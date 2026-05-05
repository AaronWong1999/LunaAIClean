import { DurableObject } from "cloudflare:workers";
import { BuilderSigner } from "@polymarket/builder-signing-sdk";
import { RelayerTxType } from "@polymarket/builder-relayer-client";
import {
  addTrackedWallet,
  createReferralAttribution,
  createUserSafeOnboardingSession,
  getFollowTask,
  getRuntimeMeta,
  getRuntimeSignal,
  getRuntimeSignals,
  getTopRuntimeSignals,
  getSportsSignals,
  getRuntimeWallets,
  getTopRuntimeWallets,
  getUserMonetizationSummary,
  getSignalHistorySummary,
  getMonetizationSummary,
  getMarketLinkResolution,
  getUser,
  getUserWalletState,
  getUserAccountExportSession,
  getUserAccountLinkSession,
  getUserAccountRestoreSession,
  getUserSafeOnboardingSession,
  getUserAccountWithdrawSession,
  getUserTradingAccount,
  getUserTradingAccountContext,
  getLatestArchivedUserTradingAccountContext,
  getReferralAttribution,
  hasIdempotencyKey,
  listBuilderAttributionEvents,
  listFollowTasks,
  listFeeLedger,
  listNewsTriggers,
  listReferralEvents,
  listTopReferrers,
  listTradeEvents,
  listUserTradingAccounts,
  listTrackedWallets,
  listArbOpportunities,
  listActiveFollowTasksByWallet,
  listSportsPushRecipients,
  listTradeSettlements,
  listWithdrawalRequests,
  listOpenFollowManagedPositions,
  listExecutionEvents,
  recordSignalPushReceipt,
  recordBuilderAttributionEvent,
  recordCronRun,
  recordExecutionEvent,
  recordFeeLedger,
  recordFeeRevenueAllocations,
  recordReferralEvent,
  recordWithdrawalRequest,
  replaceSportsSignals,
  saveUserTradingCredentials,
  settleAccruedFees,
  updateFeeLedgerSettlement,
  updateFeeRevenueAllocationStatus,
  updateFollowTaskStatus,
  saveIdempotencyKey,
  createUserAccountExportSession,
  createUserAccountLinkSession,
  createUserAccountRestoreSession,
  createUserAccountWithdrawSession,
  archiveUserTradingAccountState,
  getLatestFeeLedgerId,
  getUserTradingCredentials,
  markUserAccountWithdrawSessionUsed,
  markUserAccountExportSessionUsed,
  markUserAccountLinkSessionUsed,
  markUserAccountRestoreSessionUsed,
  markUserSafeOnboardingSessionUsed,
  updateRuntimeMeta,
  updateTradeSettlementRedemption,
  updateWithdrawalRequest,
  upsertTradeSettlement,
  upsertFollowTask,
  upsertNewsTrigger,
  upsertNewsSourceHealth,
  listNewsSourceHealth,
  listNewsTriggers,
  updateNewsTriggerMapping,
  updateNewsTriggerDualSignal,
  upsertArbOpportunity,
  upsertRuntimeWalletMetrics,
  upsertUserTradingAccount,
  upsertUser,
  touchFollowTaskTriggeredAt,
  upsertFollowManagedPosition,
  updateUserGamification,
  updateUserLanguage,
  updateUserPreferences,
  upsertMarketLinkResolution,
  upsertWalletSnapshot,
  wasSignalPushed,
} from "./db";
import {
  answerCallbackQuery,
  buildRelayerTransactionShape,
  buildFeePreview,
  collectIntegratorFee,
  createWithdrawalAddresses,
  deployTradingSafe,
  editTelegramMessage,
  executeTradingApprovals,
  fetchWithdrawQuote,
  fetchBridgeAddresses,
  fetchMarketLinkPreview,
  fetchMarketSettlement,
  fetchLiveWalletState,
  getPolygonTransactionReceipt,
  getRelayerTransaction,
  getBridgeTransactionStatus,
  getBuilderStatus,
  transferUsdcToBridge,
  provisionManagedTradingAccount,
  redeemWinningPositions,
  sendTelegramReplyKeyboardMessage,
  sendTelegramMessage,
  WITHDRAW_PRESETS,
} from "./polymarket";
import { fetchLiveSportsSignals } from "./sports";
import { TreeOfAlphaAdapter, CryptoPanicAdapter, FangchengshiAdapter, SixNineAdapter, DedupCache, type NewsEvent } from "./news";
import { mapNewsToMarket } from "./llm";
import { crossCheckPreNewsWindow } from "./smartmoney";
import { processConfirmedNewsTrigger } from "./auto_exec/executor";
import { t, pickLang, type Lang } from "./i18n";
import {
  dashboardText,
  renderConnectInstructions,
  renderConnectPortal,
  renderConnectPortalResult,
  renderCopyDesk,
  renderAddressBook,
  renderAddressProfile,
  renderDiscoverHub,
  renderExportPortal,
  renderRestorePortal,
  renderLandingPage,
  renderLeaderboard,
  renderNewsHub,
  renderCopyPrompt,
  dashboardLoadingText,
  renderCreatorDirectory,
  renderCreatorProfile,
  renderCreatorSpotlight,
  renderPnlSnapshot,
  renderPositionDetail,
  renderPositions,
  renderSignalDetail,
  renderSignalList,
  renderSportsLeaderboard,
  renderSettlementSummary,
  renderTrackRecord,
  renderAccountReceipts,
  renderSafeOnboardingPortal,
  renderTradingBlocked,
  renderTradeResult,
  renderWithdrawalResult,
  renderWithdrawPortal,
  renderWallet,
  renderWalletConnectPrompt,
  renderWalletLinkedReadonly,
  renderWorldCupHub,
  renderSportsSignalList,
  renderReferralHub,
  renderReferralLedger,
  renderArbHub,
  renderFollowTaskHub,
  renderFollowTaskPreset,
} from "./render";
import type {
  Env,
  FeePreview,
  LivePosition,
  MarketLinkPreview,
  RuntimeSignal,
  RuntimeWalletProfile,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
  TradeRequest,
  UserRecord,
} from "./types";

interface MessageSendRequest {
  text: string;
  inlineKeyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
}

interface QueueMessage {
  chatId: string;
  botId?: string;
  request: MessageSendRequest;
}

interface MarketSnapshotRecord {
  preview: MarketLinkPreview;
  expiresAt: number;
  staleAt: number;
}

interface MarketSubscriptionRecord {
  slug: string;
  conditionId: string | null;
  assetIds: string[];
  outcomes: string[];
  marketUrl: string;
}

interface ChannelStateRecord {
  status: "idle" | "connecting" | "connected" | "reconnecting" | "stale" | "error";
  lastMessageAt: string | null;
  lastHeartbeatAt: string | null;
  reconnectAttempts: number;
}

interface FollowManagedPositionRecord {
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
  takeProfitBps: number | null;
  stopLossBps: number | null;
  doubleOutDone: boolean;
  openedAt: string;
  updatedAt: string;
}

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const INTERNAL_WEBHOOK_VERIFIED_HEADER = "x-luna-telegram-webhook-verified";

export class TradeCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await request.json<TradeRequest>();
    if (!body.idempotencyKey) {
      return json({ error: "Missing idempotency key" }, 400);
    }

    if (await hasIdempotencyKey(this.env.DB, body.idempotencyKey)) {
      return json({ ok: true, duplicate: true });
    }

    try {
      let payload: Record<string, unknown>;
      if (body.action === "copy") {
        if (!body.amountUsdc || (!body.signalId && !body.tokenId)) {
          return json({ error: "Missing trade payload" }, 400);
        }
        let signal = body.signalId ? await getRuntimeSignal(this.env.DB, body.signalId) : null;
        if (!signal && !body.tokenId) {
          return json({ error: "Signal not found" }, 404);
        }
        const accountContext = await getUserTradingAccountContext(this.env, body.telegramUserId);
        if (!accountContext) {
          return json({ error: "No linked trading account for this user" }, 400);
        }
        const { copyTrade, copyTradeLimitOrder, buildFeePreview, getBuilderStatus, fetchLiveWalletState } = await import("./polymarket");
        const feePreview = buildFeePreview(this.env, body.amountUsdc);
        if (feePreview.netTradeAmountUsdc <= 0) {
          return json({ error: "Trade amount is too small after fee deduction" }, 400);
        }
        // Balance check: ensure user has enough for trade + fee
        const wallet = await fetchLiveWalletState(this.env, accountContext);
        if (wallet.snapshot.balanceUsdc < feePreview.grossAmountUsdc) {
          return json({
            error: `Insufficient balance. Need $${feePreview.grossAmountUsdc.toFixed(2)} (trade $${feePreview.netTradeAmountUsdc.toFixed(2)} + fee $${feePreview.platformFeeUsdc.toFixed(2)}), but only have $${wallet.snapshot.balanceUsdc.toFixed(2)}`
          }, 400);
        }
        const builderStatus = getBuilderStatus(this.env);
        let trade: { tokenId: string; result: Record<string, unknown>; orderType?: string };
        if (body.orderType === "limit" && body.limitPriceUsdc && body.limitPriceUsdc > 0) {
          const resolvedTokenId = signal
            ? await (await import("./polymarket")).resolveTokenId(this.env, signal.slug!, signal.selected_outcome!)
            : String(body.tokenId);
          trade = await copyTradeLimitOrder(this.env, accountContext, {
            tokenId: resolvedTokenId,
            amountUsdc: feePreview.netTradeAmountUsdc,
            limitPriceUsdc: body.limitPriceUsdc,
          });
        } else if (signal) {
          trade = await copyTrade(this.env, accountContext, signal, feePreview.netTradeAmountUsdc);
        } else {
          trade = await copyTradeByToken(this.env, accountContext, {
            tokenId: String(body.tokenId),
            amountUsdc: feePreview.netTradeAmountUsdc,
          });
        }
        payload = normalizeTradeResult(trade.result);
        await saveIdempotencyKey(this.env.DB, body.idempotencyKey, "copy", payload);
        await recordFeeLedger(this.env.DB, {
          telegramUserId: body.telegramUserId,
          signalId: body.signalId,
          tradeEventType: "copy",
          grossAmountUsdc: feePreview.grossAmountUsdc,
          platformFeeUsdc: feePreview.platformFeeUsdc,
          netTradeAmountUsdc: feePreview.netTradeAmountUsdc,
          feeBps: feePreview.feeBps,
          feeWallet: feePreview.feeWallet,
          status: feePreview.platformFeeUsdc > 0 ? "accrued_unsettled" : "zero_fee",
          detail: feePreview.feeWallet ? "fee tracked for later settlement" : "fee accounted without settlement wallet",
          metadataJson: {
            signalId: body.signalId,
            title: signal?.title_en ?? body.title ?? "Direct market trade",
            outcome: signal?.selected_outcome ?? body.outcome ?? null,
          },
        });
        const feeLedgerId = await getLatestFeeLedgerId(this.env.DB, body.telegramUserId);
        if (feeLedgerId && feePreview.platformFeeUsdc > 0) {
          await recordFeeRevenueAllocations(this.env.DB, {
            feeLedgerId,
            telegramUserId: body.telegramUserId,
            allocations: buildFeeAllocations(this.env, feePreview.platformFeeUsdc),
          });
          await recordReferralShare(this.env.DB, body.telegramUserId, feeLedgerId, feePreview.platformFeeUsdc);
          await attemptIntegratorFeeCollection(this.env, accountContext, {
            feeLedgerId,
            amountUsdc: feePreview.platformFeeUsdc,
            destinationWallet: feePreview.feeWallet,
            signalId: body.signalId,
            orderId: String(payload.orderId ?? ""),
          });
        }
        await this.env.DB.prepare(
          `INSERT INTO trade_events
           (telegram_user_id, event_type, signal_id, title, outcome, token_id, amount_usdc, status, order_id, tx_hash, payload_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            body.telegramUserId,
            "copy",
            body.signalId,
            signal?.title_en ?? body.title ?? "Direct market trade",
            signal?.selected_outcome ?? body.outcome ?? null,
            trade.tokenId,
            feePreview.netTradeAmountUsdc,
            "matched",
            String(payload.orderId ?? ""),
            String(payload.txHash ?? ""),
            JSON.stringify({
              ...payload,
              fee: feePreview,
              builder: builderStatus,
              signalSlug: signal?.slug ?? null,
              selectedOutcome: signal?.selected_outcome ?? body.outcome ?? null,
            }),
          )
          .run();
        await recordBuilderAttributionEvent(this.env.DB, {
          telegramUserId: body.telegramUserId,
          signalId: body.signalId,
          action: "copy",
          builderEnabled: builderStatus.enabled,
          builderKeyHint: builderStatus.keyHint,
          orderId: String(payload.orderId ?? ""),
          txHash: String(payload.txHash ?? ""),
          payloadJson: payload,
        });
        await recordExecutionEvent(this.env.DB, {
          telegramUserId: body.telegramUserId,
          eventType: "manual_copy_executed",
          entityType: "trade",
          entityKey: String(payload.orderId ?? trade.tokenId ?? body.signalId ?? body.tokenId ?? "copy"),
          status: "executed",
          detailJson: {
            action: "copy",
            title: signal?.title_en ?? body.title ?? "Direct market trade",
            outcome: signal?.selected_outcome ?? body.outcome ?? null,
            tokenId: trade.tokenId,
            amountUsdc: feePreview.netTradeAmountUsdc,
            fee: feePreview,
            payload,
          },
        });
        await refreshWalletSnapshotAfterTrade(this.env, body.telegramUserId, accountContext, {
          expectBalanceAtMost: wallet.snapshot.balanceUsdc - feePreview.platformFeeUsdc,
          requirePositionVisibility: true,
        });
        void updateUserGamification(this.env.DB, body.telegramUserId).catch(() => undefined);
        return json({ ok: true, action: "copy", ...payload, fee: feePreview });
      }

      if (body.action === "close") {
        if (!body.tokenId || !body.shares || !body.title || !body.outcome) {
          return json({ error: "Missing position payload" }, 400);
        }
        const { closePosition, buildFeePreview } = await import("./polymarket");
        const accountContext = await getUserTradingAccountContext(this.env, body.telegramUserId);
        if (!accountContext) {
          return json({ error: "No linked trading account for this user" }, 400);
        }
        const position: LivePosition = {
          asset: body.tokenId,
          title: body.title,
          outcome: body.outcome,
          size: body.shares,
          avgPrice: body.avgPrice ?? 0,
          curPrice: body.curPrice ?? 0,
          cashPnl: 0,
          percentPnl: 0,
          slug: "",
          currentValue: body.currentValue ?? (body.shares * (body.curPrice ?? 0)),
        };
        const trade = await closePosition(this.env, accountContext, position);
        payload = normalizeTradeResult(trade.result);
        await saveIdempotencyKey(this.env.DB, body.idempotencyKey, "close", payload);
        
        // Calculate fee based on position value (shares * current price)
        const positionValue = position.currentValue > 0 ? position.currentValue : position.size * position.curPrice;
        const feePreview = buildFeePreview(this.env, positionValue);
        
        // Record fee ledger for close action
        await recordFeeLedger(this.env.DB, {
          telegramUserId: body.telegramUserId,
          tradeEventType: "close",
          grossAmountUsdc: feePreview.grossAmountUsdc,
          platformFeeUsdc: feePreview.platformFeeUsdc,
          netTradeAmountUsdc: feePreview.netTradeAmountUsdc,
          feeBps: feePreview.feeBps,
          feeWallet: feePreview.feeWallet,
          status: feePreview.platformFeeUsdc > 0 ? "accrued_unsettled" : "zero_fee",
          detail: feePreview.feeWallet ? "fee tracked for close position" : "fee accounted without settlement wallet",
          metadataJson: {
            title: body.title,
            outcome: body.outcome,
            shares: body.shares,
            positionValue,
          },
        });
        
        // Collect fee if applicable
        const feeLedgerId = await getLatestFeeLedgerId(this.env.DB, body.telegramUserId);
        if (feeLedgerId && feePreview.platformFeeUsdc > 0) {
          await recordFeeRevenueAllocations(this.env.DB, {
            feeLedgerId,
            telegramUserId: body.telegramUserId,
            allocations: buildFeeAllocations(this.env, feePreview.platformFeeUsdc),
          });
          await recordReferralShare(this.env.DB, body.telegramUserId, feeLedgerId, feePreview.platformFeeUsdc);
          await attemptIntegratorFeeCollection(this.env, accountContext, {
            feeLedgerId,
            amountUsdc: feePreview.platformFeeUsdc,
            destinationWallet: feePreview.feeWallet,
            orderId: String(payload.orderId ?? ""),
          });
        }
        
        await this.env.DB.prepare(
          `INSERT INTO trade_events
           (telegram_user_id, event_type, title, outcome, token_id, shares, status, order_id, tx_hash, payload_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            body.telegramUserId,
            "close",
            body.title,
            body.outcome,
            body.tokenId,
            body.shares,
            "matched",
            String(payload.orderId ?? ""),
            String(payload.txHash ?? ""),
            JSON.stringify({ ...payload, fee: feePreview }),
          )
          .run();
        await recordExecutionEvent(this.env.DB, {
          telegramUserId: body.telegramUserId,
          eventType: "manual_close_executed",
          entityType: "trade",
          entityKey: String(payload.orderId ?? body.tokenId ?? "close"),
          status: "executed",
          detailJson: {
            action: "close",
            title: body.title,
            outcome: body.outcome,
            tokenId: body.tokenId,
            shares: body.shares,
            fee: feePreview,
            payload,
          },
        });
        await refreshWalletSnapshotAfterTrade(this.env, body.telegramUserId, accountContext, {
          targetTokenId: body.tokenId,
          requirePositionClosure: true,
          maxAttempts: 1,
        });
        void updateUserGamification(this.env.DB, body.telegramUserId).catch(() => undefined);
        return json({ ok: true, action: "close", ...payload, fee: feePreview });
      }

      return json({ error: "Unsupported action" }, 400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await saveIdempotencyKey(this.env.DB, body.idempotencyKey, body.action, { ok: false, error: message });
      return json({ ok: false, error: message }, 500);
    }
  }
}

export class MarketStreamCoordinator extends DurableObject<Env> {
  private readonly ctx: DurableObjectState;
  private readonly cache = new Map<string, MarketSnapshotRecord>();
  private readonly subscriptions = new Map<string, MarketSubscriptionRecord>();
  private readonly assetToSlug = new Map<string, string>();
  private readonly rtdsSubscriptions = new Map<string, { topic: string; type: string; filters?: string | null }>();
  private readonly channelState: Record<"market" | "sports" | "rtds", ChannelStateRecord> = {
    market: { status: "idle", lastMessageAt: null, lastHeartbeatAt: null, reconnectAttempts: 0 },
    sports: { status: "idle", lastMessageAt: null, lastHeartbeatAt: null, reconnectAttempts: 0 },
    rtds: { status: "idle", lastMessageAt: null, lastHeartbeatAt: null, reconnectAttempts: 0 },
  };
  private marketWs: WebSocket | null = null;
  private sportsWs: WebSocket | null = null;
  private rtdsWs: WebSocket | null = null;
  private marketHeartbeat: ReturnType<typeof setInterval> | null = null;
  private rtdsHeartbeat: ReturnType<typeof setInterval> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx = ctx;
    this.ctx.blockConcurrencyWhile(async () => {
      const persisted = await this.ctx.storage.get<{
        subscriptions?: MarketSubscriptionRecord[];
        cache?: Array<{ slug: string; record: MarketSnapshotRecord }>;
        rtdsSubscriptions?: Array<{ topic: string; type: string; filters?: string | null }>;
      }>("runtime_state");
      if (!persisted) return;
      for (const item of persisted.subscriptions ?? []) {
        this.subscriptions.set(item.slug, item);
        for (const assetId of item.assetIds) {
          this.assetToSlug.set(assetId, item.slug);
        }
      }
      for (const item of persisted.cache ?? []) {
        this.cache.set(item.slug, item.record);
      }
      for (const item of persisted.rtdsSubscriptions ?? []) {
        this.rtdsSubscriptions.set(`${item.topic}:${item.type}:${item.filters ?? ""}`, item);
      }
      if (this.subscriptions.size) {
        this.ensureMarketSocket();
      }
      if (this.rtdsSubscriptions.size) {
        this.ensureRtdsSocket([]);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug")?.trim();
    if (request.method === "GET" && url.pathname === "/status") {
      if (this.subscriptions.size && this.channelState.market.status === "idle") {
        this.ensureMarketSocket();
      }
      if (this.rtdsSubscriptions.size && this.channelState.rtds.status === "idle") {
        this.ensureRtdsSocket([]);
      }
      return json({
        ok: true,
        channels: {
          market: { ...this.channelState.market, subscriptionCount: this.assetToSlug.size },
          sports: { ...this.channelState.sports, subscriptionCount: this.channelState.sports.status === "idle" ? 0 : 1 },
          rtds: { ...this.channelState.rtds, subscriptionCount: this.rtdsSubscriptions.size },
        },
        marketCount: this.subscriptions.size,
        cachedCount: this.cache.size,
      });
    }

    if (request.method === "POST" && url.pathname === "/subscribe") {
      const body = await request
        .json<{
          slug?: string;
          outcome?: string | null;
          includeSports?: boolean;
          includeRtds?: boolean;
          rtdsSubscriptions?: Array<{ topic: string; type: string; filters?: string | null }>;
        }>()
        .catch(() => ({}));
      if (!body.slug) {
        return json({ error: "slug is required" }, 400);
      }
      const preview = await this.ensureSlugSubscription(body.slug, body.outcome ?? null);
      if (body.includeSports) {
        this.ensureSportsSocket();
      }
      if (body.includeRtds) {
        this.ensureRtdsSocket(body.rtdsSubscriptions ?? []);
      }
      return json({ ok: true, preview, channels: this.channelState });
    }

    if (!slug) {
      return json({ error: "Missing slug" }, 400);
    }

    if (request.method === "GET") {
      const cached = this.getFresh(slug);
      if (cached) {
        return json({
          ok: true,
          cached: true,
          stale: cached.staleAt <= Date.now(),
          source: cached.preview.source ?? "ws",
          preview: cached.preview,
        });
      }
      const preview = await this.ensureSlugSubscription(slug, url.searchParams.get("outcome"));
      return json({ ok: true, cached: false, stale: false, source: preview.source ?? "rest", preview });
    }

    if (request.method === "POST" && url.pathname === "/preview") {
      const body = await request.json<{ outcome?: string | null }>().catch(() => ({}));
      const preview = await this.ensureSlugSubscription(slug, body.outcome);
      return json({ ok: true, preview });
    }

    return json({ error: "Method not allowed" }, 405);
  }

  private getFresh(slug: string): MarketSnapshotRecord | null {
    const cached = this.cache.get(slug);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(slug);
      return null;
    }
    return cached;
  }

  private async ensureSlugSubscription(slug: string, preferredOutcome?: string | null): Promise<MarketLinkPreview> {
    const existing = this.getFresh(slug);
    if (existing) {
      return existing.preview;
    }
    const preview = await fetchMarketLinkPreview(this.env, slug, preferredOutcome);
    this.cache.set(slug, {
      preview: {
        ...preview,
        source: "rest",
        cached: false,
        stale: false,
        lastUpdatedAt: new Date().toISOString(),
      },
      expiresAt: Date.now() + 60_000,
      staleAt: Date.now() + 12_000,
    });
    this.subscriptions.set(slug, {
      slug,
      conditionId: preview.conditionId ?? null,
      assetIds: preview.tokenIds ?? (preview.tokenId ? [preview.tokenId] : []),
      outcomes: preview.outcomes ?? [],
      marketUrl: preview.marketUrl,
    });
    for (const assetId of preview.tokenIds ?? []) {
      this.assetToSlug.set(assetId, slug);
    }
    this.persistState();
    this.ensureMarketSocket();
    this.sendMarketSubscription({
      slug,
      conditionId: preview.conditionId ?? null,
      assetIds: preview.tokenIds ?? (preview.tokenId ? [preview.tokenId] : []),
      outcomes: preview.outcomes ?? [],
      marketUrl: preview.marketUrl,
    });
    return preview;
  }

  private ensureMarketSocket(): void {
    if (this.marketWs && (this.marketWs.readyState === WebSocket.OPEN || this.marketWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.channelState.market.status = this.channelState.market.reconnectAttempts > 0 ? "reconnecting" : "connecting";
    const ws = new WebSocket("wss://ws-subscriptions-clob.polymarket.com/ws/market");
    this.marketWs = ws;
    ws.addEventListener("open", () => {
      this.channelState.market.status = "connected";
      this.channelState.market.reconnectAttempts = 0;
      this.touchChannel("market", true);
      this.startMarketHeartbeat();
      for (const subscription of this.subscriptions.values()) {
        this.sendMarketSubscription(subscription);
      }
    });
    ws.addEventListener("message", (event) => {
      this.touchChannel("market");
      const text = typeof event.data === "string" ? event.data : "";
      if (!text || text === "PONG") return;
      try {
        const payload = JSON.parse(text) as unknown;
        this.processMarketMessage(payload);
      } catch {
        // Ignore malformed messages.
      }
    });
    ws.addEventListener("close", () => {
      this.channelState.market.status = "stale";
      this.channelState.market.reconnectAttempts += 1;
      this.stopMarketHeartbeat();
      this.marketWs = null;
      setTimeout(() => this.ensureMarketSocket(), Math.min(5000, 500 * this.channelState.market.reconnectAttempts));
    });
    ws.addEventListener("error", () => {
      this.channelState.market.status = "error";
    });
  }

  private ensureSportsSocket(): void {
    if (this.sportsWs && (this.sportsWs.readyState === WebSocket.OPEN || this.sportsWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.channelState.sports.status = this.channelState.sports.reconnectAttempts > 0 ? "reconnecting" : "connecting";
    const ws = new WebSocket("wss://sports-api.polymarket.com/ws");
    this.sportsWs = ws;
    ws.addEventListener("open", () => {
      this.channelState.sports.status = "connected";
      this.channelState.sports.reconnectAttempts = 0;
      this.touchChannel("sports", true);
    });
    ws.addEventListener("message", (event) => {
      this.touchChannel("sports");
      const text = typeof event.data === "string" ? event.data : "";
      if (text.toLowerCase() === "ping") {
        ws.send("pong");
        this.touchChannel("sports", true);
        return;
      }
      void this.recordStreamRuntimeEvent("sports_update", "sports", text);
    });
    ws.addEventListener("close", () => {
      this.channelState.sports.status = "stale";
      this.channelState.sports.reconnectAttempts += 1;
      this.sportsWs = null;
      setTimeout(() => this.ensureSportsSocket(), Math.min(5000, 500 * this.channelState.sports.reconnectAttempts));
    });
    ws.addEventListener("error", () => {
      this.channelState.sports.status = "error";
    });
  }

  private ensureRtdsSocket(subscriptions: Array<{ topic: string; type: string; filters?: string | null }>): void {
    for (const subscription of subscriptions) {
      this.rtdsSubscriptions.set(
        `${subscription.topic}:${subscription.type}:${subscription.filters ?? ""}`,
        subscription,
      );
    }
    this.persistState();
    if (this.rtdsWs && (this.rtdsWs.readyState === WebSocket.OPEN || this.rtdsWs.readyState === WebSocket.CONNECTING)) {
      if (this.rtdsWs.readyState === WebSocket.OPEN && subscriptions.length) {
        this.sendRtdsSubscriptions(subscriptions);
      }
      return;
    }
    this.channelState.rtds.status = this.channelState.rtds.reconnectAttempts > 0 ? "reconnecting" : "connecting";
    const ws = new WebSocket("wss://ws-live-data.polymarket.com");
    this.rtdsWs = ws;
    ws.addEventListener("open", () => {
      this.channelState.rtds.status = "connected";
      this.channelState.rtds.reconnectAttempts = 0;
      this.touchChannel("rtds", true);
      this.startRtdsHeartbeat();
      this.sendRtdsSubscriptions([...this.rtdsSubscriptions.values()]);
    });
    ws.addEventListener("message", (event) => {
      this.touchChannel("rtds");
      const text = typeof event.data === "string" ? event.data : "";
      if (!text || text === "PONG") return;
      void this.recordStreamRuntimeEvent("rtds_update", "rtds", text);
    });
    ws.addEventListener("close", () => {
      this.channelState.rtds.status = "stale";
      this.channelState.rtds.reconnectAttempts += 1;
      this.stopRtdsHeartbeat();
      this.rtdsWs = null;
      setTimeout(() => this.ensureRtdsSocket([]), Math.min(5000, 500 * this.channelState.rtds.reconnectAttempts));
    });
    ws.addEventListener("error", () => {
      this.channelState.rtds.status = "error";
    });
  }

  private sendMarketSubscription(subscription: MarketSubscriptionRecord): void {
    if (!this.marketWs || this.marketWs.readyState !== WebSocket.OPEN || !subscription.assetIds.length) return;
    this.marketWs.send(JSON.stringify({
      assets_ids: subscription.assetIds,
      type: "market",
      operation: "subscribe",
      custom_feature_enabled: true,
    }));
  }

  private sendRtdsSubscriptions(subscriptions: Array<{ topic: string; type: string; filters?: string | null }>): void {
    if (!this.rtdsWs || this.rtdsWs.readyState !== WebSocket.OPEN || !subscriptions.length) return;
    this.rtdsWs.send(JSON.stringify({
      action: "subscribe",
      subscriptions: subscriptions.map((item) => ({
        topic: item.topic,
        type: item.type,
        filters: item.filters ?? undefined,
      })),
    }));
  }

  private processMarketMessage(payload: unknown): void {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        this.processMarketMessage(item);
      }
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const message = payload as Record<string, unknown>;
    const assetId = String(message.asset_id ?? message.assetId ?? "");
    if (!assetId) return;
    const slug = this.assetToSlug.get(assetId);
    if (!slug) return;
    const snapshot = this.cache.get(slug);
    if (!snapshot) return;
    const next = { ...snapshot.preview };
    const bids = Array.isArray(message.bids) ? message.bids as Array<any> : [];
    const asks = Array.isArray(message.asks) ? message.asks as Array<any> : [];
    const bestBid = numberOrNull(message.best_bid ?? message.bestBid ?? bids[0]?.price);
    const bestAsk = numberOrNull(message.best_ask ?? message.bestAsk ?? asks[0]?.price);
    if (bestBid != null) next.bestBid = bestBid;
    if (bestAsk != null) next.bestAsk = bestAsk;
    const lastPrice = numberOrNull(message.price ?? message.last_trade_price ?? message.lastTradePrice);
    if (lastPrice != null && next.tokenIds?.length && next.outcomes?.length) {
      const index = next.tokenIds.findIndex((item) => item === assetId);
      if (index >= 0) {
        const label = String(next.outcomes[index] ?? "").toLowerCase();
        if (label === "yes") next.yesPrice = lastPrice;
        if (label === "no") next.noPrice = lastPrice;
        if (next.selectedOutcome && String(next.selectedOutcome).toLowerCase() === label) {
          next.bestBid = next.bestBid ?? lastPrice;
          next.bestAsk = next.bestAsk ?? lastPrice;
        }
      }
    }
    next.source = "ws";
    next.cached = true;
    next.stale = false;
    next.lastUpdatedAt = new Date().toISOString();
    this.cache.set(slug, {
      preview: next,
      expiresAt: Date.now() + 60_000,
      staleAt: Date.now() + 15_000,
    });
    this.schedulePersist();
  }

  private persistState(): void {
    void this.ctx.storage.put("runtime_state", {
      subscriptions: [...this.subscriptions.values()],
      cache: [...this.cache.entries()].map(([slug, record]) => ({ slug, record })),
      rtdsSubscriptions: [...this.rtdsSubscriptions.values()],
    });
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistState();
    }, 250);
  }

  private touchChannel(channel: "market" | "sports" | "rtds", heartbeat = false): void {
    const now = new Date().toISOString();
    this.channelState[channel].lastMessageAt = now;
    if (heartbeat) {
      this.channelState[channel].lastHeartbeatAt = now;
    }
  }

  private async recordStreamRuntimeEvent(
    eventType: "sports_update" | "rtds_update",
    entityType: "sports" | "rtds",
    raw: string,
  ): Promise<void> {
    await recordExecutionEvent(this.env.DB, {
      telegramUserId: "system",
      eventType,
      entityType: "runtime_event",
      entityKey: entityType,
      status: "received",
      detailJson: {
        channel: entityType,
        payload: raw.slice(0, 4000),
      },
    });
  }

  private startMarketHeartbeat(): void {
    this.stopMarketHeartbeat();
    this.marketHeartbeat = setInterval(() => {
      if (this.marketWs?.readyState === WebSocket.OPEN) {
        this.marketWs.send("PING");
        this.touchChannel("market", true);
      }
    }, 10_000);
  }

  private stopMarketHeartbeat(): void {
    if (this.marketHeartbeat) clearInterval(this.marketHeartbeat);
    this.marketHeartbeat = null;
  }

  private startRtdsHeartbeat(): void {
    this.stopRtdsHeartbeat();
    this.rtdsHeartbeat = setInterval(() => {
      if (this.rtdsWs?.readyState === WebSocket.OPEN) {
        this.rtdsWs.send("PING");
        this.touchChannel("rtds", true);
      }
    }, 5_000);
  }

  private stopRtdsHeartbeat(): void {
    if (this.rtdsHeartbeat) clearInterval(this.rtdsHeartbeat);
    this.rtdsHeartbeat = null;
  }
}

export class FollowEngineCoordinator extends DurableObject<Env> {
  private readonly ctx: DurableObjectState;
  private readonly userSockets = new Map<string, WebSocket>();
  private readonly userMarkets = new Map<string, Set<string>>();
  private readonly userStatus = new Map<string, ChannelStateRecord>();
  private readonly userHeartbeats = new Map<string, ReturnType<typeof setInterval>>();
  private readonly managedPositions = new Map<string, FollowManagedPositionRecord>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx = ctx;
    this.ctx.blockConcurrencyWhile(async () => {
      const persisted = await this.ctx.storage.get<{
        managedPositions?: FollowManagedPositionRecord[];
      }>("runtime_state");
      for (const position of persisted?.managedPositions ?? []) {
        this.managedPositions.set(position.key, position);
      }
      if (this.managedPositions.size === 0) {
        const persistedRows = await listOpenFollowManagedPositions(this.env.DB);
        for (const row of persistedRows) {
          this.managedPositions.set(row.position_key, {
            key: row.position_key,
            telegramUserId: row.telegram_user_id,
            taskId: Number(row.task_id),
            walletAddress: row.wallet_address,
            marketSlug: row.market_slug,
            tokenId: row.token_id,
            title: row.title,
            outcome: row.outcome,
            entryPrice: Number(row.entry_price),
            amountUsdc: Number(row.amount_usdc),
            principalUsdc: Number(row.principal_usdc),
            estimatedShares: Number(row.estimated_shares),
            remainingShares: Number(row.remaining_shares),
            takeProfitMode: row.take_profit_mode,
            takeProfitBps: row.take_profit_bps == null ? null : Number(row.take_profit_bps),
            stopLossBps: row.stop_loss_bps == null ? null : Number(row.stop_loss_bps),
            doubleOutDone: Boolean(row.double_out_done),
            openedAt: row.opened_at,
            updatedAt: row.updated_at,
          });
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/status") {
      return json({
        ok: true,
        users: [...this.userStatus.entries()].map(([telegramUserId, status]) => ({
          telegramUserId,
          ...status,
          subscriptionCount: this.userMarkets.get(telegramUserId)?.size ?? 0,
        })),
        managedPositions: [...this.managedPositions.values()].map((position) => ({
          ...position,
          unrealizedMoveBps: null,
        })),
      });
    }
    if (request.method === "POST" && url.pathname === "/reconcile") {
      const body = await request
        .json<{ telegramUserId?: string; key?: string }>()
        .catch(() => ({}));
      const result = await this.reconcileManagedPositions({
        telegramUserId: body.telegramUserId,
        key: body.key,
      });
      return json({ ok: true, ...result });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    const body = await request.json<{
      walletAddress?: string;
      tokenId?: string;
      title?: string;
      outcome?: string;
      triggerAmountUsdc?: number;
      side?: "buy" | "sell";
      scope?: "all" | "sports";
      marketSlug?: string | null;
    }>().catch(() => ({}));
    if (!body.walletAddress || !body.tokenId || !body.title || !body.outcome) {
      return json({ error: "walletAddress, tokenId, title, outcome are required" }, 400);
    }
    if (body.marketSlug) {
      const tasks = await listActiveFollowTasksByWallet(this.env.DB, body.walletAddress, { scope: body.scope ?? "all" });
      const preview = await loadMarketPreview(
        this.env,
        `https://polymarket.com/event/${encodeURIComponent(body.marketSlug)}`,
        body.marketSlug,
        body.outcome,
      ).catch(() => null);
      if (preview?.conditionId) {
        for (const task of tasks) {
          const accountContext = await getUserTradingAccountContext(this.env, task.telegram_user_id).catch(() => null);
          if (!accountContext?.credentials) continue;
          this.ensureUserSocket(task.telegram_user_id, accountContext, preview.conditionId);
        }
      }
    }
    const result = await executeFollowTasksForWallet(this.env, {
      walletAddress: body.walletAddress,
      tokenId: body.tokenId,
      title: body.title,
      outcome: body.outcome,
      triggerAmountUsdc: Number(body.triggerAmountUsdc ?? 0),
      side: body.side ?? "buy",
      scope: body.scope ?? "all",
      marketSlug: body.marketSlug ?? null,
    });
    for (const receipt of result.receipts) {
      if (!receipt.ok || !receipt.market_slug || !receipt.telegram_user_id || !receipt.task_id || !receipt.outcome || !receipt.title) {
        continue;
      }
      if ((receipt.take_profit_mode ?? "none") === "none" && !(Number(receipt.stop_loss_bps ?? 0) > 0) && !(Number(receipt.take_profit_bps ?? 0) > 0)) {
        continue;
      }
      const entryPrice = Number(receipt.entry_price ?? 0);
      const amountUsdc = Number(receipt.amount_usdc ?? 0);
      const estimatedShares = Number(receipt.estimated_shares ?? 0);
      if (!(entryPrice > 0) || !(amountUsdc > 0) || !(estimatedShares > 0)) {
        continue;
      }
      const key = `${receipt.telegram_user_id}:${receipt.task_id}:${receipt.token_id}`;
      this.managedPositions.set(key, {
        key,
        telegramUserId: String(receipt.telegram_user_id),
        taskId: Number(receipt.task_id),
        walletAddress: String(body.walletAddress).toLowerCase(),
        marketSlug: String(receipt.market_slug),
        tokenId: String(receipt.token_id),
        title: String(receipt.title),
        outcome: String(receipt.outcome),
        entryPrice,
        amountUsdc,
        principalUsdc: amountUsdc,
        estimatedShares,
        remainingShares: estimatedShares,
        takeProfitMode: String(receipt.take_profit_mode ?? "none"),
        takeProfitBps: receipt.take_profit_bps == null ? null : Number(receipt.take_profit_bps),
        stopLossBps: receipt.stop_loss_bps == null ? null : Number(receipt.stop_loss_bps),
        doubleOutDone: false,
        openedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await upsertFollowManagedPosition(this.env.DB, {
        key,
        telegramUserId: String(receipt.telegram_user_id),
        taskId: Number(receipt.task_id),
        walletAddress: String(body.walletAddress).toLowerCase(),
        marketSlug: String(receipt.market_slug),
        tokenId: String(receipt.token_id),
        title: String(receipt.title),
        outcome: String(receipt.outcome),
        entryPrice,
        amountUsdc,
        principalUsdc: amountUsdc,
        estimatedShares,
        remainingShares: estimatedShares,
        takeProfitMode: String(receipt.take_profit_mode ?? "none"),
        takeProfitBps: receipt.take_profit_bps == null ? null : Number(receipt.take_profit_bps),
        stopLossBps: receipt.stop_loss_bps == null ? null : Number(receipt.stop_loss_bps),
        doubleOutDone: false,
        status: "open",
        openedAt: new Date().toISOString(),
      });
      await recordExecutionEvent(this.env.DB, {
        telegramUserId: String(receipt.telegram_user_id),
        eventType: "follow_position_opened",
        entityType: "follow_managed_position",
        entityKey: key,
        status: "recorded",
        detailJson: {
          task_id: receipt.task_id,
          wallet_address: body.walletAddress,
          market_slug: receipt.market_slug,
          token_id: receipt.token_id,
          title: receipt.title,
          outcome: receipt.outcome,
          entry_price: entryPrice,
          amount_usdc: amountUsdc,
          estimated_shares: estimatedShares,
          take_profit_mode: receipt.take_profit_mode ?? "none",
          stop_loss_bps: receipt.stop_loss_bps ?? null,
        },
      });
      this.schedulePersist();
    }
    return json({ ok: true, ...result });
  }

  private ensureUserSocket(telegramUserId: string, accountContext: NonNullable<Awaited<ReturnType<typeof getUserTradingAccountContext>>>, conditionId: string): void {
    const currentMarkets = this.userMarkets.get(telegramUserId) ?? new Set<string>();
    currentMarkets.add(conditionId);
    this.userMarkets.set(telegramUserId, currentMarkets);
    const existing = this.userSockets.get(telegramUserId);
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      if (existing.readyState === WebSocket.OPEN) {
        existing.send(JSON.stringify({ markets: [conditionId], operation: "subscribe" }));
      }
      return;
    }
    this.userStatus.set(telegramUserId, {
      status: "connecting",
      lastHeartbeatAt: null,
      lastMessageAt: null,
      reconnectAttempts: this.userStatus.get(telegramUserId)?.reconnectAttempts ?? 0,
    });
    const ws = new WebSocket("wss://ws-subscriptions-clob.polymarket.com/ws/user");
    this.userSockets.set(telegramUserId, ws);
    ws.addEventListener("open", () => {
      this.userStatus.set(telegramUserId, {
        status: "connected",
        lastHeartbeatAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        reconnectAttempts: 0,
      });
      ws.send(JSON.stringify({
        auth: {
          apiKey: accountContext.credentials?.polymarketApiKey,
          secret: accountContext.credentials?.polymarketApiSecret,
          passphrase: accountContext.credentials?.polymarketApiPassphrase,
        },
        markets: [...(this.userMarkets.get(telegramUserId) ?? [])],
        type: "user",
      }));
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("PING");
          const current = this.userStatus.get(telegramUserId);
          if (current) current.lastHeartbeatAt = new Date().toISOString();
        }
      }, 10_000);
      this.userHeartbeats.set(telegramUserId, heartbeat);
    });
    ws.addEventListener("message", (event) => {
      const current = this.userStatus.get(telegramUserId);
      if (current) current.lastMessageAt = new Date().toISOString();
      void this.handleUserSocketMessage(telegramUserId, event);
    });
    ws.addEventListener("close", () => {
      const current = this.userStatus.get(telegramUserId);
      const reconnectAttempts = (current?.reconnectAttempts ?? 0) + 1;
      this.userStatus.set(telegramUserId, {
        status: "stale",
        lastHeartbeatAt: current?.lastHeartbeatAt ?? null,
        lastMessageAt: current?.lastMessageAt ?? null,
        reconnectAttempts,
      });
      const heartbeat = this.userHeartbeats.get(telegramUserId);
      if (heartbeat) clearInterval(heartbeat);
      this.userHeartbeats.delete(telegramUserId);
      this.userSockets.delete(telegramUserId);
      setTimeout(() => {
        this.ensureUserSocket(telegramUserId, accountContext, conditionId);
      }, Math.min(5000, reconnectAttempts * 500));
    });
    ws.addEventListener("error", () => {
      const current = this.userStatus.get(telegramUserId);
      this.userStatus.set(telegramUserId, {
        status: "error",
        lastHeartbeatAt: current?.lastHeartbeatAt ?? null,
        lastMessageAt: current?.lastMessageAt ?? null,
        reconnectAttempts: current?.reconnectAttempts ?? 0,
      });
    });
  }

  private async reconcileManagedPositions(filter?: { telegramUserId?: string; key?: string }): Promise<{
    checked: number;
    actions: Array<Record<string, unknown>>;
  }> {
    const actions: Array<Record<string, unknown>> = [];
    const candidates = [...this.managedPositions.values()].filter((position) => {
      if (filter?.key && position.key !== filter.key) return false;
      if (filter?.telegramUserId && position.telegramUserId !== filter.telegramUserId) return false;
      return true;
    });
    for (const position of candidates) {
      const preview = await loadMarketPreview(
        this.env,
        `https://polymarket.com/event/${encodeURIComponent(position.marketSlug)}`,
        position.marketSlug,
        position.outcome,
      ).catch(() => null);
      if (!preview) continue;
      const currentPrice = inferOutcomePrice(preview, position.outcome);
      if (!(currentPrice > 0)) continue;
      const drawdownBps = Math.round(((currentPrice - position.entryPrice) / position.entryPrice) * 10_000);
      const shouldStop = Number(position.stopLossBps ?? 0) > 0 && drawdownBps <= -Number(position.stopLossBps);
      const shouldDoubleOut =
        position.takeProfitMode === "double_out" &&
        !position.doubleOutDone &&
        currentPrice >= position.entryPrice * 2;
      const shouldFixedTp =
        position.takeProfitMode === "fixed_pct" &&
        Number(position.takeProfitBps ?? 0) > 0 &&
        drawdownBps >= Number(position.takeProfitBps);
      if (!shouldStop && !shouldDoubleOut && !shouldFixedTp) continue;
      const accountContext = await getUserTradingAccountContext(this.env, position.telegramUserId).catch(() => null);
      if (!accountContext?.credentials) continue;
      const sharesToSell = shouldStop || shouldFixedTp
        ? position.remainingShares
        : Math.min(position.remainingShares, position.principalUsdc / currentPrice);
      if (!(sharesToSell > 0)) continue;
      const objectId = this.env.TRADE_COORDINATOR.idFromName(`user:${position.telegramUserId}`);
      const stub = this.env.TRADE_COORDINATOR.get(objectId);
      const response = await stub.fetch("https://trade.internal/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "close",
          telegramUserId: position.telegramUserId,
          tokenId: position.tokenId,
          shares: sharesToSell,
          title: position.title,
          outcome: position.outcome,
          avgPrice: position.entryPrice,
          curPrice: currentPrice,
          currentValue: sharesToSell * currentPrice,
          idempotencyKey: `follow-manage:${position.key}:${shouldStop ? "sl" : shouldFixedTp ? "tp" : "double-out"}:${Date.now()}`,
        } satisfies TradeRequest),
      });
      const result = await response.json<Record<string, unknown>>().catch(() => ({ ok: false, error: "invalid_json" }));
      const ok = response.ok && Boolean(result.ok);
      const exitReason = shouldStop ? "stop_loss" : shouldFixedTp ? "take_profit" : "double_out";
      await recordExecutionEvent(this.env.DB, {
        telegramUserId: position.telegramUserId,
        eventType: shouldStop ? "follow_stop_loss_triggered" : shouldFixedTp ? "follow_take_profit_triggered" : "follow_double_out_triggered",
        entityType: "follow_managed_position",
        entityKey: position.key,
        status: ok ? "executed" : "error",
        detailJson: {
          current_price: currentPrice,
          drawdown_bps: drawdownBps,
          shares_to_sell: sharesToSell,
          result,
        },
      });
      actions.push({
        key: position.key,
        ok,
        reason: exitReason,
        current_price: currentPrice,
        drawdown_bps: drawdownBps,
        shares_to_sell: sharesToSell,
        result,
      });
      if (!ok) continue;
      if (shouldStop || shouldFixedTp) {
        this.managedPositions.delete(position.key);
        await upsertFollowManagedPosition(this.env.DB, {
          key: position.key,
          telegramUserId: position.telegramUserId,
          taskId: position.taskId,
          walletAddress: position.walletAddress,
          marketSlug: position.marketSlug,
          tokenId: position.tokenId,
          title: position.title,
          outcome: position.outcome,
          entryPrice: position.entryPrice,
          amountUsdc: position.amountUsdc,
          principalUsdc: position.principalUsdc,
          estimatedShares: position.estimatedShares,
          remainingShares: 0,
          takeProfitMode: position.takeProfitMode,
          takeProfitBps: position.takeProfitBps,
          stopLossBps: position.stopLossBps,
          doubleOutDone: position.doubleOutDone,
          status: "closed",
          lastExitReason: exitReason,
          openedAt: position.openedAt,
          closedAt: new Date().toISOString(),
        });
      } else {
        position.doubleOutDone = true;
        position.remainingShares = Math.max(0, position.remainingShares - sharesToSell);
        position.updatedAt = new Date().toISOString();
        if (position.remainingShares <= 0.000001) {
          this.managedPositions.delete(position.key);
          await upsertFollowManagedPosition(this.env.DB, {
            key: position.key,
            telegramUserId: position.telegramUserId,
            taskId: position.taskId,
            walletAddress: position.walletAddress,
            marketSlug: position.marketSlug,
            tokenId: position.tokenId,
            title: position.title,
            outcome: position.outcome,
            entryPrice: position.entryPrice,
            amountUsdc: position.amountUsdc,
            principalUsdc: position.principalUsdc,
            estimatedShares: position.estimatedShares,
            remainingShares: 0,
            takeProfitMode: position.takeProfitMode,
            takeProfitBps: position.takeProfitBps,
            stopLossBps: position.stopLossBps,
            doubleOutDone: true,
            status: "closed",
            lastExitReason: "double_out",
            openedAt: position.openedAt,
            closedAt: position.updatedAt,
          });
        } else {
          this.managedPositions.set(position.key, position);
          await upsertFollowManagedPosition(this.env.DB, {
            key: position.key,
            telegramUserId: position.telegramUserId,
            taskId: position.taskId,
            walletAddress: position.walletAddress,
            marketSlug: position.marketSlug,
            tokenId: position.tokenId,
            title: position.title,
            outcome: position.outcome,
            entryPrice: position.entryPrice,
            amountUsdc: position.amountUsdc,
            principalUsdc: position.principalUsdc,
            estimatedShares: position.estimatedShares,
            remainingShares: position.remainingShares,
            takeProfitMode: position.takeProfitMode,
            takeProfitBps: position.takeProfitBps,
            stopLossBps: position.stopLossBps,
            doubleOutDone: true,
            status: "partial",
            lastExitReason: "double_out",
            openedAt: position.openedAt,
          });
        }
      }
      const user = await getUser(this.env.DB, position.telegramUserId);
      if (user?.telegram_chat_id) {
        const exitMsg = shouldStop
          ? `🛑 <b>Follow stop loss hit</b>\n\n${escapeHtml(position.title)}\n${escapeHtml(position.outcome)} at <b>${currentPrice.toFixed(4)}</b>`
          : shouldFixedTp
          ? `🎯 <b>Follow take profit hit</b> (+${(Number(position.takeProfitBps) / 100).toFixed(0)}%)\n\n${escapeHtml(position.title)}\n${escapeHtml(position.outcome)} at <b>${currentPrice.toFixed(4)}</b>`
          : `💰 <b>Follow double-out hit</b>\n\n${escapeHtml(position.title)}\n${escapeHtml(position.outcome)} at <b>${currentPrice.toFixed(4)}</b>`;
        await send(this.env, user.telegram_chat_id, exitMsg);
      }
      this.schedulePersist();
    }
    return {
      checked: candidates.length,
      actions,
    };
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.ctx.storage.put("runtime_state", {
        managedPositions: [...this.managedPositions.values()],
      });
    }, 250);
  }

  private async handleUserSocketMessage(telegramUserId: string, event: MessageEvent): Promise<void> {
    const current = this.userStatus.get(telegramUserId);
    if (current) current.lastMessageAt = new Date().toISOString();
    const text = typeof event.data === "string" ? event.data : "";
    if (!text || text === "PONG") {
      return;
    }
    let payload: unknown = text;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      await recordExecutionEvent(this.env.DB, {
        telegramUserId,
        eventType: "user_socket_message",
        entityType: "polymarket_user_channel",
        entityKey: telegramUserId,
        status: "received",
        detailJson: { raw: text.slice(0, 1000) },
      });
      return;
    }
    const normalizedEvents = normalizeUserSocketEvents(payload);
    for (const item of normalizedEvents) {
      await recordExecutionEvent(this.env.DB, {
        telegramUserId,
        eventType: item.eventType,
        entityType: "polymarket_user_channel",
        entityKey: item.entityKey ?? telegramUserId,
        status: "received",
        detailJson: item.payload,
      });
      if (item.eventType === "fill_update") {
        await this.applyFillEventToManagedPositions(telegramUserId, item.payload);
      }
    }
    if (normalizedEvents.some((item) => item.eventType === "fill_update" || item.eventType === "order_update")) {
      await this.reconcileManagedPositions({ telegramUserId });
    }
  }

  private async applyFillEventToManagedPositions(telegramUserId: string, payload: unknown): Promise<void> {
    if (!payload || typeof payload !== "object") return;
    const record = payload as Record<string, unknown>;
    const tokenId = String(record.asset_id ?? record.assetId ?? record.token_id ?? record.tokenId ?? "");
    if (!tokenId) return;
    const side = String(record.side ?? record.order_side ?? record.orderSide ?? "").toLowerCase();
    const filledShares = numberOrNull(
      record.matched_amount ?? record.filled_amount ?? record.size_matched ?? record.size ?? record.filledSize,
    );
    if (!(filledShares && filledShares > 0)) return;
    const matches = [...this.managedPositions.values()].filter((position) => position.telegramUserId === telegramUserId && position.tokenId === tokenId);
    if (!matches.length) return;
    const isSellLike = side.includes("sell") || side.includes("ask");
    for (const position of matches) {
      position.updatedAt = new Date().toISOString();
      if (isSellLike) {
        position.remainingShares = Math.max(0, position.remainingShares - filledShares);
        if (position.remainingShares <= 0.000001) {
          this.managedPositions.delete(position.key);
          await upsertFollowManagedPosition(this.env.DB, {
            key: position.key,
            telegramUserId: position.telegramUserId,
            taskId: position.taskId,
            walletAddress: position.walletAddress,
            marketSlug: position.marketSlug,
            tokenId: position.tokenId,
            title: position.title,
            outcome: position.outcome,
            entryPrice: position.entryPrice,
            amountUsdc: position.amountUsdc,
            principalUsdc: position.principalUsdc,
            estimatedShares: position.estimatedShares,
            remainingShares: 0,
            takeProfitMode: position.takeProfitMode,
            stopLossBps: position.stopLossBps,
            doubleOutDone: position.doubleOutDone,
            status: "closed",
            lastExitReason: "fill_event",
            openedAt: position.openedAt,
            closedAt: position.updatedAt,
          });
        } else {
          this.managedPositions.set(position.key, position);
          await upsertFollowManagedPosition(this.env.DB, {
            key: position.key,
            telegramUserId: position.telegramUserId,
            taskId: position.taskId,
            walletAddress: position.walletAddress,
            marketSlug: position.marketSlug,
            tokenId: position.tokenId,
            title: position.title,
            outcome: position.outcome,
            entryPrice: position.entryPrice,
            amountUsdc: position.amountUsdc,
            principalUsdc: position.principalUsdc,
            estimatedShares: position.estimatedShares,
            remainingShares: position.remainingShares,
            takeProfitMode: position.takeProfitMode,
            stopLossBps: position.stopLossBps,
            doubleOutDone: position.doubleOutDone,
            status: "partial",
            lastExitReason: "fill_event",
            openedAt: position.openedAt,
          });
        }
        await recordExecutionEvent(this.env.DB, {
          telegramUserId,
          eventType: "follow_position_fill_applied",
          entityType: "follow_managed_position",
          entityKey: position.key,
          status: "applied",
          detailJson: {
            token_id: tokenId,
            side,
            filled_shares: filledShares,
            remaining_shares: position.remainingShares,
          },
        });
      }
    }
    this.schedulePersist();
  }
}

