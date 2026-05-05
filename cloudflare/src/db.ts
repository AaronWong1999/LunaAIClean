import type {
  Env,
  MarketLinkResolutionRecord,
  RuntimeSignal,
  RuntimeWalletProfile,
  TelegramUser,
  UserRecord,
  UserAccountExportSessionRecord,
  UserAccountLinkSessionRecord,
  UserAccountRestoreSessionRecord,
  UserSafeOnboardingSessionRecord,
  UserAccountWithdrawSessionRecord,
  UserTradingAccountArchiveRecord,
  UserTradingAccountContext,
  UserTradingAccountRecord,
  UserTradingAccountSecretPayload,
  UserTradingCredentialsRecord,
  WalletStateSnapshot,
  FollowTaskRecord,
  FollowManagedPositionDbRecord,
} from "./types";
import { decryptUserTradingPayload, encryptUserTradingPayload } from "./accounts";

export async function upsertUser(
  db: D1Database,
  payload: {
    telegramUserId: string;
    telegramChatId: string;
    botId?: string;
    from?: TelegramUser;
  },
): Promise<UserRecord> {
  await db
    .prepare(
      `INSERT INTO users (telegram_user_id, telegram_chat_id, username, first_name, last_name, language, bot_id, subscribed, sports_enabled, push_enabled, push_min_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 1, 80)
       ON CONFLICT(telegram_user_id) DO UPDATE SET
         telegram_chat_id = excluded.telegram_chat_id,
         username = excluded.username,
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         bot_id = COALESCE(excluded.bot_id, users.bot_id),
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      payload.telegramUserId,
      payload.telegramChatId,
      payload.from?.username ?? null,
      payload.from?.first_name ?? null,
      payload.from?.last_name ?? null,
      inferLanguage(payload.from?.language_code),
      payload.botId ?? "primary",
    )
    .run();

  const row = await db
    .prepare(`SELECT * FROM users WHERE telegram_user_id = ?`)
    .bind(payload.telegramUserId)
    .first<UserRecord>();

  if (!row) {
    throw new Error("Failed to upsert user");
  }
  return row;
}

export async function getUser(db: D1Database, telegramUserId: string): Promise<UserRecord | null> {
  const row = await db.prepare(`SELECT * FROM users WHERE telegram_user_id = ?`).bind(telegramUserId).first<UserRecord>();
  return row ?? null;
}

export async function updateUserPreferences(
  db: D1Database,
  telegramUserId: string,
  payload: {
    sportsEnabled?: boolean;
    pushEnabled?: boolean;
    pushMinScore?: number;
  },
): Promise<UserRecord> {
  const current = await getUser(db, telegramUserId);
  if (!current) {
    throw new Error("User not found");
  }

  const sportsEnabled = payload.sportsEnabled ?? Boolean(current.sports_enabled);
  const pushEnabled = payload.pushEnabled ?? Boolean(current.push_enabled);
  const pushMinScore = payload.pushMinScore ?? Number(current.push_min_score ?? 80);

  await db
    .prepare(
      `UPDATE users
       SET sports_enabled = ?,
           push_enabled = ?,
           push_min_score = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE telegram_user_id = ?`,
    )
    .bind(sportsEnabled ? 1 : 0, pushEnabled ? 1 : 0, pushMinScore, telegramUserId)
    .run();

  const updated = await getUser(db, telegramUserId);
  if (!updated) {
    throw new Error("Failed to update user preferences");
  }
  return updated;
}

export async function updateUserGamification(db: D1Database, telegramUserId: string): Promise<void> {
  const user = await getUser(db, telegramUserId);
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const lastTradeDate = user.last_trade_date ?? null;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let newStreak = Number(user.trade_streak ?? 0);
  if (lastTradeDate === today) {
    // Already traded today — just add XP
  } else if (lastTradeDate === yesterday) {
    // Consecutive day — extend streak
    newStreak += 1;
  } else {
    // Streak broken or first trade
    newStreak = 1;
  }

  const bonusXp = newStreak >= 7 ? 30 : newStreak >= 3 ? 15 : 0;
  const newXp = Number(user.total_xp ?? 0) + 10 + bonusXp;

  await db
    .prepare(`UPDATE users SET trade_streak = ?, total_xp = ?, last_trade_date = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ?`)
    .bind(newStreak, newXp, today, telegramUserId)
    .run();
}

export async function listTrackedWallets(db: D1Database, telegramUserId: string): Promise<string[]> {
  const result = await db
    .prepare(`SELECT wallet_address FROM tracked_wallets WHERE telegram_user_id = ? ORDER BY created_at DESC`)
    .bind(telegramUserId)
    .all<{ wallet_address: string }>();
  return (result.results ?? []).map((row) => row.wallet_address);
}

export async function addTrackedWallet(db: D1Database, telegramUserId: string, walletAddress: string): Promise<void> {
  await db
    .prepare(`INSERT OR IGNORE INTO tracked_wallets (telegram_user_id, wallet_address) VALUES (?, ?)`)
    .bind(telegramUserId, walletAddress.toLowerCase())
    .run();
}

export async function listFollowTasks(db: D1Database, telegramUserId: string): Promise<FollowTaskRecord[]> {
  const result = await db
    .prepare(`SELECT * FROM follow_tasks WHERE telegram_user_id = ? ORDER BY status DESC, updated_at DESC, id DESC`)
    .bind(telegramUserId)
    .all<FollowTaskRecord>();
  return result.results ?? [];
}

export async function listActiveFollowTasksByWallet(
  db: D1Database,
  walletAddress: string,
  payload?: { scope?: "all" | "sports" },
): Promise<FollowTaskRecord[]> {
  const normalized = walletAddress.toLowerCase();
  if (payload?.scope === "sports") {
    const result = await db
      .prepare(
        `SELECT *
         FROM follow_tasks
         WHERE wallet_address = ?
           AND status = 'active'
           AND scope = 'sports'
         ORDER BY updated_at DESC, id DESC`,
      )
      .bind(normalized)
      .all<FollowTaskRecord>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(
      `SELECT *
       FROM follow_tasks
       WHERE wallet_address = ?
         AND status = 'active'
         AND (scope = 'all' OR scope = ?)
       ORDER BY updated_at DESC, id DESC`,
    )
    .bind(normalized, payload?.scope === "sports" ? "sports" : "all")
    .all<FollowTaskRecord>();
  return result.results ?? [];
}

export async function getFollowTask(db: D1Database, telegramUserId: string, id: number): Promise<FollowTaskRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM follow_tasks WHERE telegram_user_id = ? AND id = ?`)
    .bind(telegramUserId, id)
    .first<FollowTaskRecord>();
  return row ?? null;
}

export async function touchFollowTaskTriggeredAt(db: D1Database, telegramUserId: string, id: number): Promise<void> {
  await db
    .prepare(
      `UPDATE follow_tasks
       SET last_triggered_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE telegram_user_id = ? AND id = ?`,
    )
    .bind(telegramUserId, id)
    .run();
}

export async function upsertRuntimeWalletMetrics(
  db: D1Database,
  payload: {
    address: string;
    settledTradeCount?: number | null;
    avgHoldingPeriodHours?: number | null;
    kellyConsistencyScore?: number | null;
    copySuitabilityScore?: number | null;
  },
): Promise<void> {
  const row = await db
    .prepare(`SELECT address FROM runtime_wallet_profiles WHERE lower(address) = lower(?)`)
    .bind(payload.address)
    .first<{ address: string }>();
  if (!row?.address) {
    throw new Error("runtime wallet profile not found");
  }
  await db
    .prepare(
      `UPDATE runtime_wallet_profiles
       SET settled_trade_count = COALESCE(?, settled_trade_count),
           avg_holding_period_hours = COALESCE(?, avg_holding_period_hours),
           kelly_consistency_score = COALESCE(?, kelly_consistency_score),
           copy_suitability_score = COALESCE(?, copy_suitability_score)
       WHERE address = ?`,
    )
    .bind(
      payload.settledTradeCount ?? null,
      payload.avgHoldingPeriodHours ?? null,
      payload.kellyConsistencyScore ?? null,
      payload.copySuitabilityScore ?? null,
      row.address,
    )
    .run();
}

