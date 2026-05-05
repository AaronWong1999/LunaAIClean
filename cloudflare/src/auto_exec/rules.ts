/**
 * Auto-follow rule CRUD + loaders.
 */
import type { AutoFollowMode, AutoFollowRule } from "./types";

interface RuleRow {
  id: number;
  telegram_user_id: string;
  mode: string;
  enabled: number;
  categories: string | null;
  min_smart_wallets: number | null;
  min_net_buy_usdc: number | null;
  min_confidence: number | null;
  tracked_wallets: string | null;
  trade_amount_usdc: number;
  max_trades_per_hour: number;
}

function mapRow(r: RuleRow): AutoFollowRule {
  return {
    id: r.id,
    telegramUserId: r.telegram_user_id,
    mode: r.mode as AutoFollowMode,
    enabled: !!r.enabled,
    categories: parseJsonArray(r.categories),
    minSmartWallets: r.min_smart_wallets ?? 1,
    minNetBuyUsdc: r.min_net_buy_usdc ?? 500,
    minConfidence: r.min_confidence ?? 0.6,
    trackedWallets: parseJsonArray(r.tracked_wallets).map((a) => a.toLowerCase()),
    tradeAmountUsdc: r.trade_amount_usdc,
    maxTradesPerHour: r.max_trades_per_hour,
  };
}

export async function loadDualSignalRules(
  db: D1Database,
  category: string,
): Promise<AutoFollowRule[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM auto_follow_rules
         WHERE mode = 'dual_signal' AND enabled = 1`,
    )
    .all<RuleRow>();
  return (rows.results ?? [])
    .map(mapRow)
    .filter((rule) => rule.categories.length === 0 || rule.categories.includes(category));
}

export async function loadWalletMirrorRulesForWallet(
  db: D1Database,
  walletAddress: string,
): Promise<AutoFollowRule[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM auto_follow_rules
         WHERE mode = 'wallet_mirror' AND enabled = 1`,
    )
    .all<RuleRow>();
  const addr = walletAddress.toLowerCase();
  return (rows.results ?? [])
    .map(mapRow)
    .filter((rule) => rule.trackedWallets.includes(addr));
}

export async function upsertRule(
  db: D1Database,
  rule: Omit<AutoFollowRule, "id">,
  existingId?: number,
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  if (existingId) {
    await db
      .prepare(
        `UPDATE auto_follow_rules
            SET mode = ?, enabled = ?, categories = ?, min_smart_wallets = ?,
                min_net_buy_usdc = ?, min_confidence = ?, tracked_wallets = ?,
                trade_amount_usdc = ?, max_trades_per_hour = ?, updated_at = ?
          WHERE id = ? AND telegram_user_id = ?`,
      )
      .bind(
        rule.mode,
        rule.enabled ? 1 : 0,
        JSON.stringify(rule.categories),
        rule.minSmartWallets,
        rule.minNetBuyUsdc,
        rule.minConfidence,
        JSON.stringify(rule.trackedWallets),
        rule.tradeAmountUsdc,
        rule.maxTradesPerHour,
        now,
        existingId,
        rule.telegramUserId,
      )
      .run();
    return existingId;
  }

  const res = await db
    .prepare(
      `INSERT INTO auto_follow_rules
         (telegram_user_id, mode, enabled, categories, min_smart_wallets,
          min_net_buy_usdc, min_confidence, tracked_wallets,
          trade_amount_usdc, max_trades_per_hour, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      rule.telegramUserId,
      rule.mode,
      rule.enabled ? 1 : 0,
      JSON.stringify(rule.categories),
      rule.minSmartWallets,
      rule.minNetBuyUsdc,
      rule.minConfidence,
      JSON.stringify(rule.trackedWallets),
      rule.tradeAmountUsdc,
      rule.maxTradesPerHour,
      now,
      now,
    )
    .run();
  return Number(res.meta.last_row_id ?? 0);
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