export class BotFanoutCoordinator extends DurableObject<Env> {
  private nextGlobalAt = 0;
  private readonly nextChatAt = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    const body = await request
      .json<{ chatId?: string; botId?: string; request?: MessageSendRequest }>()
      .catch(() => ({}));
    if (!body.chatId || !body.request?.text) {
      return json({ error: "Missing chat payload" }, 400);
    }

    const budgetPerSecond = await this.resolveBudgetPerSecond(body.botId ?? "primary");
    const globalGapMs = Math.max(40, Math.ceil(1000 / Math.max(1, budgetPerSecond)));
    const perChatGapMs = 1100;
    const now = Date.now();
    const dueAt = Math.max(this.nextGlobalAt, this.nextChatAt.get(body.chatId) ?? 0, now);
    const waitMs = dueAt - now;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    const messageId = await sendTelegramMessage(
      this.env,
      body.chatId,
      body.request.text,
      body.request.inlineKeyboard,
    );
    const sentAt = Date.now();
    this.nextGlobalAt = sentAt + globalGapMs;
    this.nextChatAt.set(body.chatId, sentAt + perChatGapMs);
    return json({ ok: true, messageId, bot_id: body.botId ?? "primary" });
  }

  private async resolveBudgetPerSecond(botId: string): Promise<number> {
    try {
      const row = await this.env.DB.prepare(`SELECT send_budget_per_second FROM bot_shards WHERE bot_id = ?`)
        .bind(botId)
        .first<{ send_budget_per_second: number }>();
      return Number(row?.send_budget_per_second ?? 25);
    } catch {
      return 25;
    }
  }
}

async function copyTradeByToken(
  env: Env,
  accountContext: any,
  payload: { tokenId: string; amountUsdc: number },
): Promise<{ tokenId: string; result: Record<string, unknown> }> {
  const { copyTradeByToken: executeCopyTradeByToken } = await import("./polymarket");
  return executeCopyTradeByToken(env, accountContext, payload);
}

