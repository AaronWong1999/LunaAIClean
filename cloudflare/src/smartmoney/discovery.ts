/**
 * Smart wallet auto-discovery + periodic re-scoring.
 *
 * Two modes:
 *   - discoverFromLeaderboard(): nightly cron, pulls Polymarket data-api
 *     top PnL leaderboard (30d) and scores each against our 4-dim thresholds.
 *   - rescoreExistingWallets(): weekly, recomputes win_rate / volume / avg_hold
 *     for all seed + qualified wallets; demotes ones that no longer qualify.
 *
 * Data-api endpoint: https://data-api.polymarket.com/leaderboard?window=30d
 * (subject to change — keep permissive parsing)
 */
import { isWalletQualified } from "./scorer";

const DATA_API = "https://data-api.polymarket.com";

interface LeaderboardEntry {
  address?: string;
  proxyAddress?: string;
  pnl?: number;
  volume?: number;
  winRate?: number;
  win_rate?: number;
  avgHoldDays?: number;
  avg_hold_days?: number;
  settledCount?: number;
  settled_count?: number;
  trades?: number;
}

export interface DiscoveryStats {
  fetched: number;
  newQualified: number;
  promoted: number;
  demoted: number;
}

export async function discoverFromLeaderboard(db: D1Database): Promise<DiscoveryStats> {
  let fetched = 0;
  let newQualified = 0;
  let promoted = 0;

  const entries = await fetchLeaderboard();
  fetched = entries.length;
  const now = Math.floor(Date.now() / 1000);

  for (const e of entries) {
    const addr = (e.address ?? e.proxyAddress ?? "").toLowerCase();
    if (!addr || !addr.startsWith("0x")) continue;

    const winRate = e.winRate ?? e.win_rate ?? null;
    const volume = e.volume ?? null;
    const holdDays = e.avgHoldDays ?? e.avg_hold_days ?? null;
    const settled = e.settledCount ?? e.settled_count ?? e.trades ?? null;

    const qualified = isWalletQualified(winRate, volume, holdDays, settled);
    if (!qualified) continue;

    const existing = await db
      .prepare(`SELECT address, qualified, seed FROM smart_wallets WHERE address = ?`)
      .bind(addr)
      .first<{ address: string; qualified: number; seed: number }>();

    if (!existing) {
      await db
        .prepare(
          `INSERT INTO smart_wallets
             (address, seed, qualified, win_rate_30d, volume_30d, avg_hold_days, settled_count_30d,
              discovered_at, discovery_source, updated_at)
           VALUES (?, 0, 1, ?, ?, ?, ?, ?, 'pnl_scan', CURRENT_TIMESTAMP)`,
        )
        .bind(addr, winRate, volume, holdDays, settled, now)
        .run();
      newQualified += 1;
    } else if (!existing.qualified) {
      await db
        .prepare(
          `UPDATE smart_wallets
              SET qualified = 1,
                  win_rate_30d = ?, volume_30d = ?, avg_hold_days = ?, settled_count_30d = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE address = ?`,
        )
        .bind(winRate, volume, holdDays, settled, addr)
        .run();
      promoted += 1;
    } else {
      await db
        .prepare(
          `UPDATE smart_wallets
              SET win_rate_30d = ?, volume_30d = ?, avg_hold_days = ?, settled_count_30d = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE address = ?`,
        )
        .bind(winRate, volume, holdDays, settled, addr)
        .run();
    }
  }

  return { fetched, newQualified, promoted, demoted: 0 };
}

export async function rescoreExistingWallets(db: D1Database): Promise<DiscoveryStats> {
  const rows = await db
    .prepare(`SELECT address FROM smart_wallets WHERE seed = 1 OR qualified = 1`)
    .all<{ address: string }>();
  let demoted = 0;
  let promoted = 0;
  const now = Math.floor(Date.now() / 1000);

  for (const r of rows.results ?? []) {
    const addr = r.address.toLowerCase();
    const stats = await fetchWalletStats(addr);
    if (!stats) continue;
    const qualified = isWalletQualified(stats.winRate, stats.volume, stats.holdDays, stats.settled);

    const before = await db
      .prepare(`SELECT qualified, seed FROM smart_wallets WHERE address = ?`)
      .bind(addr)
      .first<{ qualified: number; seed: number }>();
    if (!before) continue;

    await db
      .prepare(
        `UPDATE smart_wallets
            SET qualified = ?, win_rate_30d = ?, volume_30d = ?, avg_hold_days = ?, settled_count_30d = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE address = ?`,
      )
      .bind(qualified ? 1 : 0, stats.winRate, stats.volume, stats.holdDays, stats.settled, addr)
      .run();

    // seeds never actually get demoted — we just stop counting them as qualified
    if (before.qualified && !qualified) demoted += 1;
    if (!before.qualified && qualified) promoted += 1;
  }

  return { fetched: (rows.results ?? []).length, newQualified: 0, promoted, demoted };
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  // Polymarket does not currently expose a stable leaderboard-by-pnl endpoint.
  // Best-effort: use the `traders` endpoint with window=30d sorted by pnl.
  const urls = [
    `${DATA_API}/traders?window=30d&sort=pnl&limit=200`,
    `${DATA_API}/leaderboard?window=30d&limit=200`,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url, { headers: { Accept: "application/json" } });
      if (!resp.ok) continue;
      const data = (await resp.json()) as LeaderboardEntry[] | { data?: LeaderboardEntry[]; results?: LeaderboardEntry[] };
      const list = Array.isArray(data) ? data : data.data ?? data.results ?? [];
      if (list.length > 0) return list;
    } catch {
      // try next
    }
  }
  return [];
}

async function fetchWalletStats(address: string): Promise<{
  winRate: number | null;
  volume: number | null;
  holdDays: number | null;
  settled: number | null;
} | null> {
  try {
    const url = `${DATA_API}/trader/${address}?window=30d`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return null;
    const d = (await resp.json()) as Record<string, unknown>;
    const num = (k: string): number | null => {
      const v = d[k];
      return typeof v === "number" ? v : null;
    };
    return {
      winRate: num("winRate") ?? num("win_rate"),
      volume: num("volume"),
      holdDays: num("avgHoldDays") ?? num("avg_hold_days"),
      settled: num("settledCount") ?? num("settled_count") ?? num("trades"),
    };
  } catch {
    return null;
  }
}
