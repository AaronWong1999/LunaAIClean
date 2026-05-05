/**
 * Smart money fills ingestor — runs every minute via cron.
 *
 * Flow:
 *   1. Determine block range (last processed block → latest block, capped at 500 blocks)
 *   2. Fetch CTF Exchange OrderFilled logs
 *   3. Filter to known smart wallets (seed OR qualified)
 *   4. Resolve token_id → market_slug via market_resolver (Gamma API + cache)
 *   5. Insert into smart_money_fills (idempotent via tx_hash+wallet+token_id unique idx)
 *   6. Prune rows older than 2h
 *   7. Update ingestor_cursor with last processed block
 *
 * This replaces the "never called" polygon_ws path. Polling every 60s gives ~30 blocks
 * per run on Polygon (2s block time). Block range is capped to prevent runaway
 * RPC cost if cron was missed.
 */
import { fetchRecentFills, getLatestBlock, insertSmartMoneyFill, pruneOldFills } from "./polygon_ws";
import { resolveTokenId } from "./market_resolver";

const CURSOR_KEY = "smart_money_fills_last_block";
const MAX_BLOCK_RANGE = 500;
const AMOUNT_SCALE = 1_000_000; // USDC has 6 decimals

export interface IngestStats {
  fromBlock: number;
  toBlock: number;
  totalLogs: number;
  smartWalletHits: number;
  inserted: number;
  skippedUnresolved: number;
}

export async function ingestSmartMoneyFills(
  db: D1Database,
  rpcUrl: string,
): Promise<IngestStats> {
  const latestHex = await getLatestBlock(rpcUrl);
  const latestBlock = parseInt(latestHex, 16);

  const cursor = await getCursor(db);
  const fromBlock = cursor == null ? latestBlock - 30 : cursor + 1;
  const toBlock = Math.min(latestBlock, fromBlock + MAX_BLOCK_RANGE - 1);

  if (toBlock < fromBlock) {
    return { fromBlock, toBlock, totalLogs: 0, smartWalletHits: 0, inserted: 0, skippedUnresolved: 0 };
  }

  const logs = await fetchRecentFills(
    rpcUrl,
    "0x" + fromBlock.toString(16),
    "0x" + toBlock.toString(16),
  );

  const smartSet = await loadSmartWalletSet(db);
  let hits = 0;
  let inserted = 0;
  let skipped = 0;

  for (const log of logs) {
    const wallet = log.wallet.toLowerCase();
    if (!smartSet.has(wallet)) continue;
    hits += 1;

    const resolved = await resolveTokenId(db, log.tokenId);
    if (!resolved) {
      skipped += 1;
      continue;
    }

    const amountUsdc = parseAmount(log.amountRaw);
    const blockNum = parseInt(log.blockNumber, 16);
    const ts = await estimateBlockTimestamp(rpcUrl, log.blockNumber);

    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO smart_money_fills
             (wallet, market_slug, side, amount_usdc, ts, token_id, tx_hash, block_number)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(wallet, resolved.marketSlug, resolved.outcome, amountUsdc, ts, log.tokenId, log.txHash, blockNum)
        .run();
      inserted += 1;
    } catch {
      // unique idx collision = already ingested; safe to ignore
    }
  }

  await pruneOldFills(db);
  await setCursor(db, toBlock);

  return { fromBlock, toBlock, totalLogs: logs.length, smartWalletHits: hits, inserted, skippedUnresolved: skipped };
}

async function getCursor(db: D1Database): Promise<number | null> {
  const row = await db
    .prepare(`SELECT value FROM system_flags WHERE key = ?`)
    .bind(CURSOR_KEY)
    .first<{ value: string }>();
  if (!row) return null;
  const n = parseInt(row.value, 10);
  return Number.isFinite(n) ? n : null;
}

async function setCursor(db: D1Database, block: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO system_flags (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(CURSOR_KEY, String(block), now)
    .run();
}

async function loadSmartWalletSet(db: D1Database): Promise<Set<string>> {
  const rows = await db
    .prepare(`SELECT address FROM smart_wallets WHERE seed = 1 OR qualified = 1`)
    .all<{ address: string }>();
  return new Set((rows.results ?? []).map((r) => r.address.toLowerCase()));
}

function parseAmount(hexAmount: string): number {
  try {
    const bi = BigInt(hexAmount);
    return Number(bi) / AMOUNT_SCALE;
  } catch {
    return 0;
  }
}

// Block timestamp cache — one RPC call per unique block per run.
const tsCache = new Map<string, number>();
async function estimateBlockTimestamp(rpcUrl: string, blockHex: string): Promise<number> {
  if (tsCache.has(blockHex)) return tsCache.get(blockHex)!;
  try {
    const resp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: [blockHex, false] }),
    });
    const data = (await resp.json()) as { result?: { timestamp?: string } };
    const tsHex = data.result?.timestamp;
    if (!tsHex) throw new Error("no ts");
    const ts = parseInt(tsHex, 16);
    tsCache.set(blockHex, ts);
    return ts;
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}

// Exported for tests / debugging — clear cache between runs.
export function _clearBlockTsCache(): void {
  tsCache.clear();
}