// ---------------------------------------------------------------------------
// NewsIngestCoordinator — Durable Object for persistent news WebSocket (Treeofalpha)
// and periodic CryptoPanic polling. Maintains in-memory dedup cache.
// ---------------------------------------------------------------------------
export class NewsIngestCoordinator extends DurableObject<Env> {
  private readonly ctx: DurableObjectState;
  private toaAdapter: TreeOfAlphaAdapter | null = null;
  private cpAdapter: CryptoPanicAdapter | null = null;
  private fcsAdapter: FangchengshiAdapter | null = null;
  private sixnineAdapter: SixNineAdapter | null = null;
  private dedup = new DedupCache();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx = ctx;
    this.ctx.blockConcurrencyWhile(async () => {
      const alarm = await this.ctx.storage.getAlarm();
      if (!alarm) {
        await this.ctx.storage.setAlarm(Date.now() + 1_000);
      }
    });
  }

  private ensureAdapters(): void {
    if (!this.toaAdapter && this.env.TREEOFALPHA_API_KEY) {
      this.toaAdapter = new TreeOfAlphaAdapter(this.env.TREEOFALPHA_API_KEY);
    }
    if (!this.cpAdapter && this.env.CRYPTOPANIC_API_KEY) {
      this.cpAdapter = new CryptoPanicAdapter(this.env.CRYPTOPANIC_API_KEY);
    }
    if (!this.fcsAdapter) {
      this.fcsAdapter = new FangchengshiAdapter();
    }
    if (!this.sixnineAdapter && this.env.SIXNINE_API_KEY) {
      this.sixnineAdapter = new SixNineAdapter(this.env.SIXNINE_API_KEY);
    }
  }

  async alarm(): Promise<void> {
    this.ensureAdapters();
    const results: Array<{ source: string; count: number; error?: string }> = [];

    // Poll all configured adapters in parallel
    const adapters = [
      this.toaAdapter ? { adapter: this.toaAdapter, preConnect: true } : null,
      this.cpAdapter ? { adapter: this.cpAdapter, preConnect: false } : null,
      this.fcsAdapter ? { adapter: this.fcsAdapter, preConnect: false } : null,
      this.sixnineAdapter ? { adapter: this.sixnineAdapter, preConnect: false } : null,
    ].filter(Boolean) as Array<{ adapter: TreeOfAlphaAdapter | CryptoPanicAdapter | FangchengshiAdapter | SixNineAdapter; preConnect: boolean }>;

    for (const { adapter, preConnect } of adapters) {
      try {
        if (preConnect && adapter instanceof TreeOfAlphaAdapter && !adapter.connected) {
          await adapter.connect();
        }
        const events = await adapter.poll();
        const ingested = await this.ingestEvents(events);
        results.push({ source: adapter.name, count: ingested });
        await upsertNewsSourceHealth(this.env.DB, adapter.name, true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ source: adapter.name, count: 0, error: msg });
        await upsertNewsSourceHealth(this.env.DB, adapter.name, false, msg);
      }
    }

    // LLM mapping pass: process up to 5 unmapped news events per cycle
    if (this.env.OPENROUTER_API_KEY) {
      try {
        const unmapped = await listNewsTriggers(this.env.DB, { status: "detected", limit: 5 });
        for (const row of unmapped) {
          try {
            const result = await mapNewsToMarket(
              row.title as string,
              (row.body as string) ?? undefined,
              this.env.OPENROUTER_API_KEY,
              this.env.POLYMARKET_GAMMA_HOST,
              this.env.LUNAAI_LLM_MODEL,
            );
            await updateNewsTriggerMapping(this.env.DB, row.id as number, {
              marketSlug: result?.slug ?? null,
              selectedOutcome: result?.side ?? null,
              confidence: result?.confidence ?? 0,
              status: result?.slug ? "mapped" : "no_match",
              detailJson: result ? { reasoning: result.reasoning } : undefined,
            });
          } catch {
            // Individual mapping failure — skip and retry next cycle
          }
        }
      } catch {
        // Batch query failure — non-critical
      }
    }

    // M3: Cross-check mapped events against smart money pre-news window
    try {
      const mapped = await listNewsTriggers(this.env.DB, { status: "mapped", limit: 5 });
      for (const row of mapped) {
        if (!row.market_slug || !row.selected_outcome || !row.published_at) continue;
        try {
          const check = await crossCheckPreNewsWindow(
            this.env.DB,
            row.market_slug as string,
            row.selected_outcome as string,
            row.published_at as number,
          );
          const newConfidence = Math.min(1.0, (row.confidence as number ?? 0) + check.confidenceBoost);
          const newStatus = check.dualSignal ? "confirmed" : "mapped";
          await updateNewsTriggerDualSignal(this.env.DB, row.id as number, check.dualSignal, newConfidence, newStatus);
        } catch {
          // Individual cross-check failure — skip
        }
      }
    } catch {
      // Non-critical
    }

    // Degradation logic: compute active source count for confidence gating
    const healthRows = await listNewsSourceHealth(this.env.DB).catch(() => []);
    const now = Math.floor(Date.now() / 1000);
    const activeSources = healthRows.filter(
      (h) => h.consecutive_failures === 0 && h.last_heartbeat > now - 300,
    ).length;
    // 0 sources → stop trading; 1 source → raise threshold to 0.8; 2+ → normal 0.6
    const confidenceThreshold = activeSources === 0 ? Infinity : activeSources === 1 ? 0.8 : 0.6;

    // Auto-execution: process confirmed news events (DRY_RUN gate)
    const isDryRun = this.env.DRY_RUN !== "false";
    try {
      const confirmed = await listNewsTriggers(this.env.DB, { status: "confirmed", limit: 3 });
      for (const row of confirmed) {
        const confidence = row.confidence as number ?? 0;
        if (confidence < confidenceThreshold) continue;
        if (!row.market_slug) continue;

        if (isDryRun) {
          // Paper trading: log the would-be trade, mark as executed
          await updateNewsTriggerMapping(this.env.DB, row.id as number, {
            marketSlug: row.market_slug as string,
            selectedOutcome: row.selected_outcome as string | null,
            confidence,
            status: "dry_run_executed",
            detailJson: {
              reasoning: "DRY_RUN=true — trade logged but not executed",
              activeSources,
              confidenceThreshold,
              dualSignal: row.dual_signal,
            },
          });
          await recordCronRun(
            this.env.DB,
            "news_auto_trade",
            "dry_run",
            `news_id=${row.id}; slug=${row.market_slug}; side=${row.selected_outcome}; confidence=${confidence.toFixed(2)}; dual=${row.dual_signal}`,
          );
        } else {
          // Live execution would go here (V1 milestone — needs user account context)
          // For now, mark as ready for manual review
          await updateNewsTriggerMapping(this.env.DB, row.id as number, {
            marketSlug: row.market_slug as string,
            selectedOutcome: row.selected_outcome as string | null,
            confidence,
            status: "ready_to_execute",
            detailJson: { activeSources, confidenceThreshold },
          });
        }

        try {
          const matchedWallets = await this.env.DB.prepare(
            `SELECT DISTINCT wallet FROM smart_money_fills
               WHERE market_slug = ? AND side = ? AND ts BETWEEN ? AND ?`,
          )
            .bind(
              row.market_slug as string,
              row.selected_outcome ?? "YES",
              ((row.published_at as number) ?? 0) - 3600,
              (row.published_at as number) ?? Math.floor(Date.now() / 1000),
            )
            .all<{ wallet: string }>();

          await processConfirmedNewsTrigger(
            {
              db: this.env.DB,
              dryRun: isDryRun,
              placeOrder: async () => ({ ok: false, error: "live_exec_not_wired" }),
              notifyAdmin: this.env.LUNA_ADMIN_CHAT_ID
                ? async (msg: string) => {
                    try {
                      await sendTelegramMessage(this.env, this.env.LUNA_ADMIN_CHAT_ID!, msg);
                    } catch {
                      /* non-critical */
                    }
                  }
                : undefined,
            },
            {
              id: row.id as number,
              title: (row.title as string) ?? "",
              market_slug: (row.market_slug as string) ?? null,
              selected_outcome: (row.selected_outcome as string | null) ?? null,
              confidence: (row.confidence as number | null) ?? null,
              dual_signal: (row.dual_signal as number) ?? 0,
              published_at: (row.published_at as number) ?? 0,
              category: ((row.category as string) ?? "crypto"),
              status: (row.status as string) ?? "confirmed",
            },
            (matchedWallets.results ?? []).map((r) => r.wallet),
          );
        } catch (err) {
          console.error("auto_exec_fanout_err", err);
        }
      }
    } catch {
      // Non-critical
    }

    await this.ctx.storage.put("last_run", {
      timestamp: Date.now(),
      results,
    });

    // Re-schedule: 30s cadence
    await this.ctx.storage.setAlarm(Date.now() + 30_000);
  }

  /** Dedup and insert events into D1. Returns count of newly inserted events. */
  private async ingestEvents(events: NewsEvent[]): Promise<number> {
    let count = 0;
    for (const ev of events) {
      if (this.dedup.isDuplicate(ev.title, ev.published_at * 1000)) continue;
      await upsertNewsTrigger(this.env.DB, {
        source: ev.source,
        sourceKey: ev.source_key,
        title: ev.title,
        body: ev.body,
        lang: ev.lang,
        publishedAt: ev.published_at,
        status: "detected",
        category: ev.category,
      });
      count++;
    }
    return count;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      const lastRun = await this.ctx.storage.get<Record<string, unknown>>("last_run");
      return new Response(JSON.stringify({
        toaConnected: this.toaAdapter?.connected ?? false,
        cpConfigured: !!this.cpAdapter,
        fcsConfigured: !!this.fcsAdapter,
        sixnineConfigured: !!this.sixnineAdapter,
        dedupCacheSize: this.dedup.size,
        lastRun,
      }), { headers: { "content-type": "application/json" } });
    }

    if (url.pathname === "/poll") {
      await this.alarm();
      return new Response("ok");
    }

    return new Response("not found", { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(renderLandingPage(env.LUNA_VERSION), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true, env: env.APP_ENV, version: env.LUNA_VERSION });
    }

    if (request.method === "GET" && url.pathname === "/version") {
      return json({ version: env.LUNA_VERSION, site: env.LUNA_SITE_URL });
    }

    const shareMatch = url.pathname.match(/^\/share\/([^/]+)$/);
    if (shareMatch && request.method === "GET") {
      const telegramUserId = shareMatch[1];
      const [profileUser, summary, trades, accountContext] = await Promise.all([
        getUser(env.DB, telegramUserId),
        getUserMonetizationSummary(env.DB, telegramUserId),
        listTradeEvents(env.DB, { telegramUserId, limit: 10 }),
        getUserTradingAccountContext(env, telegramUserId),
      ]);
      if (!profileUser) {
        return new Response("Not found", { status: 404 });
      }
      const displayName = profileUser.username ? `@${profileUser.username}` : profileUser.first_name ?? `User ${telegramUserId}`;
      let liveBalanceUsdc = 0;
      let livePositionsCount = 0;
      let livePositionValueUsdc = 0;
      let liveUnrealizedPnlUsdc = 0;
      if (accountContext?.credentials) {
        try {
          const live = await fetchLiveWalletState(env, accountContext);
          const totals = summarizeLivePositions(live.positions);
          liveBalanceUsdc = live.snapshot.balanceUsdc;
          livePositionsCount = live.positions.length;
          livePositionValueUsdc = totals.positionValueUsdc;
          liveUnrealizedPnlUsdc = totals.unrealizedPnlUsdc;
        } catch {
          // Keep public page resilient if live state fetch fails.
        }
      }
      return new Response(
        renderCreatorProfile({
          displayName,
          subtitle: `Follow public receipts, not vibes. ${summary.tradeCount} public receipts, $${summary.grossAmountUsdc.toFixed(2)} gross traded, $${summary.platformFeeUsdc.toFixed(2)} fees paid.`,
          inviteLink: `https://t.me/GetLunaAIBot?start=ref_${encodeURIComponent(telegramUserId)}`,
          receiptsCount: summary.tradeCount,
          grossAmountUsdc: summary.grossAmountUsdc,
          feeAmountUsdc: summary.platformFeeUsdc,
          referralCount: summary.referralCount,
          referralEarnedUsdc: summary.referralEarnedUsdc,
          liveBalanceUsdc,
          livePositionsCount,
          livePositionValueUsdc,
          liveUnrealizedPnlUsdc,
          recentTrades: trades.map((trade) => ({
            title: trade.title ?? "Untitled trade",
            amount: trade.amount_usdc,
            eventType: trade.event_type,
          })),
        }),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    const connectMatch = url.pathname.match(/^\/connect\/([^/]+)$/);
    if (connectMatch && request.method === "GET") {
      const session = await getUserAccountLinkSession(env.DB, await hashLinkToken(connectMatch[1]));
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return new Response(
          renderConnectPortalResult({
            success: false,
            title: "Connection Link Expired",
            body: "This Luna connect link is no longer valid. Return to Telegram and use /connect again to generate a fresh secure session.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 410 },
        );
      }

      const existing = await getUserTradingAccount(env.DB, session.telegram_user_id);
      return new Response(
        renderConnectPortal({
          appName: "Luna AI",
          token: connectMatch[1],
          defaultFunderAddress: existing?.funder_address ?? undefined,
          defaultSignerAddress: existing?.signer_address ?? undefined,
          defaultAccountLabel: existing?.account_label ?? undefined,
        }),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    const safeMatch = url.pathname.match(/^\/safe\/([^/]+)$/);
    if (safeMatch && request.method === "GET") {
      const session = await getUserSafeOnboardingSession(env.DB, await hashLinkToken(safeMatch[1]));
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return new Response(
          renderConnectPortalResult({
            success: false,
            title: "Safe Onboarding Link Expired",
            body: "This Luna Safe onboarding link is no longer valid. Return to Telegram and use /safe or the wallet setup flow again.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 410 },
        );
      }

      return new Response(
        renderSafeOnboardingPortal({
          token: safeMatch[1],
          appName: "Luna AI",
          telegramUserId: session.telegram_user_id,
          remoteSignerUrl: `${resolvePublicBaseUrl(env)}/internal/builder/remote-signer`,
          configUrl: `${resolvePublicBaseUrl(env)}/safe/${safeMatch[1]}/config`,
          completionUrl: `${resolvePublicBaseUrl(env)}/safe/${safeMatch[1]}/complete`,
          builderSettingsUrl: env.POLYMARKET_BUILDER_SETTINGS_URL ?? "https://polymarket.com/settings?tab=builder",
          relayerHost: env.POLYMARKET_RELAYER_HOST ?? "https://relayer-v2.polymarket.com",
          safeOnboardingUrl: env.LUNA_SAFE_ONBOARDING_URL,
        }),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    const safeConfigMatch = url.pathname.match(/^\/safe\/([^/]+)\/config$/);
    if (safeConfigMatch && request.method === "GET") {
      const tokenHash = await hashLinkToken(safeConfigMatch[1]);
      const session = await getUserSafeOnboardingSession(env.DB, tokenHash);
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return json({ error: "Safe onboarding session expired" }, 410);
      }
      return json({
        ok: true,
        app: "Luna AI",
        telegram_user_id: session.telegram_user_id,
        chain_id: Number(env.POLYMARKET_CHAIN_ID || "137"),
        relayer_host: env.POLYMARKET_RELAYER_HOST ?? "https://relayer-v2.polymarket.com",
        builder_settings_url: env.POLYMARKET_BUILDER_SETTINGS_URL ?? "https://polymarket.com/settings?tab=builder",
        remote_signer_url: `${resolvePublicBaseUrl(env)}/internal/builder/remote-signer`,
        completion_url: `${resolvePublicBaseUrl(env)}/safe/${safeConfigMatch[1]}/complete`,
        geoblock_callback_url: `${resolvePublicBaseUrl(env)}/safe/${safeConfigMatch[1]}/geoblock`,
        official_reference_url: env.LUNA_SAFE_ONBOARDING_URL ?? "https://github.com/Polymarket/wagmi-safe-builder-example",
        integrator_fee: {
          bps: Number(env.LUNA_PLATFORM_FEE_BPS ?? "100"),
          destination_wallet: env.LUNA_PLATFORM_FEE_WALLET ?? null,
          mode: "post_fill_target",
        },
        relayer: {
          supported_tx_types: [RelayerTxType.SAFE, RelayerTxType.PROXY],
          recommended_tx_type: RelayerTxType.SAFE,
          safe_requires_explicit_deploy: true,
          proxy_auto_deploys_on_first_tx: true,
        },
        notes: [
          "Safe users should deploy via the Polymarket Builder relayer before trading.",
          "Proxy wallets may auto-deploy on first trade depending on frontend path.",
          "Builder credentials are separate from user API credentials.",
          "Geoblocked users must remain read-only.",
        ],
      });
    }

    const safeGeoblockMatch = url.pathname.match(/^\/safe\/([^/]+)\/geoblock$/);
    if (safeGeoblockMatch && request.method === "POST") {
      const tokenHash = await hashLinkToken(safeGeoblockMatch[1]);
      const session = await getUserSafeOnboardingSession(env.DB, tokenHash);
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return json({ error: "Safe onboarding session expired" }, 410);
      }

      const body = await request.json<{ blocked?: boolean | null; country?: string | null; region?: string | null }>().catch(() => ({}));
      const existing = await getUserTradingAccount(env.DB, session.telegram_user_id);
      await upsertUserTradingAccount(env.DB, {
        telegramUserId: session.telegram_user_id,
        status: existing?.status ?? "pending_link",
        authMode: existing?.auth_mode ?? "safe_builder",
        relayerTxType: deriveRelayerTxType(existing?.auth_mode ?? "safe_builder", existing?.relayer_tx_type ?? null),
        safeDeployed: existing?.safe_deployed === 1,
        signatureType: existing?.signature_type ?? env.POLYMARKET_SIGNATURE_TYPE,
        accountLabel: existing?.account_label ?? "Luna Safe Wallet",
        signerAddress: existing?.signer_address ?? undefined,
        funderAddress: existing?.funder_address ?? undefined,
        depositAddressEvm: existing?.deposit_address_evm ?? undefined,
        depositAddressSvm: existing?.deposit_address_svm ?? undefined,
        depositAddressBtc: existing?.deposit_address_btc ?? undefined,
        depositAddressTron: existing?.deposit_address_tron ?? undefined,
        builderEnabled: existing?.builder_enabled === 1,
        geoblockBlocked: body.blocked === null || body.blocked === undefined ? undefined : Boolean(body.blocked),
        geoblockCountry: body.country ?? undefined,
        geoblockRegion: body.region ?? undefined,
        geoblockCheckedAt: new Date().toISOString(),
        lastVerifiedAt: existing?.last_verified_at ?? undefined,
      });
      return json({ ok: true });
    }

    const safeCompleteMatch = url.pathname.match(/^\/safe\/([^/]+)\/complete$/);
    if (safeCompleteMatch && request.method === "POST") {
      const tokenHash = await hashLinkToken(safeCompleteMatch[1]);
      const session = await getUserSafeOnboardingSession(env.DB, tokenHash);
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return json({ error: "Safe onboarding session expired" }, 410);
      }

      const body = await request.json<{
        account_label?: string;
        signer_address?: string;
        funder_address?: string;
        relayer_tx_type?: "SAFE" | "PROXY";
        safe_deployed?: boolean;
        signature_type?: string;
        polymarket_private_key?: string;
        polymarket_api_key?: string;
        polymarket_api_secret?: string;
        polymarket_api_passphrase?: string;
      }>().catch(() => ({}));

      const signerAddress = String(body.signer_address ?? "").trim().toLowerCase();
      const funderAddress = String(body.funder_address ?? "").trim().toLowerCase();
      if (!isValidEvmAddress(funderAddress) || !isValidEvmAddress(signerAddress)) {
          return json({ error: "signer_address and funder_address must be valid EVM addresses" }, 400);
      }

      const existing = await getUserTradingAccount(env.DB, session.telegram_user_id);
      const geoblocked = existing?.geoblock_blocked === 1;
      const credentialsProvided = Boolean(
        body.polymarket_private_key &&
          body.polymarket_api_key &&
          body.polymarket_api_secret &&
          body.polymarket_api_passphrase,
      );
      const finalStatus: "tradable" | "linked_readonly" = credentialsProvided && !geoblocked ? "tradable" : "linked_readonly";

      await upsertUserTradingAccount(env.DB, {
        telegramUserId: session.telegram_user_id,
        status: finalStatus,
        authMode: "safe_builder",
        relayerTxType: deriveRelayerTxType("safe_builder", body.relayer_tx_type ?? "SAFE"),
        safeDeployed: Boolean(body.safe_deployed),
        signatureType: body.signature_type ?? env.POLYMARKET_SIGNATURE_TYPE,
        accountLabel: body.account_label?.trim() || "Luna Safe Wallet",
        signerAddress,
        funderAddress,
        builderEnabled: true,
        geoblockBlocked: existing?.geoblock_blocked === 1,
        geoblockCountry: existing?.geoblock_country ?? undefined,
        geoblockRegion: existing?.geoblock_region ?? undefined,
        geoblockCheckedAt: existing?.geoblock_checked_at ?? undefined,
        lastVerifiedAt: new Date().toISOString(),
      });

      if (credentialsProvided) {
        await saveUserTradingCredentials(env, {
          telegramUserId: session.telegram_user_id,
          credentials: {
            polymarketPrivateKey: body.polymarket_private_key,
            polymarketApiKey: body.polymarket_api_key,
            polymarketApiSecret: body.polymarket_api_secret,
            polymarketApiPassphrase: body.polymarket_api_passphrase,
          },
        });
      }

      const accountContext = await getUserTradingAccountContext(env, session.telegram_user_id);
      let bridgeAddresses: Record<string, string> = {};
      if (accountContext) {
        try {
          bridgeAddresses = await fetchBridgeAddresses(env, accountContext);
        } catch {
          bridgeAddresses = {};
        }
      }
      await upsertUserTradingAccount(env.DB, {
        telegramUserId: session.telegram_user_id,
        status: finalStatus,
        authMode: "safe_builder",
        relayerTxType: deriveRelayerTxType("safe_builder", body.relayer_tx_type ?? "SAFE"),
        safeDeployed: Boolean(body.safe_deployed),
        signatureType: body.signature_type ?? env.POLYMARKET_SIGNATURE_TYPE,
        accountLabel: body.account_label?.trim() || "Luna Safe Wallet",
        signerAddress,
        funderAddress,
        depositAddressEvm: bridgeAddresses.evm,
        depositAddressSvm: bridgeAddresses.svm,
        depositAddressBtc: bridgeAddresses.btc,
        depositAddressTron: bridgeAddresses.tron,
        builderEnabled: true,
        geoblockBlocked: existing?.geoblock_blocked === 1,
        geoblockCountry: existing?.geoblock_country ?? undefined,
        geoblockRegion: existing?.geoblock_region ?? undefined,
        geoblockCheckedAt: existing?.geoblock_checked_at ?? undefined,
        lastVerifiedAt: new Date().toISOString(),
      });
      await markUserSafeOnboardingSessionUsed(env.DB, tokenHash);

      const user = await getUser(env.DB, session.telegram_user_id);
      if (user?.telegram_chat_id) {
        const linkedAccount = await getUserTradingAccount(env.DB, session.telegram_user_id);
        if (linkedAccount) {
          await send(
            env,
            user.telegram_chat_id,
            geoblocked
              ? user.language === "zh"
                ? `🛡 <b>Safe Onboarding 已记录</b>\n\n检测到当前浏览器位于受限制地区，Luna 会将该账户保持为 <b>只读</b>。\n\n国家/地区：<code>${escapeForInline(linkedAccount.geoblock_country ?? "-")}</code> · 区域：<code>${escapeForInline(linkedAccount.geoblock_region ?? "-")}</code>\n\n你仍然可以查看市场和钱包，但不能直接交易。`
                : `🛡 <b>Safe Onboarding recorded</b>\n\nThe browser geoblock check reported a restricted region, so Luna will keep this account in <b>read-only</b> mode.\n\nCountry: <code>${escapeForInline(linkedAccount.geoblock_country ?? "-")}</code> · Region: <code>${escapeForInline(linkedAccount.geoblock_region ?? "-")}</code>\n\nYou can still view markets and wallet state, but trading stays disabled.`
              : credentialsProvided
              ? user.language === "zh"
                ? `🛡 <b>Safe Onboarding 已完成</b>\n\n交易钱包：<code>${escapeForInline(linkedAccount.funder_address ?? linkedAccount.signer_address ?? "-")}</code>\n状态：<b>tradable</b>\n现在你可以直接使用 /wallet、开仓和平仓。`
                : `🛡 <b>Safe Onboarding complete</b>\n\nTrading wallet: <code>${escapeForInline(linkedAccount.funder_address ?? linkedAccount.signer_address ?? "-")}</code>\nStatus: <b>tradable</b>\nYou can now use /wallet, open positions, and close positions directly.`
              : renderWalletLinkedReadonly(user, linkedAccount),
            finalStatus === "tradable" ? await walletKeyboardForContext(env, user, await getUserTradingAccountContext(env, user.telegram_user_id)) : walletReadonlyKeyboard(user),
          );
        }
      }

      return json({ ok: true, status: finalStatus, geoblocked });
    }

    if (connectMatch && request.method === "POST") {
      const tokenHash = await hashLinkToken(connectMatch[1]);
      const session = await getUserAccountLinkSession(env.DB, tokenHash);
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return new Response(
          renderConnectPortalResult({
            success: false,
            title: "Connection Link Expired",
            body: "This Luna connect link is no longer valid. Return to Telegram and use /connect again.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 410 },
        );
      }

      const form = await request.formData();
      const submission = normalizeConnectSubmission(form);
      const validationError = validateConnectSubmission(submission);
      if (validationError) {
        return new Response(
          renderConnectPortal({
            appName: "Luna AI",
            token: connectMatch[1],
            error: validationError,
            defaultFunderAddress: submission.funderAddress,
            defaultSignerAddress: submission.signerAddress,
            defaultAccountLabel: submission.accountLabel,
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }

      const hasCredentials = Boolean(
        submission.privateKey &&
          submission.apiKey &&
          submission.apiSecret &&
          submission.apiPassphrase,
      );

      const provisionalStatus: "linked_readonly" | "tradable" = hasCredentials ? "tradable" : "linked_readonly";

      await upsertUserTradingAccount(env.DB, {
        telegramUserId: session.telegram_user_id,
        status: provisionalStatus,
        authMode: "external_proxy",
        relayerTxType: deriveRelayerTxType("external_proxy", "PROXY"),
        safeDeployed: false,
        signatureType: env.POLYMARKET_SIGNATURE_TYPE,
        accountLabel: submission.accountLabel,
        signerAddress: submission.signerAddress,
        funderAddress: submission.funderAddress,
        lastVerifiedAt: new Date().toISOString(),
      });

      if (hasCredentials) {
        await saveUserTradingCredentials(env, {
          telegramUserId: session.telegram_user_id,
          credentials: {
            polymarketPrivateKey: submission.privateKey,
            polymarketApiKey: submission.apiKey,
            polymarketApiSecret: submission.apiSecret,
            polymarketApiPassphrase: submission.apiPassphrase,
          },
        });
      }

      const candidateContext = await getUserTradingAccountContext(env, session.telegram_user_id);
      if (!candidateContext) {
        throw new Error("Failed to load linked account context");
      }

      let bridgeAddresses: Record<string, string> = {};
      try {
        bridgeAddresses = await fetchBridgeAddresses(env, candidateContext);
      } catch {
        bridgeAddresses = {};
      }

      let liveVerificationError: string | undefined;
      if (hasCredentials) {
        try {
          await fetchLiveWalletState(env, candidateContext);
        } catch (error) {
          liveVerificationError = error instanceof Error ? error.message : "Unable to verify live trading credentials";
        }
      }

      const finalStatus: "linked_readonly" | "tradable" = liveVerificationError ? "linked_readonly" : provisionalStatus;
      await upsertUserTradingAccount(env.DB, {
        telegramUserId: session.telegram_user_id,
        status: finalStatus,
        authMode: "external_proxy",
        relayerTxType: deriveRelayerTxType("external_proxy", "PROXY"),
        safeDeployed: false,
        signatureType: env.POLYMARKET_SIGNATURE_TYPE,
        accountLabel: submission.accountLabel,
        signerAddress: submission.signerAddress,
        funderAddress: submission.funderAddress,
        depositAddressEvm: bridgeAddresses.evm,
        depositAddressSvm: bridgeAddresses.svm,
        depositAddressBtc: bridgeAddresses.btc,
        depositAddressTron: bridgeAddresses.tron,
        lastVerifiedAt: new Date().toISOString(),
      });
      await markUserAccountLinkSessionUsed(env.DB, tokenHash);

      const user = await getUser(env.DB, session.telegram_user_id);
      if (user?.telegram_chat_id) {
        const account = await getUserTradingAccount(env.DB, session.telegram_user_id);
        if (account) {
          await send(
            env,
            user.telegram_chat_id,
            liveVerificationError
              ? renderTradingBlocked(
                  user,
                  user.language === "zh"
                    ? `账户已登记，但实盘凭据验证失败：${liveVerificationError}`
                    : `Account linked, but live credential verification failed: ${liveVerificationError}`,
                )
              : finalStatus === "tradable"
                ? user.language === "zh"
                  ? `✅ <b>账户已连接并可交易</b>\n\n交易钱包：<code>${escapeForInline(account.funder_address ?? account.signer_address ?? "-")}</code>\n现在你可以回到 Luna 使用 /wallet 和跟单功能。`
                  : `✅ <b>Account linked and tradable</b>\n\nTrading wallet: <code>${escapeForInline(account.funder_address ?? account.signer_address ?? "-")}</code>\nReturn to Luna and use /wallet or copy-trade now.`
                : renderWalletLinkedReadonly(user, account),
            finalStatus === "tradable" ? walletKeyboard(user) : walletReadonlyKeyboard(user),
          );
        }
      }

      return new Response(
        renderConnectPortalResult({
          success: !liveVerificationError,
          title: liveVerificationError ? "Account Linked In Read-Only Mode" : "Account Connected",
          body: liveVerificationError
            ? `Your account was stored, but live trading verification failed.\n\n${liveVerificationError}\n\nLuna downgraded this account to read-only mode. You can retry with fresh credentials from /connect.`
            : finalStatus === "tradable"
              ? "Your account is now tradable. Return to Telegram and use /wallet, copy-trade, and close-position as normal."
              : "Your account is now linked in read-only mode. Return to Telegram to inspect the wallet record or complete tradable setup later.",
        }),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    const exportMatch = url.pathname.match(/^\/export\/([^/]+)$/);
    if (exportMatch && request.method === "GET") {
      const session = await getUserAccountExportSession(env.DB, await hashLinkToken(exportMatch[1]));
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return new Response(
          renderExportPortal({
            title: "Backup Link Expired",
            body: "This Luna backup link is no longer valid. Return to Telegram and use /backupwallet again to generate a fresh secure backup link.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 410 },
        );
      }

      const account = await getUserTradingAccount(env.DB, session.telegram_user_id);
      const encrypted = await getUserTradingCredentials(env, session.telegram_user_id);
      if (!account || !encrypted || account.auth_mode !== "managed_signer") {
        return new Response(
          renderExportPortal({
            title: "Backup Unavailable",
            body: "No managed Luna wallet backup is available for this session.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 404 },
        );
      }

      const context = await getUserTradingAccountContext(env, session.telegram_user_id);
      if (!context?.credentials) {
        return new Response(
          renderExportPortal({
            title: "Backup Unavailable",
            body: "This wallet does not currently have exportable managed credentials.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 404 },
        );
      }

      const payload = JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          luna_version: env.LUNA_VERSION,
          auth_mode: account.auth_mode,
          signature_type: account.signature_type,
          funder_address: account.funder_address,
          signer_address: account.signer_address,
          deposit_address_evm: account.deposit_address_evm,
          deposit_address_svm: account.deposit_address_svm,
          deposit_address_btc: account.deposit_address_btc,
          deposit_address_tron: account.deposit_address_tron,
          credentials: context.credentials,
        },
        null,
        2,
      );
      await markUserAccountExportSessionUsed(env.DB, await hashLinkToken(exportMatch[1]));
      return new Response(
        renderExportPortal({
          title: "Managed Wallet Backup Ready",
          body: "Download this backup now and store it offline. This one-time link is now consumed after use.",
          downloadJson: payload,
          filename: `luna-wallet-backup-${session.telegram_user_id}.json`,
        }),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    const restoreMatch = url.pathname.match(/^\/restore\/([^/]+)$/);
    if (restoreMatch && request.method === "GET") {
      const session = await getUserAccountRestoreSession(env.DB, await hashLinkToken(restoreMatch[1]));
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return new Response(
          renderRestorePortal({
            appName: "Luna AI",
            token: restoreMatch[1],
            error: "This Luna restore link is no longer valid. Return to Telegram and use /restorewallet again.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 410 },
        );
      }
      return new Response(
        renderRestorePortal({
          appName: "Luna AI",
          token: restoreMatch[1],
        }),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    if (restoreMatch && request.method === "POST") {
      const tokenHash = await hashLinkToken(restoreMatch[1]);
      const session = await getUserAccountRestoreSession(env.DB, tokenHash);
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return new Response(
          renderConnectPortalResult({
            success: false,
            title: "Restore Link Expired",
            body: "This Luna restore link is no longer valid. Return to Telegram and use /restorewallet again.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 410 },
        );
      }

      const form = await request.formData();
      const backupRaw = String(form.get("backup_json") ?? "").trim();
      const restored = parseManagedWalletBackup(backupRaw);
      if ("error" in restored) {
        return new Response(
          renderRestorePortal({
            appName: "Luna AI",
            token: restoreMatch[1],
            error: restored.error,
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }

      await saveUserTradingCredentials(env, {
        telegramUserId: session.telegram_user_id,
        credentials: restored.credentials,
      });
      await upsertUserTradingAccount(env.DB, {
        telegramUserId: session.telegram_user_id,
        status: "tradable",
        authMode: "managed_signer",
        relayerTxType: deriveManagedWalletRelayerTxType(restored.signerAddress, restored.funderAddress, restored.signatureType),
        safeDeployed: false,
        signatureType: restored.signatureType,
        accountLabel: restored.accountLabel,
        signerAddress: restored.signerAddress,
        funderAddress: restored.funderAddress,
        depositAddressEvm: restored.depositAddressEvm,
        depositAddressSvm: restored.depositAddressSvm,
        depositAddressBtc: restored.depositAddressBtc,
        depositAddressTron: restored.depositAddressTron,
        lastVerifiedAt: new Date().toISOString(),
      });

      const restoredContext = await getUserTradingAccountContext(env, session.telegram_user_id);
      if (!restoredContext?.credentials) {
        throw new Error("Failed to load restored account context");
      }

      let bridgeAddresses: Record<string, string> = {};
      try {
        bridgeAddresses = await fetchBridgeAddresses(env, restoredContext);
        await fetchLiveWalletState(env, restoredContext);
      } catch (error) {
        return new Response(
          renderRestorePortal({
            appName: "Luna AI",
            token: restoreMatch[1],
            error: error instanceof Error ? error.message : "Unable to verify restored wallet.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }

      await upsertUserTradingAccount(env.DB, {
        telegramUserId: session.telegram_user_id,
        status: "tradable",
        authMode: "managed_signer",
        relayerTxType: deriveManagedWalletRelayerTxType(restored.signerAddress, restored.funderAddress, restored.signatureType),
        safeDeployed: false,
        signatureType: restored.signatureType,
        accountLabel: restored.accountLabel,
        signerAddress: restored.signerAddress,
        funderAddress: restored.funderAddress,
        depositAddressEvm: bridgeAddresses.evm ?? restored.depositAddressEvm,
        depositAddressSvm: bridgeAddresses.svm ?? restored.depositAddressSvm,
        depositAddressBtc: bridgeAddresses.btc ?? restored.depositAddressBtc,
        depositAddressTron: bridgeAddresses.tron ?? restored.depositAddressTron,
        lastVerifiedAt: new Date().toISOString(),
      });
      await markUserAccountRestoreSessionUsed(env.DB, tokenHash);

      const user = await getUser(env.DB, session.telegram_user_id);
      if (user?.telegram_chat_id) {
        const account = await getUserTradingAccount(env.DB, session.telegram_user_id);
        if (account) {
          const backupUrl = await issueExportLink(env, user.telegram_user_id);
          await send(
            env,
            user.telegram_chat_id,
            user.language === "zh"
              ? `♻️ <b>Luna 钱包已恢复</b>\n\n交易钱包：<code>${escapeForInline(account.funder_address ?? account.signer_address ?? "-")}</code>\n现在你可以直接回到 /wallet 查看余额并继续交易。`
              : `♻️ <b>Luna Wallet Restored</b>\n\nTrading wallet: <code>${escapeForInline(account.funder_address ?? account.signer_address ?? "-")}</code>\nGo back to /wallet and continue trading.`,
            walletKeyboard(user, backupUrl),
          );
        }
      }

      return new Response(
        renderConnectPortalResult({
          success: true,
          title: "Wallet Restored",
          body: "Your managed Luna wallet has been restored and verified. Return to Telegram and open /wallet.",
        }),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    const withdrawMatch = url.pathname.match(/^\/withdraw\/([^/]+)$/);
    if (withdrawMatch && request.method === "GET") {
      const session = await getUserAccountWithdrawSession(env.DB, await hashLinkToken(withdrawMatch[1]));
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return new Response(
          renderWithdrawalResult({
            success: false,
            title: "Withdrawal Link Expired",
            body: "This Luna withdrawal link is no longer valid. Return to Telegram and open Withdraw again.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 410 },
        );
      }
      const presetKey = url.searchParams.get("preset") ?? "polygon_usdc";
      const preset = getWithdrawPreset(presetKey);
      const accountContext = await getUserTradingAccountContext(env, session.telegram_user_id);
      if (!accountContext?.credentials) {
        return new Response(
          renderWithdrawalResult({
            success: false,
            title: "Withdrawal Unavailable",
            body: "This account is not tradable yet. Finish wallet setup first.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }
      if (accountContext.account.auth_mode === "managed_signer" && accountContext.account.relayer_tx_type === RelayerTxType.PROXY) {
        return new Response(
          renderWithdrawalResult({
            success: false,
            title: "Legacy Wallet Migration Required",
            body:
              "This Luna wallet was created under an older managed-wallet model that is incompatible with the official relayer withdrawal path. Create a fresh Luna wallet and move funds in through Deposit before using in-app withdrawals.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }
      const wallet = await fetchLiveWalletState(env, accountContext);
      return new Response(
        renderWithdrawPortal({
          appName: "Luna AI",
          actionPath: `/withdraw/${encodeURIComponent(withdrawMatch[1])}?preset=${encodeURIComponent(preset.key)}`,
          chainLabel: preset.chainLabel,
          tokenSymbol: preset.tokenSymbol,
          maxAmountUsdc: wallet.snapshot.balanceUsdc,
        }),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    if (withdrawMatch && request.method === "POST") {
      const session = await getUserAccountWithdrawSession(env.DB, await hashLinkToken(withdrawMatch[1]));
      if (!session || session.status !== "open" || new Date(session.expires_at).getTime() <= Date.now()) {
        return new Response(
          renderWithdrawalResult({
            success: false,
            title: "Withdrawal Link Expired",
            body: "This Luna withdrawal link is no longer valid. Return to Telegram and open Withdraw again.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 410 },
        );
      }
      const preset = getWithdrawPreset(new URL(request.url).searchParams.get("preset") ?? "polygon_usdc");
      const form = await request.formData();
      const recipientAddress = String(form.get("recipient_address") ?? "").trim();
      const amountUsdc = Number(form.get("amount_usdc") ?? "0");
      if (!isValidEvmAddress(recipientAddress)) {
        return new Response(
          renderWithdrawPortal({
            appName: "Luna AI",
            actionPath: `/withdraw/${encodeURIComponent(withdrawMatch[1])}?preset=${encodeURIComponent(preset.key)}`,
            chainLabel: preset.chainLabel,
            tokenSymbol: preset.tokenSymbol,
            error: "Recipient address must be a valid EVM address.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }
      // Check if recipient might be a Polymarket SAFE wallet
      const polymarketWarning = await checkPolymarketAddress(env, recipientAddress);
      if (polymarketWarning) {
        return new Response(
          renderWithdrawPortal({
            appName: "Luna AI",
            actionPath: `/withdraw/${encodeURIComponent(withdrawMatch[1])}?preset=${encodeURIComponent(preset.key)}`,
            chainLabel: preset.chainLabel,
            tokenSymbol: preset.tokenSymbol,
            error: polymarketWarning,
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }
      if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
        return new Response(
          renderWithdrawPortal({
            appName: "Luna AI",
            actionPath: `/withdraw/${encodeURIComponent(withdrawMatch[1])}?preset=${encodeURIComponent(preset.key)}`,
            chainLabel: preset.chainLabel,
            tokenSymbol: preset.tokenSymbol,
            error: "Amount must be a positive USDC amount.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }
      const accountContext = await getUserTradingAccountContext(env, session.telegram_user_id);
      if (!accountContext?.credentials) {
        return new Response(
          renderWithdrawalResult({
            success: false,
            title: "Withdrawal Unavailable",
            body: "This account is not tradable yet. Finish wallet setup first.",
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }
      const wallet = await fetchLiveWalletState(env, accountContext);
      if (amountUsdc > wallet.snapshot.balanceUsdc) {
        return new Response(
          renderWithdrawPortal({
            appName: "Luna AI",
            actionPath: `/withdraw/${encodeURIComponent(withdrawMatch[1])}?preset=${encodeURIComponent(preset.key)}`,
            chainLabel: preset.chainLabel,
            tokenSymbol: preset.tokenSymbol,
            maxAmountUsdc: wallet.snapshot.balanceUsdc,
            error: `Amount exceeds available balance ${wallet.snapshot.balanceUsdc.toFixed(2)} USDC.`,
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }

      try {
        // For polygon_usdc_e (same chain, same token), transfer directly to recipient
        // This works for both:
        // - Polymarket deposit addresses: Bridge auto-detects and credits CLOB balance
        // - Regular wallets: Direct on-chain USDC.e transfer
        // For other presets, use Bridge for cross-chain or token conversion
        const isDirectTransfer = preset.key === "polygon_usdc_e";
        
        let bridgeAddress: string;
        let quote: { quoteId?: string } = {};
        
        if (isDirectTransfer) {
          // Direct transfer to recipient - no bridge intermediary needed
          bridgeAddress = recipientAddress;
        } else {
          // Use bridge for cross-chain or token conversion
          const [fetchedQuote, bridgeAddresses] = await Promise.all([
            fetchWithdrawQuote(env, {
              amountUsdc,
              destinationChainId: preset.chainId,
              destinationTokenAddress: preset.tokenAddress,
              recipientAddress,
            }),
            createWithdrawalAddresses(env, accountContext, {
              destinationChainId: preset.chainId,
              destinationTokenAddress: preset.tokenAddress,
              recipientAddress,
            }),
          ]);
          quote = fetchedQuote;
          bridgeAddress = bridgeAddresses[preset.bridgeKey];
          if (!bridgeAddress) {
            throw new Error("No bridge address was returned for this destination");
          }
        }
        
        const transfer = await transferUsdcToBridge(env, accountContext, { bridgeAddress, amountUsdc });
        if (!transfer.txHash && !transfer.transactionId) {
          throw new Error("Withdrawal transfer did not return a relayer transaction id or source tx hash");
        }
        if (transfer.transactionState === "STATE_FAILED") {
          throw new Error(
            transfer.transactionId
              ? `Withdrawal relayer transaction failed before bridge submission (${transfer.transactionId})`
              : "Withdrawal relayer transaction failed before bridge submission",
          );
        }
        await recordWithdrawalRequest(env.DB, {
          telegramUserId: session.telegram_user_id,
          destinationChain: preset.chainLabel,
          destinationChainId: preset.chainId,
          destinationTokenSymbol: preset.tokenSymbol,
          destinationTokenAddress: preset.tokenAddress,
          recipientAddress,
          bridgeAddress,
          amountUsdc,
          amountBaseUnits: transfer.amountBaseUnits,
          quoteId: quote.quoteId,
          quoteJson: quote,
          status: isDirectTransfer ? "completed" : "submitted",
          bridgeStatus: isDirectTransfer ? "DIRECT_TRANSFER" : "SUBMITTED",
          sourceTransactionId: transfer.transactionId ?? undefined,
          sourceTransactionState: transfer.transactionState ?? undefined,
          sourceTxHash: transfer.txHash,
          detail: isDirectTransfer 
            ? "direct USDC.e transfer to recipient (Polymarket deposit or external wallet)"
            : "bridge transfer submitted from managed Luna wallet",
        });
        await markUserAccountWithdrawSessionUsed(env.DB, await hashLinkToken(withdrawMatch[1]));

        const user = await getUser(env.DB, session.telegram_user_id);
        if (user?.telegram_chat_id) {
          await send(
            env,
            user.telegram_chat_id,
            user.language === "zh"
              ? isDirectTransfer
                ? `💸 <b>转账已完成</b>\n\n收款地址：<code>${escapeForInline(recipientAddress)}</code>\n金额：<b>$${amountUsdc.toFixed(2)} USDC.e</b>\n${transfer.txHash ? `交易哈希：<code>${escapeForInline(transfer.txHash)}</code>\n` : ""}${transfer.transactionId ? `Relayer ID：<code>${escapeForInline(transfer.transactionId)}</code>\n` : ""}\n如果收款地址是 Polymarket deposit 地址，余额将在几秒内到账。`
                : `💸 <b>提现已提交</b>\n\n目标链：${preset.chainLabel}\n收款地址：<code>${escapeForInline(recipientAddress)}</code>\n金额：<b>$${amountUsdc.toFixed(2)}</b>\n桥地址：<code>${escapeForInline(bridgeAddress)}</code>\n${transfer.txHash ? `源 tx：<code>${escapeForInline(transfer.txHash)}</code>\n` : ""}${transfer.transactionId ? `Relayer 事务：<code>${escapeForInline(transfer.transactionId)}</code>\n` : ""}\n系统会继续轮询桥接状态并更新回执。`
              : isDirectTransfer
                ? `💸 <b>Transfer completed</b>\n\nRecipient: <code>${escapeForInline(recipientAddress)}</code>\nAmount: <b>$${amountUsdc.toFixed(2)} USDC.e</b>\n${transfer.txHash ? `Tx hash: <code>${escapeForInline(transfer.txHash)}</code>\n` : ""}${transfer.transactionId ? `Relayer ID: <code>${escapeForInline(transfer.transactionId)}</code>\n` : ""}\nIf recipient is a Polymarket deposit address, balance will arrive within seconds.`
                : `💸 <b>Withdrawal submitted</b>\n\nDestination: ${preset.chainLabel}\nRecipient: <code>${escapeForInline(recipientAddress)}</code>\nAmount: <b>$${amountUsdc.toFixed(2)}</b>\nBridge address: <code>${escapeForInline(bridgeAddress)}</code>\n${transfer.txHash ? `Source tx: <code>${escapeForInline(transfer.txHash)}</code>\n` : ""}${transfer.transactionId ? `Relayer tx: <code>${escapeForInline(transfer.transactionId)}</code>\n` : ""}\nLuna will keep polling bridge status and update your receipts.`,
            receiptsKeyboard(user),
          );
        }

        return new Response(
          renderWithdrawalResult({
            success: true,
            title: isDirectTransfer ? "Transfer Completed" : "Withdrawal Submitted",
            body: isDirectTransfer
              ? `Recipient: ${recipientAddress}\nAmount: $${amountUsdc.toFixed(2)} USDC.e\n${transfer.txHash ? `Tx hash: ${transfer.txHash}\n` : ""}${transfer.transactionId ? `Relayer ID: ${transfer.transactionId}` : ""}`.trim()
              : `Destination: ${preset.chainLabel}\nRecipient: ${recipientAddress}\nAmount: $${amountUsdc.toFixed(2)}\nBridge address: ${bridgeAddress}\n${transfer.txHash ? `Source tx: ${transfer.txHash}\n` : ""}${transfer.transactionId ? `Relayer tx: ${transfer.transactionId}` : ""}`.trim(),
          }),
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      } catch (error) {
        return new Response(
          renderWithdrawPortal({
            appName: "Luna AI",
            actionPath: `/withdraw/${encodeURIComponent(withdrawMatch[1])}?preset=${encodeURIComponent(preset.key)}`,
            chainLabel: preset.chainLabel,
            tokenSymbol: preset.tokenSymbol,
            maxAmountUsdc: wallet.snapshot.balanceUsdc,
            error: formatWithdrawFailure(error),
          }),
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 400 },
        );
      }
    }

    if (request.method === "GET" && url.pathname === "/internal/monetization") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const [summary, builderStatus] = await Promise.all([
        getMonetizationSummary(env.DB),
        Promise.resolve(getBuilderStatus(env)),
      ]);
      return json({
        ok: true,
        fee_bps: Number(env.LUNA_PLATFORM_FEE_BPS ?? "100"),
        fee_wallet: env.LUNA_PLATFORM_FEE_WALLET ?? null,
        split: {
          treasury_bps: Number(env.LUNA_TREASURY_SPLIT_BPS ?? "7000"),
          operations_bps: Number(env.LUNA_OPERATIONS_SPLIT_BPS ?? "2000"),
          referral_bps: Number(env.LUNA_REFERRAL_SPLIT_BPS ?? "500"),
          builder_reserve_bps: Number(env.LUNA_BUILDER_SPLIT_BPS ?? "500"),
          treasury_wallet: env.LUNA_TREASURY_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET ?? null,
          operations_wallet: env.LUNA_OPERATIONS_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET ?? null,
          referral_wallet: env.LUNA_REFERRAL_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET ?? null,
          builder_reserve_wallet: env.LUNA_BUILDER_RESERVE_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET ?? null,
        },
        summary,
        builder: builderStatus,
        notes: {
          revshare_protocol_requires_polymarket_tier: true,
          automated_fee_sweep_enabled: false,
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/internal/news-triggers") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const status = url.searchParams.get("status") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const rows = await listNewsTriggers(env.DB, { status, limit });
      return json({ ok: true, rows });
    }

    if (request.method === "GET" && url.pathname === "/internal/runtime-events") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const telegramUserId = url.searchParams.get("telegram_user_id") ?? undefined;
      const entityType = url.searchParams.get("entity_type") ?? undefined;
      const eventType = url.searchParams.get("event_type") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const rows = await listExecutionEvents(env.DB, { telegramUserId, entityType, eventType, limit });
      return json({ ok: true, rows });
    }

    if (request.method === "POST" && url.pathname === "/internal/news-triggers") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{
          source?: string;
          source_key?: string;
          title?: string;
          market_slug?: string | null;
          confidence?: number | null;
          status?: string;
          execution_ref?: string | null;
          detail_json?: unknown;
          notify_chat_id?: string | null;
          category?: string;
        }>()
        .catch(() => ({}));
      if (!body.source || !body.source_key || !body.title) {
        return json({ error: "source, source_key, title are required" }, 400);
      }
      if (!isAllowedNewsSource(body.source)) {
        return json({ error: "source is not in whitelist" }, 400);
      }
      await upsertNewsTrigger(env.DB, {
        source: body.source,
        sourceKey: body.source_key,
        title: body.title,
        marketSlug: body.market_slug ?? null,
        confidence: body.confidence ?? null,
        status: body.status ?? (body.market_slug ? "mapped" : "detected"),
        executionRef: body.execution_ref ?? null,
        detailJson: body.detail_json,
        category: body.category,
      });
      await recordExecutionEvent(env.DB, {
        telegramUserId: "system",
        eventType: "news_trigger_update",
        entityType: "runtime_event",
        entityKey: `${body.source}:${body.source_key}`,
        status: body.status ?? (body.market_slug ? "mapped" : "detected"),
        detailJson: {
          source: body.source,
          source_key: body.source_key,
          title: body.title,
          market_slug: body.market_slug ?? null,
          confidence: body.confidence ?? null,
          execution_ref: body.execution_ref ?? null,
          detail_json: body.detail_json ?? null,
        },
      });
      if (body.market_slug) {
        await subscribeMarketStream(env, {
          slug: body.market_slug,
          includeRtds: true,
          rtdsSubscriptions: [{ topic: "live_markets", type: "market", filters: body.market_slug }],
        }).catch(() => undefined);
      }
      if (body.notify_chat_id) {
        await send(
          env,
          body.notify_chat_id,
          renderNewsTriggerAlert(body.title, body.source, body.market_slug ?? null, body.status ?? "detected"),
        );
      }
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/internal/market-stream/prewarm") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request.json<{ slug?: string; outcome?: string | null }>().catch(() => ({}));
      if (!body.slug) {
        return json({ error: "slug is required" }, 400);
      }
      const stub = getMarketStreamStub(env);
      const response = await stub.fetch(`https://market.internal/preview?slug=${encodeURIComponent(body.slug)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: body.outcome ?? null }),
      });
      const payload = await response.json<unknown>().catch(() => null);
      return json({ ok: response.ok, payload });
    }

    if (request.method === "POST" && url.pathname === "/internal/market-stream/subscribe") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{
          slug?: string;
          outcome?: string | null;
          include_sports?: boolean;
          include_rtds?: boolean;
          rtds_subscriptions?: Array<{ topic: string; type: string; filters?: string | null }>;
        }>()
        .catch(() => ({}));
      if (!body.slug) {
        return json({ error: "slug is required" }, 400);
      }
      const stub = getMarketStreamStub(env);
      const response = await stub.fetch("https://market.internal/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: body.slug,
          outcome: body.outcome ?? null,
          includeSports: Boolean(body.include_sports),
          includeRtds: Boolean(body.include_rtds),
          rtdsSubscriptions: body.rtds_subscriptions ?? [],
        }),
      });
      const payload = await response.json<unknown>().catch(() => null);
      return json({ ok: response.ok, payload }, response.ok ? 200 : 500);
    }

    if (request.method === "GET" && url.pathname === "/internal/market-stream/status") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const stub = getMarketStreamStub(env);
      const response = await stub.fetch("https://market.internal/status");
      const payload = await response.json<unknown>().catch(() => null);
      return json({ ok: response.ok, payload }, response.ok ? 200 : 500);
    }

    if (request.method === "GET" && url.pathname === "/internal/arb-opportunities") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const status = url.searchParams.get("status") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const rows = await listArbOpportunities(env.DB, { status, limit });
      return json({ ok: true, rows });
    }

    if (request.method === "POST" && url.pathname === "/internal/arb-opportunities") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{
          polymarket_slug?: string;
          kalshi_ticker?: string | null;
          spread_bps?: number;
          net_edge_bps?: number;
          liquidity_score?: number | null;
          status?: string;
          detail_json?: unknown;
          notify_chat_id?: string | null;
        }>()
        .catch(() => ({}));
      if (!body.polymarket_slug) {
        return json({ error: "polymarket_slug is required" }, 400);
      }
      await upsertArbOpportunity(env.DB, {
        polymarketSlug: body.polymarket_slug,
        kalshiTicker: body.kalshi_ticker ?? null,
        spreadBps: body.spread_bps ?? 0,
        netEdgeBps: body.net_edge_bps ?? 0,
        liquidityScore: body.liquidity_score ?? null,
        status: body.status ?? "open",
        detailJson: body.detail_json,
      });
      await recordExecutionEvent(env.DB, {
        telegramUserId: "system",
        eventType: "arb_opportunity_update",
        entityType: "runtime_event",
        entityKey: `${body.polymarket_slug}:${body.kalshi_ticker ?? ""}`,
        status: body.status ?? "open",
        detailJson: {
          polymarket_slug: body.polymarket_slug,
          kalshi_ticker: body.kalshi_ticker ?? null,
          spread_bps: body.spread_bps ?? 0,
          net_edge_bps: body.net_edge_bps ?? 0,
          liquidity_score: body.liquidity_score ?? null,
          detail_json: body.detail_json ?? null,
        },
      });
      if (body.notify_chat_id) {
        await send(
          env,
          body.notify_chat_id,
          renderArbAlert(body.polymarket_slug, body.kalshi_ticker ?? null, body.spread_bps ?? 0, body.net_edge_bps ?? 0, body.status ?? "open"),
        );
      }
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/internal/arb-scan") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{
          polymarket_slug?: string;
          kalshi_ticker?: string | null;
          polymarket_price?: number;
          polymarket_outcome?: string | null;
          kalshi_price?: number;
          liquidity_score?: number | null;
          slippage_bps?: number | null;
        }>()
        .catch(() => ({}));
      if (!body.polymarket_slug || !Number.isFinite(body.kalshi_price)) {
        return json({ error: "polymarket_slug and kalshi_price are required" }, 400);
      }
      let polymarketPrice = Number(body.polymarket_price);
      if (!Number.isFinite(polymarketPrice)) {
        const preview = await loadMarketPreview(
          env,
          `https://polymarket.com/event/${encodeURIComponent(body.polymarket_slug)}`,
          body.polymarket_slug,
          body.polymarket_outcome ?? null,
        ).catch(() => null);
        polymarketPrice = preview
          ? Number(inferOutcomePrice(preview, body.polymarket_outcome ?? preview.selectedOutcome ?? null))
          : Number.NaN;
      }
      if (!Number.isFinite(polymarketPrice)) {
        return json({ error: "polymarket_price is required when live preview cannot determine it" }, 400);
      }
      const scan = buildArbScanResult(env, {
        polymarketSlug: body.polymarket_slug,
        kalshiTicker: body.kalshi_ticker ?? null,
        polymarketPrice,
        kalshiPrice: Number(body.kalshi_price),
        liquidityScore: body.liquidity_score ?? null,
        slippageBps: body.slippage_bps ?? null,
      });
      await subscribeMarketStream(env, {
        slug: body.polymarket_slug,
        includeRtds: true,
        rtdsSubscriptions: [{ topic: "live_markets", type: "market", filters: body.polymarket_slug }],
      }).catch(() => undefined);
      await upsertArbOpportunity(env.DB, {
        polymarketSlug: scan.polymarketSlug,
        kalshiTicker: scan.kalshiTicker,
        spreadBps: scan.spreadBps,
        netEdgeBps: scan.netEdgeBps,
        liquidityScore: scan.liquidityScore,
        status: scan.status,
        detailJson: scan,
      });
      await recordExecutionEvent(env.DB, {
        telegramUserId: "system",
        eventType: "arb_opportunity_update",
        entityType: "runtime_event",
        entityKey: `${scan.polymarketSlug}:${scan.kalshiTicker ?? ""}`,
        status: scan.status,
        detailJson: scan,
      });
      return json({ ok: true, scan });
    }

    if (request.method === "POST" && url.pathname === "/internal/runtime-wallet-metrics") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{
          address?: string;
          settled_trade_count?: number | null;
          avg_holding_period_hours?: number | null;
          kelly_consistency_score?: number | null;
          copy_suitability_score?: number | null;
        }>()
        .catch(() => ({}));
      if (!body.address) {
        return json({ error: "address is required" }, 400);
      }
      await upsertRuntimeWalletMetrics(env.DB, {
        address: body.address,
        settledTradeCount: body.settled_trade_count ?? null,
        avgHoldingPeriodHours: body.avg_holding_period_hours ?? null,
        kellyConsistencyScore: body.kelly_consistency_score ?? null,
        copySuitabilityScore: body.copy_suitability_score ?? null,
      });
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/internal/follow/trigger") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{
          wallet_address?: string;
          token_id?: string;
          title?: string;
          outcome?: string;
          trigger_amount_usdc?: number;
          side?: "buy" | "sell";
          scope?: "all" | "sports";
          market_slug?: string | null;
        }>()
        .catch(() => ({}));
      if (!body.wallet_address || !body.token_id || !body.title || !body.outcome) {
        return json({ error: "wallet_address, token_id, title, outcome are required" }, 400);
      }
      const objectId = env.FOLLOW_ENGINE.idFromName("follow:global");
      const stub = env.FOLLOW_ENGINE.get(objectId);
      const response = await stub.fetch("https://follow.internal/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: body.wallet_address,
          tokenId: body.token_id,
          title: body.title,
          outcome: body.outcome,
          triggerAmountUsdc: Number(body.trigger_amount_usdc ?? 0),
          side: body.side ?? "buy",
          scope: body.scope ?? "all",
          marketSlug: body.market_slug ?? null,
        }),
      });
      const result = await response.json<unknown>().catch(() => null);
      return json(response.ok ? result ?? { ok: true } : { ok: false, result }, response.ok ? 200 : 500);
    }

    if (request.method === "GET" && url.pathname === "/internal/follow/status") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const objectId = env.FOLLOW_ENGINE.idFromName("follow:global");
      const stub = env.FOLLOW_ENGINE.get(objectId);
      const response = await stub.fetch("https://follow.internal/status");
      const result = await response.json<unknown>().catch(() => null);
      return json(response.ok ? result ?? { ok: true } : { ok: false, result }, response.ok ? 200 : 500);
    }

    if (request.method === "POST" && url.pathname === "/internal/follow/reconcile") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{ telegram_user_id?: string; key?: string }>()
        .catch(() => ({}));
      const objectId = env.FOLLOW_ENGINE.idFromName("follow:global");
      const stub = env.FOLLOW_ENGINE.get(objectId);
      const response = await stub.fetch("https://follow.internal/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          telegramUserId: body.telegram_user_id,
          key: body.key,
        }),
      });
      const result = await response.json<unknown>().catch(() => null);
      return json(response.ok ? result ?? { ok: true } : { ok: false, result }, response.ok ? 200 : 500);
    }

    if (request.method === "POST" && url.pathname === "/internal/queue/send") {
      const via = request.headers.get("x-luna-via");
      if (via !== "app-global") {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{ chatId?: string; botId?: string; request?: MessageSendRequest }>()
        .catch(() => ({}));
      if (!body.chatId || !body.request?.text) {
        return json({ error: "chatId and request.text are required" }, 400);
      }
      await routeTelegramSend(env, body.chatId, body.request, body.botId);
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/internal/monetization/ledger") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const status = url.searchParams.get("status") ?? undefined;
      const rows = await listFeeLedger(env.DB, { limit, status });
      return json({ ok: true, rows });
    }

    if (request.method === "GET" && url.pathname === "/internal/withdrawals") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const status = url.searchParams.get("status") ?? undefined;
      const rows = await listWithdrawalRequests(env.DB, { limit, status });
      return json({ ok: true, rows });
    }

    if (request.method === "GET" && url.pathname === "/internal/user-account") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const telegramUserId = url.searchParams.get("telegram_user_id");
      if (!telegramUserId) {
        return json({ error: "telegram_user_id is required" }, 400);
      }
      const [account, credentials] = await Promise.all([
        getUserTradingAccount(env.DB, telegramUserId),
        getUserTradingAccountContext(env, telegramUserId).catch(() => null),
      ]);
      return json({
        ok: true,
        account,
        credentials_present: Boolean(credentials?.credentials),
      });
    }

    if (request.method === "GET" && url.pathname === "/internal/user-account/relayer-status") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const telegramUserId = url.searchParams.get("telegram_user_id");
      if (!telegramUserId) {
        return json({ error: "telegram_user_id is required" }, 400);
      }
      const accountContext = await getUserTradingAccountContext(env, telegramUserId);
      if (!accountContext) {
        return json({ error: "user trading account not found" }, 404);
      }
      const relayer = buildRelayerTransactionShape(accountContext);
      return json({
        ok: true,
        tx_type: relayer.txType,
        safe_deployed: relayer.safeDeployed,
        builder_enabled: accountContext.account.builder_enabled === 1,
        signer_address: accountContext.account.signer_address,
        funder_address: accountContext.account.funder_address,
        auth_mode: accountContext.account.auth_mode,
      });
    }

    if (request.method === "POST" && url.pathname === "/internal/builder/remote-signer") {
      const expectedToken = env.BUILDER_REMOTE_SIGNER_TOKEN?.trim();
      const authHeader = request.headers.get("authorization") ?? "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!expectedToken || bearer !== expectedToken) {
        return json({ error: "Unauthorized" }, 401);
      }
      if (
        !env.POLYMARKET_BUILDER_API_KEY?.trim() ||
        !env.POLYMARKET_BUILDER_API_SECRET?.trim() ||
        !env.POLYMARKET_BUILDER_API_PASSPHRASE?.trim()
      ) {
        return json({ error: "Builder credentials are not configured" }, 503);
      }
      const body = await request.json<{ method?: string; path?: string; body?: string; timestamp?: number }>().catch(() => ({}));
      if (!body.method || !body.path) {
        return json({ error: "method and path are required" }, 400);
      }
      const signer = new BuilderSigner({
        key: env.POLYMARKET_BUILDER_API_KEY,
        secret: env.POLYMARKET_BUILDER_API_SECRET,
        passphrase: env.POLYMARKET_BUILDER_API_PASSPHRASE,
      });
      const payload = signer.createBuilderHeaderPayload(body.method, body.path, body.body, body.timestamp);
      return json(payload);
    }

    if (request.method === "GET" && url.pathname === "/internal/builder/status") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const builderStatus = getBuilderStatus(env);
      return json({
        ok: true,
        builder_enabled: builderStatus.enabled,
        builder_key_hint: builderStatus.keyHint ?? null,
        remote_signer_token_configured: Boolean(env.BUILDER_REMOTE_SIGNER_TOKEN?.trim()),
        supported_tx_types: [RelayerTxType.SAFE, RelayerTxType.PROXY],
        builder_settings_url: env.POLYMARKET_BUILDER_SETTINGS_URL ?? "https://polymarket.com/settings?tab=builder",
        relayer_host: env.POLYMARKET_RELAYER_HOST ?? "https://relayer-v2.polymarket.com",
        ip_whitelist_recommended: true,
      });
    }

    if (request.method === "GET" && url.pathname === "/internal/relayer/probe") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const address = String(url.searchParams.get("address") ?? "").trim();
      if (!isValidEvmAddress(address)) {
        return json({ error: "address must be a valid EVM address" }, 400);
      }
      const target = `${env.POLYMARKET_RELAYER_HOST ?? "https://relayer-v2.polymarket.com"}/deployed?address=${encodeURIComponent(address)}`;
      const response = await fetch(target);
      const body = await response.text();
      return json({ ok: true, target, status: response.status, body });
    }

    if (request.method === "GET" && url.pathname === "/internal/user-account/list") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const status = url.searchParams.get("status") as "pending_link" | "linked_readonly" | "tradable" | null;
      const limit = Number(url.searchParams.get("limit") ?? "100");
      const rows = await listUserTradingAccounts(env.DB, { status: status ?? undefined, limit });
      return json({ ok: true, rows });
    }

    if (request.method === "POST" && url.pathname === "/internal/user-account/register") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request.json<{
        telegram_user_id?: string;
        status?: "pending_link" | "linked_readonly" | "tradable";
        auth_mode?: "external_proxy" | "managed_signer" | "safe_builder";
        relayer_tx_type?: "SAFE" | "PROXY";
        safe_deployed?: boolean;
        signature_type?: string;
        account_label?: string;
        signer_address?: string;
        funder_address?: string;
        deposit_address_evm?: string;
        deposit_address_svm?: string;
        deposit_address_btc?: string;
        deposit_address_tron?: string;
        builder_enabled?: boolean;
        last_verified_at?: string;
      }>().catch(() => ({}));
      if (!body.telegram_user_id) {
        return json({ error: "telegram_user_id is required" }, 400);
      }
      const existing = await getUserTradingAccount(env.DB, body.telegram_user_id);
      await upsertUserTradingAccount(env.DB, {
        telegramUserId: body.telegram_user_id,
        status: body.status ?? existing?.status ?? "pending_link",
        authMode: body.auth_mode ?? existing?.auth_mode ?? "external_proxy",
        relayerTxType: deriveRelayerTxType(
          body.auth_mode ?? existing?.auth_mode ?? "external_proxy",
          body.relayer_tx_type ?? existing?.relayer_tx_type ?? null,
        ),
        safeDeployed: body.safe_deployed ?? (existing ? existing.safe_deployed > 0 : body.auth_mode === "safe_builder"),
        signatureType: body.signature_type ?? existing?.signature_type ?? undefined,
        accountLabel: body.account_label ?? existing?.account_label ?? undefined,
        signerAddress: body.signer_address ?? existing?.signer_address ?? undefined,
        funderAddress: body.funder_address ?? existing?.funder_address ?? undefined,
        depositAddressEvm: body.deposit_address_evm ?? existing?.deposit_address_evm ?? undefined,
        depositAddressSvm: body.deposit_address_svm ?? existing?.deposit_address_svm ?? undefined,
        depositAddressBtc: body.deposit_address_btc ?? existing?.deposit_address_btc ?? undefined,
        depositAddressTron: body.deposit_address_tron ?? existing?.deposit_address_tron ?? undefined,
        builderEnabled: body.builder_enabled ?? (existing ? existing.builder_enabled > 0 : false),
        lastVerifiedAt: body.last_verified_at ?? existing?.last_verified_at ?? undefined,
      });
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/internal/user-account/provision-managed") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request.json<{ telegram_user_id?: string; account_label?: string }>().catch(() => ({}));
      if (!body.telegram_user_id) {
        return json({ error: "telegram_user_id is required" }, 400);
      }
      if (!env.USER_ACCOUNT_ENCRYPTION_SECRET?.trim()) {
        return json({ error: "USER_ACCOUNT_ENCRYPTION_SECRET is not configured" }, 500);
      }
      const managed = await provisionManagedTradingAccount(env, {
        accountLabel: body.account_label ?? "Luna Managed Wallet",
      });
      await upsertUserTradingAccount(env.DB, {
        telegramUserId: body.telegram_user_id,
        status: "pending_link",
        authMode: "managed_signer",
        relayerTxType: deriveManagedWalletRelayerTxType(managed.signerAddress, managed.funderAddress, managed.signatureType),
        safeDeployed: false,
        signatureType: managed.signatureType,
        accountLabel: managed.accountLabel,
        signerAddress: managed.signerAddress,
        funderAddress: managed.funderAddress,
        lastVerifiedAt: new Date().toISOString(),
      });
      await saveUserTradingCredentials(env, {
        telegramUserId: body.telegram_user_id,
        credentials: managed.credentials,
      });
      const accountContext = await getUserTradingAccountContext(env, body.telegram_user_id);
      const bridgeAddresses = accountContext ? await fetchBridgeAddresses(env, accountContext).catch(() => ({})) : {};
      await upsertUserTradingAccount(env.DB, {
        telegramUserId: body.telegram_user_id,
        status: "tradable",
        authMode: "managed_signer",
        relayerTxType: deriveManagedWalletRelayerTxType(managed.signerAddress, managed.funderAddress, managed.signatureType),
        safeDeployed: false,
        signatureType: managed.signatureType,
        accountLabel: managed.accountLabel,
        signerAddress: managed.signerAddress,
        funderAddress: managed.funderAddress,
        depositAddressEvm: bridgeAddresses.evm,
        depositAddressSvm: bridgeAddresses.svm,
        depositAddressBtc: bridgeAddresses.btc,
        depositAddressTron: bridgeAddresses.tron,
        lastVerifiedAt: new Date().toISOString(),
      });
      return json({ ok: true, signer_address: managed.signerAddress, funder_address: managed.funderAddress });
    }

    if (request.method === "POST" && url.pathname === "/internal/user-account/migrate-legacy-balance") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request.json<{ telegram_user_id?: string; amount_usdc?: number; destination_address?: string }>().catch(() => ({}));
      if (!body.telegram_user_id) {
        return json({ error: "telegram_user_id is required" }, 400);
      }
      const current = await getUserTradingAccountContext(env, body.telegram_user_id);
      if (!current?.account.deposit_address_evm) {
        return json({ error: "current managed wallet deposit address not found" }, 404);
      }
      const archived = await getLatestArchivedUserTradingAccountContext(env, body.telegram_user_id);
      if (!archived?.credentials?.polymarketPrivateKey) {
        return json({ error: "archived legacy wallet credentials not found" }, 404);
      }
      const destinationAddress = body.destination_address?.trim() || current.account.deposit_address_evm;
      if (!isValidEvmAddress(destinationAddress)) {
        return json({ error: "destination_address must be a valid EVM address" }, 400);
      }
      let amountUsdc = Number(body.amount_usdc ?? 0);
      if (!(amountUsdc > 0)) {
        const live = await fetchLiveWalletState(env, archived);
        amountUsdc = Number(live.snapshot.balanceUsdc ?? 0);
      }
      if (!(amountUsdc > 0)) {
        return json({ error: "archived wallet has no transferable balance" }, 400);
      }
      const transfer = await transferUsdcToBridge(env, archived, {
        bridgeAddress: destinationAddress,
        amountUsdc,
      });
      return json({
        ok: true,
        telegram_user_id: body.telegram_user_id,
        destination_address: destinationAddress,
        amount_usdc: amountUsdc,
        transfer,
        archived_signer_address: archived.account.signer_address,
      });
    }

    if (request.method === "POST" && url.pathname === "/internal/user-account/credentials") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request.json<{
        telegram_user_id?: string;
        polymarket_private_key?: string;
        polymarket_api_key?: string;
        polymarket_api_secret?: string;
        polymarket_api_passphrase?: string;
      }>().catch(() => ({}));
      if (!body.telegram_user_id) {
        return json({ error: "telegram_user_id is required" }, 400);
      }
      await saveUserTradingCredentials(env, {
        telegramUserId: body.telegram_user_id,
        credentials: {
          polymarketPrivateKey: body.polymarket_private_key,
          polymarketApiKey: body.polymarket_api_key,
          polymarketApiSecret: body.polymarket_api_secret,
          polymarketApiPassphrase: body.polymarket_api_passphrase,
        },
      });
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/internal/user-account/safe-deploy") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request.json<{ telegram_user_id?: string }>().catch(() => ({}));
      if (!body.telegram_user_id) {
        return json({ error: "telegram_user_id is required" }, 400);
      }
      const accountContext = await getUserTradingAccountContext(env, body.telegram_user_id);
      if (!accountContext) {
        return json({ error: "user trading account not found" }, 404);
      }
      let result;
      try {
        result = await deployTradingSafe(env, accountContext);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "Unknown safe deploy error");
        const stack = error instanceof Error ? error.stack : null;
        return json({ error: "safe_deploy_failed", message, stack }, 500);
      }
      await upsertUserTradingAccount(env.DB, {
        telegramUserId: body.telegram_user_id,
        status: accountContext.account.status,
        authMode: accountContext.account.auth_mode,
        relayerTxType: "SAFE",
        safeDeployed: true,
        signatureType: accountContext.account.signature_type ?? env.POLYMARKET_SIGNATURE_TYPE,
        accountLabel: accountContext.account.account_label ?? undefined,
        signerAddress: accountContext.account.signer_address ?? undefined,
        funderAddress: result.proxyAddress ?? accountContext.account.funder_address ?? undefined,
        depositAddressEvm: accountContext.account.deposit_address_evm ?? undefined,
        depositAddressSvm: accountContext.account.deposit_address_svm ?? undefined,
        depositAddressBtc: accountContext.account.deposit_address_btc ?? undefined,
        depositAddressTron: accountContext.account.deposit_address_tron ?? undefined,
        builderEnabled: accountContext.account.builder_enabled === 1,
        geoblockBlocked: accountContext.account.geoblock_blocked === 1,
        geoblockCountry: accountContext.account.geoblock_country ?? undefined,
        geoblockRegion: accountContext.account.geoblock_region ?? undefined,
        geoblockCheckedAt: accountContext.account.geoblock_checked_at ?? undefined,
        lastVerifiedAt: new Date().toISOString(),
      });
      return json({ ok: true, result });
    }

    if (request.method === "POST" && url.pathname === "/internal/user-account/set-approvals") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request.json<{ telegram_user_id?: string }>().catch(() => ({}));
      if (!body.telegram_user_id) {
        return json({ error: "telegram_user_id is required" }, 400);
      }
      const accountContext = await getUserTradingAccountContext(env, body.telegram_user_id);
      if (!accountContext) {
        return json({ error: "user trading account not found" }, 404);
      }
      let result;
      try {
        result = await executeTradingApprovals(env, accountContext);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "Unknown set approvals error");
        const stack = error instanceof Error ? error.stack : null;
        return json({ error: "set_approvals_failed", message, stack }, 500);
      }
      return json({ ok: true, result });
    }

    if (request.method === "POST" && url.pathname === "/internal/monetization/settle") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request.json<{ batch_id?: string; tx_ref?: string; note?: string }>().catch(() => ({}));
      const batchId = body.batch_id?.trim() || `manual-${Date.now()}`;
      const result = await settleAccruedFees(env.DB, {
        batchId,
        settlementTxRef: body.tx_ref?.trim() || undefined,
        note: body.note?.trim() || undefined,
      });
      return json({ ok: true, ...result, batch_id: batchId });
    }

    if (request.method === "POST" && url.pathname === "/internal/monetization/collect-fee") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{ telegram_user_id?: string; fee_ledger_id?: number; destination_wallet?: string }>()
        .catch(() => ({}));
      if (!body.telegram_user_id || !body.fee_ledger_id) {
        return json({ error: "telegram_user_id and fee_ledger_id are required" }, 400);
      }
      const accountContext = await getUserTradingAccountContext(env, body.telegram_user_id);
      if (!accountContext) {
        return json({ error: "user trading account not found" }, 404);
      }
      const ledgerRows = await listFeeLedger(env.DB, { telegramUserId: body.telegram_user_id, limit: 200 });
      const ledger = ledgerRows.find((row) => Number(row.id) === Number(body.fee_ledger_id));
      if (!ledger) {
        return json({ error: "fee ledger row not found" }, 404);
      }
      if (!(Number(ledger.platform_fee_usdc) > 0)) {
        return json({ error: "fee ledger row has no collectible fee" }, 400);
      }
      const result = await attemptIntegratorFeeCollection(env, accountContext, {
        feeLedgerId: Number(ledger.id),
        amountUsdc: Number(ledger.platform_fee_usdc),
        destinationWallet: body.destination_wallet?.trim() || ledger.fee_wallet || env.LUNA_PLATFORM_FEE_WALLET,
        signalId: ledger.signal_id ?? undefined,
        orderId: null,
      });
      return json({ ok: true, result });
    }

    if (request.method === "POST" && url.pathname === "/internal/user-account/transfer-pol") {
      if (!isAuthorizedInternalRequest(env, request)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const body = await request
        .json<{ telegram_user_id?: string; destination_address?: string; amount_pol?: number; use_archived?: boolean }>()
        .catch(() => ({}));
      if (!body.telegram_user_id || !body.destination_address) {
        return json({ error: "telegram_user_id and destination_address are required" }, 400);
      }
      let signerPrivateKey: string | undefined;
      if (body.use_archived) {
        const archived = await getLatestArchivedUserTradingAccountContext(env, body.telegram_user_id);
        // archived credentials use polymarketPrivateKey, current use signerPrivateKey
        signerPrivateKey = archived?.credentials?.signerPrivateKey || archived?.credentials?.polymarketPrivateKey;
      } else {
        const accountContext = await getUserTradingAccountContext(env, body.telegram_user_id);
        signerPrivateKey = accountContext?.credentials?.signerPrivateKey || accountContext?.credentials?.polymarketPrivateKey;
      }
      if (!signerPrivateKey) {
        return json({ error: "user trading account credentials not found" }, 404);
      }
      try {
        const { providers, Wallet, utils } = await import("ethers");
        const provider = new providers.StaticJsonRpcProvider(
          env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com",
          { chainId: 137, name: "matic" },
        );
        const wallet = new Wallet(signerPrivateKey, provider);
        const balance = await provider.getBalance(wallet.address);
        const feeData = await provider.getFeeData();
        const gasLimit = 21000;
        const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? utils.parseUnits("50", "gwei");
        const gasCost = gasPrice.mul(gasLimit);
        let amount;
        if (body.amount_pol && body.amount_pol > 0) {
          amount = utils.parseEther(String(body.amount_pol));
        } else {
          // Leave 0.05 POL for future gas
          const reserve = utils.parseEther("0.05");
          amount = balance.sub(gasCost).sub(reserve);
        }
        if (amount.lte(0)) {
          return json({ error: "insufficient_balance", balance: utils.formatEther(balance), gas_cost: utils.formatEther(gasCost) }, 400);
        }
        const tx = await wallet.sendTransaction({
          to: body.destination_address,
          value: amount,
          gasLimit,
          gasPrice: feeData.gasPrice,
        });
        const receipt = await tx.wait();
        return json({
          ok: true,
          from: wallet.address,
          to: body.destination_address,
          amount_pol: utils.formatEther(amount),
          tx_hash: tx.hash,
          status: receipt?.status === 1 ? "success" : "failed",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: "transfer_failed", message }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      const via = request.headers.get("x-luna-via");
      const directSecret = request.headers.get(TELEGRAM_SECRET_HEADER);
      const internalProof = request.headers.get(INTERNAL_WEBHOOK_VERIFIED_HEADER);
      const trustedInternalForward =
        via === "app-global" &&
        Boolean(env.INTERNAL_ADMIN_SECRET) &&
        internalProof === env.INTERNAL_ADMIN_SECRET;
      const trustedDirectTelegram =
        !trustedInternalForward &&
        (!env.TELEGRAM_WEBHOOK_SECRET || directSecret === env.TELEGRAM_WEBHOOK_SECRET);
      if (!trustedInternalForward && !trustedDirectTelegram) {
        return json({ error: "Unauthorized" }, 401);
      }
      try {
        const update = await request.json<TelegramUpdate>();
        await handleTelegramUpdate(env, update, ctx);
        return json({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ ok: false, error: "webhook_failed", message }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const body = message.body;
        await routeTelegramSend(env, body.chatId, body.request, body.botId);
        message.ack();
      } catch {
        message.retry();
      }
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === "*/1 * * * *") {
      ctx.waitUntil(tickNewsIngest(env, controller.cron));
      return;
    }
    if (controller.cron === "*/5 * * * *") {
      ctx.waitUntil(Promise.all([
        refreshSportsRuntime(env, controller.cron),
        reconcileFollowRuntime(env, controller.cron),
      ]).then(() => undefined));
      return;
    }
    ctx.waitUntil(syncBackofficeState(env, controller.cron));
  },
};

async function refreshSportsRuntime(env: Env, cron: string): Promise<void> {
  const generatedAt = new Date().toISOString();
  try {
    const previousSportsSignals = await getSportsSignals(env.DB);
    const signals = await fetchLiveSportsSignals(env);
    const counts = await replaceSportsSignals(env.DB, { signals, generatedAt });
    await updateRuntimeMeta(env.DB, {
      generatedAt,
      signalCount: counts.totalSignals,
      sportsSignalCount: counts.sportsSignals,
    });
    await pushNewSportsSignals(env, previousSportsSignals, signals);
    await recordCronRun(
      env.DB,
      "runtime_refresh",
      "ok",
      `cron=${cron}; sports=${counts.sportsSignals}; total=${counts.totalSignals}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sports refresh error";
    await recordCronRun(env.DB, "runtime_refresh", "error", `cron=${cron}; ${message}`);
  }
}

async function syncBackofficeState(env: Env, cron: string): Promise<void> {
  try {
    await Promise.all([
      syncPendingWithdrawals(env),
      syncRecentSettlements(env),
    ]);
    await recordCronRun(env.DB, "artifact_heartbeat", "ok", `cron=${cron}; backoffice_synced=1`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backoffice sync error";
    await recordCronRun(env.DB, "artifact_heartbeat", "error", `cron=${cron}; ${message}`);
  }
}

async function reconcileFollowRuntime(env: Env, cron: string): Promise<void> {
  try {
    const objectId = env.FOLLOW_ENGINE.idFromName("follow:global");
    const stub = env.FOLLOW_ENGINE.get(objectId);
    const response = await stub.fetch("https://follow.internal/reconcile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json<Record<string, unknown>>().catch(() => ({}));
    await recordCronRun(
      env.DB,
      "follow_reconcile",
      response.ok ? "ok" : "error",
      `cron=${cron}; checked=${Number(payload.checked ?? 0)}; actions=${Array.isArray(payload.actions) ? payload.actions.length : 0}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown follow reconcile error";
    await recordCronRun(env.DB, "follow_reconcile", "error", `cron=${cron}; ${message}`);
  }
}

async function tickNewsIngest(env: Env, cron: string): Promise<void> {
  try {
    const objectId = env.NEWS_INGEST.idFromName("news:global");
    const stub = env.NEWS_INGEST.get(objectId);
    const response = await stub.fetch("https://news.internal/poll", { method: "POST" });
    await recordCronRun(
      env.DB,
      "news_ingest",
      response.ok ? "ok" : "error",
      `cron=${cron}; status=${response.status}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown news ingest error";
    await recordCronRun(env.DB, "news_ingest", "error", `cron=${cron}; ${message}`);
  }
}

async function pushNewSportsSignals(env: Env, previousSignals: RuntimeSignal[], nextSignals: RuntimeSignal[]): Promise<void> {
  const previousSlugs = new Set(previousSignals.map((signal) => signal.slug).filter((slug): slug is string => !!slug));
  const candidates = nextSignals
    .filter((signal) => !!signal.slug)
    .filter((signal) => !previousSlugs.has(signal.slug!))
    .filter((signal) => signal.score >= 80)
    .slice(0, 3);

  if (!candidates.length) return;

  const recipients = await listSportsPushRecipients(env.DB, 80);
  if (!recipients.length) return;

  for (const recipient of recipients) {
    for (const signal of candidates) {
      if (!signal.slug) continue;
      const alreadyPushed = await wasSignalPushed(env.DB, recipient.telegram_user_id, signal.slug, "sports");
      if (alreadyPushed) continue;
      await env.PUSH_QUEUE.send({
        chatId: recipient.telegram_chat_id,
        request: {
          text: renderSportsPush(recipient.language, signal),
          inlineKeyboard: [[button(t(recipient.language, "btn.open_card"), `signal:${signal.id}`)]],
        },
      });
      await recordSignalPushReceipt(env.DB, recipient.telegram_user_id, signal.slug, "sports");
    }
  }
}

async function handleTelegramUpdate(env: Env, update: TelegramUpdate, ctx?: ExecutionContext): Promise<void> {
  if (update.message) {
    await handleTelegramMessage(env, update.message, ctx);
    return;
  }
  if (update.callback_query) {
    await handleTelegramCallback(env, update.callback_query);
  }
}

async function handleTelegramMessage(env: Env, message: TelegramMessage, ctx?: ExecutionContext): Promise<void> {
  const from = message.from;
  if (!from || !message.chat?.id) return;

  const user = await upsertUser(env.DB, {
    telegramUserId: String(from.id),
    telegramChatId: String(message.chat.id),
    from,
  });

  const rawText = (message.text ?? "").trim();
  const text = mapQuickMenuTextToCommand(rawText) ?? rawText;
  if (!text) return;

  if (text.startsWith("/link ")) {
    const parts = text.slice(6).trim().split(/\s+/).filter(Boolean);
    const funderAddress = parts[0]?.trim();
    const signerAddress = parts[1]?.trim() || funderAddress;
    if (!isValidEvmAddress(funderAddress) || !isValidEvmAddress(signerAddress)) {
      await send(
        env,
        user.telegram_chat_id,
        user.language === "zh"
          ? "地址格式不对。请使用：/link 你的_funder_地址 [你的_signer_地址]"
          : "Address format is invalid. Use: /link your_funder_address [your_signer_address]",
        walletSetupKeyboard(user),
      );
      return;
    }

    await upsertUserTradingAccount(env.DB, {
      telegramUserId: user.telegram_user_id,
      status: "linked_readonly",
      authMode: "external_proxy",
      relayerTxType: deriveRelayerTxType("external_proxy", "PROXY"),
      safeDeployed: false,
      signatureType: env.POLYMARKET_SIGNATURE_TYPE,
      accountLabel: user.username ? `@${user.username}` : `tg:${user.telegram_user_id}`,
      signerAddress,
      funderAddress,
      lastVerifiedAt: new Date().toISOString(),
    });

    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (accountContext) {
      try {
        const addresses = await fetchBridgeAddresses(env, accountContext);
        await upsertUserTradingAccount(env.DB, {
          telegramUserId: user.telegram_user_id,
          status: accountContext.account.status,
          authMode: accountContext.account.auth_mode,
          relayerTxType: deriveRelayerTxType(accountContext.account.auth_mode, accountContext.account.relayer_tx_type),
          safeDeployed: accountContext.account.safe_deployed === 1,
          signatureType: accountContext.account.signature_type ?? env.POLYMARKET_SIGNATURE_TYPE,
          accountLabel: accountContext.account.account_label ?? undefined,
          signerAddress: accountContext.account.signer_address ?? undefined,
          funderAddress: accountContext.account.funder_address ?? undefined,
          depositAddressEvm: addresses.evm,
          depositAddressSvm: addresses.svm,
          depositAddressBtc: addresses.btc,
          depositAddressTron: addresses.tron,
          builderEnabled: accountContext.account.builder_enabled === 1,
          lastVerifiedAt: new Date().toISOString(),
        });
      } catch {
        // Keep readonly account even if bridge address fetch fails.
      }
    }

    const linked = await getUserTradingAccount(env.DB, user.telegram_user_id);
    await send(
      env,
      user.telegram_chat_id,
      linked ? renderWalletLinkedReadonly(user, linked) : renderWalletConnectPrompt(user),
      walletReadonlyKeyboard(user),
    );
    return;
  }

  if (text.startsWith("/track ")) {
    const address = text.slice(7).trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      await send(env, user.telegram_chat_id, t(user.language, "address.invalid"));
      return;
    }
    await addTrackedWallet(env.DB, user.telegram_user_id, address);
    await send(env, user.telegram_chat_id, t(user.language, "tracked.added"));
    return;
  }

  const marketLink = extractPolymarketMarketLink(text);
  if (marketLink) {
    try {
      await handlePolymarketMarketLink(env, user, message, marketLink);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown market link error";
      await send(env, user.telegram_chat_id, user.language === "zh" ? `链接解析失败：${escapeHtml(detail)}` : `Unable to parse this market link: ${escapeHtml(detail)}`);
    }
    return;
  }

  if (/^\d+$/.test(text)) {
    const signal = await getRuntimeSignal(env.DB, Number(text));
    if (!signal) {
      await send(env, user.telegram_chat_id, t(user.language, "signal.not_found"));
      return;
    }
    await send(env, user.telegram_chat_id, renderSignalDetail(user, signal), signalDetailKeyboard(user, signal));
    return;
  }

  switch (normalizeCommand(text)) {
    case "/start":
      if (/^\/start\s+ref_/i.test(text)) {
        const referrerId = text.replace(/^\/start\s+ref_/i, "").trim();
        await recordReferralAttributionIfNeeded(env, user.telegram_user_id, referrerId);
        await sendReferralWelcome(env, user, referrerId);
        return;
      }
      if (/^\/start\s+worldcup/i.test(text)) {
        const [signals, wallets] = await Promise.all([getRuntimeSignals(env.DB), getRuntimeWallets(env.DB)]);
        await send(env, user.telegram_chat_id, renderWorldCupHub(user, signals, wallets), worldCupHubKeyboard(user, signals));
        return;
      }
      await sendDashboardSkeletonAndRefresh(env, user, ctx);
      return;
    case "/help": {
      const lang = user.language;
      const helpText = lang === "zh"
        ? `📖 <b>Luna 帮助</b>\n\n<b>发现机会</b>\n/start - 返回主菜单\n/discover - 看今日主推与体育窗口\n/copydesk - 看 AI 当前建议跟谁单\n/addressbook - 看地址库和候选钱包\n/follow - 看跟单任务\n/news - 看新闻狙击审计链\n/arb - 看跨所套利预警\n/worldcup - 看体育/世界杯主题\n/signals - 浏览全部交易信号\n/refer - 查看邀请赚佣入口\n/creators - 看带单达人榜\n/share - 获取公开分享页\n/pnl - 生成收益快照\n\n<b>交易与资金</b>\n/wallet - 查看余额和持仓\n/withdraw - 提现\n/receipts - 交易回执\n/settlements - 结算记录\n\n<b>钱包管理</b>\n/createwallet - 创建托管钱包\n/backupwallet - 备份钱包\n/restorewallet - 恢复钱包\n/settings - 设置（语言等）\n\n<b>费用说明</b>\n• 开仓收取 1% 平台费\n• 平仓收取 1% 平台费\n• 费用在交易金额之外额外收取\n• 所有 gas 由 Polymarket 支付\n\n<b>充值提现</b>\n• 仅支持从外部钱包充值\n• 仅支持提现到外部钱包\n• 不支持 Polymarket 用户间直接转账`
        : `📖 <b>Luna Help</b>\n\n<b>Discover</b>\n/start - Back to dashboard\n/discover - See today's best trades and sports window\n/copydesk - See who Luna thinks you should copy now\n/addressbook - Open the wallet library\n/follow - Review live follow tasks\n/news - Open the news sniper audit trail\n/arb - Open cross-exchange arb alerts\n/worldcup - Open sports / World Cup hub\n/signals - Browse all signals\n/refer - Open invite & earn\n/creators - Browse top creators\n/share - Get your public share page\n/pnl - Generate your PnL snapshot\n\n<b>Trading & Funds</b>\n/wallet - View balance and positions\n/withdraw - Withdraw funds\n/receipts - Trade receipts\n/settlements - Settlement records\n\n<b>Wallet Management</b>\n/createwallet - Create managed wallet\n/backupwallet - Backup wallet\n/restorewallet - Restore wallet\n/settings - Settings (language, etc.)\n\n<b>Fee Structure</b>\n• 1% platform fee on opening positions\n• 1% platform fee on closing positions\n• Fees are charged on top of trade amount\n• All gas paid by Polymarket\n\n<b>Deposits & Withdrawals</b>\n• Only deposit from external wallets\n• Only withdraw to external wallets\n• No direct transfers between Polymarket users`;
      await send(
        env,
        user.telegram_chat_id,
        helpText,
        dashboardKeyboard(user, await buildDashboardState(env, user, { preferCached: true })),
      );
      return;
    }
    case "/settings": {
      await send(env, user.telegram_chat_id, renderSettingsPanel(user), settingsKeyboard(user));
      return;
    }
    case "/lang":
    case "/language":
      await send(env, user.telegram_chat_id, t(user.language, "lang.choose"), languageKeyboard());
      return;
    case "/safe":
    case "/safeonboarding":
      {
        const safeUrl = await issueSafeOnboardingLink(env, user.telegram_user_id);
        await send(env, user.telegram_chat_id, buildSafeOnboardingLaunchMessage(user, safeUrl), walletSetupKeyboard(user));
      }
      return;
    case "/connect":
      {
        const connectUrl = await issueConnectLink(env, user.telegram_user_id);
        await send(env, user.telegram_chat_id, buildConnectLaunchMessage(user, connectUrl), walletSetupKeyboard(user, connectUrl));
      }
      return;
    case "/createwallet": {
      const account = await provisionManagedWalletForUser(env, user, { forceReplaceLegacy: true });
      const backupUrl = await issueExportLink(env, user.telegram_user_id);
      await send(env, user.telegram_chat_id, renderManagedWalletCreated(user, account), walletKeyboard(user, backupUrl));
      return;
    }
    case "/backupwallet": {
      const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
      if (!accountContext || accountContext.account.auth_mode !== "managed_signer" || !accountContext.credentials) {
        await send(
          env,
          user.telegram_chat_id,
          t(user.language, "backup.no_wallet"),
          walletSetupKeyboard(user),
        );
        return;
      }
      const backupUrl = await issueExportLink(env, user.telegram_user_id);
      await send(env, user.telegram_chat_id, buildBackupLaunchMessage(user, backupUrl), walletKeyboard(user, backupUrl));
      return;
    }
    case "/migratelegacy": {
      const current = await getUserTradingAccountContext(env, user.telegram_user_id);
      if (!current?.account.deposit_address_evm) {
        await send(env, user.telegram_chat_id, "No active managed wallet destination is available yet. Create a fresh wallet first with /createwallet.");
        return;
      }
      const archived = await getLatestArchivedUserTradingAccountContext(env, user.telegram_user_id);
      if (!archived?.credentials?.polymarketPrivateKey) {
        await send(env, user.telegram_chat_id, "No archived legacy wallet was found for this account.");
        return;
      }
      const live = await fetchLiveWalletState(env, archived);
      const amountUsdc = Number(live.snapshot.balanceUsdc ?? 0);
      if (!(amountUsdc > 0)) {
        await send(env, user.telegram_chat_id, "Archived legacy wallet has no transferable balance.");
        return;
      }
      try {
        const transfer = await transferUsdcToBridge(env, archived, {
          bridgeAddress: current.account.deposit_address_evm,
          amountUsdc,
        });
        await send(
          env,
          user.telegram_chat_id,
          `♻️ <b>Legacy wallet migration submitted</b>\n\nAmount: <b>$${amountUsdc.toFixed(6)}</b>\nDestination: <code>${escapeForInline(current.account.deposit_address_evm)}</code>\n${transfer.txHash ? `Source tx: <code>${escapeForInline(transfer.txHash)}</code>\n` : ""}${transfer.transactionId ? `Relayer tx: <code>${escapeForInline(transfer.transactionId)}</code>` : ""}`.trim(),
          walletKeyboard(user),
        );
      } catch (error) {
        await send(env, user.telegram_chat_id, `Legacy migration failed:\n<code>${escapeForInline(error instanceof Error ? error.message : String(error))}</code>`, walletKeyboard(user));
      }
      return;
    }
    case "/restorewallet": {
      const restoreUrl = await issueRestoreLink(env, user.telegram_user_id);
      await send(env, user.telegram_chat_id, buildRestoreLaunchMessage(user, restoreUrl), walletSetupKeyboard(user, undefined, restoreUrl));
      return;
    }
    case "/deploysafe": {
      const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
      if (!accountContext) {
        await send(env, user.telegram_chat_id, "No trading account found. Create a wallet first with /createwallet.");
        return;
      }
      const relayerShape = buildRelayerTransactionShape(accountContext);
      if (relayerShape.txType !== RelayerTxType.SAFE) {
        await send(env, user.telegram_chat_id, "This account is not configured for SAFE relayer mode.");
        return;
      }
      if (relayerShape.safeDeployed) {
        await send(env, user.telegram_chat_id, "SAFE wallet is already deployed.", walletKeyboard(user));
        return;
      }
      try {
        const result = await deployTradingSafe(env, accountContext);
        await upsertUserTradingAccount(env.DB, {
          telegramUserId: user.telegram_user_id,
          status: accountContext.account.status,
          authMode: accountContext.account.auth_mode,
          relayerTxType: "SAFE",
          safeDeployed: true,
          signatureType: accountContext.account.signature_type ?? env.POLYMARKET_SIGNATURE_TYPE,
          accountLabel: accountContext.account.account_label ?? undefined,
          signerAddress: accountContext.account.signer_address ?? undefined,
          funderAddress: result.proxyAddress ?? accountContext.account.funder_address ?? undefined,
          depositAddressEvm: accountContext.account.deposit_address_evm ?? undefined,
          depositAddressSvm: accountContext.account.deposit_address_svm ?? undefined,
          depositAddressBtc: accountContext.account.deposit_address_btc ?? undefined,
          depositAddressTron: accountContext.account.deposit_address_tron ?? undefined,
          builderEnabled: accountContext.account.builder_enabled === 1,
          geoblockBlocked: accountContext.account.geoblock_blocked === 1,
          geoblockCountry: accountContext.account.geoblock_country ?? undefined,
          geoblockRegion: accountContext.account.geoblock_region ?? undefined,
          geoblockCheckedAt: accountContext.account.geoblock_checked_at ?? undefined,
          lastVerifiedAt: new Date().toISOString(),
        });
        await send(
          env,
          user.telegram_chat_id,
          `✅ <b>SAFE wallet deployed</b>\n\nTransaction ID: <code>${escapeForInline(result.transactionId)}</code>${result.transactionHash ? `\nTx hash: <code>${escapeForInline(result.transactionHash)}</code>` : ""}${result.proxyAddress ? `\nSAFE address: <code>${escapeForInline(result.proxyAddress)}</code>` : ""}`,
          walletKeyboard(user),
        );
      } catch (error) {
        await send(env, user.telegram_chat_id, `SAFE deployment failed:\n<code>${escapeForInline(error instanceof Error ? error.message : String(error))}</code>`, walletKeyboard(user));
      }
      return;
    }
    case "/status": {
      const meta = await getRuntimeMeta(env.DB);
      const walletCount = Number(meta.wallet_count ?? 0);
      const signalCount = Number(meta.signal_count ?? 0);
      const body = user.language === "zh"
        ? `🧭 <b>Luna 状态</b>\n\n版本：${env.LUNA_VERSION}\n跟踪钱包：${walletCount}\n实时信号：${signalCount}\n环境：${env.APP_ENV}`
        : `🧭 <b>Luna Status</b>\n\nVersion: ${env.LUNA_VERSION}\nTracked wallets: ${walletCount}\nLive signals: ${signalCount}\nEnvironment: ${env.APP_ENV}`;
      const dashboard = await buildDashboardState(env, user, { preferCached: true });
      await send(env, user.telegram_chat_id, body, dashboardKeyboard(user, dashboard));
      return;
    }
    case "/discover":
    case "/today": {
      const [signals, topSignals, sportsSignals, topWallets] = await Promise.all([
        getRuntimeSignals(env.DB),
        getTopRuntimeSignals(env.DB, { sports: 0, limit: 5 }),
        getTopRuntimeSignals(env.DB, { sports: 1, limit: 4 }),
        getTopRuntimeWallets(env.DB, 5),
      ]);
      await send(env, user.telegram_chat_id, renderDiscoverHub(user, { topSignals, sportsSignals, wallets: topWallets }), discoverKeyboard(user, signals));
      return;
    }
    case "/copydesk":
    case "/copyai": {
      const copydesk = await buildCopyDeskStateForUser(env, user);
      await send(
        env,
        user.telegram_chat_id,
        renderCopyDesk(user, copydesk),
        copyDeskKeyboard(user, copydesk),
      );
      return;
    }
    case "/addressbook": {
      const state = await buildAddressBookStateForUser(env, user);
      await send(env, user.telegram_chat_id, renderAddressBook(user, state), addressBookKeyboard(user, state));
      return;
    }
    case "/follow":
    case "/copytasks": {
      const state = await buildFollowHubStateForUser(env, user);
      await send(env, user.telegram_chat_id, renderFollowTaskHub(user, state), followTasksKeyboard(user, state.tasks));
      return;
    }
    case "/news": {
      const rows = await listNewsTriggers(env.DB, { limit: 12 });
      await send(env, user.telegram_chat_id, renderNewsHub(user, rows), newsHubKeyboard(user));
      return;
    }
    case "/newshealth": {
      const healthRows = await listNewsSourceHealth(env.DB);
      const now = Math.floor(Date.now() / 1000);
      let statusText = "📡 <b>News Source Health</b>\n\n";
      if (healthRows.length === 0) {
        statusText += "No sources configured yet.";
      } else {
        for (const row of healthRows) {
          const ago = row.last_heartbeat > 0 ? `${Math.round((now - row.last_heartbeat) / 60)}m ago` : "never";
          const icon = row.consecutive_failures === 0 ? "🟢" : row.consecutive_failures < 3 ? "🟡" : "🔴";
          statusText += `${icon} <b>${row.source}</b>\n  Last heartbeat: ${ago}\n  Failures: ${row.consecutive_failures}${row.last_error ? `\n  Error: <code>${row.last_error.slice(0, 80)}</code>` : ""}\n\n`;
        }
      }
      // Also get DO status if available
      try {
        const objectId = env.NEWS_INGEST.idFromName("news:global");
        const stub = env.NEWS_INGEST.get(objectId);
        const resp = await stub.fetch("https://news.internal/status");
        const doStatus = await resp.json<Record<string, unknown>>();
        statusText += `\n🔧 <b>DO Status</b>\nToA WS: ${doStatus.toaConnected ? "🟢 connected" : "🔴 disconnected"}\nCP: ${doStatus.cpConfigured ? "✅" : "❌"}\nFCS: ${doStatus.fcsConfigured ? "✅" : "❌"}\n6551: ${doStatus.sixnineConfigured ? "✅" : "❌"}\nDedup cache: ${doStatus.dedupCacheSize} entries`;
      } catch {
        statusText += "\n⚠️ Could not reach NewsIngestCoordinator DO";
      }
      await send(env, user.telegram_chat_id, statusText);
      return;
    }
    case "/smartmoneyhealth": {
      const walletCount = await env.DB
        .prepare(`SELECT COUNT(*) as cnt FROM smart_wallets`)
        .first<{ cnt: number }>();
      const seedCount = await env.DB
        .prepare(`SELECT COUNT(*) as cnt FROM smart_wallets WHERE seed = 1`)
        .first<{ cnt: number }>();
      const qualifiedCount = await env.DB
        .prepare(`SELECT COUNT(*) as cnt FROM smart_wallets WHERE qualified = 1`)
        .first<{ cnt: number }>();
      const fillCount = await env.DB
        .prepare(`SELECT COUNT(*) as cnt FROM smart_money_fills`)
        .first<{ cnt: number }>();
      const recentFills = await env.DB
        .prepare(`SELECT COUNT(*) as cnt FROM smart_money_fills WHERE ts > ?`)
        .bind(Math.floor(Date.now() / 1000) - 3600)
        .first<{ cnt: number }>();
      const confirmedNews = await env.DB
        .prepare(`SELECT COUNT(*) as cnt FROM news_triggers WHERE dual_signal = 1`)
        .first<{ cnt: number }>();

      const smText = `🧠 <b>Smart Money Health</b>\n\n` +
        `Wallets: ${walletCount?.cnt ?? 0} total\n` +
        `  Seed: ${seedCount?.cnt ?? 0}\n` +
        `  Qualified: ${qualifiedCount?.cnt ?? 0}\n\n` +
        `Fills (2h window): ${fillCount?.cnt ?? 0}\n` +
        `Fills (last 1h): ${recentFills?.cnt ?? 0}\n\n` +
        `Dual-signal confirmed: ${confirmedNews?.cnt ?? 0} news events`;
      await send(env, user.telegram_chat_id, smText);
      return;
    }
    case "/arb": {
      const rows = await listArbOpportunities(env.DB, { limit: 12 });
      await send(env, user.telegram_chat_id, renderArbHub(user, rows), arbHubKeyboard(user));
      return;
    }
    case "/refer":
    case "/invite": {
      const { summary, recentEvents } = await buildReferralView(env, user.telegram_user_id, 5);
      await send(
        env,
        user.telegram_chat_id,
        renderReferralHub(user, {
          inviteLink: buildInviteLink(user),
          referralBps: Number(env.LUNA_REFERRAL_SPLIT_BPS ?? "500"),
          referralWallet: env.LUNA_REFERRAL_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET ?? null,
          platformFeeBps: Number(env.LUNA_PLATFORM_FEE_BPS ?? "100"),
          referralCount: summary.referralCount,
          referralEarnedUsdc: summary.referralEarnedUsdc,
          publicShareUrl: `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`,
          recentEvents,
          totalSettledFeeUsdc: summary.settledFeeUsdc,
          totalGrossVolumeUsdc: summary.grossAmountUsdc,
          feeWallet: env.LUNA_PLATFORM_FEE_WALLET ?? null,
        }),
        referKeyboard(user, `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`),
      );
      return;
    }
    case "/referrals":
    case "/ledger": {
      const { summary, recentEvents } = await buildReferralView(env, user.telegram_user_id, 12);
      await send(
        env,
        user.telegram_chat_id,
        renderReferralLedger(user, {
          referralCount: summary.referralCount,
          referralEarnedUsdc: summary.referralEarnedUsdc,
          events: recentEvents,
        }),
        referralLedgerKeyboard(user, `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`),
      );
      return;
    }
    case "/creators": {
      const creators = await listTopReferrers(env.DB, { limit: 10 });
      await send(
        env,
        user.telegram_chat_id,
        renderCreatorDirectory(
          user,
          creators.map((row) => ({
            displayName: row.username ? `@${row.username}` : row.first_name ?? `User ${row.telegram_user_id.slice(-4)}`,
            telegramUserId: row.telegram_user_id,
            referralCount: Number(row.referral_count),
            referralEarnedUsdc: Number(row.referral_earned_usdc),
            tradeCount: Number(row.trade_count),
            grossAmountUsdc: Number(row.gross_amount_usdc),
          })),
        ),
        creatorsKeyboard(
          user,
          creators.map((row) => ({
            telegramUserId: row.telegram_user_id,
            label: row.username ? `@${row.username}` : row.first_name ?? `User ${row.telegram_user_id.slice(-4)}`,
          })),
        ),
      );
      return;
    }
    case "/share": {
      const publicShareUrl = `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`;
      const body = user.language === "zh"
        ? `📣 <b>公开分享页</b>\n\n把这个链接发给朋友、群组或社群，让他们直接看到你的公开交易回执，并从你的邀请链接进入 Luna。\n\n<code>${escapeHtml(publicShareUrl)}</code>`
        : `📣 <b>Public share page</b>\n\nSend this link to friends, group chats, or your audience so they can view your public receipts and enter Luna through your invite flow.\n\n<code>${escapeHtml(publicShareUrl)}</code>`;
      await send(env, user.telegram_chat_id, body, [[{ text: "Open share page", url: publicShareUrl }], [button(t(user.language, "btn.back_dashboard"), "menu")]]);
      return;
    }
    case "/profile": {
      const publicShareUrl = `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`;
      const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
      const summary = await getUserMonetizationSummary(env.DB, user.telegram_user_id);
      const cached = accountContext ? await getCachedWalletView(env, user, accountContext) : null;
      await send(
        env,
        user.telegram_chat_id,
        renderPnlSnapshot(user, {
          balanceUsdc: cached?.balanceUsdc ?? 0,
          positionsCount: cached?.positionsCount ?? 0,
          positionValueUsdc: 0,
          unrealizedPnlUsdc: 0,
          tradeCount: summary.tradeCount,
          grossAmountUsdc: summary.grossAmountUsdc,
          platformFeeUsdc: summary.platformFeeUsdc,
          referralCount: summary.referralCount,
          referralEarnedUsdc: summary.referralEarnedUsdc,
          publicShareUrl,
          snapshotLabel: cached?.snapshotLabel,
        }),
        pnlKeyboard(user, publicShareUrl),
      );
      return;
    }
    case "/pnl": {
      const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
      if (!accountContext) {
        await send(env, user.telegram_chat_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
        return;
      }
      const publicShareUrl = `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`;
      const [cached, summary] = await Promise.all([
        getCachedWalletView(env, user, accountContext),
        getUserMonetizationSummary(env.DB, user.telegram_user_id),
      ]);
      await send(
        env,
        user.telegram_chat_id,
        renderPnlSnapshot(user, {
          balanceUsdc: cached.balanceUsdc,
          positionsCount: cached.positionsCount,
          positionValueUsdc: 0,
          unrealizedPnlUsdc: 0,
          tradeCount: summary.tradeCount,
          grossAmountUsdc: summary.grossAmountUsdc,
          platformFeeUsdc: summary.platformFeeUsdc,
          referralCount: summary.referralCount,
          referralEarnedUsdc: summary.referralEarnedUsdc,
          publicShareUrl,
          snapshotLabel: cached.snapshotLabel,
        }),
        pnlKeyboard(user, publicShareUrl),
      );
      return;
    }
    case "/signals": {
      const signals = await getRuntimeSignals(env.DB);
      await send(env, user.telegram_chat_id, renderSignalList(user, signals), signalListKeyboard(user, signals));
      return;
    }
    case "/worldcup": {
      const [signals, wallets] = await Promise.all([getRuntimeSignals(env.DB), getRuntimeWallets(env.DB)]);
      await send(env, user.telegram_chat_id, renderWorldCupHub(user, signals, wallets), worldCupHubKeyboard(user, signals));
      return;
    }
    case "/wallet": {
      const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
      if (!accountContext) {
        await send(env, user.telegram_chat_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
        return;
      }
      if (!accountContext.credentials) {
        await send(env, user.telegram_chat_id, renderWalletLinkedReadonly(user, accountContext.account), walletReadonlyKeyboard(user));
        return;
      }
      const cached = await getCachedWalletView(env, user, accountContext);
      const keyboard = await walletKeyboardForContext(env, user, accountContext);
      await send(
        env,
        user.telegram_chat_id,
        renderWallet(user, {
          address: cached.address,
          balanceUsdc: cached.balanceUsdc,
          positionsCount: cached.positionsCount,
          openOrders: cached.openOrders,
          snapshotLabel: cached.snapshotLabel,
        }),
        keyboard,
      );
      return;
    }
    case "/withdraw": {
      const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
      if (!accountContext?.credentials) {
        await send(env, user.telegram_chat_id, renderTradingBlocked(user, t(user.language, "trading.need_wallet_withdraw")), walletSetupKeyboard(user));
        return;
      }
      await send(env, user.telegram_chat_id, t(user.language, "withdraw.choose"), withdrawKeyboard(user));
      return;
    }
    case "/walletdebug": {
      const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
      if (!accountContext) {
        await send(env, user.telegram_chat_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
        return;
      }
      if (!accountContext.credentials) {
        const body = user.language === "zh"
          ? `🛠 <b>钱包调试</b>\n\nsigner: <code>${escapeForInline(accountContext.account.signer_address)}</code>\nfunder: <code>${escapeForInline(accountContext.account.funder_address)}</code>\nstatus: <b>${accountContext.account.status}</b>\nauth: <b>${accountContext.account.auth_mode}</b>\n\n当前账户已连接，但还没有可交易凭据。`
          : `🛠 <b>Wallet Debug</b>\n\nsigner: <code>${escapeForInline(accountContext.account.signer_address)}</code>\nfunder: <code>${escapeForInline(accountContext.account.funder_address)}</code>\nstatus: <b>${accountContext.account.status}</b>\nauth: <b>${accountContext.account.auth_mode}</b>\n\nThe account is linked, but no tradable credentials are provisioned yet.`;
        await send(env, user.telegram_chat_id, body, walletReadonlyKeyboard(user));
        return;
      }
      const wallet = await fetchLiveWalletState(env, accountContext);
      const body = user.language === "zh"
        ? `🛠 <b>钱包调试</b>\n\nsigner: <code>${short(accountContext.account.signer_address ?? "-")}</code>\nfunder: <code>${short(accountContext.account.funder_address ?? "-")}</code>\nwallet: <code>${wallet.snapshot.depositAddress}</code>\nbalance: <b>${wallet.snapshot.balanceUsdc.toFixed(6)} USDC</b>\npositions: <b>${wallet.positions.length}</b>\nopen_orders: <b>${wallet.snapshot.openOrdersCount}</b>\nstatus: <b>${accountContext.account.status}</b>`
        : `🛠 <b>Wallet Debug</b>\n\nsigner: <code>${short(accountContext.account.signer_address ?? "-")}</code>\nfunder: <code>${short(accountContext.account.funder_address ?? "-")}</code>\nwallet: <code>${wallet.snapshot.depositAddress}</code>\nbalance: <b>${wallet.snapshot.balanceUsdc.toFixed(6)} USDC</b>\npositions: <b>${wallet.positions.length}</b>\nopen_orders: <b>${wallet.snapshot.openOrdersCount}</b>\nstatus: <b>${accountContext.account.status}</b>`;
      const keyboard = await walletKeyboardForContext(env, user, accountContext);
      await send(env, user.telegram_chat_id, body, keyboard);
      return;
    }
    case "/receipts": {
      const [summary, trades, fees, builderEvents] = await Promise.all([
        getUserMonetizationSummary(env.DB, user.telegram_user_id),
        listTradeEvents(env.DB, { telegramUserId: user.telegram_user_id, limit: 10 }),
        listFeeLedger(env.DB, { telegramUserId: user.telegram_user_id, limit: 10 }),
        listBuilderAttributionEvents(env.DB, { telegramUserId: user.telegram_user_id, limit: 10 }),
      ]);
      await send(
        env,
        user.telegram_chat_id,
        renderAccountReceipts(user, { summary, trades, fees, builderEvents }),
        receiptsKeyboard(user),
      );
      return;
    }
    case "/settlements": {
      const rows = await syncUserSettlementState(env, user.telegram_user_id);
      await send(env, user.telegram_chat_id, renderSettlementSummary(user, rows), settlementsKeyboard(user));
      return;
    }
    case "/redeem": {
      const result = await redeemUserSettlements(env, user);
      await send(env, user.telegram_chat_id, result.text, settlementsKeyboard(user));
      return;
    }
    case "/leaderboard": {
      const wallets = await getRuntimeWallets(env.DB);
      const tracked = await listTrackedWallets(env.DB, user.telegram_user_id);
      await send(env, user.telegram_chat_id, renderLeaderboard(user, wallets, tracked));
      return;
    }
    case "/trackrecord": {
      const summary = await getSignalHistorySummary(env.DB);
      await send(
        env,
        user.telegram_chat_id,
        renderTrackRecord(user, summary),
        dashboardKeyboard(user, await buildDashboardState(env, user, { preferCached: true })),
      );
      return;
    }
    default:
      await send(env, user.telegram_chat_id, dashboardText(user), dashboardKeyboard(user));
  }
}

async function handleTelegramCallback(env: Env, callback: TelegramCallbackQuery): Promise<void> {
  const message = callback.message;
  if (!message?.chat?.id || !callback.from) return;
  await answerCallbackQuery(env, callback.id);

  const user = (await getUser(env.DB, String(callback.from.id))) ?? await upsertUser(env.DB, {
    telegramUserId: String(callback.from.id),
    telegramChatId: String(message.chat.id),
    from: callback.from,
  });

  const data = callback.data ?? "";
  const [action, ...rest] = data.split(":");

  if (action === "menu") {
    const dashboard = await buildDashboardState(env, user, { preferCached: true });
    await safeEdit(env, String(message.chat.id), message.message_id, dashboardText(user, dashboard), dashboardKeyboard(user, dashboard));
    return;
  }

  if (action === "set_lang") {
    const newLang = rest[0] as Lang;
    if (["zh", "en", "ja", "ko"].includes(newLang)) {
      await updateUserLanguage(env.DB, user.telegram_user_id, newLang);
      user.language = newLang;
      await safeEdit(env, String(message.chat.id), message.message_id, renderSettingsPanel(user), settingsKeyboard(user));
    }
    return;
  }

  if (action === "settings") {
    await safeEdit(env, String(message.chat.id), message.message_id, renderSettingsPanel(user), settingsKeyboard(user));
    return;
  }

  if (action === "settings_toggle_sports") {
    const updated = await updateUserPreferences(env.DB, user.telegram_user_id, {
      sportsEnabled: !Boolean(user.sports_enabled),
    });
    Object.assign(user, updated);
    await safeEdit(env, String(message.chat.id), message.message_id, renderSettingsPanel(user), settingsKeyboard(user));
    return;
  }

  if (action === "settings_toggle_push") {
    const updated = await updateUserPreferences(env.DB, user.telegram_user_id, {
      pushEnabled: !Boolean(user.push_enabled),
    });
    Object.assign(user, updated);
    await safeEdit(env, String(message.chat.id), message.message_id, renderSettingsPanel(user), settingsKeyboard(user));
    return;
  }

  if (action === "settings_push_score") {
    const score = Number(rest[0]);
    if ([80, 85, 90].includes(score)) {
      const updated = await updateUserPreferences(env.DB, user.telegram_user_id, {
        pushMinScore: score,
      });
      Object.assign(user, updated);
      await safeEdit(env, String(message.chat.id), message.message_id, renderSettingsPanel(user), settingsKeyboard(user));
    }
    return;
  }

  if (action === "signals") {
    const signals = await getRuntimeSignals(env.DB);
    await safeEdit(env, String(message.chat.id), message.message_id, renderSignalList(user, signals), signalListKeyboard(user, signals));
    return;
  }

  if (action === "discover") {
    const [signals, topSignals, sportsSignals, topWallets] = await Promise.all([
      getRuntimeSignals(env.DB),
      getTopRuntimeSignals(env.DB, { sports: 0, limit: 5 }),
      getTopRuntimeSignals(env.DB, { sports: 1, limit: 4 }),
      getTopRuntimeWallets(env.DB, 5),
    ]);
    await safeEdit(env, String(message.chat.id), message.message_id, renderDiscoverHub(user, { topSignals, sportsSignals, wallets: topWallets }), discoverKeyboard(user, signals));
    return;
  }

  if (action === "copydesk") {
    const copydesk = await buildCopyDeskStateForUser(env, user);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderCopyDesk(user, copydesk),
      copyDeskKeyboard(user, copydesk),
    );
    return;
  }

  if (action === "addressbook") {
    const state = await buildAddressBookStateForUser(env, user);
    await safeEdit(env, String(message.chat.id), message.message_id, renderAddressBook(user, state), addressBookKeyboard(user, state));
    return;
  }

  if (action === "follow_tasks") {
    const state = await buildFollowHubStateForUser(env, user);
    await safeEdit(env, String(message.chat.id), message.message_id, renderFollowTaskHub(user, state), followTasksKeyboard(user, state.tasks));
    return;
  }

  if (action === "news_hub") {
    const rows = await listNewsTriggers(env.DB, { limit: 12 });
    await safeEdit(env, String(message.chat.id), message.message_id, renderNewsHub(user, rows), newsHubKeyboard(user));
    return;
  }

  if (action === "arb_hub") {
    const rows = await listArbOpportunities(env.DB, { limit: 12 });
    await safeEdit(env, String(message.chat.id), message.message_id, renderArbHub(user, rows), arbHubKeyboard(user));
    return;
  }

  if (action === "address_profile") {
    const compactAddress = rest[0] ?? "";
    const [wallets, trackedAddresses, tasks] = await Promise.all([
      getRuntimeWallets(env.DB),
      listTrackedWallets(env.DB, user.telegram_user_id),
      listFollowTasks(env.DB, user.telegram_user_id),
    ]);
    const wallet = findRuntimeWalletByAddress(wallets, compactAddress);
    if (!wallet) return;
    const followTask = tasks.find((task) => task.wallet_address.toLowerCase() === wallet.address.toLowerCase()) ?? null;
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderAddressProfile(user, wallet, {
        tracked: trackedAddresses.map((item) => item.toLowerCase()).includes(wallet.address.toLowerCase()),
        followTask,
      }),
      addressProfileKeyboard(user, wallet, Boolean(followTask)),
    );
    return;
  }

  if (action === "track_wallet") {
    const compactAddress = rest[0] ?? "";
    const wallets = await getRuntimeWallets(env.DB);
    const wallet = findRuntimeWalletByAddress(wallets, compactAddress);
    if (!wallet) return;
    await addTrackedWallet(env.DB, user.telegram_user_id, wallet.address);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderAddressProfile(user, wallet, { tracked: true }),
      addressProfileKeyboard(user, wallet, false),
    );
    return;
  }

  if (action === "follow_wallet") {
    const compactAddress = rest[0] ?? "";
    const [wallets, trackedAddresses] = await Promise.all([
      getRuntimeWallets(env.DB),
      listTrackedWallets(env.DB, user.telegram_user_id),
    ]);
    const wallet = findRuntimeWalletByAddress(wallets, compactAddress);
    if (!wallet) return;
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderFollowTaskPreset(user, {
        wallet,
        tracked: trackedAddresses.map((item) => item.toLowerCase()).includes(wallet.address.toLowerCase()),
        sportsBias: isSportsWalletProfile(wallet),
      }),
      followPresetKeyboard(user, wallet),
    );
    return;
  }

  if (action === "follow_preset") {
    const compactAddress = rest[0] ?? "";
    const preset = (rest[1] ?? "b") as "c" | "b" | "a";
    const wallets = await getRuntimeWallets(env.DB);
    const wallet = findRuntimeWalletByAddress(wallets, compactAddress);
    if (!wallet) return;
    const config = buildFollowPresetConfig(wallet, preset);
    const task = await upsertFollowTask(env.DB, {
      telegramUserId: user.telegram_user_id,
      walletAddress: wallet.address,
      walletName: wallet.name,
      walletScore: wallet.score,
      walletSpecialty: isSportsWalletProfile(wallet) ? pickLang(wallet, "specialty", user.language) : null,
      scope: config.scope,
      copyAmountUsdc: config.copyAmountUsdc,
      maxPerTradeUsdc: config.maxPerTradeUsdc,
      minTradeThresholdUsdc: config.minTradeThresholdUsdc,
      direction: config.direction,
      executionMode: config.executionMode,
      takeProfitMode: "double_out",
      stopLossBps: 1500,
      maxOpenPositions: 3,
      cooldownSec: 30,
      status: "active",
      source: "ai_copydesk",
    });
    await addTrackedWallet(env.DB, user.telegram_user_id, wallet.address);
    const state = await buildFollowHubStateForUser(env, user);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      `✅ <b>${t(user.language, "follow.created")}</b>\n\n${escapeHtml(wallet.name)}\n<code>${escapeHtml(wallet.address)}</code>\n\n$${task.copy_amount_usdc.toFixed(2)} · ${escapeHtml(task.execution_mode)} · ${task.scope === "sports" ? "sports" : "all"}`,
      followTasksKeyboard(user, state.tasks),
    );
    return;
  }

  if (action === "follow_toggle") {
    const id = Number(rest[0]);
    const task = await getFollowTask(env.DB, user.telegram_user_id, id);
    if (!task) return;
    const updated = await updateFollowTaskStatus(env.DB, user.telegram_user_id, id, task.status === "active" ? "paused" : "active");
    const state = await buildFollowHubStateForUser(env, user);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderFollowTaskHub(user, state),
      followTasksKeyboard(user, state.tasks, updated?.id),
    );
    return;
  }

  if (action === "worldcup") {
    const [signals, wallets] = await Promise.all([getRuntimeSignals(env.DB), getRuntimeWallets(env.DB)]);
    await safeEdit(env, String(message.chat.id), message.message_id, renderWorldCupHub(user, signals, wallets), worldCupHubKeyboard(user, signals));
    return;
  }

  if (action === "worldcup_signals") {
    const signals = await getRuntimeSignals(env.DB);
    await safeEdit(env, String(message.chat.id), message.message_id, renderSportsSignalList(user, signals), sportsSignalListKeyboard(user, signals));
    return;
  }

  if (action === "sports_wallets") {
    const wallets = await getRuntimeWallets(env.DB);
    const tracked = await listTrackedWallets(env.DB, user.telegram_user_id);
    await safeEdit(env, String(message.chat.id), message.message_id, renderSportsLeaderboard(user, wallets, tracked), sportsLeaderboardKeyboard(user));
    return;
  }

  if (action === "signal") {
    const signal = await getRuntimeSignal(env.DB, Number(rest[0]));
    if (!signal) return;
    await safeEdit(env, String(message.chat.id), message.message_id, renderSignalDetail(user, signal), signalDetailKeyboard(user, signal));
    return;
  }

  if (action === "link_copy") {
    const slug = decodeURIComponent(rest[0] ?? "");
    const outcome = decodeURIComponent(rest[1] ?? "");
    const amount = Number(rest[2] ?? "0");
    if (!slug || !outcome || !Number.isFinite(amount) || amount <= 0) return;
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
      return;
    }
    if (!accountContext.credentials) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderTradingBlocked(user, t(user.language, "trading.readonly_copy")), walletReadonlyKeyboard(user));
      return;
    }
    const preview = await loadMarketPreview(env, `https://polymarket.com/event/${encodeURIComponent(slug)}`, slug, outcome);
    const objectId = env.TRADE_COORDINATOR.idFromName(`user:${user.telegram_user_id}`);
    const stub = env.TRADE_COORDINATOR.get(objectId);
    const response = await stub.fetch("https://trade.internal/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "copy",
        telegramUserId: user.telegram_user_id,
        signalId: undefined,
        title: preview.title,
        outcome,
        tokenId: preview.tokenId ?? undefined,
        amountUsdc: amount,
        idempotencyKey: `link_copy:${callback.id}`,
      } satisfies TradeRequest),
    });
    const result = await response.json<Record<string, unknown>>();
    const fee = result.fee as FeePreview | undefined;
    const text = response.ok && result.ok
      ? renderTradeResult(user, "copy", preview.title, outcome, amount, result, fee)
      : renderTradeError(user, "copy", preview.title, result.error ? String(result.error) : "Unknown error");
    await safeEdit(env, String(message.chat.id), message.message_id, text, [
      [{ text: "Open Market", url: preview.marketUrl }],
      [button(t(user.language, "btn.back_dashboard"), "menu")],
    ]);
    return;
  }

  if (action === "copy") {
    const signal = await getRuntimeSignal(env.DB, Number(rest[0]));
    if (!signal) return;
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
      return;
    }
    if (!accountContext.credentials) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderTradingBlocked(user, t(user.language, "trading.readonly_copy")), walletReadonlyKeyboard(user));
      return;
    }
    const state = await fetchLiveWalletState(env, accountContext);
    await upsertWalletSnapshot(env.DB, user.telegram_user_id, state.snapshot);
    const minOrderSize = Number(env.POLYMARKET_MIN_ORDER_SIZE_USDC ?? "1") || 1;
    const feeBps = Number(env.LUNA_PLATFORM_FEE_BPS ?? "100") || 100;
    const defaultAmount = copyCandidateAmounts(state.snapshot.balanceUsdc, minOrderSize, feeBps)[0] ?? minOrderSize;
    const defaultFee = buildFeePreview(env, defaultAmount);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderCopyPrompt(user, signal, state.snapshot.balanceUsdc, defaultFee),
      copyAmountKeyboard(env, signal.id, state.snapshot.balanceUsdc, user.language),
    );
    return;
  }

  if (action === "copy_amount") {
    const signal = await getRuntimeSignal(env.DB, Number(rest[0]));
    const amount = Number(rest[1]);
    if (!signal || !Number.isFinite(amount) || amount <= 0) return;
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
      return;
    }
    if (!accountContext.credentials || accountContext.account.status !== "tradable") {
      await safeEdit(env, String(message.chat.id), message.message_id, renderTradingBlocked(user, t(user.language, "trading.need_wallet_copy")), walletSetupKeyboard(user));
      return;
    }
    const fee = buildFeePreview(env, amount);

    const objectId = env.TRADE_COORDINATOR.idFromName(`user:${user.telegram_user_id}`);
    const stub = env.TRADE_COORDINATOR.get(objectId);
    const response = await stub.fetch("https://trade.internal/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "copy",
        telegramUserId: user.telegram_user_id,
        signalId: signal.id,
        amountUsdc: amount,
        idempotencyKey: `copy:${callback.id}`,
      } satisfies TradeRequest),
    });
    const result = await response.json<Record<string, unknown>>();
    const text = response.ok && result.ok
      ? renderTradeResult(user, "copy", localizedSignalTitle(user, signal), signal.selected_outcome ?? "", amount, result, fee)
      : renderTradeError(user, "copy", signal.title_en, result.error ? String(result.error) : "Unknown error");
    await safeEdit(env, String(message.chat.id), message.message_id, text, signalDetailKeyboard(user, signal));
    return;
  }

  if (action === "copy_limit_prompt") {
    // User tapped 🎯 limit order button — show current price and ask to confirm or customize
    const signal = await getRuntimeSignal(env.DB, Number(rest[0]));
    const amount = Number(rest[1]);
    if (!signal || !Number.isFinite(amount) || amount <= 0) return;
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext?.credentials || accountContext.account.status !== "tradable") {
      await safeEdit(env, String(message.chat.id), message.message_id, renderTradingBlocked(user, t(user.language, "trading.need_wallet_copy")), walletSetupKeyboard(user));
      return;
    }
    const currentPriceStr = signal.current_price ?? "—";
    const currentPriceNum = parseFloat(currentPriceStr.replace(/[^0-9.]/g, "")) / 100; // e.g. "55¢" -> 0.55
    const priceDisplay = Number.isFinite(currentPriceNum) ? `${Math.round(currentPriceNum * 100)}¢` : currentPriceStr;
    const lang = user.language;
    const limitPromptText = lang === "zh"
      ? `🎯 <b>限价跟单</b>\n\n<b>${escapeHtml(signal.title_zh)}</b>\n方向：${escapeHtml(signal.selected_outcome ?? "—")}\n当前价格：<b>${priceDisplay}</b>\n下单金额：<b>$${amount.toFixed(2)}</b>\n\n限价单将按当前价格挂单，不会立即成交。\n市场价格到达后自动成交。\n\n确认以当前价格 <b>${priceDisplay}</b> 挂限价单？`
      : `🎯 <b>Limit Order</b>\n\n<b>${escapeHtml(signal.title_en)}</b>\nSide: ${escapeHtml(signal.selected_outcome ?? "—")}\nCurrent price: <b>${priceDisplay}</b>\nOrder size: <b>$${amount.toFixed(2)}</b>\n\nA limit order will be placed at the current market price. It will execute when the market reaches your price.\n\nConfirm limit order at <b>${priceDisplay}</b>?`;
    const limitPriceCents = Number.isFinite(currentPriceNum) ? Math.round(currentPriceNum * 100) : 0;
    const keyboard: MessageSendRequest["inlineKeyboard"] = limitPriceCents > 0
      ? [
          [button(lang === "zh" ? `✅ 确认 ${priceDisplay} 挂单` : `✅ Place limit @ ${priceDisplay}`, `copy_limit_confirm:${signal.id}:${amount}:${currentPriceNum.toFixed(4)}`)],
          [button(lang === "zh" ? "« 返回" : "« Back", `copy:${signal.id}`)],
        ]
      : [[button(lang === "zh" ? "« 返回" : "« Back", `copy:${signal.id}`)]];
    await safeEdit(env, String(message.chat.id), message.message_id, limitPromptText, keyboard);
    return;
  }

  if (action === "copy_limit_confirm") {
    const signal = await getRuntimeSignal(env.DB, Number(rest[0]));
    const amount = Number(rest[1]);
    const limitPrice = Number(rest[2]);
    if (!signal || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(limitPrice) || limitPrice <= 0) return;
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext?.credentials || accountContext.account.status !== "tradable") {
      await safeEdit(env, String(message.chat.id), message.message_id, renderTradingBlocked(user, t(user.language, "trading.need_wallet_copy")), walletSetupKeyboard(user));
      return;
    }
    const fee = buildFeePreview(env, amount);
    const objectId = env.TRADE_COORDINATOR.idFromName(`user:${user.telegram_user_id}`);
    const stub = env.TRADE_COORDINATOR.get(objectId);
    const response = await stub.fetch("https://trade.internal/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "copy",
        telegramUserId: user.telegram_user_id,
        signalId: signal.id,
        amountUsdc: amount,
        orderType: "limit",
        limitPriceUsdc: limitPrice,
        idempotencyKey: `copy_limit:${callback.id}`,
      } satisfies TradeRequest),
    });
    const result = await response.json<Record<string, unknown>>();
    const priceDisplay = `${Math.round(limitPrice * 100)}¢`;
    const lang = user.language;
    const text = response.ok && result.ok
      ? `✅ <b>${lang === "zh" ? "限价单已挂出" : "Limit order placed"}</b>\n\n${escapeHtml(lang === "zh" ? signal.title_zh : signal.title_en)}\n${lang === "zh" ? "限价" : "Price"}：<b>${priceDisplay}</b>\n${lang === "zh" ? "金额" : "Amount"}：<b>$${amount.toFixed(2)}</b>\n${lang === "zh" ? "手续费" : "Fee"}：<b>$${fee.platformFeeUsdc.toFixed(2)}</b>\n\n${lang === "zh" ? "订单将在市场价格到达后自动成交。" : "Order will execute automatically when market reaches your price."}`
      : renderTradeError(user, "copy", signal.title_en, result.error ? String(result.error) : "Unknown error");
    await safeEdit(env, String(message.chat.id), message.message_id, text, signalDetailKeyboard(user, signal));
    return;
  }

  if (action === "wallet") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
      return;
    }
    if (!accountContext.credentials) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderWalletLinkedReadonly(user, accountContext.account), walletReadonlyKeyboard(user));
      return;
    }
    const cached = await getCachedWalletView(env, user, accountContext);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderWallet(user, {
        address: cached.address,
        balanceUsdc: cached.balanceUsdc,
        positionsCount: cached.positionsCount,
        openOrders: cached.openOrders,
        snapshotLabel: cached.snapshotLabel,
      }),
      await walletKeyboardForContext(env, user, accountContext),
    );
    return;
  }

  if (action === "wallet_refresh") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext?.credentials) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
      return;
    }
    const wallet = await fetchLiveWalletState(env, accountContext);
    await upsertWalletSnapshot(env.DB, user.telegram_user_id, wallet.snapshot);
    void syncUserSettlementState(env, user.telegram_user_id).catch(() => undefined);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderWallet(user, {
        address: wallet.snapshot.depositAddress,
        balanceUsdc: wallet.snapshot.balanceUsdc,
        positionsCount: wallet.positions.length,
        openOrders: wallet.snapshot.openOrdersCount,
      }),
      await walletKeyboardForContext(env, user, accountContext),
    );
    return;
  }

  if (action === "positions") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext?.credentials) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderTradingBlocked(user, t(user.language, "trading.need_wallet_positions")), walletSetupKeyboard(user));
      return;
    }
    const wallet = await fetchLiveWalletState(env, accountContext);
    await safeEdit(env, String(message.chat.id), message.message_id, renderPositions(user, wallet.positions), positionsKeyboard(user, wallet.positions));
    return;
  }

  if (action === "receipts") {
    const [summary, trades, fees, builderEvents] = await Promise.all([
      getUserMonetizationSummary(env.DB, user.telegram_user_id),
      listTradeEvents(env.DB, { telegramUserId: user.telegram_user_id, limit: 10 }),
      listFeeLedger(env.DB, { telegramUserId: user.telegram_user_id, limit: 10 }),
      listBuilderAttributionEvents(env.DB, { telegramUserId: user.telegram_user_id, limit: 10 }),
    ]);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderAccountReceipts(user, { summary, trades, fees, builderEvents }),
      receiptsKeyboard(user),
    );
    return;
  }

  if (action === "pnl_share") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext) {
      await safeEdit(
        env,
        String(message.chat.id),
        message.message_id,
        renderWalletConnectPrompt(user),
        walletSetupKeyboard(user),
      );
      return;
    }
    const publicShareUrl = `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`;
    const [cached, summary] = await Promise.all([
      getCachedWalletView(env, user, accountContext),
      getUserMonetizationSummary(env.DB, user.telegram_user_id),
    ]);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderPnlSnapshot(user, {
        balanceUsdc: cached.balanceUsdc,
        positionsCount: cached.positionsCount,
        positionValueUsdc: 0,
        unrealizedPnlUsdc: 0,
        tradeCount: summary.tradeCount,
        grossAmountUsdc: summary.grossAmountUsdc,
        platformFeeUsdc: summary.platformFeeUsdc,
        referralCount: summary.referralCount,
        referralEarnedUsdc: summary.referralEarnedUsdc,
        publicShareUrl,
        snapshotLabel: cached.snapshotLabel,
      }),
      pnlKeyboard(user, publicShareUrl),
    );
    return;
  }

  if (action === "pnl_refresh") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext?.credentials) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
      return;
    }
    const wallet = await fetchLiveWalletState(env, accountContext);
    await upsertWalletSnapshot(env.DB, user.telegram_user_id, wallet.snapshot);
    const totals = summarizeLivePositions(wallet.positions);
    const publicShareUrl = `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`;
    const summary = await getUserMonetizationSummary(env.DB, user.telegram_user_id);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderPnlSnapshot(user, {
        balanceUsdc: wallet.snapshot.balanceUsdc,
        positionsCount: wallet.positions.length,
        positionValueUsdc: totals.positionValueUsdc,
        unrealizedPnlUsdc: totals.unrealizedPnlUsdc,
        tradeCount: summary.tradeCount,
        grossAmountUsdc: summary.grossAmountUsdc,
        platformFeeUsdc: summary.platformFeeUsdc,
        referralCount: summary.referralCount,
        referralEarnedUsdc: summary.referralEarnedUsdc,
        publicShareUrl,
      }),
      pnlKeyboard(user, publicShareUrl),
    );
    return;
  }

  if (action === "refer") {
    const inviteLink = buildInviteLink(user);
    const { summary, recentEvents } = await buildReferralView(env, user.telegram_user_id, 5);
    const publicShareUrl = `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`;
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderReferralHub(user, {
        inviteLink,
        referralBps: Number(env.LUNA_REFERRAL_SPLIT_BPS ?? "500"),
        referralWallet: env.LUNA_REFERRAL_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET ?? null,
        platformFeeBps: Number(env.LUNA_PLATFORM_FEE_BPS ?? "100"),
        referralCount: summary.referralCount,
        referralEarnedUsdc: summary.referralEarnedUsdc,
        publicShareUrl,
        recentEvents,
        totalSettledFeeUsdc: summary.settledFeeUsdc,
        totalGrossVolumeUsdc: summary.grossAmountUsdc,
        feeWallet: env.LUNA_PLATFORM_FEE_WALLET ?? null,
      }),
      referKeyboard(user, publicShareUrl),
    );
    return;
  }

  if (action === "refer_ledger") {
    const { summary, recentEvents } = await buildReferralView(env, user.telegram_user_id, 12);
    const publicShareUrl = `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(user.telegram_user_id)}`;
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderReferralLedger(user, {
        referralCount: summary.referralCount,
        referralEarnedUsdc: summary.referralEarnedUsdc,
        events: recentEvents,
      }),
      referralLedgerKeyboard(user, publicShareUrl),
    );
    return;
  }

  if (action === "creators") {
    const creators = await listTopReferrers(env.DB, { limit: 10 });
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderCreatorDirectory(
        user,
        creators.map((row) => ({
          displayName: row.username ? `@${row.username}` : row.first_name ?? `User ${row.telegram_user_id.slice(-4)}`,
          telegramUserId: row.telegram_user_id,
          referralCount: Number(row.referral_count),
          referralEarnedUsdc: Number(row.referral_earned_usdc),
          tradeCount: Number(row.trade_count),
          grossAmountUsdc: Number(row.gross_amount_usdc),
        })),
      ),
      creatorsKeyboard(
        user,
        creators.map((row) => ({
          telegramUserId: row.telegram_user_id,
          label: row.username ? `@${row.username}` : row.first_name ?? `User ${row.telegram_user_id.slice(-4)}`,
        })),
      ),
    );
    return;
  }

  if (action.startsWith("creator_profile:")) {
    const telegramUserId = action.replace("creator_profile:", "");
    const spotlight = await buildCreatorSpotlight(env, telegramUserId);
    if (!spotlight) {
      await safeEdit(
        env,
        String(message.chat.id),
        message.message_id,
        "Creator profile unavailable.",
        [[button(t(user.language, "btn.creators"), "creators")]],
      );
      return;
    }
    const publicShareUrl = `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(telegramUserId)}`;
    const inviteLink = `https://t.me/GetLunaAIBot?start=ref_${encodeURIComponent(telegramUserId)}`;
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderCreatorSpotlight(user, spotlight),
      creatorSpotlightKeyboard(user, publicShareUrl, inviteLink),
    );
    return;
  }

  if (action.startsWith("creator_share:")) {
    const telegramUserId = action.replace("creator_share:", "");
    const publicShareUrl = `${resolvePublicBaseUrl(env)}/share/${encodeURIComponent(telegramUserId)}`;
    const profileUser = await getUser(env.DB, telegramUserId);
    const label = profileUser?.username ? `@${profileUser.username}` : profileUser?.first_name ?? `User ${telegramUserId.slice(-4)}`;
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      `📣 <b>${escapeHtml(label)}</b>\n\n<code>${escapeHtml(publicShareUrl)}</code>`,
      [
        [{ text: "Open public page", url: publicShareUrl }],
        [button(t(user.language, "btn.creators"), "creators")],
        [button(t(user.language, "btn.back_dashboard"), "menu")],
      ],
    );
    return;
  }

  if (action === "settlements") {
    const rows = await syncUserSettlementState(env, user.telegram_user_id);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      renderSettlementSummary(user, rows),
      settlementsKeyboard(user),
    );
    return;
  }

  if (action === "redeem_settlements") {
    const result = await redeemUserSettlements(env, user);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      result.text,
      settlementsKeyboard(user),
    );
    return;
  }

  if (action === "position_detail") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext?.credentials) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderTradingBlocked(user, t(user.language, "trading.need_wallet_positions")), walletSetupKeyboard(user));
      return;
    }
    const wallet = await fetchLiveWalletState(env, accountContext);
    const position = wallet.positions[Number(rest[0])];
    if (!position) return;
    await safeEdit(env, String(message.chat.id), message.message_id, renderPositionDetail(user, position), positionDetailKeyboard(user, Number(rest[0])));
    return;
  }

  if (action === "close_position") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext?.credentials) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderTradingBlocked(user, t(user.language, "trading.need_wallet_close")), walletSetupKeyboard(user));
      return;
    }
    const wallet = await fetchLiveWalletState(env, accountContext);
    const index = Number(rest[0]);
    const position = wallet.positions[index];
    if (!position) return;
    const objectId = env.TRADE_COORDINATOR.idFromName(`wallet:${accountContext.account.funder_address ?? accountContext.account.signer_address ?? user.telegram_user_id}`);
    const stub = env.TRADE_COORDINATOR.get(objectId);
    const response = await stub.fetch("https://trade.internal/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "close",
        telegramUserId: user.telegram_user_id,
        title: position.title,
        outcome: position.outcome,
        tokenId: position.asset,
        shares: position.size,
        avgPrice: position.avgPrice,
        curPrice: position.curPrice,
        currentValue: position.currentValue,
        idempotencyKey: `close:${callback.id}`,
      } satisfies TradeRequest),
    });
    const result = await response.json<Record<string, unknown>>();
    const fee = result.fee as FeePreview | undefined;
    const text = response.ok && result.ok
      ? renderTradeResult(user, "close", position.title, position.outcome, position.size, result, fee)
      : renderTradeError(user, "close", position.title, result.error ? String(result.error) : "Unknown error");
    await safeEdit(env, String(message.chat.id), message.message_id, text, await walletKeyboardForContext(env, user, accountContext));
    return;
  }

  if (action === "deposit") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderWalletConnectPrompt(user), walletSetupKeyboard(user));
      return;
    }
    const chain = rest[0];
    if (!chain) {
      await safeEdit(env, String(message.chat.id), message.message_id, t(user.language, "deposit.choose_chain"), depositKeyboard(user));
      return;
    }
    const addresses = await fetchBridgeAddresses(env, accountContext);
    const key = depositChainKey(chain);
    const address = addresses[key];
    const text = renderDepositAddress(user, chain, address ?? "");
    await safeEdit(env, String(message.chat.id), message.message_id, text, depositKeyboard(user));
    return;
  }

  if (action === "withdraw") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext?.credentials) {
      await safeEdit(env, String(message.chat.id), message.message_id, renderTradingBlocked(user, t(user.language, "trading.need_wallet_withdraw")), walletSetupKeyboard(user));
      return;
    }
    if (!rest[0]) {
      await safeEdit(env, String(message.chat.id), message.message_id, t(user.language, "withdraw.choose"), withdrawKeyboard(user));
      return;
    }
    const preset = getWithdrawPreset(rest[0]);
    const link = await issueWithdrawLink(env, user.telegram_user_id, preset.key);
    await safeEdit(
      env,
      String(message.chat.id),
      message.message_id,
      buildWithdrawLaunchMessage(user, preset.chainLabel, link),
      withdrawKeyboard(user, preset.key, link),
    );
    return;
  }

  if (action === "leaderboard") {
    const wallets = await getRuntimeWallets(env.DB);
    const tracked = await listTrackedWallets(env.DB, user.telegram_user_id);
    await safeEdit(env, String(message.chat.id), message.message_id, renderLeaderboard(user, wallets, tracked), leaderboardKeyboard(user));
    return;
  }

  if (action === "trackrecord") {
    const summary = await getSignalHistorySummary(env.DB);
    await safeEdit(env, String(message.chat.id), message.message_id, renderTrackRecord(user, summary), menuKeyboard(user));
  }

  if (action === "connect_wallet") {
    const connectUrl = await issueConnectLink(env, user.telegram_user_id);
    await safeEdit(env, String(message.chat.id), message.message_id, buildConnectLaunchMessage(user, connectUrl), walletSetupKeyboard(user, connectUrl));
    return;
  }

  if (action === "safe_onboarding") {
    const safeUrl = await issueSafeOnboardingLink(env, user.telegram_user_id);
    await safeEdit(env, String(message.chat.id), message.message_id, buildSafeOnboardingLaunchMessage(user, safeUrl), walletSetupKeyboard(user));
    return;
  }

  if (action === "restore_wallet") {
    const restoreUrl = await issueRestoreLink(env, user.telegram_user_id);
    await safeEdit(env, String(message.chat.id), message.message_id, buildRestoreLaunchMessage(user, restoreUrl), walletSetupKeyboard(user, undefined, restoreUrl));
    return;
  }

  if (action === "create_managed_wallet") {
    const account = await provisionManagedWalletForUser(env, user, { forceReplaceLegacy: true });
    const backupUrl = await issueExportLink(env, user.telegram_user_id);
    await safeEdit(env, String(message.chat.id), message.message_id, renderManagedWalletCreated(user, account), walletKeyboard(user, backupUrl));
    return;
  }

  if (action === "backup_wallet") {
    const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
    if (!accountContext || accountContext.account.auth_mode !== "managed_signer" || !accountContext.credentials) {
      await safeEdit(
        env,
        String(message.chat.id),
        message.message_id,
        user.language === "zh"
          ? "当前没有可导出的 Luna 托管钱包。先创建一个。"
          : "There is no exportable managed Luna wallet yet. Create one first.",
        walletSetupKeyboard(user),
      );
      return;
    }
    const backupUrl = await issueExportLink(env, user.telegram_user_id);
    await safeEdit(env, String(message.chat.id), message.message_id, buildBackupLaunchMessage(user, backupUrl), walletKeyboard(user, backupUrl));
    return;
  }
}

