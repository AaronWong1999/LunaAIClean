/**
 * Polygon WebSocket listener for Polymarket CTF Exchange events.
 * Monitors OrderFilled events from qualified smart wallets.
 *
 * Architecture: Uses Durable Object alarm-based polling of recent blocks
 * via JSON-RPC instead of persistent WebSocket (more reliable on CF Workers).
 *
 * Fills are written to smart_money_fills table with a 2-hour rolling window.
 */

// Polymarket CTF Exchange contract on Polygon
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// OrderFilled event signature: keccak256("OrderFilled(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)")
const ORDER_FILLED_TOPIC = "0xd0a08e8c493f9c94f29311604c9de1d4e1f14d2d2fe3e8e8e4eabb5b05f49a01";

interface FillEvent {
  wallet: string;
  marketSlug: string;
  side: string;
  amountUsdc: number;
  timestamp: number;
}

/**
 * Fetch recent OrderFilled logs from Polygon RPC.
 * Returns parsed fill events for known smart wallets.
 */
export async function fetchRecentFills(
  rpcUrl: string,
  fromBlock: string,
  toBlock: string,
): Promise<Array<{ wallet: string; tokenId: string; amountRaw: string; txHash: string; blockNumber: string }>> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getLogs",
    params: [
      {
        fromBlock,
        toBlock,
        address: CTF_EXCHANGE,
        topics: [ORDER_FILLED_TOPIC],
      },
    ],
  };

  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Polygon RPC ${resp.status}`);
  }

  const data = (await resp.json()) as {
    result?: Array<{
      topics: string[];
      data: string;
      transactionHash: string;
      blockNumber: string;
    }>;
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`Polygon RPC error: ${data.error.message}`);
  }

  return (data.result ?? []).map((log) => ({
    // topics[1] = maker address (padded to 32 bytes)
    wallet: "0x" + (log.topics[1]?.slice(26) ?? ""),
    tokenId: log.topics[2] ?? "",
    amountRaw: log.data.slice(0, 66), // first 32 bytes of data
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
  }));
}

/**
 * Get the latest block number from Polygon RPC.
 */
export async function getLatestBlock(rpcUrl: string): Promise<string> {
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
  });
  const data = (await resp.json()) as { result: string };
  return data.result;
}

/**
 * Clean up smart_money_fills older than 2 hours.
 */
export async function pruneOldFills(db: D1Database): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 7200; // 2 hours
  await db.prepare(`DELETE FROM smart_money_fills WHERE ts < ?`).bind(cutoff).run();
}

/**
 * Insert a fill event into D1.
 */
export async function insertSmartMoneyFill(
  db: D1Database,
  fill: {
    wallet: string;
    marketSlug: string;
    side: string;
    amountUsdc: number;
    ts: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO smart_money_fills (wallet, market_slug, side, amount_usdc, ts)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(fill.wallet, fill.marketSlug, fill.side, fill.amountUsdc, fill.ts)
    .run();
}
