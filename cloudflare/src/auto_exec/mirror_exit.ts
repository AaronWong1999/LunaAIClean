/**
 * Mirror-exit: "跟谁进场就跟谁出场" — 1:1 binding between the managed
 * position and the smart-money wallet whose buy triggered it.
 *
 * When that specific source_wallet SELLS the same market+outcome, the
 * position exits. No threshold / quorum logic — the user opted to ride
 * exactly this wallet, so this wallet's sell is the exit signal.
 *
 * exit_strategy JSON on follow_managed_positions:
 *   {"type":"mirror","source_wallet":"0x..."}    (wallet_mirror positions)
 *   {"type":"multiple","target_x":3}              (指定 Nx 全平)
 *   {"type":"double_out"}                         (翻倍 50% 出本)
 *   {"type":"manual"}                             (手动)
 */

import type { SmartMoneyFillRow } from "./types";

export type ExitStrategy =
  | { type: "mirror"; source_wallet: string }
  | { type: "multiple"; target_x: number }
  | { type: "double_out" }
  | { type: "manual" };

interface ManagedPositionRow {
  id: number;
  telegram_user_id: string;
  market_slug: string;
  outcome: string;
  entry_price: number;
  size_shares: number;
  status: string;
  exit_strategy: string | null;
}

export interface MirrorExitDecision {
  positionId: number;
  telegramUserId: string;
  marketSlug: string;
  outcome: string;
  sizeShares: number;
  reason: string;
}

/**
 * Called whenever a SELL fill lands on smart_money_fills. Finds every open
 * managed position whose exit_strategy.source_wallet equals the selling
 * wallet on the same market+outcome — those positions exit now.
 */
export async function findMirrorExits(
  db: D1Database,
  sellFill: SmartMoneyFillRow,
): Promise<MirrorExitDecision[]> {
  const rows = await db
    .prepare(
      `SELECT id, telegram_user_id, market_slug, outcome, entry_price, size_shares, status, exit_strategy
         FROM follow_managed_positions
        WHERE status = 'open'
          AND market_slug = ?
          AND outcome = ?
          AND exit_strategy IS NOT NULL`,
    )
    .bind(sellFill.market_slug, sellFill.side)
    .all<ManagedPositionRow>();

  const decisions: MirrorExitDecision[] = [];
  const sellWallet = sellFill.wallet.toLowerCase();

  for (const p of rows.results ?? []) {
    const strat = parseStrategy(p.exit_strategy);
    if (!strat || strat.type !== "mirror") continue;
    if ((strat.source_wallet ?? "").toLowerCase() !== sellWallet) continue;

    decisions.push({
      positionId: p.id,
      telegramUserId: p.telegram_user_id,
      marketSlug: p.market_slug,
      outcome: p.outcome,
      sizeShares: p.size_shares,
      reason: `mirror_exit:${sellWallet.slice(0, 10)}`,
    });
  }

  return decisions;
}

function parseStrategy(raw: string | null): ExitStrategy | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExitStrategy;
  } catch {
    return null;
  }
}

/** For the cron-driven price sweep in PositionWatcher. */
export function shouldExitOnPriceMultiple(strat: ExitStrategy | null, entryPrice: number, currentPrice: number): boolean {
  if (!strat || strat.type !== "multiple") return false;
  const target = strat.target_x;
  if (!target || target <= 1) return false;
  return currentPrice >= entryPrice * target;
}