export async function upsertFollowTask(
  db: D1Database,
  payload: {
    telegramUserId: string;
    walletAddress: string;
    walletName?: string | null;
    walletScore?: number | null;
    walletSpecialty?: string | null;
    scope: "all" | "sports";
    copyAmountUsdc: number;
    maxPerTradeUsdc: number;
    minTradeThresholdUsdc: number;
    direction: "both" | "buy_only" | "sell_only";
    executionMode: "cautious" | "standard" | "expert";
    takeProfitMode?: "none" | "double_out" | "fixed_pct";
    takeProfitBps?: number | null;
    stopLossBps?: number | null;
    maxOpenPositions?: number | null;
    cooldownSec?: number | null;
    status?: "active" | "paused";
    source?: "manual" | "ai_copydesk";
  },
): Promise<FollowTaskRecord> {
  await db
    .prepare(
      `INSERT INTO follow_tasks
       (telegram_user_id, wallet_address, wallet_name, wallet_score, wallet_specialty, scope, sizing_mode, copy_amount_usdc, max_per_trade_usdc, min_trade_threshold_usdc, direction, execution_mode, take_profit_mode, take_profit_bps, stop_loss_bps, max_open_positions, cooldown_sec, status, source)
       VALUES (?, ?, ?, ?, ?, ?, 'fixed_usdc', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_user_id, wallet_address, scope) DO UPDATE SET
         wallet_name = excluded.wallet_name,
         wallet_score = excluded.wallet_score,
         wallet_specialty = excluded.wallet_specialty,
         copy_amount_usdc = excluded.copy_amount_usdc,
         max_per_trade_usdc = excluded.max_per_trade_usdc,
         min_trade_threshold_usdc = excluded.min_trade_threshold_usdc,
         direction = excluded.direction,
         execution_mode = excluded.execution_mode,
         take_profit_mode = excluded.take_profit_mode,
         take_profit_bps = excluded.take_profit_bps,
         stop_loss_bps = excluded.stop_loss_bps,
         max_open_positions = excluded.max_open_positions,
         cooldown_sec = excluded.cooldown_sec,
         status = excluded.status,
         source = excluded.source,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      payload.telegramUserId,
      payload.walletAddress.toLowerCase(),
      payload.walletName ?? null,
      payload.walletScore ?? null,
      payload.walletSpecialty ?? null,
      payload.scope,
      payload.copyAmountUsdc,
      payload.maxPerTradeUsdc,
      payload.minTradeThresholdUsdc,
      payload.direction,
      payload.executionMode,
      payload.takeProfitMode ?? "none",
      payload.takeProfitBps ?? null,
      payload.stopLossBps ?? null,
      payload.maxOpenPositions ?? 3,
      payload.cooldownSec ?? 30,
      payload.status ?? "active",
      payload.source ?? "manual",
    )
    .run();

  const row = await db
    .prepare(`SELECT * FROM follow_tasks WHERE telegram_user_id = ? AND wallet_address = ? AND scope = ?`)
    .bind(payload.telegramUserId, payload.walletAddress.toLowerCase(), payload.scope)
    .first<FollowTaskRecord>();
  if (!row) throw new Error("Failed to upsert follow task");
  return row;
}

export async function getMarketLinkResolution(db: D1Database, url: string): Promise<MarketLinkResolutionRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM market_link_resolutions WHERE url = ?`)
    .bind(url)
    .first<MarketLinkResolutionRecord>();
  return row ?? null;
}