function normalizeCommand(text: string): string {
  return text.split(/\s+/)[0].split("@")[0].toLowerCase();
}

function mapQuickMenuTextToCommand(text: string): string | null {
  const normalized = text.trim();
  const mapping = new Map<string, string>([
    ["📄 最新信号", "/signals"],
    ["💼 钱包", "/wallet"],
    ["📁 个人主页", "/pnl"],
    ["📁 成绩单", "/pnl"],
    ["🏆 聪明钱榜单", "/leaderboard"],
    ["⚙️ 设置", "/settings"],
    ["📊 主控台", "/start"],
    ["📄 Latest Signals", "/signals"],
    ["💼 Wallet", "/wallet"],
    ["⚙️ Settings", "/settings"],
    ["📁 Profile", "/pnl"],
    ["📁 Scorecard", "/pnl"],
    ["🏆 Smart Wallets", "/leaderboard"],
    ["📊 Dashboard", "/start"],
  ]);
  return mapping.get(normalized) ?? null;
}

function isAuthorizedInternalRequest(env: Env, request: Request): boolean {
  if (!env.INTERNAL_ADMIN_SECRET) return false;
  const header = request.headers.get("x-internal-admin-secret");
  return header === env.INTERNAL_ADMIN_SECRET;
}

function deriveRelayerTxType(authMode: "external_proxy" | "managed_signer" | "safe_builder", explicit?: string | null): "SAFE" | "PROXY" {
  if (explicit === RelayerTxType.SAFE || explicit === RelayerTxType.PROXY) {
    return explicit;
  }
  if (authMode === "external_proxy") return RelayerTxType.PROXY;
  if (authMode === "managed_signer") return RelayerTxType.SAFE;
  return RelayerTxType.SAFE;
}

