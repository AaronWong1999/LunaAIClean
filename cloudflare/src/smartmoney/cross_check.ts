/**
 * Cross-check: pre-news 1h window smart money signal.
 *
 * For a given news event that has been mapped to a market_slug,
 * query smart_money_fills to see if qualified wallets had net
 * buy-in ≥ $500 on the same side within the 1 hour before
 * the news was published.
 *
 * This is the "moat" — the dual-signal confirmation that no
 * competitor has (PolyCop/PolyGun/Insiders.bot are all backwards-looking).
 */

export interface CrossCheckResult {
  dualSignal: boolean;
  netBuyUsdc: number;
  matchedWallets: number;
  confidenceBoost: number; // +0.3 if dual_signal=true
}

/**
 * Run the cross-check query against D1.
 * Returns whether the dual signal is confirmed.
 */
export async function crossCheckPreNewsWindow(
  db: D1Database,
  marketSlug: string,
  selectedOutcome: string,
  newsPublishedAt: number, // Unix epoch seconds
): Promise<CrossCheckResult> {
  const windowStart = newsPublishedAt - 3600; // 1 hour before

  const result = await db
    .prepare(
      `SELECT
         SUM(amount_usdc) as net_buy_usdc,
         COUNT(DISTINCT wallet) as matched_wallets
       FROM smart_money_fills
       WHERE market_slug = ?
         AND ts BETWEEN ? AND ?
         AND side = ?
         AND wallet IN (
           SELECT address FROM smart_wallets
           WHERE seed = 1 OR qualified = 1
         )`,
    )
    .bind(marketSlug, windowStart, newsPublishedAt, selectedOutcome)
    .first<{ net_buy_usdc: number | null; matched_wallets: number }>();

  const netBuyUsdc = result?.net_buy_usdc ?? 0;
  const matchedWallets = result?.matched_wallets ?? 0;
  const dualSignal = netBuyUsdc >= 500;

  return {
    dualSignal,
    netBuyUsdc,
    matchedWallets,
    confidenceBoost: dualSignal ? 0.3 : 0,
  };
}