export async function upsertMarketLinkResolution(
  db: D1Database,
  payload: {
    url: string;
    slug: string;
    outcome?: string | null;
    tokenId?: string | null;
    titleEn?: string | null;
    titleZh?: string | null;
    marketUrl?: string | null;
    detailJson?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO market_link_resolutions
       (url, slug, outcome, token_id, title_en, title_zh, market_url, detail_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(url) DO UPDATE SET
         slug = excluded.slug,
         outcome = excluded.outcome,
         token_id = excluded.token_id,
         title_en = excluded.title_en,
         title_zh = excluded.title_zh,
         market_url = excluded.market_url,
         detail_json = excluded.detail_json,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      payload.url,
      payload.slug,
      payload.outcome ?? null,
      payload.tokenId ?? null,
      payload.titleEn ?? null,
      payload.titleZh ?? null,
      payload.marketUrl ?? null,
      payload.detailJson ? JSON.stringify(payload.detailJson) : null,
    )
    .run();
}

export async function listNewsTriggers(
  db: D1Database,
  payload?: { status?: string; limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const limit = Math.max(1, Math.min(payload?.limit ?? 20, 100));
  if (payload?.status) {
    const result = await db
      .prepare(`SELECT * FROM news_triggers WHERE status = ? ORDER BY updated_at DESC, id DESC LIMIT ?`)
      .bind(payload.status, limit)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(`SELECT * FROM news_triggers ORDER BY updated_at DESC, id DESC LIMIT ?`)
    .bind(limit)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function updateNewsTriggerMapping(
  db: D1Database,
  id: number,
  payload: {
    marketSlug: string | null;
    selectedOutcome: string | null;
    confidence: number;
    status: string;
    detailJson?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE news_triggers SET
        market_slug = ?, selected_outcome = ?, confidence = ?,
        status = ?, detail_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      payload.marketSlug,
      payload.selectedOutcome,
      payload.confidence,
      payload.status,
      payload.detailJson ? JSON.stringify(payload.detailJson) : null,
      id,
    )
    .run();
}

export async function updateNewsTriggerDualSignal(
  db: D1Database,
  id: number,
  dualSignal: boolean,
  confidence: number,
  status: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE news_triggers SET dual_signal = ?, confidence = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(dualSignal ? 1 : 0, confidence, status, id)
    .run();
}

export async function upsertNewsTrigger(
  db: D1Database,
  payload: {
    source: string;
    sourceKey: string;
    title: string;
    body?: string | null;
    lang?: string;
    publishedAt?: number | null;
    marketSlug?: string | null;
    selectedOutcome?: string | null;
    confidence?: number | null;
    dualSignal?: boolean;
    status?: string;
    executionRef?: string | null;
    detailJson?: unknown;
    category?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO news_triggers
       (source, source_key, title, body, lang, published_at, market_slug, selected_outcome, confidence, dual_signal, status, execution_ref, detail_json, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(source, source_key) DO NOTHING`,
    )
    .bind(
      payload.source,
      payload.sourceKey,
      payload.title,
      payload.body ?? null,
      payload.lang ?? "en",
      payload.publishedAt ?? null,
      payload.marketSlug ?? null,
      payload.selectedOutcome ?? null,
      payload.confidence ?? null,
      payload.dualSignal ? 1 : 0,
      payload.status ?? "detected",
      payload.executionRef ?? null,
      payload.detailJson ? JSON.stringify(payload.detailJson) : null,
      payload.category ?? "crypto",
    )
    .run();
}

export async function upsertNewsSourceHealth(
  db: D1Database,
  source: string,
  success: boolean,
  error?: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  if (success) {
    await db
      .prepare(
        `INSERT INTO news_source_health (source, last_heartbeat, consecutive_failures, updated_at)
         VALUES (?, ?, 0, CURRENT_TIMESTAMP)
         ON CONFLICT(source) DO UPDATE SET
           last_heartbeat = excluded.last_heartbeat,
           consecutive_failures = 0,
           last_error = NULL,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(source, now)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO news_source_health (source, last_heartbeat, consecutive_failures, last_error, updated_at)
         VALUES (?, 0, 1, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(source) DO UPDATE SET
           consecutive_failures = news_source_health.consecutive_failures + 1,
           last_error = excluded.last_error,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(source, error ?? "unknown")
      .run();
  }
}

export async function listNewsSourceHealth(
  db: D1Database,
): Promise<Array<{ source: string; last_heartbeat: number; consecutive_failures: number; last_error: string | null }>> {
  const result = await db
    .prepare(`SELECT source, last_heartbeat, consecutive_failures, last_error FROM news_source_health ORDER BY source`)
    .all<{ source: string; last_heartbeat: number; consecutive_failures: number; last_error: string | null }>();
  return result.results ?? [];
}

export async function listArbOpportunities(
  db: D1Database,
  payload?: { status?: string; limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const limit = Math.max(1, Math.min(payload?.limit ?? 20, 100));
  if (payload?.status) {
    const result = await db
      .prepare(`SELECT * FROM arb_opportunities WHERE status = ? ORDER BY updated_at DESC, id DESC LIMIT ?`)
      .bind(payload.status, limit)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(`SELECT * FROM arb_opportunities ORDER BY updated_at DESC, id DESC LIMIT ?`)
    .bind(limit)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function upsertArbOpportunity(
  db: D1Database,
  payload: {
    polymarketSlug: string;
    kalshiTicker?: string | null;
    spreadBps?: number;
    netEdgeBps?: number;
    liquidityScore?: number | null;
    status?: string;
    detailJson?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO arb_opportunities
       (polymarket_slug, kalshi_ticker, spread_bps, net_edge_bps, liquidity_score, status, detail_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
    .bind(
      payload.polymarketSlug,
      payload.kalshiTicker ?? null,
      payload.spreadBps ?? 0,
      payload.netEdgeBps ?? 0,
      payload.liquidityScore ?? null,
      payload.status ?? "open",
      payload.detailJson ? JSON.stringify(payload.detailJson) : null,
    )
    .run();
}

export async function updateFollowTaskStatus(
  db: D1Database,
  telegramUserId: string,
  id: number,
  status: "active" | "paused",
): Promise<FollowTaskRecord | null> {
  await db
    .prepare(`UPDATE follow_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ? AND id = ?`)
    .bind(status, telegramUserId, id)
    .run();
  return getFollowTask(db, telegramUserId, id);
}

export async function listOpenFollowManagedPositions(
  db: D1Database,
  payload?: { telegramUserId?: string; taskId?: number },
): Promise<FollowManagedPositionDbRecord[]> {
  if (payload?.telegramUserId) {
    const result = await db
      .prepare(
        `SELECT *
         FROM follow_managed_positions
         WHERE telegram_user_id = ?
           AND status IN ('open', 'partial')
         ORDER BY updated_at DESC`,
      )
      .bind(payload.telegramUserId)
      .all<FollowManagedPositionDbRecord>();
    return result.results ?? [];
  }
  if (typeof payload?.taskId === "number") {
    const result = await db
      .prepare(
        `SELECT *
         FROM follow_managed_positions
         WHERE task_id = ?
           AND status IN ('open', 'partial')
         ORDER BY updated_at DESC`,
      )
      .bind(payload.taskId)
      .all<FollowManagedPositionDbRecord>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(
      `SELECT *
       FROM follow_managed_positions
       WHERE status IN ('open', 'partial')
       ORDER BY updated_at DESC`,
    )
    .all<FollowManagedPositionDbRecord>();
  return result.results ?? [];
}

export async function upsertFollowManagedPosition(
  db: D1Database,
  payload: {
    key: string;
    telegramUserId: string;
    taskId: number;
    walletAddress: string;
    marketSlug: string;
    tokenId: string;
    title: string;
    outcome: string;
    entryPrice: number;
    amountUsdc: number;
    principalUsdc: number;
    estimatedShares: number;
    remainingShares: number;
    takeProfitMode: string;
    takeProfitBps?: number | null;
    stopLossBps?: number | null;
    doubleOutDone?: boolean;
    status?: "open" | "partial" | "closed";
    lastExitReason?: string | null;
    openedAt: string;
    closedAt?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO follow_managed_positions
       (position_key, telegram_user_id, task_id, wallet_address, market_slug, token_id, title, outcome, entry_price, amount_usdc, principal_usdc, estimated_shares, remaining_shares, take_profit_mode, take_profit_bps, stop_loss_bps, double_out_done, status, last_exit_reason, opened_at, closed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(position_key) DO UPDATE SET
         telegram_user_id = excluded.telegram_user_id,
         task_id = excluded.task_id,
         wallet_address = excluded.wallet_address,
         market_slug = excluded.market_slug,
         token_id = excluded.token_id,
         title = excluded.title,
         outcome = excluded.outcome,
         entry_price = excluded.entry_price,
         amount_usdc = excluded.amount_usdc,
         principal_usdc = excluded.principal_usdc,
         estimated_shares = excluded.estimated_shares,
         remaining_shares = excluded.remaining_shares,
         take_profit_mode = excluded.take_profit_mode,
         take_profit_bps = excluded.take_profit_bps,
         stop_loss_bps = excluded.stop_loss_bps,
         double_out_done = excluded.double_out_done,
         status = excluded.status,
         last_exit_reason = excluded.last_exit_reason,
         opened_at = excluded.opened_at,
         closed_at = excluded.closed_at,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      payload.key,
      payload.telegramUserId,
      payload.taskId,
      payload.walletAddress.toLowerCase(),
      payload.marketSlug,
      payload.tokenId,
      payload.title,
      payload.outcome,
      payload.entryPrice,
      payload.amountUsdc,
      payload.principalUsdc,
      payload.estimatedShares,
      payload.remainingShares,
      payload.takeProfitMode,
      payload.takeProfitBps ?? null,
      payload.stopLossBps ?? null,
      payload.doubleOutDone ? 1 : 0,
      payload.status ?? "open",
      payload.lastExitReason ?? null,
      payload.openedAt,
      payload.closedAt ?? null,
    )
    .run();
}

export async function recordExecutionEvent(
  db: D1Database,
  payload: {
    telegramUserId: string;
    eventType: string;
    entityType?: string | null;
    entityKey?: string | null;
    status?: string;
    detailJson?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO execution_events
       (telegram_user_id, event_type, entity_type, entity_key, status, detail_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      payload.telegramUserId,
      payload.eventType,
      payload.entityType ?? null,
      payload.entityKey ?? null,
      payload.status ?? "recorded",
      payload.detailJson ? JSON.stringify(payload.detailJson) : null,
    )
    .run();
}

export async function listExecutionEvents(
  db: D1Database,
  payload?: {
    telegramUserId?: string;
    entityType?: string;
    eventType?: string;
    limit?: number;
  },
): Promise<Array<Record<string, unknown>>> {
  const limit = Math.max(1, Math.min(payload?.limit ?? 50, 200));
  if (payload?.telegramUserId) {
    const result = await db
      .prepare(
        `SELECT *
         FROM execution_events
         WHERE telegram_user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(payload.telegramUserId, limit)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (payload?.entityType) {
    const result = await db
      .prepare(
        `SELECT *
         FROM execution_events
         WHERE entity_type = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(payload.entityType, limit)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (payload?.eventType) {
    const result = await db
      .prepare(
        `SELECT *
         FROM execution_events
         WHERE event_type = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(payload.eventType, limit)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(
      `SELECT *
       FROM execution_events
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function getReferralAttribution(
  db: D1Database,
  refereeTelegramUserId: string,
): Promise<{ referee_telegram_user_id: string; referrer_telegram_user_id: string; attribution_source: string; created_at: string } | null> {
  const row = await db
    .prepare(`SELECT * FROM referral_attributions WHERE referee_telegram_user_id = ?`)
    .bind(refereeTelegramUserId)
    .first<any>();
  return row ?? null;
}

export async function createReferralAttribution(
  db: D1Database,
  payload: {
    refereeTelegramUserId: string;
    referrerTelegramUserId: string;
    attributionSource?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO referral_attributions
       (referee_telegram_user_id, referrer_telegram_user_id, attribution_source)
       VALUES (?, ?, ?)`,
    )
    .bind(
      payload.refereeTelegramUserId,
      payload.referrerTelegramUserId,
      payload.attributionSource ?? "telegram_start",
    )
    .run();
}

export async function getRuntimeSignals(db: D1Database): Promise<RuntimeSignal[]> {
  const result = await db.prepare(`SELECT * FROM runtime_signals ORDER BY id ASC`).all<RuntimeSignal>();
  return result.results ?? [];
}

export async function getTopRuntimeSignals(
  db: D1Database,
  payload?: { sports?: 0 | 1; limit?: number },
): Promise<RuntimeSignal[]> {
  const limit = Math.max(1, Math.min(payload?.limit ?? 5, 20));
  if (typeof payload?.sports === "number") {
    const result = await db
      .prepare(`SELECT * FROM runtime_signals WHERE sports = ? ORDER BY score DESC, id ASC LIMIT ?`)
      .bind(payload.sports, limit)
      .all<RuntimeSignal>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(`SELECT * FROM runtime_signals ORDER BY score DESC, id ASC LIMIT ?`)
    .bind(limit)
    .all<RuntimeSignal>();
  return result.results ?? [];
}

export async function getRuntimeSignal(db: D1Database, signalId: number): Promise<RuntimeSignal | null> {
  const row = await db.prepare(`SELECT * FROM runtime_signals WHERE id = ?`).bind(signalId).first<RuntimeSignal>();
  return row ?? null;
}

export async function getRuntimeWallets(db: D1Database): Promise<RuntimeWalletProfile[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM runtime_wallet_profiles
       ORDER BY COALESCE(copy_suitability_score, score) DESC,
                COALESCE(kelly_consistency_score, score) DESC,
                score DESC,
                name ASC`,
    )
    .all<RuntimeWalletProfile>();
  return result.results ?? [];
}

export async function getTopRuntimeWallets(db: D1Database, limit = 5): Promise<RuntimeWalletProfile[]> {
  const bounded = Math.max(1, Math.min(limit, 20));
  const result = await db
    .prepare(
      `SELECT *
       FROM runtime_wallet_profiles
       ORDER BY COALESCE(copy_suitability_score, score) DESC,
                COALESCE(kelly_consistency_score, score) DESC,
                score DESC,
                name ASC
       LIMIT ?`,
    )
    .bind(bounded)
    .all<RuntimeWalletProfile>();
  return result.results ?? [];
}

export async function getSportsSignals(db: D1Database): Promise<RuntimeSignal[]> {
  const result = await db.prepare(`SELECT * FROM runtime_signals WHERE sports = 1 ORDER BY score DESC, id ASC`).all<RuntimeSignal>();
  return result.results ?? [];
}

export async function getRuntimeMeta(db: D1Database): Promise<Record<string, unknown>> {
  const row = await db.prepare(`SELECT payload_json FROM runtime_meta WHERE singleton_key = 'runtime'`).first<{ payload_json: string }>();
  return row?.payload_json ? JSON.parse(row.payload_json) : {};
}

export async function replaceSportsSignals(
  db: D1Database,
  payload: {
    signals: RuntimeSignal[];
    generatedAt: string;
  },
): Promise<{ totalSignals: number; sportsSignals: number }> {
  const nonSportsMeta = await db
    .prepare(
      `SELECT
         COALESCE(MAX(CASE WHEN sports = 0 THEN id END), 0) AS max_non_sports_id,
         SUM(CASE WHEN sports = 0 THEN 1 ELSE 0 END) AS non_sports_count
       FROM runtime_signals`,
    )
    .first<{ max_non_sports_id: number | null; non_sports_count: number | null }>();

  const maxNonSportsId = Number(nonSportsMeta?.max_non_sports_id ?? 0);
  const nonSportsCount = Number(nonSportsMeta?.non_sports_count ?? 0);

  await db.prepare(`DELETE FROM runtime_signals WHERE sports = 1`).run();

  if (payload.signals.length) {
    await db.batch(
      payload.signals.map((signal, index) =>
        db
          .prepare(
            `INSERT INTO runtime_signals
             (id, slug, title_en, title_zh, action_en, action_zh, score, current_price, expected_return, daily_return, liquidity, expiry_en, expiry_zh, source_count, detail_url, market_url, analysis_en, analysis_zh, selected_outcome, sports, status_en, status_zh, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            maxNonSportsId + index + 1,
            signal.slug,
            signal.title_en,
            signal.title_zh,
            signal.action_en,
            signal.action_zh,
            signal.score,
            signal.current_price,
            signal.expected_return,
            signal.daily_return,
            signal.liquidity,
            signal.expiry_en,
            signal.expiry_zh,
            signal.source_count,
            signal.detail_url,
            signal.market_url,
            signal.analysis_en,
            signal.analysis_zh,
            signal.selected_outcome,
            1,
            signal.status_en,
            signal.status_zh,
            payload.generatedAt,
          ),
      ),
    );
  }

  const totalSignals = nonSportsCount + payload.signals.length;
  return {
    totalSignals,
    sportsSignals: payload.signals.length,
  };
}

export async function updateRuntimeMeta(
  db: D1Database,
  payload: {
    generatedAt: string;
    signalCount: number;
    sportsSignalCount: number;
  },
): Promise<void> {
  const current = await db
    .prepare(
      `SELECT generated_at, duration_sec, wallet_count, signal_count, top_wallet, top_signal, payload_json
       FROM runtime_meta WHERE singleton_key = 'runtime'`,
    )
    .first<{
      generated_at: string | null;
      duration_sec: number | null;
      wallet_count: number | null;
      signal_count: number | null;
      top_wallet: string | null;
      top_signal: string | null;
      payload_json: string | null;
    }>();

  const currentPayload = current?.payload_json ? JSON.parse(current.payload_json) as Record<string, unknown> : {};
  const nextPayload = {
    ...currentPayload,
    generated_at: payload.generatedAt,
    signal_count: payload.signalCount,
    sports_signal_count: payload.sportsSignalCount,
  };

  await db
    .prepare(
      `INSERT INTO runtime_meta (singleton_key, generated_at, duration_sec, wallet_count, signal_count, top_wallet, top_signal, payload_json, updated_at)
       VALUES ('runtime', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(singleton_key) DO UPDATE SET
         generated_at = excluded.generated_at,
         duration_sec = excluded.duration_sec,
         wallet_count = excluded.wallet_count,
         signal_count = excluded.signal_count,
         top_wallet = excluded.top_wallet,
         top_signal = excluded.top_signal,
         payload_json = excluded.payload_json,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      payload.generatedAt,
      current?.duration_sec ?? null,
      current?.wallet_count ?? null,
      payload.signalCount,
      current?.top_wallet ?? null,
      current?.top_signal ?? null,
      JSON.stringify(nextPayload),
    )
    .run();
}

export async function getSignalHistorySummary(db: D1Database): Promise<{
  total: number;
  won: number;
  lost: number;
  open: number;
  settled: number;
  win_rate: number;
  recent_settled: Array<{ title_en?: string; title_zh?: string; status_en?: string; status_zh?: string }>;
}> {
  const result = await db
    .prepare(`SELECT payload_json FROM signal_history_snapshots ORDER BY generated_at DESC LIMIT 3`)
    .all<{ payload_json: string }>();
  const snapshots = (result.results ?? []).map((row) => JSON.parse(row.payload_json));
  const deduped = new Map<string, Record<string, unknown>>();

  for (const snapshot of snapshots) {
    for (const item of (snapshot.signals ?? []) as Array<Record<string, unknown>>) {
      const key = `${String(item.slug ?? item.title_en ?? item.title_zh ?? "unknown")}::${String(item.selected_outcome ?? item.action_en ?? item.action_zh ?? "")}`;
      const existing = deduped.get(key);
      const existingResolved = existing ? ["Won", "Lost"].includes(String(existing.status_en ?? "")) : false;
      const nextResolved = ["Won", "Lost"].includes(String(item.status_en ?? ""));
      if (existingResolved && !nextResolved) continue;
      deduped.set(key, item);
    }
  }

  const values = Array.from(deduped.values());
  const won = values.filter((item) => item.status_en === "Won").length;
  const lost = values.filter((item) => item.status_en === "Lost").length;
  const settled = won + lost;
  const total = values.length;
  const open = total - settled;
  const recentSettled = values
    .filter((item) => item.status_en === "Won" || item.status_en === "Lost")
    .slice(-3)
    .reverse()
    .map((item) => ({
      title_en: item.title_en as string | undefined,
      title_zh: item.title_zh as string | undefined,
      status_en: item.status_en as string | undefined,
      status_zh: (item.status_en === "Won" ? "已赢" : "已输") as string | undefined,
    }));

  return {
    total,
    won,
    lost,
    open,
    settled,
    win_rate: settled ? (won / settled) * 100 : 0,
    recent_settled: recentSettled,
  };
}

export async function upsertWalletSnapshot(db: D1Database, telegramUserId: string, snapshot: WalletStateSnapshot): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_wallet_state (telegram_user_id, deposit_address, last_balance_usdc, last_positions_count, last_open_orders_count, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_user_id) DO UPDATE SET
         deposit_address = excluded.deposit_address,
         last_balance_usdc = excluded.last_balance_usdc,
         last_positions_count = excluded.last_positions_count,
         last_open_orders_count = excluded.last_open_orders_count,
         status = excluded.status,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(telegramUserId, snapshot.depositAddress, snapshot.balanceUsdc, snapshot.positionsCount, snapshot.openOrdersCount, snapshot.status ?? null)
    .run();
}

export async function getUserWalletState(db: D1Database, telegramUserId: string): Promise<{
  deposit_address: string | null;
  last_balance_usdc: number;
  last_positions_count: number;
  last_open_orders_count: number;
  status: string | null;
  updated_at: string;
} | null> {
  const row = await db
    .prepare(`SELECT * FROM user_wallet_state WHERE telegram_user_id = ?`)
    .bind(telegramUserId)
    .first<any>();
  return row ?? null;
}

export async function getUserTradingAccount(db: D1Database, telegramUserId: string): Promise<UserTradingAccountRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM user_trading_accounts WHERE telegram_user_id = ?`)
    .bind(telegramUserId)
    .first<UserTradingAccountRecord>();
  return row ?? null;
}

export async function listUserTradingAccounts(
  db: D1Database,
  payload?: { status?: UserTradingAccountRecord["status"]; limit?: number },
): Promise<UserTradingAccountRecord[]> {
  const limit = Math.max(1, Math.min(payload?.limit ?? 100, 500));
  if (payload?.status) {
    const result = await db
      .prepare(`SELECT * FROM user_trading_accounts WHERE status = ? ORDER BY updated_at DESC LIMIT ?`)
      .bind(payload.status, limit)
      .all<UserTradingAccountRecord>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(`SELECT * FROM user_trading_accounts ORDER BY updated_at DESC LIMIT ?`)
    .bind(limit)
    .all<UserTradingAccountRecord>();
  return result.results ?? [];
}

export async function upsertUserTradingAccount(
  db: D1Database,
  payload: {
    telegramUserId: string;
    status: UserTradingAccountRecord["status"];
    authMode: UserTradingAccountRecord["auth_mode"];
    relayerTxType?: UserTradingAccountRecord["relayer_tx_type"];
    safeDeployed?: boolean;
    signatureType?: string;
    accountLabel?: string;
    signerAddress?: string;
    funderAddress?: string;
    depositAddressEvm?: string;
    depositAddressSvm?: string;
    depositAddressBtc?: string;
    depositAddressTron?: string;
    builderEnabled?: boolean;
    geoblockBlocked?: boolean;
    geoblockCountry?: string;
    geoblockRegion?: string;
    geoblockCheckedAt?: string;
    lastVerifiedAt?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_trading_accounts
       (telegram_user_id, status, auth_mode, relayer_tx_type, safe_deployed, signature_type, account_label, signer_address, funder_address, deposit_address_evm, deposit_address_svm, deposit_address_btc, deposit_address_tron, builder_enabled, geoblock_blocked, geoblock_country, geoblock_region, geoblock_checked_at, last_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_user_id) DO UPDATE SET
         status = excluded.status,
         auth_mode = excluded.auth_mode,
         relayer_tx_type = excluded.relayer_tx_type,
         safe_deployed = excluded.safe_deployed,
         signature_type = excluded.signature_type,
         account_label = excluded.account_label,
         signer_address = excluded.signer_address,
         funder_address = excluded.funder_address,
         deposit_address_evm = excluded.deposit_address_evm,
         deposit_address_svm = excluded.deposit_address_svm,
         deposit_address_btc = excluded.deposit_address_btc,
         deposit_address_tron = excluded.deposit_address_tron,
         builder_enabled = excluded.builder_enabled,
         geoblock_blocked = CASE
           WHEN excluded.geoblock_checked_at IS NOT NULL THEN excluded.geoblock_blocked
           ELSE user_trading_accounts.geoblock_blocked
         END,
         geoblock_country = CASE
           WHEN excluded.geoblock_checked_at IS NOT NULL THEN excluded.geoblock_country
           ELSE user_trading_accounts.geoblock_country
         END,
         geoblock_region = CASE
           WHEN excluded.geoblock_checked_at IS NOT NULL THEN excluded.geoblock_region
           ELSE user_trading_accounts.geoblock_region
         END,
         geoblock_checked_at = COALESCE(excluded.geoblock_checked_at, user_trading_accounts.geoblock_checked_at),
         last_verified_at = excluded.last_verified_at,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      payload.telegramUserId,
      payload.status,
      payload.authMode,
      payload.relayerTxType ?? null,
      payload.safeDeployed ? 1 : 0,
      payload.signatureType ?? null,
      payload.accountLabel ?? null,
      payload.signerAddress?.toLowerCase() ?? null,
      payload.funderAddress?.toLowerCase() ?? null,
      payload.depositAddressEvm ?? null,
      payload.depositAddressSvm ?? null,
      payload.depositAddressBtc ?? null,
      payload.depositAddressTron ?? null,
      payload.builderEnabled ? 1 : 0,
      payload.geoblockBlocked === undefined ? 0 : payload.geoblockBlocked ? 1 : 0,
      payload.geoblockCountry ?? null,
      payload.geoblockRegion ?? null,
      payload.geoblockCheckedAt ?? null,
      payload.lastVerifiedAt ?? null,
    )
    .run();
}

export async function saveUserTradingCredentials(
  env: Env,
  payload: {
    telegramUserId: string;
    credentials: UserTradingAccountSecretPayload;
  },
): Promise<void> {
  const encryptedPayload = await encryptUserTradingPayload(env, payload.credentials);
  await env.DB
    .prepare(
      `INSERT INTO user_trading_credentials (telegram_user_id, encrypted_payload, encryption_version)
       VALUES (?, ?, 'v1')
       ON CONFLICT(telegram_user_id) DO UPDATE SET
         encrypted_payload = excluded.encrypted_payload,
         encryption_version = excluded.encryption_version,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(payload.telegramUserId, encryptedPayload)
    .run();
}

export async function getUserTradingCredentials(env: Env, telegramUserId: string): Promise<UserTradingCredentialsRecord | null> {
  const row = await env.DB
    .prepare(`SELECT * FROM user_trading_credentials WHERE telegram_user_id = ?`)
    .bind(telegramUserId)
    .first<UserTradingCredentialsRecord>();
  return row ?? null;
}

export async function getUserTradingAccountContext(env: Env, telegramUserId: string): Promise<UserTradingAccountContext | null> {
  const account = await getUserTradingAccount(env.DB, telegramUserId);
  if (!account) return null;
  const encrypted = await getUserTradingCredentials(env, telegramUserId);
  if (!encrypted) return { account };
  const credentials = await decryptUserTradingPayload(env, encrypted.encrypted_payload);
  return { account, credentials };
}

export async function archiveUserTradingAccountState(
  env: Env,
  payload: {
    telegramUserId: string;
    reason: string;
  },
): Promise<void> {
  const [account, credentials] = await Promise.all([
    getUserTradingAccount(env.DB, payload.telegramUserId),
    getUserTradingCredentials(env, payload.telegramUserId),
  ]);
  if (!account) return;
  await env.DB
    .prepare(
      `INSERT INTO user_trading_account_archives (telegram_user_id, reason, account_json, encrypted_payload)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(
      payload.telegramUserId,
      payload.reason,
      JSON.stringify(account),
      credentials?.encrypted_payload ?? null,
    )
    .run();
}

export async function getLatestArchivedUserTradingAccountContext(
  env: Env,
  telegramUserId: string,
): Promise<UserTradingAccountContext | null> {
  const row = await env.DB
    .prepare(
      `SELECT * FROM user_trading_account_archives
       WHERE telegram_user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    )
    .bind(telegramUserId)
    .first<UserTradingAccountArchiveRecord>();
  if (!row) return null;
  const account = JSON.parse(row.account_json) as UserTradingAccountRecord;
  if (!row.encrypted_payload) {
    return { account };
  }
  const credentials = await decryptUserTradingPayload(env, row.encrypted_payload);
  return { account, credentials };
}

export async function createUserAccountLinkSession(
  db: D1Database,
  payload: {
    tokenHash: string;
    telegramUserId: string;
    expiresAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_account_link_sessions (token_hash, telegram_user_id, status, expires_at)
       VALUES (?, ?, 'open', ?)`,
    )
    .bind(payload.tokenHash, payload.telegramUserId, payload.expiresAt)
    .run();
}

export async function getUserAccountLinkSession(
  db: D1Database,
  tokenHash: string,
): Promise<UserAccountLinkSessionRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM user_account_link_sessions WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<UserAccountLinkSessionRecord>();
  return row ?? null;
}

export async function markUserAccountLinkSessionUsed(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare(
      `UPDATE user_account_link_sessions
       SET status = 'used',
           used_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .run();
}

export async function createUserAccountExportSession(
  db: D1Database,
  payload: {
    tokenHash: string;
    telegramUserId: string;
    expiresAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_account_export_sessions (token_hash, telegram_user_id, status, expires_at)
       VALUES (?, ?, 'open', ?)`,
    )
    .bind(payload.tokenHash, payload.telegramUserId, payload.expiresAt)
    .run();
}

export async function getUserAccountExportSession(
  db: D1Database,
  tokenHash: string,
): Promise<UserAccountExportSessionRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM user_account_export_sessions WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<UserAccountExportSessionRecord>();
  return row ?? null;
}

export async function markUserAccountExportSessionUsed(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare(
      `UPDATE user_account_export_sessions
       SET status = 'used',
           used_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .run();
}

export async function createUserAccountRestoreSession(
  db: D1Database,
  payload: {
    tokenHash: string;
    telegramUserId: string;
    expiresAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_account_restore_sessions (token_hash, telegram_user_id, status, expires_at)
       VALUES (?, ?, 'open', ?)`,
    )
    .bind(payload.tokenHash, payload.telegramUserId, payload.expiresAt)
    .run();
}

export async function getUserAccountRestoreSession(
  db: D1Database,
  tokenHash: string,
): Promise<UserAccountRestoreSessionRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM user_account_restore_sessions WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<UserAccountRestoreSessionRecord>();
  return row ?? null;
}

export async function markUserAccountRestoreSessionUsed(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare(
      `UPDATE user_account_restore_sessions
       SET status = 'used',
           used_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .run();
}

export async function createUserAccountWithdrawSession(
  db: D1Database,
  payload: {
    tokenHash: string;
    telegramUserId: string;
    expiresAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_account_withdraw_sessions (token_hash, telegram_user_id, status, expires_at)
       VALUES (?, ?, 'open', ?)`,
    )
    .bind(payload.tokenHash, payload.telegramUserId, payload.expiresAt)
    .run();
}

export async function createUserSafeOnboardingSession(
  db: D1Database,
  payload: {
    tokenHash: string;
    telegramUserId: string;
    expiresAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_safe_onboarding_sessions (token_hash, telegram_user_id, status, expires_at)
       VALUES (?, ?, 'open', ?)`,
    )
    .bind(payload.tokenHash, payload.telegramUserId, payload.expiresAt)
    .run();
}

export async function getUserSafeOnboardingSession(
  db: D1Database,
  tokenHash: string,
): Promise<UserSafeOnboardingSessionRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM user_safe_onboarding_sessions WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<UserSafeOnboardingSessionRecord>();
  return row ?? null;
}

export async function markUserSafeOnboardingSessionUsed(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare(
      `UPDATE user_safe_onboarding_sessions
       SET status = 'used',
           used_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .run();
}

export async function getUserAccountWithdrawSession(
  db: D1Database,
  tokenHash: string,
): Promise<UserAccountWithdrawSessionRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM user_account_withdraw_sessions WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<UserAccountWithdrawSessionRecord>();
  return row ?? null;
}

export async function markUserAccountWithdrawSessionUsed(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare(
      `UPDATE user_account_withdraw_sessions
       SET status = 'used',
           used_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .run();
}

export async function hasIdempotencyKey(db: D1Database, key: string): Promise<boolean> {
  const row = await db.prepare(`SELECT idempotency_key FROM idempotency_keys WHERE idempotency_key = ?`).bind(key).first();
  return !!row;
}

export async function saveIdempotencyKey(db: D1Database, key: string, scope: string, resultJson: unknown): Promise<void> {
  await db
    .prepare(`INSERT OR REPLACE INTO idempotency_keys (idempotency_key, scope, result_json) VALUES (?, ?, ?)`)
    .bind(key, scope, JSON.stringify(resultJson))
    .run();
}

export async function saveTradeEvent(
  db: D1Database,
  payload: {
    telegramUserId: string;
    eventType: string;
    signalId?: number;
    title?: string;
    outcome?: string;
    tokenId?: string;
    amountUsdc?: number;
    shares?: number;
    status: string;
    orderId?: string;
    txHash?: string;
    payloadJson?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO trade_events
       (telegram_user_id, event_type, signal_id, title, outcome, token_id, amount_usdc, shares, status, order_id, tx_hash, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      payload.telegramUserId,
      payload.eventType,
      payload.signalId ?? null,
      payload.title ?? null,
      payload.outcome ?? null,
      payload.tokenId ?? null,
      payload.amountUsdc ?? null,
      payload.shares ?? null,
      payload.status,
      payload.orderId ?? null,
      payload.txHash ?? null,
      payload.payloadJson ? JSON.stringify(payload.payloadJson) : null,
    )
    .run();
}

export async function recordFeeLedger(
  db: D1Database,
  payload: {
    telegramUserId: string;
    signalId?: number;
    tradeEventType: string;
    grossAmountUsdc: number;
    platformFeeUsdc: number;
    netTradeAmountUsdc: number;
    feeBps: number;
    feeWallet?: string;
    status: string;
    detail?: string;
    metadataJson?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fee_ledger
       (telegram_user_id, signal_id, trade_event_type, gross_amount_usdc, platform_fee_usdc, net_trade_amount_usdc, fee_bps, fee_wallet, status, detail, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      payload.telegramUserId,
      payload.signalId ?? null,
      payload.tradeEventType,
      payload.grossAmountUsdc,
      payload.platformFeeUsdc,
      payload.netTradeAmountUsdc,
      payload.feeBps,
      payload.feeWallet ?? null,
      payload.status,
      payload.detail ?? null,
      payload.metadataJson ? JSON.stringify(payload.metadataJson) : null,
    )
    .run();
}

export async function getLatestFeeLedgerId(db: D1Database, telegramUserId: string): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT id
       FROM fee_ledger
       WHERE telegram_user_id = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .bind(telegramUserId)
    .first<{ id: number | null }>();
  return row?.id != null ? Number(row.id) : null;
}

export async function recordFeeRevenueAllocations(
  db: D1Database,
  payload: {
    feeLedgerId: number;
    telegramUserId: string;
    allocations: Array<{
      bucket: string;
      amountUsdc: number;
      destinationWallet?: string;
      status?: string;
      detail?: string;
    }>;
  },
): Promise<void> {
  if (!payload.allocations.length) return;
  const statements = payload.allocations.map((allocation) =>
    db
      .prepare(
        `INSERT INTO fee_revenue_allocations
         (fee_ledger_id, telegram_user_id, bucket, amount_usdc, destination_wallet, status, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        payload.feeLedgerId,
        payload.telegramUserId,
        allocation.bucket,
        allocation.amountUsdc,
        allocation.destinationWallet ?? null,
        allocation.status ?? "reserved",
        allocation.detail ?? null,
      ),
  );
  await db.batch(statements);
}

export async function updateFeeLedgerSettlement(
  db: D1Database,
  payload: {
    feeLedgerId: number;
    status: string;
    settlementTxRef?: string;
    detail?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE fee_ledger
       SET status = ?,
           settlement_tx_ref = COALESCE(?, settlement_tx_ref),
           settled_at = CASE WHEN ? = 'settled' THEN CURRENT_TIMESTAMP ELSE settled_at END,
           detail = COALESCE(?, detail)
       WHERE id = ?`,
    )
    .bind(
      payload.status,
      payload.settlementTxRef ?? null,
      payload.status,
      payload.detail ?? null,
      payload.feeLedgerId,
    )
    .run();
}

export async function updateFeeRevenueAllocationStatus(
  db: D1Database,
  payload: {
    feeLedgerId: number;
    status: string;
    detail?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE fee_revenue_allocations
       SET status = ?,
           detail = COALESCE(?, detail),
           updated_at = CURRENT_TIMESTAMP
       WHERE fee_ledger_id = ?`,
    )
    .bind(payload.status, payload.detail ?? null, payload.feeLedgerId)
    .run();
}

export async function listFeeLedger(
  db: D1Database,
  payload?: {
    limit?: number;
    status?: string;
    telegramUserId?: string;
  },
): Promise<
  Array<{
    id: number;
    telegram_user_id: string;
    signal_id: number | null;
    trade_event_type: string;
    gross_amount_usdc: number;
    platform_fee_usdc: number;
    net_trade_amount_usdc: number;
    fee_bps: number;
    fee_wallet: string | null;
    status: string;
    settlement_batch_id: string | null;
    settlement_tx_ref: string | null;
    settled_at: string | null;
    detail: string | null;
    metadata_json: string | null;
    created_at: string;
  }>
> {
  const limit = Math.max(1, Math.min(payload?.limit ?? 50, 200));
  if (payload?.status && payload?.telegramUserId) {
    const result = await db
      .prepare(
        `SELECT *
         FROM fee_ledger
         WHERE status = ?
           AND telegram_user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(payload.status, payload.telegramUserId, limit)
      .all<any>();
    return result.results ?? [];
  }

  if (payload?.telegramUserId) {
    const result = await db
      .prepare(
        `SELECT *
         FROM fee_ledger
         WHERE telegram_user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(payload.telegramUserId, limit)
      .all<any>();
    return result.results ?? [];
  }

  if (payload?.status) {
    const result = await db
      .prepare(
        `SELECT *
         FROM fee_ledger
         WHERE status = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(payload.status, limit)
      .all<{
        id: number;
        telegram_user_id: string;
        signal_id: number | null;
        trade_event_type: string;
        gross_amount_usdc: number;
        platform_fee_usdc: number;
        net_trade_amount_usdc: number;
        fee_bps: number;
        fee_wallet: string | null;
        status: string;
        settlement_batch_id: string | null;
        settlement_tx_ref: string | null;
        settled_at: string | null;
        detail: string | null;
        metadata_json: string | null;
        created_at: string;
      }>();
    return result.results ?? [];
  }

  const result = await db
    .prepare(
      `SELECT *
       FROM fee_ledger
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{
      id: number;
      telegram_user_id: string;
      signal_id: number | null;
      trade_event_type: string;
      gross_amount_usdc: number;
      platform_fee_usdc: number;
      net_trade_amount_usdc: number;
      fee_bps: number;
      fee_wallet: string | null;
      status: string;
      settlement_batch_id: string | null;
      settlement_tx_ref: string | null;
      settled_at: string | null;
      detail: string | null;
      metadata_json: string | null;
      created_at: string;
    }>();
  return result.results ?? [];
}

export async function listTradeEvents(
  db: D1Database,
  payload: { telegramUserId: string; limit?: number },
): Promise<
  Array<{
    id: number;
    telegram_user_id: string;
    event_type: string;
    signal_id: number | null;
    title: string | null;
    outcome: string | null;
    token_id: string | null;
    amount_usdc: number | null;
    shares: number | null;
    status: string;
    order_id: string | null;
    tx_hash: string | null;
    payload_json: string | null;
    created_at: string;
  }>
> {
  const limit = Math.max(1, Math.min(payload.limit ?? 20, 50));
  const result = await db
    .prepare(
      `SELECT *
       FROM trade_events
       WHERE telegram_user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(payload.telegramUserId, limit)
    .all<any>();
  return result.results ?? [];
}

export async function recordReferralEvent(
  db: D1Database,
  payload: {
    referrerTelegramUserId: string;
    refereeTelegramUserId: string;
    botId?: string;
    feeLedgerId?: number;
    tier?: string;
    discountBps?: number;
    rebateBps?: number;
    creatorTelegramUserId?: string | null;
    amountUsdc: number;
    detail?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO referral_events
       (referrer_telegram_user_id, referee_telegram_user_id, bot_id, fee_ledger_id, event_type, tier, discount_bps, rebate_bps, creator_telegram_user_id, amount_usdc, detail)
       VALUES (?, ?, ?, ?, 'trade_fee_share', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      payload.referrerTelegramUserId,
      payload.refereeTelegramUserId,
      payload.botId ?? "primary",
      payload.feeLedgerId ?? null,
      payload.tier ?? "standard",
      payload.discountBps ?? 0,
      payload.rebateBps ?? 0,
      payload.creatorTelegramUserId ?? null,
      payload.amountUsdc,
      payload.detail ?? null,
    )
    .run();
}

export async function listReferralEvents(
  db: D1Database,
  payload: { referrerTelegramUserId: string; limit?: number },
): Promise<
  Array<{
    id: number;
    referrer_telegram_user_id: string;
    referee_telegram_user_id: string;
    fee_ledger_id: number | null;
    event_type: string;
    amount_usdc: number;
    detail: string | null;
    created_at: string;
  }>
> {
  const limit = Math.max(1, Math.min(payload.limit ?? 20, 100));
  const result = await db
    .prepare(
      `SELECT *
       FROM referral_events
       WHERE referrer_telegram_user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(payload.referrerTelegramUserId, limit)
    .all<any>();
  return result.results ?? [];
}

export async function listTopReferrers(
  db: D1Database,
  payload?: { limit?: number },
): Promise<
  Array<{
    telegram_user_id: string;
    username: string | null;
    first_name: string | null;
    referral_count: number;
    referral_earned_usdc: number;
    trade_count: number;
    gross_amount_usdc: number;
  }>
> {
  const limit = Math.max(1, Math.min(payload?.limit ?? 10, 50));
  const result = await db
    .prepare(
      `SELECT
         u.telegram_user_id,
         u.username,
         u.first_name,
         COALESCE(r.referral_count, 0) AS referral_count,
         COALESCE(r.referral_earned_usdc, 0) AS referral_earned_usdc,
         COALESCE(f.trade_count, 0) AS trade_count,
         COALESCE(f.gross_amount_usdc, 0) AS gross_amount_usdc
       FROM users u
       LEFT JOIN (
         SELECT
           referrer_telegram_user_id,
           COUNT(DISTINCT referee_telegram_user_id) AS referral_count,
           COALESCE(SUM(amount_usdc), 0) AS referral_earned_usdc
         FROM referral_events
         GROUP BY referrer_telegram_user_id
       ) r ON r.referrer_telegram_user_id = u.telegram_user_id
       LEFT JOIN (
         SELECT telegram_user_id, COUNT(*) AS trade_count, COALESCE(SUM(gross_amount_usdc), 0) AS gross_amount_usdc
         FROM fee_ledger
         GROUP BY telegram_user_id
       ) f ON f.telegram_user_id = u.telegram_user_id
       WHERE COALESCE(r.referral_count, 0) > 0 OR COALESCE(f.trade_count, 0) > 0
       GROUP BY u.telegram_user_id, u.username, u.first_name, r.referral_count, r.referral_earned_usdc, f.trade_count, f.gross_amount_usdc
       ORDER BY referral_earned_usdc DESC, referral_count DESC, gross_amount_usdc DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<any>();
  return result.results ?? [];
}

export async function recordWithdrawalRequest(
  db: D1Database,
  payload: {
    telegramUserId: string;
    destinationChain: string;
    destinationChainId: string;
    destinationTokenSymbol: string;
    destinationTokenAddress: string;
    recipientAddress: string;
    bridgeAddress: string;
    amountUsdc: number;
    amountBaseUnits: string;
    quoteId?: string;
    quoteJson?: unknown;
    status: string;
    bridgeStatus?: string;
    sourceTransactionId?: string;
    sourceTransactionState?: string;
    sourceTxHash?: string;
    bridgeTxHash?: string;
    detail?: string;
  },
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO withdrawal_requests
       (telegram_user_id, destination_chain, destination_chain_id, destination_token_symbol, destination_token_address, recipient_address, bridge_address, amount_usdc, amount_base_units, quote_id, quote_json, status, bridge_status, source_transaction_id, source_transaction_state, source_tx_hash, bridge_tx_hash, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      payload.telegramUserId,
      payload.destinationChain,
      payload.destinationChainId,
      payload.destinationTokenSymbol,
      payload.destinationTokenAddress,
      payload.recipientAddress,
      payload.bridgeAddress,
      payload.amountUsdc,
      payload.amountBaseUnits,
      payload.quoteId ?? null,
      payload.quoteJson ? JSON.stringify(payload.quoteJson) : null,
      payload.status,
      payload.bridgeStatus ?? null,
      payload.sourceTransactionId ?? null,
      payload.sourceTransactionState ?? null,
      payload.sourceTxHash ?? null,
      payload.bridgeTxHash ?? null,
      payload.detail ?? null,
    )
    .run();
  return Number(result.meta.last_row_id ?? 0);
}

export async function listWithdrawalRequests(
  db: D1Database,
  payload: { telegramUserId?: string; status?: string; limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const limit = Math.max(1, Math.min(payload.limit ?? 20, 100));
  if (payload.telegramUserId && payload.status) {
    const result = await db
      .prepare(
        `SELECT *
         FROM withdrawal_requests
         WHERE telegram_user_id = ? AND status = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(payload.telegramUserId, payload.status, limit)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (payload.telegramUserId) {
    const result = await db
      .prepare(
        `SELECT *
         FROM withdrawal_requests
         WHERE telegram_user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(payload.telegramUserId, limit)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (payload.status) {
    const result = await db
      .prepare(
        `SELECT *
         FROM withdrawal_requests
         WHERE status = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(payload.status, limit)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(`SELECT * FROM withdrawal_requests ORDER BY created_at DESC, id DESC LIMIT ?`)
    .bind(limit)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function updateWithdrawalRequest(
  db: D1Database,
  payload: {
    id: number;
    status: string;
    bridgeStatus?: string;
    sourceTransactionId?: string;
    sourceTransactionState?: string;
    sourceTxHash?: string;
    bridgeTxHash?: string;
    detail?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE withdrawal_requests
       SET status = ?,
           bridge_status = COALESCE(?, bridge_status),
           source_transaction_id = COALESCE(?, source_transaction_id),
           source_transaction_state = COALESCE(?, source_transaction_state),
           source_tx_hash = COALESCE(?, source_tx_hash),
           bridge_tx_hash = COALESCE(?, bridge_tx_hash),
           detail = COALESCE(?, detail),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      payload.status,
      payload.bridgeStatus ?? null,
      payload.sourceTransactionId ?? null,
      payload.sourceTransactionState ?? null,
      payload.sourceTxHash ?? null,
      payload.bridgeTxHash ?? null,
      payload.detail ?? null,
      payload.id,
    )
    .run();
}

export async function upsertTradeSettlement(
  db: D1Database,
  payload: {
    telegramUserId: string;
    tradeEventId: number;
    marketSlug: string;
    title?: string;
    selectedOutcome?: string;
    winningOutcome?: string | null;
    settlementStatus: string;
    redeemableAmountUsdc?: number | null;
    resolvedAt?: string | null;
    detailJson?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO trade_settlements
       (telegram_user_id, trade_event_id, market_slug, title, selected_outcome, winning_outcome, settlement_status, redeemable_amount_usdc, resolved_at, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(trade_event_id) DO UPDATE SET
         winning_outcome = excluded.winning_outcome,
         settlement_status = excluded.settlement_status,
         redeemable_amount_usdc = excluded.redeemable_amount_usdc,
         resolved_at = excluded.resolved_at,
         detail_json = excluded.detail_json,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      payload.telegramUserId,
      payload.tradeEventId,
      payload.marketSlug,
      payload.title ?? null,
      payload.selectedOutcome ?? null,
      payload.winningOutcome ?? null,
      payload.settlementStatus,
      payload.redeemableAmountUsdc ?? null,
      payload.resolvedAt ?? null,
      payload.detailJson ? JSON.stringify(payload.detailJson) : null,
    )
    .run();
}

export async function updateTradeSettlementRedemption(
  db: D1Database,
  payload: {
    tradeEventId: number;
    settlementStatus: string;
    redeemableAmountUsdc?: number | null;
    detailJson?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE trade_settlements
       SET settlement_status = ?,
           redeemable_amount_usdc = ?,
           detail_json = COALESCE(?, detail_json),
           updated_at = CURRENT_TIMESTAMP
       WHERE trade_event_id = ?`,
    )
    .bind(
      payload.settlementStatus,
      payload.redeemableAmountUsdc ?? null,
      payload.detailJson ? JSON.stringify(payload.detailJson) : null,
      payload.tradeEventId,
    )
    .run();
}

export async function listTradeSettlements(
  db: D1Database,
  payload: { telegramUserId: string; limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const limit = Math.max(1, Math.min(payload.limit ?? 20, 100));
  const result = await db
    .prepare(
      `SELECT *
       FROM trade_settlements
       WHERE telegram_user_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(payload.telegramUserId, limit)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listBuilderAttributionEvents(
  db: D1Database,
  payload: { telegramUserId: string; limit?: number },
): Promise<
  Array<{
    id: number;
    telegram_user_id: string;
    signal_id: number | null;
    action: string;
    builder_enabled: number;
    builder_key_hint: string | null;
    order_id: string | null;
    tx_hash: string | null;
    payload_json: string | null;
    created_at: string;
  }>
> {
  const limit = Math.max(1, Math.min(payload.limit ?? 20, 50));
  const result = await db
    .prepare(
      `SELECT *
       FROM builder_attribution_events
       WHERE telegram_user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(payload.telegramUserId, limit)
    .all<any>();
  return result.results ?? [];
}

export async function getUserMonetizationSummary(
  db: D1Database,
  telegramUserId: string,
): Promise<{
  tradeCount: number;
  grossAmountUsdc: number;
  platformFeeUsdc: number;
  netTradeAmountUsdc: number;
  unsettledFeeUsdc: number;
  settledFeeUsdc: number;
  builderEventCount: number;
  referralCount: number;
  referralEarnedUsdc: number;
}> {
  const feeRow = await db
    .prepare(
      `SELECT
         COUNT(*) AS fee_ledger_count,
         COALESCE(SUM(gross_amount_usdc), 0) AS gross_amount_usdc,
         COALESCE(SUM(platform_fee_usdc), 0) AS platform_fee_usdc,
         COALESCE(SUM(net_trade_amount_usdc), 0) AS net_trade_amount_usdc,
         COALESCE(SUM(CASE WHEN status = 'accrued_unsettled' THEN platform_fee_usdc ELSE 0 END), 0) AS unsettled_fee_usdc,
         COALESCE(SUM(CASE WHEN status = 'settled' THEN platform_fee_usdc ELSE 0 END), 0) AS settled_fee_usdc
       FROM fee_ledger
       WHERE telegram_user_id = ?`,
    )
    .bind(telegramUserId)
    .first<any>();

  const builderRow = await db
    .prepare(
      `SELECT COUNT(*) AS builder_event_count
       FROM builder_attribution_events
       WHERE telegram_user_id = ?`,
    )
    .bind(telegramUserId)
    .first<{ builder_event_count: number | null }>();

  const referralRow = await db
    .prepare(
      `SELECT
         COUNT(DISTINCT referee_telegram_user_id) AS referral_count,
         COALESCE(SUM(amount_usdc), 0) AS referral_earned_usdc
       FROM referral_events
       WHERE referrer_telegram_user_id = ?`,
    )
    .bind(telegramUserId)
    .first<{ referral_count: number | null; referral_earned_usdc: number | null }>();

  return {
    tradeCount: Number(feeRow?.fee_ledger_count ?? 0),
    grossAmountUsdc: Number(feeRow?.gross_amount_usdc ?? 0),
    platformFeeUsdc: Number(feeRow?.platform_fee_usdc ?? 0),
    netTradeAmountUsdc: Number(feeRow?.net_trade_amount_usdc ?? 0),
    unsettledFeeUsdc: Number(feeRow?.unsettled_fee_usdc ?? 0),
    settledFeeUsdc: Number(feeRow?.settled_fee_usdc ?? 0),
    builderEventCount: Number(builderRow?.builder_event_count ?? 0),
    referralCount: Number(referralRow?.referral_count ?? 0),
    referralEarnedUsdc: Number(referralRow?.referral_earned_usdc ?? 0),
  };
}

export async function settleAccruedFees(
  db: D1Database,
  payload: {
    batchId: string;
    settlementTxRef?: string;
    note?: string;
  },
): Promise<{ rowsUpdated: number; totalFeeUsdc: number }> {
  const unsettled = await db
    .prepare(
      `SELECT
         COUNT(*) AS row_count,
         COALESCE(SUM(platform_fee_usdc), 0) AS total_fee_usdc
       FROM fee_ledger
       WHERE status = 'accrued_unsettled'`,
    )
    .first<{ row_count: number | null; total_fee_usdc: number | null }>();

  const rowCount = Number(unsettled?.row_count ?? 0);
  const totalFeeUsdc = Number(unsettled?.total_fee_usdc ?? 0);
  if (!rowCount) {
    return { rowsUpdated: 0, totalFeeUsdc: 0 };
  }

  const nextDetail = payload.note ?? "marked settled by internal operator";
  await db
    .prepare(
      `UPDATE fee_ledger
       SET status = 'settled',
           settlement_batch_id = ?,
           settlement_tx_ref = ?,
           settled_at = CURRENT_TIMESTAMP,
           detail = ?
       WHERE status = 'accrued_unsettled'`,
    )
    .bind(payload.batchId, payload.settlementTxRef ?? null, nextDetail)
    .run();

  return {
    rowsUpdated: rowCount,
    totalFeeUsdc,
  };
}

export async function recordBuilderAttributionEvent(
  db: D1Database,
  payload: {
    telegramUserId: string;
    signalId?: number;
    action: string;
    builderEnabled: boolean;
    builderKeyHint?: string;
    orderId?: string;
    txHash?: string;
    payloadJson?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO builder_attribution_events
       (telegram_user_id, signal_id, action, builder_enabled, builder_key_hint, order_id, tx_hash, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      payload.telegramUserId,
      payload.signalId ?? null,
      payload.action,
      payload.builderEnabled ? 1 : 0,
      payload.builderKeyHint ?? null,
      payload.orderId ?? null,
      payload.txHash ?? null,
      payload.payloadJson ? JSON.stringify(payload.payloadJson) : null,
    )
    .run();
}

export async function recordCronRun(db: D1Database, jobName: string, status: string, detail?: string): Promise<void> {
  await db
    .prepare(`INSERT INTO cron_runs (job_name, status, detail) VALUES (?, ?, ?)`)
    .bind(jobName, status, detail ?? null)
    .run();
}

export async function listSportsPushRecipients(db: D1Database, minScore: number): Promise<Array<Pick<UserRecord, "telegram_user_id" | "telegram_chat_id" | "language">>> {
  const result = await db
    .prepare(
      `SELECT telegram_user_id, telegram_chat_id, language
       FROM users
       WHERE subscribed = 1
         AND push_enabled = 1
         AND push_min_score <= ?
       ORDER BY updated_at DESC`,
    )
    .bind(minScore)
    .all<Pick<UserRecord, "telegram_user_id" | "telegram_chat_id" | "language">>();
  return result.results ?? [];
}

export async function wasSignalPushed(db: D1Database, telegramUserId: string, signalSlug: string, channel = "sports"): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT telegram_user_id
       FROM signal_push_receipts
       WHERE telegram_user_id = ? AND signal_slug = ? AND channel = ?`,
    )
    .bind(telegramUserId, signalSlug, channel)
    .first();
  return !!row;
}

export async function recordSignalPushReceipt(db: D1Database, telegramUserId: string, signalSlug: string, channel = "sports"): Promise<void> {
  await db
    .prepare(`INSERT OR IGNORE INTO signal_push_receipts (telegram_user_id, signal_slug, channel) VALUES (?, ?, ?)`)
    .bind(telegramUserId, signalSlug, channel)
    .run();
}

export async function getMonetizationSummary(db: D1Database): Promise<{
  feeLedgerCount: number;
  grossAmountUsdc: number;
  platformFeeUsdc: number;
  netTradeAmountUsdc: number;
  unsettledFeeUsdc: number;
  settledFeeUsdc: number;
  builderEventCount: number;
}> {
  const feeRow = await db
    .prepare(
      `SELECT
         COUNT(*) AS fee_ledger_count,
         COALESCE(SUM(gross_amount_usdc), 0) AS gross_amount_usdc,
         COALESCE(SUM(platform_fee_usdc), 0) AS platform_fee_usdc,
         COALESCE(SUM(net_trade_amount_usdc), 0) AS net_trade_amount_usdc,
         COALESCE(SUM(CASE WHEN status = 'accrued_unsettled' THEN platform_fee_usdc ELSE 0 END), 0) AS unsettled_fee_usdc,
         COALESCE(SUM(CASE WHEN status = 'settled' THEN platform_fee_usdc ELSE 0 END), 0) AS settled_fee_usdc
       FROM fee_ledger`,
    )
    .first<{
      fee_ledger_count: number | null;
      gross_amount_usdc: number | null;
      platform_fee_usdc: number | null;
      net_trade_amount_usdc: number | null;
      unsettled_fee_usdc: number | null;
      settled_fee_usdc: number | null;
    }>();

  const builderRow = await db
    .prepare(`SELECT COUNT(*) AS builder_event_count FROM builder_attribution_events`)
    .first<{ builder_event_count: number | null }>();

  return {
    feeLedgerCount: Number(feeRow?.fee_ledger_count ?? 0),
    grossAmountUsdc: Number(feeRow?.gross_amount_usdc ?? 0),
    platformFeeUsdc: Number(feeRow?.platform_fee_usdc ?? 0),
    netTradeAmountUsdc: Number(feeRow?.net_trade_amount_usdc ?? 0),
    unsettledFeeUsdc: Number(feeRow?.unsettled_fee_usdc ?? 0),
    settledFeeUsdc: Number(feeRow?.settled_fee_usdc ?? 0),
    builderEventCount: Number(builderRow?.builder_event_count ?? 0),
  };
}

export async function updateUserLanguage(db: D1Database, telegramUserId: string, language: "zh" | "en" | "ja" | "ko"): Promise<void> {
  await db
    .prepare(`UPDATE users SET language = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ?`)
    .bind(language, telegramUserId)
    .run();
}

function inferLanguage(languageCode?: string): "zh" | "en" | "ja" | "ko" {
  const code = languageCode?.toLowerCase() ?? "";
  if (code.startsWith("zh")) return "zh";
  if (code.startsWith("ja")) return "ja";
  if (code.startsWith("ko")) return "ko";
  return "en";
}