function deriveManagedWalletRelayerTxType(
  signerAddress?: string | null,
  funderAddress?: string | null,
  signatureType?: string | null,
): "SAFE" | "PROXY" {
  const signer = signerAddress?.trim().toLowerCase();
  const funder = funderAddress?.trim().toLowerCase();
  if ((signatureType ?? "").trim() === "0") {
    return RelayerTxType.PROXY;
  }
  if (signer && funder && signer === funder) {
    return RelayerTxType.PROXY;
  }
  return RelayerTxType.SAFE;
}

function isLegacyManagedWalletContext(accountContext: Awaited<ReturnType<typeof getUserTradingAccountContext>> | null): boolean {
  if (!accountContext || accountContext.account.auth_mode !== "managed_signer") {
    return false;
  }
  const signer = accountContext.account.signer_address?.trim().toLowerCase();
  const funder = accountContext.account.funder_address?.trim().toLowerCase();
  const signatureType = (accountContext.account.signature_type ?? "").trim();
  if (signatureType !== "2") {
    return true;
  }
  if (!signer || !funder) {
    return true;
  }
  if (signer === funder) {
    return true;
  }
  if (accountContext.account.relayer_tx_type === RelayerTxType.PROXY) {
    return true;
  }
  return false;
}

function getMarketStreamStub(env: Env): DurableObjectStub<Env> {
  const objectId = env.MARKET_STREAM.idFromName("stream:global");
  return env.MARKET_STREAM.get(objectId);
}

