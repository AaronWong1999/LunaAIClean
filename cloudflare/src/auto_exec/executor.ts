/**
 * Auto-exec orchestrator.
 *
 * Two entry points (both expected to be called from the cron / DO alarm
 * handler in index.ts — this module itself has no scheduling):
 *
 *   - processConfirmedNewsTrigger(): called after M3 cross-check flips a
 *     news_trigger to status='confirmed'. Fans out to all dual_signal rules
 *     that match the trigger's category, respecting rate caps and kill-switch.
 *
 *   - processSmartMoneyFill(): called from ingestor.ts for each new
 *     smart_money_fills row that matches a user's wallet_mirror rule.
 *     BUY fills → open position; SELL fills → mirror-exit on matching
 *     managed positions (see mirror_exit.ts).
 *
 * The actual trade placement is delegated to `placeAutoOrder()`, which the
 * caller wires to the existing TradeCoordinator Durable Object. This file
 * stays transport-agnostic.
 */
import { checkRateLimits, readSystemFlags } from "./flags";
import { loadDualSignalRules, loadWalletMirrorRulesForWallet } from "./rules";
import type { AutoExecAttempt, AutoFollowRule, NewsTriggerRow, SmartMoneyFillRow } from "./types";

export interface AutoExecContext {
  db: D1Database;
  dryRun: boolean;
  /** Delegate to TradeCoordinator / polymarket.placeOrder. `exitStrategy`
   * (JSON string) should be written onto the new managed position row. */
  placeOrder: (
    rule: AutoFollowRule,
    marketSlug: string,
    outcome: string,
    amountUsdc: number,
    exitStrategy?: string,
  ) => Promise<{ ok: true; orderId: string } | { ok: false; error: string }>;
  /** Push a TG alert to the Aaron-side admin channel. */
  notifyAdmin?: (msg: string) => Promise<void>;
  /** Optional per-trade user push. */
  notifyUser?: (telegramUserId: string, msg: string) => Promise<void>;
}

export async function processConfirmedNewsTrigger(
  ctx: AutoExecContext,
  trigger: NewsTriggerRow,
  matchedWallets: string[],
): Promise<AutoExecAttempt[]> {
  const { db, dryRun } = ctx;
  if (!trigger.market_slug || !trigger.selected_outcome) return [];
  if (trigger.dual_signal !== 1) return [];

  const rules = await loadDualSignalRules(db, trigger.category);
  if (rules.length === 0) return [];

  const attempts: AutoExecAttempt[] = [];
  for (const rule of rules) {
    if (matchedWallets.length < rule.minSmartWallets) continue;
    if ((trigger.confidence ?? 0) < rule.minConfidence) continue;

    const attempt = await runOne(ctx, rule, {
      source: "news_trigger",
      sourceRef: String(trigger.id),
      marketSlug: trigger.market_slug,
      outcome: trigger.selected_outcome,
      amount: rule.tradeAmountUsdc,
    });
    attempts.push(attempt);
  }

  if (ctx.notifyAdmin && attempts.some((a) => a.status === "placed")) {
    const placed = attempts.filter((a) => a.status === "placed");
    const total = placed.reduce((sum, a) => sum + a.tradeAmountUsdc, 0);
    await ctx.notifyAdmin(
      `🤖 AUTO-EXEC fired\n` +
        `News: ${trigger.title.slice(0, 100)}\n` +
        `Market: ${trigger.market_slug} / ${trigger.selected_outcome}\n` +
        `Smart wallets: ${matchedWallets.length}\n` +
        `Users: ${placed.length} | Total: $${total.toFixed(2)}\n` +
        `Mode: ${dryRun ? "DRY_RUN" : "LIVE"}`,
    );
  }

  return attempts;
}

export async function processSmartMoneyBuy(
  ctx: AutoExecContext,
  fill: SmartMoneyFillRow,
): Promise<AutoExecAttempt[]> {
  const { db } = ctx;
  const rules = await loadWalletMirrorRulesForWallet(db, fill.wallet);
  if (rules.length === 0) return [];

  const attempts: AutoExecAttempt[] = [];
  for (const rule of rules) {
    // For wallet_mirror positions, bind exit_strategy 1:1 to the source
    // wallet so "跟谁进场就跟谁出场". The caller (index.ts) must write
    // this onto the managed position row it creates.
    const exitStrategy = JSON.stringify({ type: "mirror", source_wallet: fill.wallet.toLowerCase() });
    const attempt = await runOne(ctx, rule, {
      source: "wallet_mirror",
      sourceRef: fill.tx_hash ?? String(fill.id),
      marketSlug: fill.market_slug,
      outcome: fill.side,
      amount: rule.tradeAmountUsdc,
      exitStrategy,
    });
    attempts.push(attempt);
  }
  return attempts;
}

async function runOne(
  ctx: AutoExecContext,
  rule: AutoFollowRule,
  target: {
    source: "news_trigger" | "wallet_mirror";
    sourceRef: string;
    marketSlug: string;
    outcome: string;
    amount: number;
    exitStrategy?: string;
  },
): Promise<AutoExecAttempt> {
  const { db, dryRun } = ctx;

  const gate = await checkRateLimits(db, rule.telegramUserId);
  if (!gate.allowed) {
    const status = gate.reason === "paused" ? "blocked_pause" : "blocked_rate";
    const att: AutoExecAttempt = {
      telegramUserId: rule.telegramUserId,
      ruleId: rule.id,
      source: target.source,
      sourceRef: target.sourceRef,
      marketSlug: target.marketSlug,
      outcome: target.outcome,
      tradeAmountUsdc: target.amount,
      status,
    };
    await writeEvent(db, att);
    return att;
  }

  if (dryRun) {
    const att: AutoExecAttempt = {
      telegramUserId: rule.telegramUserId,
      ruleId: rule.id,
      source: target.source,
      sourceRef: target.sourceRef,
      marketSlug: target.marketSlug,
      outcome: target.outcome,
      tradeAmountUsdc: target.amount,
      status: "dry_run",
    };
    await writeEvent(db, att);
    return att;
  }

  const result = await ctx.placeOrder(rule, target.marketSlug, target.outcome, target.amount, target.exitStrategy);
  const att: AutoExecAttempt = {
    telegramUserId: rule.telegramUserId,
    ruleId: rule.id,
    source: target.source,
    sourceRef: target.sourceRef,
    marketSlug: target.marketSlug,
    outcome: target.outcome,
    tradeAmountUsdc: target.amount,
    status: result.ok ? "placed" : "failed",
    error: result.ok ? undefined : result.error,
  };
  await writeEvent(db, att);

  if (ctx.notifyUser && result.ok) {
    await ctx.notifyUser(
      rule.telegramUserId,
      `⚡ Auto-copy placed\n${target.marketSlug} · ${target.outcome}\n$${target.amount.toFixed(2)} (${target.source})`,
    );
  }

  return att;
}

async function writeEvent(db: D1Database, att: AutoExecAttempt): Promise<void> {
  const ts = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO auto_exec_events
         (telegram_user_id, rule_id, source, source_ref, market_slug, outcome,
          trade_amount_usdc, status, error, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      att.telegramUserId,
      att.ruleId,
      att.source,
      att.sourceRef,
      att.marketSlug,
      att.outcome,
      att.tradeAmountUsdc,
      att.status,
      att.error ?? null,
      ts,
    )
    .run();
}

/** Convenience check — reads only, no side effects. */
export async function isAutoExecActive(db: D1Database): Promise<boolean> {
  const f = await readSystemFlags(db);
  return !f.autoExecPaused;
}
