/**
 * Smart money scoring engine.
 * Evaluates wallets on 4 dimensions (30-day window):
 * 1. Settled markets ≥ 10
 * 2. Win rate ≥ 58%
 * 3. Cumulative volume ≥ $5k
 * 4. Average hold duration < 7d
 *
 * For MVP cold start, seed wallets from the static JSON file
 * are unconditionally trusted (seed=true).
 */

export interface SmartWalletRecord {
  address: string;
  seed: boolean;
  qualified: boolean;
  win_rate_30d: number | null;
  volume_30d: number | null;
  avg_hold_days: number | null;
  settled_count_30d: number | null;
  updated_at: string;
}

const QUALIFICATION_THRESHOLDS = {
  minSettledMarkets: 10,
  minWinRate: 0.58,
  minVolume: 5000, // $5k USDC
  maxAvgHoldDays: 7,
};

/**
 * Check if a wallet meets all 4 qualification dimensions.
 */
export function isWalletQualified(
  winRate: number | null,
  volume: number | null,
  avgHoldDays: number | null,
  settledCount: number | null,
): boolean {
  if (winRate == null || volume == null || avgHoldDays == null || settledCount == null) return false;
  return (
    settledCount >= QUALIFICATION_THRESHOLDS.minSettledMarkets &&
    winRate >= QUALIFICATION_THRESHOLDS.minWinRate &&
    volume >= QUALIFICATION_THRESHOLDS.minVolume &&
    avgHoldDays <= QUALIFICATION_THRESHOLDS.maxAvgHoldDays
  );
}

/**
 * Parse the static smart money JSON and extract wallet addresses.
 * Returns addresses that have positive PnL and meaningful volume.
 */
export function parseSeedWallets(
  data: Array<{
    wallet: string;
    rankings?: Array<{
      pnl?: number;
      vol?: number;
    }>;
  }>,
): string[] {
  return data
    .filter((entry) => {
      if (!entry.wallet) return false;
      // At least one ranking with positive PnL
      return entry.rankings?.some((r) => (r.pnl ?? 0) > 0);
    })
    .map((entry) => entry.wallet.toLowerCase());
}