async function prewarmMarketStream(env: Env, slug: string, outcome?: string | null): Promise<void> {
  const stub = getMarketStreamStub(env);
  await stub.fetch(`https://market.internal/preview?slug=${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ outcome: outcome ?? null }),
  });
}

async function subscribeMarketStream(
  env: Env,
  payload: {
    slug: string;
    outcome?: string | null;
    includeSports?: boolean;
    includeRtds?: boolean;
    rtdsSubscriptions?: Array<{ topic: string; type: string; filters?: string | null }>;
  },
): Promise<void> {
  const stub = getMarketStreamStub(env);
  await stub.fetch("https://market.internal/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug: payload.slug,
      outcome: payload.outcome ?? null,
      includeSports: Boolean(payload.includeSports),
      includeRtds: Boolean(payload.includeRtds),
      rtdsSubscriptions: payload.rtdsSubscriptions ?? [],
    }),
  });
}

async function routeTelegramSend(
  env: Env,
  chatId: string,
  request: MessageSendRequest,
  botId = "primary",
): Promise<void> {
  const objectId = env.BOT_FANOUT.idFromName(`bot:${botId}`);
  const stub = env.BOT_FANOUT.get(objectId);
  const response = await stub.fetch("https://bot-fanout.internal/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chatId, request, botId }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`telegram_send_failed:${response.status}:${detail}`);
  }
}

async function send(env: Env, chatId: string, text: string, inlineKeyboard?: MessageSendRequest["inlineKeyboard"]): Promise<void> {
  await routeTelegramSend(env, chatId, { text, inlineKeyboard });
}

async function sendDashboardSkeletonAndRefresh(env: Env, user: UserRecord, ctx?: ExecutionContext): Promise<void> {
  const account = await getUserTradingAccount(env.DB, user.telegram_user_id);
  await sendTelegramReplyKeyboardMessage(
    env,
    user.telegram_chat_id,
    quickMenuShellText(user),
    quickMenuKeyboard(user),
  );
  const shellMessageId = await sendTelegramMessage(
    env,
    user.telegram_chat_id,
    dashboardLoadingText(user, Boolean(account)),
    dashboardKeyboard(user, { hasLinkedAccount: Boolean(account), balanceUsdc: account ? 1 : 0 }),
  );
  const refresh = async () => {
    const dashboard = await buildDashboardState(env, user);
    if (shellMessageId) {
      await safeEdit(env, user.telegram_chat_id, shellMessageId, dashboardText(user, dashboard), dashboardKeyboard(user, dashboard));
      return;
    }
    await send(env, user.telegram_chat_id, dashboardText(user, dashboard), dashboardKeyboard(user, dashboard));
  };
  if (ctx) {
    ctx.waitUntil(refresh());
  } else {
    await refresh();
  }
}

async function safeEdit(env: Env, chatId: string, messageId: number, text: string, inlineKeyboard?: MessageSendRequest["inlineKeyboard"]): Promise<void> {
  try {
    await editTelegramMessage(env, chatId, messageId, text, inlineKeyboard);
  } catch {
    await send(env, chatId, text, inlineKeyboard);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isAllowedNewsSource(source: string): boolean {
  return new Set(["internal_admin", "whitehouse_rss", "sec", "fed", "ap", "reuters", "coindesk", "theblock"]).has(
    source.trim().toLowerCase(),
  );
}

function renderNewsTriggerAlert(title: string, source: string, marketSlug: string | null, status: string): string {
  const slug = marketSlug ? `\n🎯 ${escapeHtml(marketSlug)}` : "";
  return `📰 <b>News trigger</b>\n\n${escapeHtml(title)}\n🗞 ${escapeHtml(source)} · ${escapeHtml(status)}${slug}`;
}

function renderArbAlert(
  polymarketSlug: string,
  kalshiTicker: string | null,
  spreadBps: number,
  netEdgeBps: number,
  status: string,
): string {
  return `⚖️ <b>Arb alert</b>\n\nPM: <code>${escapeHtml(polymarketSlug)}</code>\nKalshi: <code>${escapeHtml(kalshiTicker ?? "-")}</code>\nSpread: <b>${spreadBps.toFixed(1)}bps</b>\nNet: <b>${netEdgeBps.toFixed(1)}bps</b>\nStatus: <b>${escapeHtml(status)}</b>`;
}

function inferOutcomePrice(preview: MarketLinkPreview, outcome: string | null | undefined): number | null {
  const normalized = String(outcome ?? preview.selectedOutcome ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "yes") {
    return numberOrNull(preview.bestAsk ?? preview.bestBid ?? preview.yesPrice);
  }
  if (normalized === "no") {
    return numberOrNull(preview.bestAsk ?? preview.bestBid ?? preview.noPrice);
  }
  const outcomes = preview.outcomes ?? [];
  const index = outcomes.findIndex((item) => item.toLowerCase() === normalized);
  if (index < 0) {
    return numberOrNull(preview.bestAsk ?? preview.bestBid);
  }
  if (preview.selectedOutcome && preview.selectedOutcome.toLowerCase() === normalized) {
    return numberOrNull(preview.bestAsk ?? preview.bestBid);
  }
  return numberOrNull(preview.bestAsk ?? preview.bestBid);
}

function buildArbScanResult(
  env: Env,
  payload: {
    polymarketSlug: string;
    kalshiTicker: string | null;
    polymarketPrice: number;
    kalshiPrice: number;
    liquidityScore: number | null;
    slippageBps: number | null;
  },
): {
  polymarketSlug: string;
  kalshiTicker: string | null;
  spreadBps: number;
  netEdgeBps: number;
  liquidityScore: number | null;
  status: "open" | "not_actionable";
  assumedFeeBps: number;
  assumedSlippageBps: number;
} {
  const spreadBps = Math.abs(payload.polymarketPrice - payload.kalshiPrice) * 10_000;
  const feeBps = Number(env.LUNA_PLATFORM_FEE_BPS ?? "100") || 100;
  const slippageBps = Number(payload.slippageBps ?? 35);
  const netEdgeBps = spreadBps - feeBps - slippageBps;
  return {
    polymarketSlug: payload.polymarketSlug,
    kalshiTicker: payload.kalshiTicker,
    spreadBps,
    netEdgeBps,
    liquidityScore: payload.liquidityScore,
    status: netEdgeBps > 0 ? "open" : "not_actionable",
    assumedFeeBps: feeBps,
    assumedSlippageBps: slippageBps,
  };
}

async function executeFollowTasksForWallet(
  env: Env,
  payload: {
    walletAddress: string;
    tokenId: string;
    title: string;
    outcome: string;
    triggerAmountUsdc: number;
    side: "buy" | "sell";
    scope: "all" | "sports";
    marketSlug?: string | null;
  },
): Promise<{ executed: number; skipped: number; receipts: Array<Record<string, unknown>> }> {
  if (payload.side !== "buy") {
    return { executed: 0, skipped: 0, receipts: [] };
  }
  const preview = payload.marketSlug
    ? await loadMarketPreview(
        env,
        `https://polymarket.com/event/${encodeURIComponent(payload.marketSlug)}`,
        payload.marketSlug,
        payload.outcome,
      ).catch(() => null)
    : null;
  const entryPrice = preview ? inferOutcomePrice(preview, payload.outcome) : null;
  const tasks = await listActiveFollowTasksByWallet(env.DB, payload.walletAddress, { scope: payload.scope });
  const receipts: Array<Record<string, unknown>> = [];
  let skipped = 0;
  for (const task of tasks) {
    if (payload.triggerAmountUsdc > 0 && payload.triggerAmountUsdc < task.min_trade_threshold_usdc) {
      skipped += 1;
      continue;
    }
    if (task.direction === "sell_only") {
      skipped += 1;
      continue;
    }
    if (task.last_triggered_at && task.cooldown_sec && task.cooldown_sec > 0) {
      const nextAt = new Date(task.last_triggered_at).getTime() + task.cooldown_sec * 1000;
      if (Number.isFinite(nextAt) && nextAt > Date.now()) {
        skipped += 1;
        continue;
      }
    }
    const accountContext = await getUserTradingAccountContext(env, task.telegram_user_id);
    if (!accountContext?.credentials || accountContext.account.status !== "tradable") {
      skipped += 1;
      continue;
    }
    if (task.max_open_positions && task.max_open_positions > 0) {
      try {
        const live = await fetchLiveWalletState(env, accountContext);
        if (live.positions.length >= task.max_open_positions) {
          skipped += 1;
          continue;
        }
      } catch {
        skipped += 1;
        continue;
      }
    }
    const amountUsdc = Math.min(task.copy_amount_usdc, task.max_per_trade_usdc);
    if (!(amountUsdc > 0)) {
      skipped += 1;
      continue;
    }
    const objectId = env.TRADE_COORDINATOR.idFromName(`user:${task.telegram_user_id}`);
    const stub = env.TRADE_COORDINATOR.get(objectId);
    const response = await stub.fetch("https://trade.internal/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "copy",
        telegramUserId: task.telegram_user_id,
        title: payload.title,
        outcome: payload.outcome,
        tokenId: payload.tokenId,
        amountUsdc,
        idempotencyKey: `follow:${task.id}:${payload.tokenId}:${Date.now()}`,
      } satisfies TradeRequest),
    });
    const result = await response.json<Record<string, unknown>>().catch(() => ({ ok: false, error: "invalid_json" }));
    receipts.push({
      task_id: task.id,
      telegram_user_id: task.telegram_user_id,
      ok: response.ok && Boolean(result.ok),
      token_id: payload.tokenId,
      title: payload.title,
      outcome: payload.outcome,
      market_slug: payload.marketSlug ?? null,
      amount_usdc: amountUsdc,
      entry_price: entryPrice,
      estimated_shares: entryPrice && entryPrice > 0 ? amountUsdc / entryPrice : null,
      take_profit_mode: task.take_profit_mode ?? "none",
      take_profit_bps: task.take_profit_bps ?? null,
      stop_loss_bps: task.stop_loss_bps ?? null,
      result,
    });
    if (response.ok && result.ok) {
      await touchFollowTaskTriggeredAt(env.DB, task.telegram_user_id, task.id);
      const user = await getUser(env.DB, task.telegram_user_id);
      if (user?.telegram_chat_id) {
        await send(
          env,
          user.telegram_chat_id,
          renderFollowExecutionAlert(user.language, task.wallet_name ?? payload.walletAddress, payload.title, payload.outcome, amountUsdc, task.take_profit_mode ?? "none"),
        );
      }
    } else {
      skipped += 1;
    }
  }
  return {
    executed: receipts.filter((row) => row.ok).length,
    skipped,
    receipts,
  };
}

function renderFollowExecutionAlert(
  language: UserRecord["language"],
  walletName: string,
  title: string,
  outcome: string,
  amountUsdc: number,
  takeProfitMode: string,
): string {
  const modeLabel = takeProfitMode === "double_out" ? "double_out" : takeProfitMode === "fixed_pct" ? "fixed_tp" : takeProfitMode;
  if (language === "zh") {
    return `🤝 <b>跟单已触发</b>\n\n钱包：${escapeHtml(walletName)}\n市场：${escapeHtml(title)}\n方向：<b>${escapeHtml(outcome)}</b>\n金额：<b>$${amountUsdc.toFixed(2)}</b>\n退出模板：<b>${escapeHtml(modeLabel)}</b>`;
  }
  return `🤝 <b>Follow execution fired</b>\n\nWallet: ${escapeHtml(walletName)}\nMarket: ${escapeHtml(title)}\nSide: <b>${escapeHtml(outcome)}</b>\nSize: <b>$${amountUsdc.toFixed(2)}</b>\nExit template: <b>${escapeHtml(modeLabel)}</b>`;
}

async function buildDashboardState(
  env: Env,
  user: UserRecord,
  options?: { preferCached?: boolean },
): Promise<{
  hasLinkedAccount: boolean;
  accountStatus?: string | null;
  authMode?: string | null;
  balanceUsdc?: number | null;
  positionsCount?: number | null;
  topSignalTitle?: string | null;
  topSignalScore?: number | null;
  topSportsTitle?: string | null;
  topWalletName?: string | null;
  topWalletScore?: number | null;
}> {
  const preferCached = Boolean(options?.preferCached);
  const [account, walletState, topSignals, topSportsSignals, topWallets] = await Promise.all([
    getUserTradingAccount(env.DB, user.telegram_user_id),
    getUserWalletState(env.DB, user.telegram_user_id),
    getTopRuntimeSignals(env.DB, { sports: 0, limit: 1 }),
    getTopRuntimeSignals(env.DB, { sports: 1, limit: 1 }),
    getTopRuntimeWallets(env.DB, 1),
  ]);
  const topSignal = topSignals[0];
  const topSports = topSportsSignals[0];
  const topWallet = topWallets[0];
  const summary = {
    topSignalTitle: topSignal ? pickLang(topSignal, "title", user.language) : null,
    topSignalScore: topSignal?.score ?? null,
    topSportsTitle: topSports ? pickLang(topSports, "title", user.language) : null,
    topWalletName: topWallet?.name ?? null,
    topWalletScore: topWallet?.score ?? null,
  };
  if (!preferCached && account?.status === "tradable") {
    try {
      const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
      if (accountContext?.credentials) {
        const live = await fetchLiveWalletState(env, accountContext);
        await upsertWalletSnapshot(env.DB, user.telegram_user_id, live.snapshot);
        return {
          hasLinkedAccount: true,
          accountStatus: account.status,
          authMode: account.auth_mode,
          balanceUsdc: live.snapshot.balanceUsdc,
          positionsCount: live.snapshot.positionsCount,
          ...summary,
        };
      }
    } catch {
      // Fall back to the last cached snapshot if live reads fail.
    }
  }
  return {
    hasLinkedAccount: Boolean(account),
    accountStatus: account?.status ?? null,
    authMode: account?.auth_mode ?? null,
    balanceUsdc: walletState?.last_balance_usdc ?? 0,
    positionsCount: walletState?.last_positions_count ?? 0,
    ...summary,
  };
}

async function getCachedWalletView(env: Env, user: UserRecord, accountContext: Awaited<ReturnType<typeof getUserTradingAccountContext>>): Promise<{
  address: string;
  balanceUsdc: number;
  positionsCount: number;
  openOrders: number;
  snapshotLabel: string;
}> {
  const walletState = await getUserWalletState(env.DB, user.telegram_user_id);
  return {
    address: walletState?.deposit_address ?? accountContext?.account.deposit_address_evm ?? accountContext?.account.funder_address ?? accountContext?.account.signer_address ?? "-",
    balanceUsdc: Number(walletState?.last_balance_usdc ?? 0),
    positionsCount: Number(walletState?.last_positions_count ?? 0),
    openOrders: Number(walletState?.last_open_orders_count ?? 0),
    snapshotLabel: walletState?.updated_at ? `${t(user.language, "cache.snapshot")} · ${walletState.updated_at}` : t(user.language, "cache.hint"),
  };
}

