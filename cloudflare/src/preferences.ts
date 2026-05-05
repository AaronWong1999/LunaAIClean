/**
 * Per-user preferences: news categories, default copy amount, default exit
 * strategy, dual-signal sensitivity. Stored in `user_preferences` (0005).
 */

import type { NewsCategory } from "./news/types";

export interface UserPreferences {
  telegramUserId: string;
  subscribedCategories: NewsCategory[];
  defaultCopyAmountUsdc: number;
  defaultExitStrategy: string; // JSON
  minDualSignalWallets: number;
  pushOnConfirmed: boolean;
}

const DEFAULTS: Omit<UserPreferences, "telegramUserId"> = {
  subscribedCategories: ["crypto", "sports"],
  defaultCopyAmountUsdc: 5,
  defaultExitStrategy: '{"type":"double_out"}',
  minDualSignalWallets: 1,
  pushOnConfirmed: true,
};

export async function loadPreferences(
  db: D1Database,
  telegramUserId: string,
): Promise<UserPreferences> {
  const row = await db
    .prepare(
      `SELECT subscribed_categories, default_copy_amount_usdc, default_exit_strategy,
              min_dual_signal_wallets, push_on_confirmed
         FROM user_preferences WHERE telegram_user_id = ?`,
    )
    .bind(telegramUserId)
    .first<{
      subscribed_categories: string;
      default_copy_amount_usdc: number;
      default_exit_strategy: string;
      min_dual_signal_wallets: number;
      push_on_confirmed: number;
    }>();
  if (!row) {
    return { telegramUserId, ...DEFAULTS };
  }
  return {
    telegramUserId,
    subscribedCategories: parseCategories(row.subscribed_categories),
    defaultCopyAmountUsdc: row.default_copy_amount_usdc,
    defaultExitStrategy: row.default_exit_strategy,
    minDualSignalWallets: row.min_dual_signal_wallets,
    pushOnConfirmed: !!row.push_on_confirmed,
  };
}

export async function savePreferences(
  db: D1Database,
  prefs: UserPreferences,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO user_preferences
         (telegram_user_id, subscribed_categories, default_copy_amount_usdc,
          default_exit_strategy, min_dual_signal_wallets, push_on_confirmed, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_user_id) DO UPDATE SET
         subscribed_categories = excluded.subscribed_categories,
         default_copy_amount_usdc = excluded.default_copy_amount_usdc,
         default_exit_strategy = excluded.default_exit_strategy,
         min_dual_signal_wallets = excluded.min_dual_signal_wallets,
         push_on_confirmed = excluded.push_on_confirmed,
         updated_at = excluded.updated_at`,
    )
    .bind(
      prefs.telegramUserId,
      JSON.stringify(prefs.subscribedCategories),
      prefs.defaultCopyAmountUsdc,
      prefs.defaultExitStrategy,
      prefs.minDualSignalWallets,
      prefs.pushOnConfirmed ? 1 : 0,
      now,
    )
    .run();
}

export async function loadSubscribersForCategory(
  db: D1Database,
  category: NewsCategory,
): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT telegram_user_id, subscribed_categories
         FROM user_preferences WHERE push_on_confirmed = 1`,
    )
    .all<{ telegram_user_id: string; subscribed_categories: string }>();
  return (rows.results ?? [])
    .filter((r) => parseCategories(r.subscribed_categories).includes(category))
    .map((r) => r.telegram_user_id);
}

function parseCategories(raw: string): NewsCategory[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return ["crypto"];
    return v.filter((c): c is NewsCategory => ["crypto", "sports", "macro", "politics"].includes(c));
  } catch {
    return ["crypto"];
  }
}