async function refreshWalletSnapshotAfterTrade(
  env: Env,
  telegramUserId: string,
  accountContext: NonNullable<Awaited<ReturnType<typeof getUserTradingAccountContext>>>,
  options?: {
    expectBalanceAtMost?: number;
    requirePositionVisibility?: boolean;
    requirePositionClosure?: boolean;
    targetTokenId?: string;
    maxAttempts?: number;
  },
): Promise<void> {
  const maxAttempts = Math.max(1, Math.min(options?.maxAttempts ?? 3, 5));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const live = await fetchLiveWalletState(env, accountContext);
      await upsertWalletSnapshot(env.DB, telegramUserId, live.snapshot);
      const balanceOk =
        typeof options?.expectBalanceAtMost !== "number" || live.snapshot.balanceUsdc <= options.expectBalanceAtMost + 0.02;
      const positionVisible = !options?.requirePositionVisibility || live.positions.length > 0 || live.snapshot.openOrdersCount > 0;
      const positionClosed =
        !options?.requirePositionClosure ||
        !options?.targetTokenId ||
        !live.positions.some((position) => position.asset === options.targetTokenId);
      if (balanceOk && positionVisible && positionClosed) {
        return;
      }
    } catch {
      // Fall through and retry once or twice before giving up.
    }
    if (attempt < maxAttempts - 1) {
      await sleep(1500);
    }
  }
}

function summarizeLivePositions(positions: LivePosition[]): {
  positionValueUsdc: number;
  unrealizedPnlUsdc: number;
} {
  return positions.reduce(
    (acc, position) => {
      acc.positionValueUsdc += Number(position.currentValue ?? 0);
      acc.unrealizedPnlUsdc += Number(position.cashPnl ?? 0);
      return acc;
    },
    { positionValueUsdc: 0, unrealizedPnlUsdc: 0 },
  );
}

async function buildReferralView(env: Env, telegramUserId: string, limit: number): Promise<{
  summary: Awaited<ReturnType<typeof getUserMonetizationSummary>>;
  recentEvents: Array<{ refereeLabel: string; amountUsdc: number; createdAt: string; detail?: string | null }>;
}> {
  const [summary, referralEvents, accounts] = await Promise.all([
    getUserMonetizationSummary(env.DB, telegramUserId),
    listReferralEvents(env.DB, { referrerTelegramUserId: telegramUserId, limit }),
    listUserTradingAccounts(env.DB, { limit: 500 }),
  ]);
  return {
    summary,
    recentEvents: referralEvents.map((event) => {
      const referee = accounts.find((item) => item.telegram_user_id === event.referee_telegram_user_id);
      return {
        refereeLabel: referee?.account_label ?? `User ${event.referee_telegram_user_id.slice(-4)}`,
        amountUsdc: Number(event.amount_usdc),
        createdAt: event.created_at,
        detail: event.detail,
      };
    }),
  };
}

async function buildCopyDeskStateForUser(env: Env, user: UserRecord): Promise<{
  topWallet: RuntimeWalletProfile | null;
  sportsWallet: RuntimeWalletProfile | null;
  topSignal: RuntimeSignal | null;
  sportsSignal: RuntimeSignal | null;
  balanceUsdc: number | null;
  suggestedSizes: number[];
}> {
  const [topWallets, allWallets, topSignals, sportsSignals] = await Promise.all([
    getTopRuntimeWallets(env.DB, 5),
    getRuntimeWallets(env.DB),
    getTopRuntimeSignals(env.DB, { sports: 0, limit: 3 }),
    getTopRuntimeSignals(env.DB, { sports: 1, limit: 3 }),
  ]);
  const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
  let balanceUsdc: number | null = null;
  if (accountContext) {
    const cached = await getCachedWalletView(env, user, accountContext);
    balanceUsdc = cached.balanceUsdc;
  }
  const suggestedSizes = balanceUsdc != null
    ? copyCandidateAmounts(
        balanceUsdc,
        Number(env.POLYMARKET_MIN_ORDER_SIZE_USDC ?? "1") || 1,
        Number(env.LUNA_PLATFORM_FEE_BPS ?? "100") || 100,
      ).slice(0, 3)
    : [];
  return {
    topWallet: topWallets[0] ?? allWallets[0] ?? null,
    sportsWallet: allWallets.find(isSportsWalletProfile) ?? topWallets.find(isSportsWalletProfile) ?? null,
    topSignal: topSignals[0] ?? null,
    sportsSignal: sportsSignals[0] ?? null,
    balanceUsdc,
    suggestedSizes,
  };
}

async function buildAddressBookStateForUser(env: Env, user: UserRecord): Promise<{
  topWallets: RuntimeWalletProfile[];
  sportsWallets: RuntimeWalletProfile[];
  trackedWallets: RuntimeWalletProfile[];
  trackedAddresses: string[];
  activeTaskCount: number;
}> {
  const [wallets, trackedAddresses, tasks] = await Promise.all([
    getRuntimeWallets(env.DB),
    listTrackedWallets(env.DB, user.telegram_user_id),
    listFollowTasks(env.DB, user.telegram_user_id),
  ]);
  const trackedSet = new Set(trackedAddresses.map((item) => item.toLowerCase()));
  return {
    topWallets: wallets.slice(0, 6),
    sportsWallets: wallets.filter(isSportsWalletProfile).slice(0, 6),
    trackedWallets: wallets.filter((wallet) => trackedSet.has(wallet.address.toLowerCase())).slice(0, 8),
    trackedAddresses,
    activeTaskCount: tasks.filter((task) => task.status === "active").length,
  };
}

async function buildFollowHubStateForUser(env: Env, user: UserRecord) {
  const [tasks, wallets] = await Promise.all([
    listFollowTasks(env.DB, user.telegram_user_id),
    getRuntimeWallets(env.DB),
  ]);
  const inTasks = new Set(tasks.map((task) => task.wallet_address.toLowerCase()));
  return {
    tasks,
    suggestedWallets: wallets.filter((wallet) => !inTasks.has(wallet.address.toLowerCase())).slice(0, 6),
  };
}

function findRuntimeWalletByAddress(wallets: RuntimeWalletProfile[], compactAddress: string): RuntimeWalletProfile | null {
  const normalized = `0x${compactAddress}`.toLowerCase();
  return wallets.find((wallet) => wallet.address.toLowerCase() === normalized) ?? null;
}

function buildFollowPresetConfig(
  wallet: RuntimeWalletProfile,
  preset: "c" | "b" | "a",
): {
  scope: "all" | "sports";
  copyAmountUsdc: number;
  maxPerTradeUsdc: number;
  minTradeThresholdUsdc: number;
  direction: "both" | "buy_only" | "sell_only";
  executionMode: "cautious" | "standard" | "expert";
} {
  const sportsBias = isSportsWalletProfile(wallet);
  if (preset === "c") {
    return {
      scope: sportsBias ? "sports" : "all",
      copyAmountUsdc: 1,
      maxPerTradeUsdc: 2,
      minTradeThresholdUsdc: 1,
      direction: "buy_only",
      executionMode: "cautious",
    };
  }
  if (preset === "a") {
    return {
      scope: sportsBias ? "sports" : "all",
      copyAmountUsdc: sportsBias ? 5 : 3,
      maxPerTradeUsdc: sportsBias ? 8 : 5,
      minTradeThresholdUsdc: 1,
      direction: "both",
      executionMode: "expert",
    };
  }
  return {
    scope: sportsBias ? "sports" : "all",
    copyAmountUsdc: sportsBias ? 3 : 2,
    maxPerTradeUsdc: sportsBias ? 5 : 3,
    minTradeThresholdUsdc: 1,
    direction: "both",
    executionMode: "standard",
  };
}

async function buildCreatorSpotlight(env: Env, telegramUserId: string): Promise<{
  displayName: string;
  telegramUserId: string;
  referralCount: number;
  referralEarnedUsdc: number;
  tradeCount: number;
  grossAmountUsdc: number;
  liveBalanceUsdc: number;
  livePositionsCount: number;
  livePositionValueUsdc: number;
  liveUnrealizedPnlUsdc: number;
  recentTrades: Array<{ title: string; amount: number | null; eventType: string }>;
  snapshotLabel?: string;
} | null> {
  const [profileUser, summary, trades, accountContext, walletState] = await Promise.all([
    getUser(env.DB, telegramUserId),
    getUserMonetizationSummary(env.DB, telegramUserId),
    listTradeEvents(env.DB, { telegramUserId, limit: 10 }),
    getUserTradingAccountContext(env, telegramUserId),
    getUserWalletState(env.DB, telegramUserId),
  ]);
  if (!profileUser) return null;
  let liveBalanceUsdc = Number(walletState?.last_balance_usdc ?? 0);
  let livePositionsCount = Number(walletState?.last_positions_count ?? 0);
  let livePositionValueUsdc = 0;
  let liveUnrealizedPnlUsdc = 0;
  let snapshotLabel = walletState?.updated_at ? `Cached snapshot · ${walletState.updated_at}` : undefined;
  if (accountContext?.credentials && !walletState) {
    try {
      const live = await fetchLiveWalletState(env, accountContext);
      const totals = summarizeLivePositions(live.positions);
      liveBalanceUsdc = live.snapshot.balanceUsdc;
      livePositionsCount = live.positions.length;
      livePositionValueUsdc = totals.positionValueUsdc;
      liveUnrealizedPnlUsdc = totals.unrealizedPnlUsdc;
      snapshotLabel = undefined;
    } catch {
      // Keep creator spotlight resilient when live wallet fetch fails.
    }
  }
  return {
    displayName: profileUser.username ? `@${profileUser.username}` : profileUser.first_name ?? `User ${telegramUserId.slice(-4)}`,
    telegramUserId,
    referralCount: summary.referralCount,
    referralEarnedUsdc: summary.referralEarnedUsdc,
    tradeCount: summary.tradeCount,
    grossAmountUsdc: summary.grossAmountUsdc,
    liveBalanceUsdc,
    livePositionsCount,
    livePositionValueUsdc,
    liveUnrealizedPnlUsdc,
    snapshotLabel,
    recentTrades: trades.map((trade) => ({
      title: trade.title ?? "Untitled trade",
      amount: trade.amount_usdc,
      eventType: trade.event_type,
    })),
  };
}

function isSportsWalletProfile(wallet: RuntimeWalletProfile): boolean {
  const haystack = `${wallet.specialty_zh} ${wallet.specialty_en} ${wallet.note_zh} ${wallet.note_en}`.toLowerCase();
  return ["sport", "soccer", "football", "world cup", "match", "体育", "足球", "世界杯"].some((term) => haystack.includes(term));
}

async function sendDashboard(env: Env, user: UserRecord): Promise<void> {
  const dashboard = await buildDashboardState(env, user, { preferCached: true });
  await send(env, user.telegram_chat_id, dashboardText(user, dashboard), dashboardKeyboard(user, dashboard));
}

async function sendReferralWelcome(env: Env, user: UserRecord, referrerId: string): Promise<void> {
  const text = user.language === "zh"
    ? `🎁 <b>欢迎来到 Luna</b>\n\n你是通过邀请码进入的。先完成三步：\n1. 创建或连接钱包\n2. 充值少量 USDC\n3. 从“今日机会”里先做第一笔小额真单\n\n邀请来源：<code>${escapeForInline(referrerId)}</code>`
    : `🎁 <b>Welcome to Luna</b>\n\nYou entered through an invite link. Start with three steps:\n1. Create or connect a wallet\n2. Deposit a small amount of USDC\n3. Use Discover for your first small live trade\n\nInvite source: <code>${escapeForInline(referrerId)}</code>`;
  const dashboard = await buildDashboardState(env, user, { preferCached: true });
  await send(env, user.telegram_chat_id, text, dashboardKeyboard(user, dashboard));
}

async function recordReferralAttributionIfNeeded(env: Env, refereeTelegramUserId: string, referrerTelegramUserId: string): Promise<void> {
  if (!referrerTelegramUserId || refereeTelegramUserId === referrerTelegramUserId) return;
  const existing = await getReferralAttribution(env.DB, refereeTelegramUserId);
  if (existing) return;
  await createReferralAttribution(env.DB, {
    refereeTelegramUserId,
    referrerTelegramUserId,
    attributionSource: "telegram_start",
  });
}

async function recordReferralShare(
  db: D1Database,
  refereeTelegramUserId: string,
  feeLedgerId: number,
  totalFeeUsdc: number,
): Promise<void> {
  const attribution = await getReferralAttribution(db, refereeTelegramUserId);
  if (!attribution) return;
  const referralAmountUsdc = Number((totalFeeUsdc * 0.05).toFixed(4));
  if (referralAmountUsdc <= 0) return;
  await recordReferralEvent(db, {
    referrerTelegramUserId: attribution.referrer_telegram_user_id,
    refereeTelegramUserId,
    feeLedgerId,
    amountUsdc: referralAmountUsdc,
    detail: "5% of platform fee reserved for referral pool attribution",
  });
}

function menuKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  return dashboardKeyboard(user);
}

function renderSettingsPanel(user: UserRecord): string {
  const lang = user.language;
  const languageLabel = lang === "zh" ? "中文" : lang === "en" ? "English" : lang === "ja" ? "日本語" : "한국어";
  return `⚙️ <b>${t(lang, "settings.title")}</b>\n\n${t(lang, "settings.language")}：<b>${languageLabel}</b>\n${t(lang, "settings.sports")}：<b>${user.sports_enabled ? t(lang, "settings.on") : t(lang, "settings.off")}</b>\n${t(lang, "settings.alerts")}：<b>${user.push_enabled ? t(lang, "settings.on") : t(lang, "settings.off")}</b>\n${t(lang, "settings.min_score")}：<b>${user.push_min_score}</b>\n\n${t(lang, "settings.hint")}`;
}

function dashboardKeyboard(user: UserRecord, payload?: { hasLinkedAccount?: boolean; balanceUsdc?: number | null }): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  const hasAccount = Boolean(payload?.hasLinkedAccount);
  const balance = Number(payload?.balanceUsdc ?? 0);
  if (!hasAccount) {
    return [
      [button(t(lang, "btn.discover"), "discover"), button(t(lang, "btn.copydesk"), "copydesk")],
      [button(t(lang, "btn.addressbook"), "addressbook"), button(t(lang, "btn.follow_tasks"), "follow_tasks")],
      [button(t(lang, "btn.news"), "news_hub"), button(t(lang, "btn.arb"), "arb_hub")],
      [button(t(lang, "btn.create_wallet"), "create_managed_wallet")],
      [button(t(lang, "btn.restore_wallet"), "restore_wallet")],
      [button(t(lang, "btn.worldcup"), "worldcup"), button(t(lang, "btn.refer"), "refer")],
      [button(t(lang, "btn.creators"), "creators"), button(t(lang, "btn.settings"), "settings")],
    ];
  }
  if (balance <= 0) {
    return [
      [button(t(lang, "btn.discover"), "discover"), button(t(lang, "btn.copydesk"), "copydesk")],
      [button(t(lang, "btn.addressbook"), "addressbook"), button(t(lang, "btn.follow_tasks"), "follow_tasks")],
      [button(t(lang, "btn.news"), "news_hub"), button(t(lang, "btn.arb"), "arb_hub")],
      [button(t(lang, "btn.deposit"), "deposit"), button(t(lang, "btn.wallet"), "wallet")],
      [button(t(lang, "btn.worldcup"), "worldcup"), button(t(lang, "btn.creators"), "creators")],
      [button(t(lang, "btn.receipts"), "receipts"), button(t(lang, "btn.settlements"), "settlements")],
      [button(t(lang, "btn.pnl"), "pnl_share"), button(t(lang, "btn.settings"), "settings")],
    ];
  }
  return [
    [button(t(lang, "btn.discover"), "discover"), button(t(lang, "btn.copydesk"), "copydesk")],
    [button(t(lang, "btn.addressbook"), "addressbook"), button(t(lang, "btn.follow_tasks"), "follow_tasks")],
    [button(t(lang, "btn.news"), "news_hub"), button(t(lang, "btn.arb"), "arb_hub")],
    [button(t(lang, "btn.worldcup"), "worldcup"), button(t(lang, "btn.wallet"), "wallet")],
    [button(t(lang, "btn.signals"), "signals"), button(t(lang, "btn.receipts"), "receipts")],
    [button(t(lang, "btn.settlements"), "settlements"), button(t(lang, "btn.refer"), "refer")],
    [button(t(lang, "btn.creators"), "creators"), button(t(lang, "btn.pnl"), "pnl_share")],
    [button(t(lang, "btn.settings"), "settings")],
  ];
}

function signalListKeyboard(user: UserRecord, signals: RuntimeSignal[]): MessageSendRequest["inlineKeyboard"] {
  const visible = signals.filter((signal) => user.sports_enabled || signal.sports === 0);
  const rows: NonNullable<MessageSendRequest["inlineKeyboard"]> = [];
  for (let i = 0; i < visible.length; i += 4) {
    rows.push(visible.slice(i, i + 4).map((signal) => button(String(signal.id), `signal:${signal.id}`)));
  }
  rows.push([button(t(user.language, "btn.back_dashboard"), "menu")]);
  return rows;
}

function sportsSignalListKeyboard(user: UserRecord, signals: RuntimeSignal[]): MessageSendRequest["inlineKeyboard"] {
  const sportsSignals = signals
    .filter((signal) => signal.sports === 1)
    .sort((left, right) => right.score - left.score);
  const rows: NonNullable<MessageSendRequest["inlineKeyboard"]> = [];
  for (let i = 0; i < sportsSignals.length; i += 3) {
    rows.push(sportsSignals.slice(i, i + 3).map((signal) => button(`#${signal.id}`, `signal:${signal.id}`)));
  }
  rows.push([button(t(user.language, "btn.back_worldcup"), "worldcup")]);
  return rows;
}

function signalDetailKeyboard(user: UserRecord, signal: RuntimeSignal): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  return [
    [
      { text: t(lang, "btn.detail"), url: signal.detail_url },
      { text: t(lang, "btn.market"), url: signal.market_url },
      { text: t(lang, "btn.copy"), callback_data: `copy:${signal.id}` },
    ],
    [{ text: t(lang, "btn.back_signals"), callback_data: signal.sports === 1 ? "worldcup_signals" : "signals" }],
  ];
}

function copyAmountKeyboard(env: Env, signalId: number, balanceUsdc: number, language: UserRecord["language"]): MessageSendRequest["inlineKeyboard"] {
  const minOrderSize = Number(env.POLYMARKET_MIN_ORDER_SIZE_USDC ?? "1") || 1;
  const feeBps = Number(env.LUNA_PLATFORM_FEE_BPS ?? "100") || 100;
  const unique = copyCandidateAmounts(balanceUsdc, minOrderSize, feeBps);
  const marketLabels = unique.map((amount) => button(`⚡ $${amount}`, `copy_amount:${signalId}:${amount}`));
  const limitLabels = unique.map((amount) => button(`🎯 $${amount}`, `copy_limit_prompt:${signalId}:${amount}`));
  return [
    marketLabels,
    limitLabels,
    [button(t(language, "btn.back_signal"), `signal:${signalId}`)],
  ];
}

function walletKeyboard(user: UserRecord, backupUrl?: string): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  const backupRow = backupUrl
    ? [{ text: t(lang, "btn.download_backup"), url: backupUrl }]
    : [button(t(lang, "btn.backup_wallet"), "backup_wallet")];
  return [
    [button(t(lang, "btn.positions"), "positions"), button(t(lang, "btn.deposit"), "deposit")],
    [button(t(lang, "btn.withdraw"), "withdraw"), button(t(lang, "btn.settlements"), "settlements")],
    [button(t(lang, "btn.receipts"), "receipts"), button(t(lang, "btn.pnl"), "pnl_share")],
    [button(t(lang, "btn.refresh"), "wallet_refresh")],
    [button(t(lang, "btn.discover"), "discover"), button(t(lang, "btn.refer"), "refer")],
    backupRow,
    [button(t(lang, "btn.back_dashboard"), "menu")],
  ];
}

function extractPolymarketMarketLink(text: string): string | null {
  const match = text.match(/https?:\/\/(?:www\.)?polymarket\.com\/(?:event|market)\/[^\s?#]+(?:\?[^\s#]+)?/i);
  return match?.[0] ?? null;
}

function parsePolymarketSlug(urlValue: string): { slug: string | null; outcome: string | null } {
  try {
    const url = new URL(urlValue);
    const parts = url.pathname.split("/").filter(Boolean);
    return {
      slug: parts.length >= 2 ? parts[1] : null,
      outcome: url.searchParams.get("outcome"),
    };
  } catch {
    return { slug: null, outcome: null };
  }
}

async function loadMarketPreview(env: Env, rawUrl: string, knownSlug?: string | null, preferredOutcome?: string | null): Promise<MarketLinkPreview> {
  const parsed = knownSlug ? { slug: knownSlug, outcome: preferredOutcome ?? null } : parsePolymarketSlug(rawUrl);
  if (!parsed.slug) {
    throw new Error("Unable to parse Polymarket market slug");
  }

  const cached = await getMarketLinkResolution(env.DB, rawUrl);
  let cachedPreview: MarketLinkPreview | null = null;
  if (cached?.detail_json) {
    try {
      cachedPreview = JSON.parse(cached.detail_json) as MarketLinkPreview;
    } catch {
      cachedPreview = null;
    }
  }

  const stub = getMarketStreamStub(env);
  const response = await stub.fetch(`https://market.internal/preview?slug=${encodeURIComponent(parsed.slug)}`, {
    method: "GET",
  }).catch(() => null);
  let preview: MarketLinkPreview | null = null;
  if (response?.ok) {
    const payload = await response.json<{ preview: MarketLinkPreview }>().catch(() => null);
    preview = payload?.preview ?? null;
  }
  if (!preview) {
    const warmResponse = await stub.fetch(`https://market.internal/preview?slug=${encodeURIComponent(parsed.slug)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome: preferredOutcome ?? parsed.outcome ?? null }),
    }).catch(() => null);
    if (warmResponse?.ok) {
      const payload = await warmResponse.json<{ preview: MarketLinkPreview }>().catch(() => null);
      preview = payload?.preview ?? null;
    }
  }
  if (!preview) {
    if (cachedPreview) {
      return {
        ...cachedPreview,
        source: cachedPreview.source ?? "rest",
        cached: true,
        stale: true,
      };
    }
    throw new Error(`Failed to load market preview for ${parsed.slug}`);
  }
  await upsertMarketLinkResolution(env.DB, {
    url: rawUrl,
    slug: parsed.slug,
    outcome: preview.selectedOutcome,
    tokenId: preview.tokenId,
    titleEn: preview.title,
    titleZh: preview.titleZh ?? null,
    marketUrl: preview.marketUrl,
    detailJson: preview,
  });
  return preview;
}

async function handlePolymarketMarketLink(env: Env, user: UserRecord, _message: TelegramMessage, marketUrl: string): Promise<void> {
  const preview = await loadMarketPreview(env, marketUrl);
  await send(env, user.telegram_chat_id, renderMarketLinkTradeCard(user, preview), marketLinkKeyboard(user, preview));
}

function renderMarketLinkTradeCard(user: UserRecord, preview: MarketLinkPreview): string {
  const title = user.language === "zh" && preview.titleZh ? preview.titleZh : preview.title;
  const side = preview.selectedOutcome ?? (user.language === "zh" ? "默认方向" : "Default side");
  const yes = preview.yesPrice != null ? `${Math.round(preview.yesPrice * 100)}c` : "-";
  const no = preview.noPrice != null ? `${Math.round(preview.noPrice * 100)}c` : "-";
  const bestBid = preview.bestBid != null ? `${Math.round(preview.bestBid * 100)}c` : "-";
  const bestAsk = preview.bestAsk != null ? `${Math.round(preview.bestAsk * 100)}c` : "-";
  const liquidity = preview.liquidityClob != null ? `$${preview.liquidityClob.toLocaleString()}` : "-";
  const volume = preview.volume24hr != null ? `$${preview.volume24hr.toLocaleString()}` : "-";
  return `⚡ <b>${user.language === "zh" ? "URL 执行卡片" : "Market Trade Card"}</b>\n\n${escapeHtml(title)}\n\n🎯 ${user.language === "zh" ? "默认方向" : "Default side"}：<b>${escapeHtml(side)}</b>\n📈 YES：<b>${yes}</b> · NO：<b>${no}</b>\n📚 Bid/Ask：<b>${bestBid}</b> / <b>${bestAsk}</b>\n💧 ${user.language === "zh" ? "流动性" : "Liquidity"}：<b>${liquidity}</b>\n📊 24h ${user.language === "zh" ? "成交量" : "Volume"}：<b>${volume}</b>\n💸 ${user.language === "zh" ? "平台费" : "Platform fee"}：<b>1%</b>\n\n${user.language === "zh" ? "点下面金额直接下单，或先打开市场核对规则。" : "Tap a quick amount to trade now, or open the market to verify the rules first."}`;
}

function marketLinkKeyboard(user: UserRecord, preview: MarketLinkPreview): MessageSendRequest["inlineKeyboard"] {
  const selectedOutcome = preview.selectedOutcome ?? "Yes";
  return [
    preview.tokenId
      ? [1, 5, 10].map((amount) => button(`$${amount}`, `link_copy:${encodeURIComponent(preview.slug)}:${encodeURIComponent(selectedOutcome)}:${amount}`))
      : [button(user.language === "zh" ? "返回主控台" : "Back to dashboard", "menu")],
    [{ text: user.language === "zh" ? "打开市场" : "Open Market", url: preview.marketUrl }],
    [button(t(user.language, "btn.back_dashboard"), "menu")],
  ];
}

function settingsKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  return [
    [button(`${t(lang, "btn.settings_sports")} · ${user.sports_enabled ? t(lang, "settings.on") : t(lang, "settings.off")}`, "settings_toggle_sports")],
    [button(`${t(lang, "btn.settings_alerts")} · ${user.push_enabled ? t(lang, "settings.on") : t(lang, "settings.off")}`, "settings_toggle_push")],
    [
      button(`${t(lang, "btn.settings_score")} 80`, "settings_push_score:80"),
      button(`${t(lang, "btn.settings_score")} 85`, "settings_push_score:85"),
      button(`${t(lang, "btn.settings_score")} 90`, "settings_push_score:90"),
    ],
    ...languageKeyboard(),
    [button(t(lang, "btn.back_dashboard"), "menu")],
  ];
}

function walletSetupKeyboard(user: UserRecord, connectUrl?: string, restoreUrl?: string): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  const connectRow = connectUrl
    ? [{ text: t(lang, "btn.connect_wallet_secure"), url: connectUrl }]
    : [button(t(lang, "btn.connect_wallet"), "connect_wallet")];
  const restoreRow = restoreUrl
    ? [{ text: t(lang, "btn.restore_wallet"), url: restoreUrl }]
    : [button(t(lang, "btn.restore_wallet"), "restore_wallet")];
  return [
    [button(t(lang, "btn.safe_onboarding"), "safe_onboarding")],
    connectRow,
    [button(t(lang, "btn.create_wallet"), "create_managed_wallet")],
    restoreRow,
    [button(t(lang, "btn.back_dashboard"), "menu")],
  ];
}

function walletReadonlyKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  return [
    [button(t(lang, "btn.safe_onboarding"), "safe_onboarding")],
    [button(t(lang, "btn.create_wallet"), "create_managed_wallet")],
    [button(t(lang, "btn.back_wallet"), "wallet")],
    [button(t(lang, "btn.back_dashboard"), "menu")],
  ];
}

function positionsKeyboard(user: UserRecord, positions: LivePosition[]): MessageSendRequest["inlineKeyboard"] {
  const rows: NonNullable<MessageSendRequest["inlineKeyboard"]> = positions.slice(0, 5).map((position, index) => [
    button(`${index + 1}. ${truncate(position.title, 28)}`, `position_detail:${index}`),
  ]);
  rows.push([button(t(user.language, "btn.back_wallet"), "wallet")]);
  return rows;
}

function positionDetailKeyboard(user: UserRecord, index: number): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  return [
    [button(t(lang, "btn.close_position"), `close_position:${index}`)],
    [button(t(lang, "btn.back_positions"), "positions")],
  ];
}

function depositKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  return [
    [button("Polygon", "deposit:Polygon"), button("Ethereum", "deposit:Ethereum")],
    [button("Base", "deposit:Base"), button("Arbitrum", "deposit:Arbitrum")],
    [button("Solana", "deposit:Solana"), button("Tron", "deposit:Tron")],
    [button("Bitcoin", "deposit:Bitcoin")],
    [button(t(user.language, "btn.back_wallet"), "wallet")],
  ];
}

function withdrawKeyboard(user: UserRecord, selectedPreset?: string, url?: string): MessageSendRequest["inlineKeyboard"] {
  const rows = WITHDRAW_PRESETS.map((preset) => [
    url && selectedPreset === preset.key
      ? { text: `${preset.chainLabel} ${preset.tokenSymbol}`, url }
      : button(`${preset.chainLabel} ${preset.tokenSymbol}`, `withdraw:${preset.key}`),
  ]);
  rows.push([button(t(user.language, "btn.back_wallet"), "wallet")]);
  return rows;
}

function receiptsKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  return [
    [button(t(lang, "btn.pnl"), "pnl_share")],
    [button(t(lang, "btn.back_wallet"), "wallet")],
    [button(t(lang, "btn.back_dashboard"), "menu")],
  ];
}

function discoverKeyboard(user: UserRecord, signals: RuntimeSignal[]): MessageSendRequest["inlineKeyboard"] {
  const sports = signals.filter((signal) => signal.sports === 1).sort((a, b) => b.score - a.score)[0];
  const top = signals.filter((signal) => signal.sports === 0).sort((a, b) => b.score - a.score)[0];
  const rows: NonNullable<MessageSendRequest["inlineKeyboard"]> = [
    [button(t(user.language, "btn.copydesk"), "copydesk"), button(t(user.language, "btn.worldcup"), "worldcup")],
    [button(t(user.language, "btn.signals"), "signals")],
  ];
  if (top) {
    rows.push([button(`🔥 #${top.id}`, `signal:${top.id}`)]);
  }
  if (sports) {
    rows.push([button(`⚽ #${sports.id}`, `signal:${sports.id}`)]);
  }
  rows.push([button(t(user.language, "btn.refer"), "refer"), button(t(user.language, "btn.creators"), "creators")]);
  rows.push([button(t(user.language, "btn.news"), "news_hub"), button(t(user.language, "btn.arb"), "arb_hub")]);
  rows.push([button(t(user.language, "btn.addressbook"), "addressbook"), button(t(user.language, "btn.follow_tasks"), "follow_tasks")]);
  rows.push([button(t(user.language, "btn.back_dashboard"), "menu")]);
  return rows;
}

function newsHubKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  return [
    [button(t(user.language, "btn.arb"), "arb_hub"), button(t(user.language, "btn.follow_tasks"), "follow_tasks")],
    [button(t(user.language, "btn.back_dashboard"), "menu")],
  ];
}

function arbHubKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  return [
    [button(t(user.language, "btn.news"), "news_hub"), button(t(user.language, "btn.follow_tasks"), "follow_tasks")],
    [button(t(user.language, "btn.back_dashboard"), "menu")],
  ];
}

function copyDeskKeyboard(
  user: UserRecord,
  payload: {
    topSignal?: RuntimeSignal | null;
    sportsSignal?: RuntimeSignal | null;
    topWallet?: RuntimeWalletProfile | null;
    sportsWallet?: RuntimeWalletProfile | null;
    suggestedSizes?: number[];
  },
): MessageSendRequest["inlineKeyboard"] {
  const rows: NonNullable<MessageSendRequest["inlineKeyboard"]> = [];
  if (payload.topSignal) {
    rows.push([button(`🔥 #${payload.topSignal.id}`, `signal:${payload.topSignal.id}`)]);
    if (payload.suggestedSizes?.length) {
      rows.push(
        payload.suggestedSizes.slice(0, 3).map((amount, index) => {
          const label = index === 0
            ? (user.language === "zh" ? "保守" : "Conservative")
            : index === 1
              ? (user.language === "zh" ? "平衡" : "Balanced")
              : (user.language === "zh" ? "激进" : "Aggressive");
          return button(`${label} $${amount}`, `copy_amount:${payload.topSignal!.id}:${amount}`);
        }),
      );
    }
  }
  if (payload.sportsSignal) {
    rows.push([button(`⚽ #${payload.sportsSignal.id}`, `signal:${payload.sportsSignal.id}`)]);
  }
  if (payload.topWallet) {
    rows.push([button(`🤝 ${truncate(payload.topWallet.name, 18)}`, `follow_wallet:${payload.topWallet.address.slice(2).toLowerCase()}`)]);
  }
  rows.push([button(t(user.language, "btn.quick_smart_money"), "leaderboard"), button(t(user.language, "btn.creators"), "creators")]);
  rows.push([button(t(user.language, "btn.addressbook"), "addressbook"), button(t(user.language, "btn.follow_tasks"), "follow_tasks")]);
  rows.push([button(t(user.language, "btn.worldcup"), "worldcup"), button(t(user.language, "btn.discover"), "discover")]);
  rows.push([button(t(user.language, "btn.back_dashboard"), "menu")]);
  return rows;
}

function addressBookKeyboard(
  user: UserRecord,
  payload: {
    topWallets: RuntimeWalletProfile[];
    sportsWallets: RuntimeWalletProfile[];
    activeTaskCount: number;
  },
): MessageSendRequest["inlineKeyboard"] {
  const rows: NonNullable<MessageSendRequest["inlineKeyboard"]> = [];
  for (const wallet of payload.topWallets.slice(0, 2)) {
    rows.push([button(`📇 ${truncate(wallet.name, 18)}`, `address_profile:${wallet.address.slice(2).toLowerCase()}`)]);
  }
  for (const wallet of payload.sportsWallets.slice(0, 2)) {
    rows.push([button(`⚽ ${truncate(wallet.name, 18)}`, `address_profile:${wallet.address.slice(2).toLowerCase()}`)]);
  }
  rows.push([button(t(user.language, "btn.follow_tasks"), "follow_tasks"), button(t(user.language, "btn.copydesk"), "copydesk")]);
  rows.push([button(t(user.language, "btn.back_dashboard"), "menu")]);
  return rows;
}

function addressProfileKeyboard(
  user: UserRecord,
  wallet: RuntimeWalletProfile,
  hasFollowTask: boolean,
): MessageSendRequest["inlineKeyboard"] {
  return [
    [button(t(user.language, "btn.track_wallet"), `track_wallet:${wallet.address.slice(2).toLowerCase()}`)],
    [button(t(user.language, "btn.follow_wallet"), `follow_wallet:${wallet.address.slice(2).toLowerCase()}`)],
    [button(hasFollowTask ? t(user.language, "btn.follow_tasks") : t(user.language, "btn.copydesk"), hasFollowTask ? "follow_tasks" : "copydesk")],
    [button(t(user.language, "btn.back_addressbook"), "addressbook")],
  ];
}

function followPresetKeyboard(user: UserRecord, wallet: RuntimeWalletProfile): MessageSendRequest["inlineKeyboard"] {
  const compact = wallet.address.slice(2).toLowerCase();
  return [
    [
      button(`${t(user.language, "btn.follow_conservative")} $1`, `follow_preset:${compact}:c`),
      button(`${t(user.language, "btn.follow_balanced")} $2`, `follow_preset:${compact}:b`),
    ],
    [button(`${t(user.language, "btn.follow_aggressive")} $3+`, `follow_preset:${compact}:a`)],
    [button(t(user.language, "btn.back_addressbook"), "addressbook"), button(t(user.language, "btn.back_follow"), "follow_tasks")],
  ];
}

function followTasksKeyboard(
  user: UserRecord,
  tasks: Array<{ id: number; status: string }>,
  spotlightTaskId?: number | null,
): MessageSendRequest["inlineKeyboard"] {
  const rows: NonNullable<MessageSendRequest["inlineKeyboard"]> = [];
  for (const task of tasks.slice(0, 4)) {
    const isActive = task.status === "active";
    rows.push([
      button(
        `${isActive ? t(user.language, "btn.pause_task") : t(user.language, "btn.resume_task")} #${task.id}${spotlightTaskId === task.id ? " ✨" : ""}`,
        `follow_toggle:${task.id}`,
      ),
    ]);
  }
  rows.push([button(t(user.language, "btn.addressbook"), "addressbook"), button(t(user.language, "btn.copydesk"), "copydesk")]);
  rows.push([button(t(user.language, "btn.back_dashboard"), "menu")]);
  return rows;
}

function referKeyboard(user: UserRecord, inviteLink: string): MessageSendRequest["inlineKeyboard"] {
  return [
    [{ text: t(user.language, "btn.refer"), url: inviteLink }],
    [button(t(user.language, "btn.referral_ledger"), "refer_ledger"), button(t(user.language, "btn.creators"), "creators")],
    [button(t(user.language, "btn.quick_profile"), "pnl_share")],
    [button(t(user.language, "btn.back_dashboard"), "menu")],
  ];
}

function creatorsKeyboard(
  user: UserRecord,
  creators: Array<{ telegramUserId: string; label: string }>,
): MessageSendRequest["inlineKeyboard"] {
  const rows: NonNullable<MessageSendRequest["inlineKeyboard"]> = [];
  for (const creator of creators.slice(0, 5)) {
    rows.push([
      button(`📣 ${truncate(creator.label, 14)}`, `creator_profile:${creator.telegramUserId}`),
      button("🌐 Share", `creator_share:${creator.telegramUserId}`),
    ]);
  }
  rows.push([button(t(user.language, "btn.refer"), "refer"), button(t(user.language, "btn.quick_profile"), "pnl_share")]);
  rows.push([button(t(user.language, "btn.back_dashboard"), "menu")]);
  return rows;
}

function pnlKeyboard(user: UserRecord, publicShareUrl: string): MessageSendRequest["inlineKeyboard"] {
  return [
    [{ text: t(user.language, "btn.open_public_page"), url: publicShareUrl }],
    [button(t(user.language, "btn.refresh"), "pnl_refresh")],
    [button(t(user.language, "btn.receipts"), "receipts"), button(t(user.language, "btn.creators"), "creators")],
    [button(t(user.language, "btn.refer"), "refer")],
    [button(t(user.language, "btn.back_dashboard"), "menu")],
  ];
}

function referralLedgerKeyboard(user: UserRecord, publicShareUrl: string): MessageSendRequest["inlineKeyboard"] {
  return [
    [{ text: t(user.language, "btn.open_public_page"), url: publicShareUrl }],
    [button(t(user.language, "btn.refer"), "refer"), button(t(user.language, "btn.creators"), "creators")],
    [button(t(user.language, "btn.back_dashboard"), "menu")],
  ];
}

function creatorSpotlightKeyboard(user: UserRecord, publicShareUrl: string, inviteLink: string): MessageSendRequest["inlineKeyboard"] {
  return [
    [{ text: t(user.language, "btn.open_public_page"), url: publicShareUrl }],
    [{ text: t(user.language, "btn.refer"), url: inviteLink }],
    [button("📈 Scorecard", "pnl_share"), button("🌐 Share", `creator_share:${publicShareUrl.split("/").pop()}`)],
    [button(t(user.language, "btn.creators"), "creators"), button(t(user.language, "btn.back_dashboard"), "menu")],
  ];
}

function settlementsKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  return [
    [button(t(lang, "btn.redeem"), "redeem_settlements")],
    [button(t(lang, "btn.back_wallet"), "wallet")],
    [button(t(lang, "btn.back_dashboard"), "menu")],
  ];
}

function leaderboardKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  return [
    [button(t(user.language, "btn.addressbook"), "addressbook"), button(t(user.language, "btn.follow_tasks"), "follow_tasks")],
    [button(t(user.language, "btn.back_dashboard"), "menu")],
  ];
}

function renderDepositAddress(user: UserRecord, chain: string, address: string): string {
  const lang = user.language;
  if (!address) {
    return `💳 <b>${chain} ${t(lang, "deposit.title")}</b>\n\n${t(lang, "deposit.no_address")}`;
  }
  const evmNote = ["polygon", "ethereum", "base", "arbitrum"].includes(chain.toLowerCase())
    ? `\n\n${t(lang, "deposit.evm_note")}`
    : "";
  return `💳 <b>${chain} ${t(lang, "deposit.title")}</b>\n\n<code>${address}</code>\n\n${t(lang, "deposit.real_address")}${evmNote}`;
}

function worldCupHubKeyboard(user: UserRecord, signals: RuntimeSignal[]): MessageSendRequest["inlineKeyboard"] {
  const lang = user.language;
  const topSignals = signals.filter((signal) => signal.sports === 1).sort((left, right) => right.score - left.score).slice(0, 3);
  const rows: NonNullable<MessageSendRequest["inlineKeyboard"]> = [
    [button(t(lang, "btn.match_cards"), "worldcup_signals"), button(t(lang, "btn.copydesk"), "copydesk")],
    [button(t(lang, "btn.sports_wallets"), "sports_wallets")],
  ];
  if (topSignals.length) {
    rows.push(topSignals.map((signal) => button(`#${signal.id}`, `signal:${signal.id}`)));
  }
  rows.push([button(t(lang, "btn.back_dashboard"), "menu")]);
  return rows;
}

function sportsLeaderboardKeyboard(user: UserRecord): MessageSendRequest["inlineKeyboard"] {
  return [[button(t(user.language, "btn.back_worldcup"), "worldcup")]];
}

function languageKeyboard(): MessageSendRequest["inlineKeyboard"] {
  return [
    [button("🇨🇳 中文", "set_lang:zh"), button("🇬🇧 English", "set_lang:en")],
    [button("🇯🇵 日本語", "set_lang:ja"), button("🇰🇷 한국어", "set_lang:ko")],
  ];
}

function copyCandidateAmounts(balanceUsdc: number, minOrderSize = 1, feeBps = 100): number[] {
  // Fee is added on top, not deducted from trade amount
  // User needs balance >= trade_amount + fee
  const feeRate = feeBps / 10000;
  const candidates = [1, 5, 10, 25, 50]
    .filter((amount) => amount >= minOrderSize)
    .filter((amount) => {
      const feeEstimate = amount * feeRate;
      return (amount + feeEstimate) <= balanceUsdc;
    });
  // Always show at least min order option if balance allows
  if (candidates.length === 0 && balanceUsdc >= minOrderSize * (1 + feeRate)) {
    return [minOrderSize];
  }
  return candidates.length ? candidates : [minOrderSize];
}

function localizedSignalTitle(user: UserRecord, signal: RuntimeSignal): string {
  return pickLang(signal, "title", user.language);
}

function renderTradeError(user: UserRecord, action: "copy" | "close", title: string, error: string): string {
  const lang = user.language;
  const header = action === "copy" ? t(lang, "trade.copy_fail") : t(lang, "trade.close_fail");
  return `❌ <b>${header}</b>\n\n${title}\n<code>${escapeHtml(error)}</code>`;
}

function renderSportsPush(language: Lang, signal: RuntimeSignal): string {
  const title = pickLang(signal, "title", language);
  const action = pickLang(signal, "action", language);
  const expiry = pickLang(signal, "expiry", language);
  return `⚽ <b>${t(language, "push.sports_title")}</b>\n\n<b>${escapeHtml(title)}</b>\n🎯 ${escapeHtml(action)}\n🏆 Smart Score: <b>${signal.score}</b>\n💧 ${t(language, "signal.liquidity")}：<b>${escapeHtml(signal.liquidity)}</b>\n⏰ ${escapeHtml(expiry)}\n\n${t(language, "push.sports_hint")}`;
}

function depositChainKey(chain: string): string {
  switch (chain.toLowerCase()) {
    case "polygon":
    case "ethereum":
    case "base":
    case "arbitrum":
      return "evm";
    case "solana":
      return "svm";
    case "tron":
      return "tron";
    case "bitcoin":
      return "btc";
    default:
      return chain.toLowerCase();
  }
}

function normalizeTradeResult(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const result = value as Record<string, unknown>;
  return {
    orderId: result.orderID ?? result.orderId ?? "",
    txHash: result.transactionsHashes?.[0] ?? result.txHash ?? result.transactionHash ?? "",
    status: result.status ?? "",
    raw: result,
  };
}

function button(text: string, callback_data: string): { text: string; callback_data: string } {
  return { text, callback_data };
}

function short(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function escapeForInline(value: string | null | undefined): string {
  return escapeHtml(value ?? "-");
}

async function provisionManagedWalletForUser(env: Env, user: UserRecord, options?: { forceReplaceLegacy?: boolean }) {
  const existing = await getUserTradingAccountContext(env, user.telegram_user_id);
  if (existing?.account.auth_mode === "managed_signer" && existing.credentials) {
    if (!isLegacyManagedWalletContext(existing)) {
      return existing.account;
    }
    if (!options?.forceReplaceLegacy) {
      try {
        const wallet = await fetchLiveWalletState(env, existing);
        const hasBalance = Number(wallet.snapshot.balanceUsdc ?? 0) > 0;
        const hasPositions = wallet.positions.length > 0;
        const hasOpenOrders = Number(wallet.snapshot.openOrdersCount ?? 0) > 0;
        if (hasBalance || hasPositions || hasOpenOrders) {
          return existing.account;
        }
      } catch {
        return existing.account;
      }
    }
    await archiveUserTradingAccountState(env, {
      telegramUserId: user.telegram_user_id,
      reason: "legacy_managed_wallet_reprovision",
    });
  }
  if (!env.USER_ACCOUNT_ENCRYPTION_SECRET?.trim()) {
    throw new Error("Managed wallet provisioning is unavailable because USER_ACCOUNT_ENCRYPTION_SECRET is not configured.");
  }
  const managed = await provisionManagedTradingAccount(env, {
    accountLabel: user.username ? `@${user.username} Luna Wallet` : `Luna Wallet ${user.telegram_user_id}`,
  });
  await upsertUserTradingAccount(env.DB, {
    telegramUserId: user.telegram_user_id,
    status: "pending_link",
    authMode: "managed_signer",
    relayerTxType: deriveManagedWalletRelayerTxType(managed.signerAddress, managed.funderAddress, managed.signatureType),
    safeDeployed: false,
    signatureType: managed.signatureType,
    accountLabel: managed.accountLabel,
    signerAddress: managed.signerAddress,
    funderAddress: managed.funderAddress,
    lastVerifiedAt: new Date().toISOString(),
  });
  await saveUserTradingCredentials(env, {
    telegramUserId: user.telegram_user_id,
    credentials: managed.credentials,
  });
  const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
  const bridgeAddresses = accountContext ? await fetchBridgeAddresses(env, accountContext).catch(() => ({})) : {};
  await upsertUserTradingAccount(env.DB, {
    telegramUserId: user.telegram_user_id,
    status: "tradable",
    authMode: "managed_signer",
    relayerTxType: deriveManagedWalletRelayerTxType(managed.signerAddress, managed.funderAddress, managed.signatureType),
    safeDeployed: false,
    signatureType: managed.signatureType,
    accountLabel: managed.accountLabel,
    signerAddress: managed.signerAddress,
    funderAddress: managed.funderAddress,
    depositAddressEvm: bridgeAddresses.evm,
    depositAddressSvm: bridgeAddresses.svm,
    depositAddressBtc: bridgeAddresses.btc,
    depositAddressTron: bridgeAddresses.tron,
    lastVerifiedAt: new Date().toISOString(),
  });
  const account = await getUserTradingAccount(env.DB, user.telegram_user_id);
  if (!account) {
    throw new Error("Managed wallet provisioning failed");
  }
  return account;
}

async function issueExportLink(env: Env, telegramUserId: string): Promise<string> {
  const token = createOpaqueToken();
  await createUserAccountExportSession(env.DB, {
    tokenHash: await hashLinkToken(token),
    telegramUserId,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  return `${resolvePublicBaseUrl(env)}/export/${token}`;
}

async function issueRestoreLink(env: Env, telegramUserId: string): Promise<string> {
  const token = createOpaqueToken();
  await createUserAccountRestoreSession(env.DB, {
    tokenHash: await hashLinkToken(token),
    telegramUserId,
    expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  });
  return `${resolvePublicBaseUrl(env)}/restore/${token}`;
}

async function issueWithdrawLink(env: Env, telegramUserId: string, presetKey: string): Promise<string> {
  const token = createOpaqueToken();
  await createUserAccountWithdrawSession(env.DB, {
    tokenHash: await hashLinkToken(token),
    telegramUserId,
    expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  });
  return `${resolvePublicBaseUrl(env)}/withdraw/${token}?preset=${encodeURIComponent(presetKey)}`;
}

async function issueSafeOnboardingLink(env: Env, telegramUserId: string): Promise<string> {
  const token = createOpaqueToken();
  await createUserSafeOnboardingSession(env.DB, {
    tokenHash: await hashLinkToken(token),
    telegramUserId,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  return `${resolvePublicBaseUrl(env)}/safe/${token}`;
}

async function issueConnectLink(env: Env, telegramUserId: string): Promise<string> {
  const token = createOpaqueToken();
  await createUserAccountLinkSession(env.DB, {
    tokenHash: await hashLinkToken(token),
    telegramUserId,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  return `${resolvePublicBaseUrl(env)}/connect/${token}`;
}

function buildWithdrawLaunchMessage(user: UserRecord, chainLabel: string, withdrawUrl: string): string {
  const lang = user.language;
  const title = t(lang, "withdraw.title");
  const hint = t(lang, "withdraw.hint");
  const expiry = t(lang, "withdraw.link_expiry");
  return "\u{1F4B8} <b>" + title + " " + escapeHtml(chainLabel) + "</b>\n\n" + hint + "\n\n" + expiry + "\n<code>" + escapeHtml(withdrawUrl) + "</code>";
}

function formatWithdrawFailure(error: unknown, lang?: Lang): string {
  const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = msg.toLowerCase();
  if (lower.includes("legacy wallet migration required") || lower.includes("older managed-wallet model")) {
    return "This Luna wallet is on a legacy account model. Create a fresh Luna wallet and use the Deposit route before trying in-app withdrawals.";
  }
  if (lower.includes("insufficient funds for intrinsic transaction cost") || lower.includes("insufficient funds for transfer")) {
    return lang ? t(lang, "withdraw.gas_error") : "Your trading wallet has USDC but not enough native POL for gas. Send a small amount of Polygon gas token (MATIC/POL) to the trading wallet, then try Withdraw again.";
  }
  if (lower.includes("this wallet does not have a signer private key")) {
    return lang ? t(lang, "withdraw.no_signer") : "This wallet cannot sign direct withdrawals yet. Finish the official Safe/Builder onboarding path first.";
  }
  if (lower.includes("insufficient usdc.e balance")) {
    return lang ? t(lang, "withdraw.insufficient") : "This trading wallet does not have enough bridged USDC.e balance to complete the withdrawal.";
  }
  return msg;
}

function buildConnectLaunchMessage(user: UserRecord, connectUrl: string): string {
  const lang = user.language;
  return "\u{1F510} <b>" + t(lang, "connect.secure_title") + "</b>\n\n" + t(lang, "connect.secure_hint") + "\n\n<code>" + escapeHtml(connectUrl) + "</code>";
}

function buildSafeOnboardingLaunchMessage(user: UserRecord, safeUrl: string): string {
  const lang = user.language;
  return "\u{1F6E1} <b>" + t(lang, "safe.title") + "</b>\n\n" + t(lang, "safe.hint") + "\n\n<code>" + escapeHtml(safeUrl) + "</code>";
}

function buildBackupLaunchMessage(user: UserRecord, backupUrl: string): string {
  const lang = user.language;
  return "\u{1F9FE} <b>" + t(lang, "backup.title") + "</b>\n\n" + t(lang, "backup.hint") + "\n\n<code>" + escapeHtml(backupUrl) + "</code>";
}

function buildRestoreLaunchMessage(user: UserRecord, restoreUrl: string): string {
  const lang = user.language;
  return "\u267B\uFE0F <b>" + t(lang, "restore.title") + "</b>\n\n" + t(lang, "restore.hint") + "\n\n<code>" + escapeHtml(restoreUrl) + "</code>";
}

function buildInviteLink(user: UserRecord): string {
  return `https://t.me/GetLunaAIBot?start=ref_${encodeURIComponent(user.telegram_user_id)}`;
}

function quickMenuKeyboard(user: UserRecord): string[][] {
  const lang = user.language;
  return [
    [t(lang, "btn.quick_signals"), t(lang, "btn.wallet")],
    [t(lang, "btn.quick_profile"), t(lang, "btn.quick_smart_money")],
    [t(lang, "btn.settings"), t(lang, "btn.quick_dashboard")],
  ];
}

function quickMenuShellText(user: UserRecord): string {
  return user.language === "zh"
    ? "⚡ <b>Luna 已就绪</b>\n快捷菜单已加载。你可以直接点下面的菜单，不必每次都输入命令。"
    : "⚡ <b>Luna is ready</b>\nQuick menu loaded. Use the buttons below instead of typing every command.";
}

async function walletKeyboardForContext(env: Env, user: UserRecord, accountContext: Awaited<ReturnType<typeof getUserTradingAccountContext>>): Promise<MessageSendRequest["inlineKeyboard"]> {
  if (accountContext?.account.auth_mode === "managed_signer" && accountContext.credentials) {
    const backupUrl = await issueExportLink(env, user.telegram_user_id);
    return walletKeyboard(user, backupUrl);
  }
  return walletKeyboard(user);
}

function renderManagedWalletCreated(user: UserRecord, account: { funder_address: string | null; deposit_address_evm: string | null; auth_mode: string | null }): string {
  const lang = user.language;
  return `✨ <b>${t(lang, "wallet.created_title")}</b>\n\n${t(lang, "label.mode")}：<b>${escapeHtml(account.auth_mode ?? "managed_signer")}</b>\n${t(lang, "wallet.trading_wallet")}：<code>${escapeForInline(account.funder_address)}</code>\n${account.deposit_address_evm ? `EVM ${t(lang, "deposit.title")}：<code>${escapeForInline(account.deposit_address_evm)}</code>\n` : ""}\n${t(lang, "wallet.created_hint")}`;
}

function getWithdrawPreset(key: string) {
  return WITHDRAW_PRESETS.find((preset) => preset.key === key) ?? WITHDRAW_PRESETS[0];
}

function buildFeeAllocations(env: Env, totalFeeUsdc: number): Array<{
  bucket: string;
  amountUsdc: number;
  destinationWallet?: string;
  status?: string;
  detail?: string;
}> {
  const treasuryBps = Number(env.LUNA_TREASURY_SPLIT_BPS ?? "7000");
  const operationsBps = Number(env.LUNA_OPERATIONS_SPLIT_BPS ?? "2000");
  const referralBps = Number(env.LUNA_REFERRAL_SPLIT_BPS ?? "500");
  const builderBps = Number(env.LUNA_BUILDER_SPLIT_BPS ?? "500");
  const totalBps = treasuryBps + operationsBps + referralBps + builderBps || 10000;
  const normalized = [
    { bucket: "treasury", bps: treasuryBps, destinationWallet: env.LUNA_TREASURY_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET },
    { bucket: "operations", bps: operationsBps, destinationWallet: env.LUNA_OPERATIONS_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET },
    { bucket: "referral_pool", bps: referralBps, destinationWallet: env.LUNA_REFERRAL_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET },
    { bucket: "builder_reserve", bps: builderBps, destinationWallet: env.LUNA_BUILDER_RESERVE_WALLET ?? env.LUNA_PLATFORM_FEE_WALLET },
  ];
  return normalized
    .map((item, index) => {
      const raw = index === normalized.length - 1
        ? Math.max(0, Number((totalFeeUsdc - normalized.slice(0, index).reduce((sum, next) => sum + (totalFeeUsdc * next.bps) / totalBps, 0)).toFixed(2)))
        : Number(((totalFeeUsdc * item.bps) / totalBps).toFixed(2));
      return {
        bucket: item.bucket,
        amountUsdc: raw,
        destinationWallet: item.destinationWallet,
        status: "reserved",
        detail: `split=${item.bps}/${totalBps}`,
      };
    })
    .filter((item) => item.amountUsdc > 0);
}

async function attemptIntegratorFeeCollection(
  env: Env,
  accountContext: Awaited<ReturnType<typeof getUserTradingAccountContext>>,
  payload: {
    feeLedgerId: number;
    amountUsdc: number;
    destinationWallet?: string | null;
    signalId?: number;
    orderId?: string | null;
  },
): Promise<{
  attempted: boolean;
  collected: boolean;
  reason?: string;
  txHash?: string;
  transactionId?: string;
}> {
  if (!accountContext) {
    return { attempted: false, collected: false, reason: "missing account context" };
  }
  const destinationWallet = payload.destinationWallet?.trim();
  if (!destinationWallet) {
    await updateFeeLedgerSettlement(env.DB, {
      feeLedgerId: payload.feeLedgerId,
      status: "accrued_unsettled",
      detail: "No platform fee wallet configured; fee remains accrued",
    });
    await updateFeeRevenueAllocationStatus(env.DB, {
      feeLedgerId: payload.feeLedgerId,
      status: "reserved",
      detail: "No platform fee wallet configured",
    });
    return { attempted: false, collected: false, reason: "missing destination wallet" };
  }

  try {
    const result = await collectIntegratorFee(env, accountContext, {
      amountUsdc: payload.amountUsdc,
      destinationWallet,
      note: payload.orderId ? `Collect Luna fee for order ${payload.orderId}` : "Collect Luna integrator fee",
    });
    await updateFeeLedgerSettlement(env.DB, {
      feeLedgerId: payload.feeLedgerId,
      status: "settled",
      settlementTxRef: result.transactionHash ?? result.transactionId,
      detail: `Integrator fee collected via relayer (${result.txType})`,
    });
    await updateFeeRevenueAllocationStatus(env.DB, {
      feeLedgerId: payload.feeLedgerId,
      status: "settled",
      detail: `settlement_tx=${result.transactionHash ?? result.transactionId ?? "n/a"}`,
    });
    return {
      attempted: true,
      collected: true,
      txHash: result.transactionHash,
      transactionId: result.transactionId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integrator fee collection failed";
    await updateFeeLedgerSettlement(env.DB, {
      feeLedgerId: payload.feeLedgerId,
      status: "accrued_unsettled",
      detail: `Integrator fee collection failed: ${message}`,
    });
    await updateFeeRevenueAllocationStatus(env.DB, {
      feeLedgerId: payload.feeLedgerId,
      status: "reserved",
      detail: `collection_failed=${message}`,
    });
    return { attempted: true, collected: false, reason: message };
  }
}

async function syncPendingWithdrawals(env: Env): Promise<void> {
  const rows = await listWithdrawalRequests(env.DB, { status: "submitted", limit: 50 });
  for (const row of rows) {
    const bridgeAddress = String(row.bridge_address ?? "");
    if (!bridgeAddress) continue;
    try {
      if (!row.source_tx_hash && row.source_transaction_id) {
        const accountContext = await getUserTradingAccountContext(env.DB, String(row.telegram_user_id ?? ""));
        if (accountContext) {
          const relayerTx = await getRelayerTransaction(env, accountContext, String(row.source_transaction_id));
          if (relayerTx?.state === "STATE_FAILED") {
            await updateWithdrawalRequest(env.DB, {
              id: Number(row.id),
              status: "failed",
              sourceTransactionState: relayerTx.state,
              sourceTxHash: typeof relayerTx.transactionHash === "string" ? relayerTx.transactionHash : undefined,
              detail: JSON.stringify(relayerTx),
            });
            continue;
          }
          if (typeof relayerTx?.transactionHash === "string" && relayerTx.transactionHash) {
            await updateWithdrawalRequest(env.DB, {
              id: Number(row.id),
              status: "submitted",
              sourceTransactionState: typeof relayerTx.state === "string" ? relayerTx.state : undefined,
              sourceTxHash: relayerTx.transactionHash,
              detail: JSON.stringify(relayerTx),
            });
          }
        }
      }
      if (row.source_tx_hash) {
        const receipt = await getPolygonTransactionReceipt(env, String(row.source_tx_hash));
        if (receipt?.status === "0x0") {
          await updateWithdrawalRequest(env.DB, {
            id: Number(row.id),
            status: "failed",
            sourceTxHash: String(row.source_tx_hash),
            sourceTransactionState: "CHAIN_FAILED",
            detail: JSON.stringify({ reason: "source_tx_reverted", txHash: row.source_tx_hash }),
          });
          continue;
        }
      }
      const statusPayload = await getBridgeTransactionStatus(env, bridgeAddress);
      const transactions = Array.isArray(statusPayload.transactions) ? (statusPayload.transactions as Array<Record<string, unknown>>) : [];
      const latest = transactions[0] ?? {};
      const bridgeStatus = typeof latest.status === "string" ? latest.status : "SUBMITTED";
      const status = bridgeStatus === "COMPLETED" ? "completed" : bridgeStatus === "FAILED" ? "failed" : "submitted";
      await updateWithdrawalRequest(env.DB, {
        id: Number(row.id),
        status,
        bridgeStatus,
        sourceTransactionState: typeof row.source_transaction_state === "string" ? String(row.source_transaction_state) : undefined,
        bridgeTxHash: typeof latest.destinationTxHash === "string" ? latest.destinationTxHash : typeof latest.txHash === "string" ? latest.txHash : undefined,
        detail: JSON.stringify(statusPayload),
      });
      if (status !== "submitted") {
        const user = await getUser(env.DB, String(row.telegram_user_id ?? ""));
        if (user?.telegram_chat_id) {
          await send(
            env,
            user.telegram_chat_id,
            user.language === "zh"
              ? `${status === "completed" ? "✅" : "❌"} <b>提现状态更新</b>\n\n目标链：${escapeHtml(String(row.destination_chain ?? "-"))}\n金额：<b>$${Number(row.amount_usdc ?? 0).toFixed(2)}</b>\n状态：<b>${escapeHtml(bridgeStatus)}</b>\n${row.source_tx_hash ? `源 tx：<code>${escapeForInline(String(row.source_tx_hash))}</code>\n` : ""}${latest.destinationTxHash ? `目标 tx：<code>${escapeForInline(String(latest.destinationTxHash))}</code>` : ""}`
              : `${status === "completed" ? "✅" : "❌"} <b>Withdrawal Update</b>\n\nDestination: ${escapeHtml(String(row.destination_chain ?? "-"))}\nAmount: <b>$${Number(row.amount_usdc ?? 0).toFixed(2)}</b>\nStatus: <b>${escapeHtml(bridgeStatus)}</b>\n${row.source_tx_hash ? `Source tx: <code>${escapeForInline(String(row.source_tx_hash))}</code>\n` : ""}${latest.destinationTxHash ? `Destination tx: <code>${escapeForInline(String(latest.destinationTxHash))}</code>` : ""}`,
            receiptsKeyboard(user),
          );
        }
      }
    } catch (error) {
      await updateWithdrawalRequest(env.DB, {
        id: Number(row.id),
        status: "submitted",
        detail: error instanceof Error ? error.message : "bridge status check failed",
      });
    }
  }
}

async function syncUserSettlementState(env: Env, telegramUserId: string): Promise<Array<Record<string, unknown>>> {
  const trades = await listTradeEvents(env.DB, { telegramUserId, limit: 50 });
  for (const trade of trades) {
    if (trade.event_type !== "copy" || !trade.payload_json) continue;
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(trade.payload_json);
    } catch {
      payload = {};
    }
    const marketSlug = typeof payload.signalSlug === "string" ? payload.signalSlug : "";
    if (!marketSlug) continue;
    try {
      const settlement = await fetchMarketSettlement(env, marketSlug);
      const selectedOutcome = typeof payload.selectedOutcome === "string" ? payload.selectedOutcome : trade.outcome ?? undefined;
      let settlementStatus = "open";
      let redeemableAmountUsdc: number | null = null;
      if (settlement.resolved) {
        if (settlement.winningOutcome && selectedOutcome && settlement.winningOutcome.toLowerCase() === selectedOutcome.toLowerCase()) {
          settlementStatus = "resolved_won";
          redeemableAmountUsdc = Number(trade.amount_usdc ?? 0);
        } else if (settlement.winningOutcome) {
          settlementStatus = "resolved_lost";
          redeemableAmountUsdc = 0;
        } else {
          settlementStatus = "resolved_unknown";
        }
      }
      await upsertTradeSettlement(env.DB, {
        telegramUserId,
        tradeEventId: Number(trade.id),
        marketSlug,
        title: trade.title ?? undefined,
        selectedOutcome,
        winningOutcome: settlement.winningOutcome,
        settlementStatus,
        redeemableAmountUsdc,
        resolvedAt: settlement.resolvedAt,
        detailJson: settlement.detail,
      });
    } catch {
      continue;
    }
  }
  return listTradeSettlements(env.DB, { telegramUserId, limit: 20 });
}

async function syncRecentSettlements(env: Env): Promise<void> {
  const accounts = await listUserTradingAccounts(env.DB, { status: "tradable", limit: 100 });
  for (const account of accounts) {
    await syncUserSettlementState(env, account.telegram_user_id);
  }
}

async function redeemUserSettlements(env: Env, user: UserRecord): Promise<{ text: string }> {
  const accountContext = await getUserTradingAccountContext(env, user.telegram_user_id);
  if (!accountContext?.credentials) {
    return {
      text: user.language === "zh"
        ? "❌ 先完成你自己的交易账户授权，之后才能兑付已结算的赢家仓位。"
        : "❌ Finish authorizing your own trading account before redeeming resolved winning positions.",
    };
  }
  const rows = await syncUserSettlementState(env, user.telegram_user_id);
  const redeemable = rows.filter((row) =>
    String(row.settlement_status) === "resolved_won" && Number(row.redeemable_amount_usdc ?? 0) > 0,
  );
  if (!redeemable.length) {
    return {
      text: user.language === "zh"
        ? "🏁 当前没有可兑付的赢家仓位。"
        : "🏁 There are no redeemable winning positions right now.",
    };
  }
  try {
    const result = await redeemWinningPositions(
      env,
      accountContext,
      redeemable.map((row) => ({
        tradeEventId: Number(row.trade_event_id),
        marketSlug: String(row.market_slug ?? ""),
        selectedOutcome: row.selected_outcome ? String(row.selected_outcome) : null,
      })),
    );
    for (const row of redeemable) {
      await updateTradeSettlementRedemption(env.DB, {
        tradeEventId: Number(row.trade_event_id),
        settlementStatus: "redeemed",
        redeemableAmountUsdc: 0,
        detailJson: {
          redemption: {
            transactionId: result.transactionId,
            transactionHash: result.transactionHash ?? null,
            txType: result.txType,
            attempted: result.attempted,
          },
        },
      });
    }
    return {
      text: user.language === "zh"
        ? `💸 <b>已提交兑付</b>\n\n已尝试兑付 <b>${redeemable.length}</b> 个赢家仓位。\n交易参考：<code>${escapeForInline(result.transactionHash ?? result.transactionId)}</code>`
        : `💸 <b>Redeem Submitted</b>\n\nAttempted redemption for <b>${redeemable.length}</b> winning positions.\nReference: <code>${escapeForInline(result.transactionHash ?? result.transactionId)}</code>`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Redeem failed";
    return {
      text: user.language === "zh"
        ? `❌ <b>兑付失败</b>\n\n${escapeHtml(message)}`
        : `❌ <b>Redeem Failed</b>\n\n${escapeHtml(message)}`,
    };
  }
}

function resolvePublicBaseUrl(env: Env): string {
  if (env.LUNA_SITE_URL?.startsWith("https://") && !env.LUNA_SITE_URL.includes("lunaai.bot")) {
    return env.LUNA_SITE_URL;
  }
  return "https://YOUR_BOT_WORKER.YOUR_CF_SUBDOMAIN.workers.dev";
}

function createOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return bytesToBase64Url(bytes);
}

async function hashLinkToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeConnectSubmission(form: FormData): {
  accountLabel?: string;
  funderAddress: string;
  signerAddress: string;
  privateKey?: string;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
} {
  const accountLabel = String(form.get("account_label") ?? "").trim() || undefined;
  const funderAddress = String(form.get("funder_address") ?? "").trim();
  const signerAddress = String(form.get("signer_address") ?? "").trim() || funderAddress;
  const privateKey = String(form.get("polymarket_private_key") ?? "").trim() || undefined;
  const apiKey = String(form.get("polymarket_api_key") ?? "").trim() || undefined;
  const apiSecret = String(form.get("polymarket_api_secret") ?? "").trim() || undefined;
  const apiPassphrase = String(form.get("polymarket_api_passphrase") ?? "").trim() || undefined;
  return {
    accountLabel,
    funderAddress: funderAddress.toLowerCase(),
    signerAddress: signerAddress.toLowerCase(),
    privateKey,
    apiKey,
    apiSecret,
    apiPassphrase,
  };
}

function validateConnectSubmission(payload: {
  funderAddress: string;
  signerAddress: string;
  privateKey?: string;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
}): string | undefined {
  if (!isValidEvmAddress(payload.funderAddress) || !isValidEvmAddress(payload.signerAddress)) {
    return "Funder and signer must both be valid EVM addresses.";
  }
  const providedSecrets = [payload.privateKey, payload.apiKey, payload.apiSecret, payload.apiPassphrase].filter(Boolean).length;
  if (providedSecrets > 0 && providedSecrets < 4) {
    return "To enable tradable mode, provide all four credential fields together.";
  }
  if (payload.privateKey && !/^0x[a-fA-F0-9]{64}$/.test(payload.privateKey)) {
    return "Private key must be a 0x-prefixed 32-byte hex string.";
  }
  return undefined;
}

function parseManagedWalletBackup(raw: string):
  | {
      authMode: "managed_signer";
      signatureType: string;
      signerAddress: string;
      funderAddress: string;
      depositAddressEvm?: string;
      depositAddressSvm?: string;
      depositAddressBtc?: string;
      depositAddressTron?: string;
      accountLabel: string;
      credentials: {
        polymarketPrivateKey: string;
        polymarketApiKey: string;
        polymarketApiSecret: string;
        polymarketApiPassphrase: string;
      };
    }
  | { error: string } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.auth_mode !== "managed_signer") {
      return { error: "Backup is not a Luna managed wallet export." };
    }
    const signerAddress = String(parsed.signer_address ?? "").toLowerCase();
    const funderAddress = String(parsed.funder_address ?? "").toLowerCase();
    if (!isValidEvmAddress(signerAddress) || !isValidEvmAddress(funderAddress)) {
      return { error: "Backup is missing a valid signer or funder address." };
    }
    const credentials = parsed.credentials as Record<string, unknown> | undefined;
    const polymarketPrivateKey = String(credentials?.polymarketPrivateKey ?? "").trim();
    const polymarketApiKey = String(credentials?.polymarketApiKey ?? "").trim();
    const polymarketApiSecret = String(credentials?.polymarketApiSecret ?? "").trim();
    const polymarketApiPassphrase = String(credentials?.polymarketApiPassphrase ?? "").trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(polymarketPrivateKey) || !polymarketApiKey || !polymarketApiSecret || !polymarketApiPassphrase) {
      return { error: "Backup is missing complete tradable credentials." };
    }
    return {
      authMode: "managed_signer",
      signatureType: String(parsed.signature_type ?? "0"),
      signerAddress,
      funderAddress,
      depositAddressEvm: parsed.deposit_address_evm ? String(parsed.deposit_address_evm) : undefined,
      depositAddressSvm: parsed.deposit_address_svm ? String(parsed.deposit_address_svm) : undefined,
      depositAddressBtc: parsed.deposit_address_btc ? String(parsed.deposit_address_btc) : undefined,
      depositAddressTron: parsed.deposit_address_tron ? String(parsed.deposit_address_tron) : undefined,
      accountLabel: "Restored Luna Wallet",
      credentials: {
        polymarketPrivateKey,
        polymarketApiKey,
        polymarketApiSecret,
        polymarketApiPassphrase,
      },
    };
  } catch {
    return { error: "Backup JSON is invalid." };
  }
}

function isValidEvmAddress(value: string | undefined): value is string {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

/**
 * Check if address might be a Polymarket user address.
 * Returns warning message if detected, undefined if safe.
 */
async function checkPolymarketAddress(env: Env, address: string): Promise<string | undefined> {
  const lowerAddress = address.toLowerCase();
  
  // Check if it's a known Luna user's SAFE wallet or deposit address
  const knownUser = await env.DB.prepare(`
    SELECT telegram_user_id FROM user_trading_accounts 
    WHERE LOWER(funder_address) = ? 
       OR LOWER(signer_address) = ? 
       OR LOWER(deposit_address_evm) = ?
    LIMIT 1
  `).bind(lowerAddress, lowerAddress, lowerAddress).first<{ telegram_user_id: string }>();
  
  if (knownUser) {
    return "This appears to be another Polymarket user's address. Direct transfers between Polymarket accounts are NOT supported by the Bridge and funds may be unrecoverable. Please withdraw to an external wallet (MetaMask, exchange, etc.) instead.";
  }
  
  // Check if address looks like a Gnosis Safe proxy (deployed by SafeProxyFactory)
  // Safe proxies have specific bytecode patterns, but checking on-chain is expensive.
  // As a heuristic, we can check if the address has been used as a funder in the past.
  
  // Additional check: Polymarket deposit addresses follow a pattern
  // They are generated by the Bridge contract for each user
  // For now, we rely on the known user check above
  
  return undefined;
}

function normalizeUserSocketEvents(payload: unknown): Array<{
  eventType: "fill_update" | "order_update" | "user_event";
  entityKey?: string;
  payload: unknown;
}> {
  const rows = Array.isArray(payload) ? payload : [payload];
  const events: Array<{
    eventType: "fill_update" | "order_update" | "user_event";
    entityKey?: string;
    payload: unknown;
  }> = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      events.push({ eventType: "user_event", payload: row });
      continue;
    }
    const record = row as Record<string, unknown>;
    const eventName = String(record.event_type ?? record.type ?? record.event ?? record.status ?? "").toLowerCase();
    const hasTradeFields =
      record.matched_amount != null ||
      record.filled_amount != null ||
      record.size_matched != null ||
      record.trade_id != null;
    const hasOrderFields =
      record.order_id != null ||
      record.orderID != null ||
      record.asset_id != null ||
      record.market != null;
    const entityKey = String(record.order_id ?? record.orderID ?? record.trade_id ?? record.id ?? "");
    if (hasTradeFields || eventName.includes("fill") || eventName.includes("match") || eventName.includes("trade")) {
      events.push({ eventType: "fill_update", entityKey, payload: record });
      continue;
    }
    if (
      hasOrderFields ||
      eventName.includes("order") ||
      eventName.includes("cancel") ||
      eventName.includes("open") ||
      eventName.includes("accepted") ||
      eventName.includes("rejected")
    ) {
      events.push({ eventType: "order_update", entityKey, payload: record });
      continue;
    }
    events.push({ eventType: "user_event", entityKey, payload: record });
  }
  return events;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
