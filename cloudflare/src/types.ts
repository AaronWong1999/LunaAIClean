export interface Env {
  DB: D1Database;
  TRADE_COORDINATOR: DurableObjectNamespace;
  MARKET_STREAM: DurableObjectNamespace;
  BOT_FANOUT: DurableObjectNamespace;
  FOLLOW_ENGINE: DurableObjectNamespace;
  NEWS_INGEST: DurableObjectNamespace;
  PUSH_QUEUE: Queue<PushQueueMessage>;
  APP_ENV: string;
  LUNA_VERSION: string;
  LUNA_SITE_URL: string;
  POLYMARKET_RELAYER_HOST?: string;
  POLYMARKET_BUILDER_SETTINGS_URL?: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  INTERNAL_ADMIN_SECRET?: string;
  BUILDER_REMOTE_SIGNER_TOKEN?: string;
  USER_ACCOUNT_ENCRYPTION_SECRET?: string;
  LUNA_SAFE_ONBOARDING_URL?: string;
  LUNA_PLATFORM_FEE_BPS?: string;
  LUNA_PLATFORM_FEE_WALLET?: string;
  POLYMARKET_MIN_ORDER_SIZE_USDC?: string;
  LUNA_TREASURY_WALLET?: string;
  LUNA_OPERATIONS_WALLET?: string;
  LUNA_REFERRAL_WALLET?: string;
  LUNA_BUILDER_RESERVE_WALLET?: string;
  LUNA_TREASURY_SPLIT_BPS?: string;
  LUNA_OPERATIONS_SPLIT_BPS?: string;
  LUNA_REFERRAL_SPLIT_BPS?: string;
  LUNA_BUILDER_SPLIT_BPS?: string;
  POLYGON_RPC_URL?: string;
  TREEOFALPHA_API_KEY?: string;
  CRYPTOPANIC_API_KEY?: string;
  SIXNINE_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  LUNAAI_LLM_MODEL?: string;
  DRY_RUN?: string;
  LUNA_ADMIN_CHAT_ID?: string;
  SPORTMONKS_API_TOKEN?: string;
  POLYMARKET_HOST: string;
  POLYMARKET_GAMMA_HOST: string;
  POLYMARKET_DATA_HOST: string;
  POLYMARKET_BRIDGE_HOST: string;
  POLYMARKET_CHAIN_ID: string;
  POLYMARKET_SIGNATURE_TYPE: string;
  POLYMARKET_PRIVATE_KEY: string;
  POLYMARKET_API_KEY: string;
  POLYMARKET_API_SECRET: string;
  POLYMARKET_API_PASSPHRASE: string;
  POLYMARKET_FUNDER_ADDRESS: string;
  POLYMARKET_USER_ADDRESS: string;
  POLYMARKET_BUILDER_API_KEY?: string;
  POLYMARKET_BUILDER_API_SECRET?: string;
  POLYMARKET_BUILDER_API_PASSPHRASE?: string;
  POLYMARKET_RELAYER_API_KEY?: string;
  POLYMARKET_RELAYER_API_KEY_ADDRESS?: string;
}

export interface UserAccountLinkSessionRecord {
  token_hash: string;
  telegram_user_id: string;
  status: "open" | "used" | "expired";
  expires_at: string;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAccountExportSessionRecord {
  token_hash: string;
  telegram_user_id: string;
  status: "open" | "used" | "expired";
  expires_at: string;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAccountRestoreSessionRecord {
  token_hash: string;
  telegram_user_id: string;
  status: "open" | "used" | "expired";
  expires_at: string;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAccountWithdrawSessionRecord {
  token_hash: string;
  telegram_user_id: string;
  status: "open" | "used" | "expired";
  expires_at: string;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSafeOnboardingSessionRecord {
  token_hash: string;
  telegram_user_id: string;
  status: "open" | "used" | "expired";
  expires_at: string;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface RuntimeSignal {
  id: number;
  slug: string | null;
  title_en: string;
  title_zh: string;
  action_en: string;
  action_zh: string;
  score: number;
  current_price: string;
  expected_return: string;
  daily_return: string;
  liquidity: string;
  expiry_en: string;
  expiry_zh: string;
  source_count: string;
  detail_url: string;
  market_url: string;
  analysis_en: string;
  analysis_zh: string;
  selected_outcome: string | null;
  sports: number;
  status_en: string | null;
  status_zh: string | null;
}

export interface RuntimeWalletProfile {
  address: string;
  name: string;
  score: number;
  grade: string;
  roi_30d: string;
  win_rate_30d: string;
  activity: string;
  specialty_zh: string;
  specialty_en: string;
  note_zh: string;
  note_en: string;
  settled_trade_count?: number | null;
  avg_holding_period_hours?: number | null;
  kelly_consistency_score?: number | null;
  copy_suitability_score?: number | null;
}

export interface FollowTaskRecord {
  id: number;
  telegram_user_id: string;
  wallet_address: string;
  wallet_name: string | null;
  wallet_score: number | null;
  wallet_specialty: string | null;
  scope: "all" | "sports";
  sizing_mode: "fixed_usdc";
  copy_amount_usdc: number;
  max_per_trade_usdc: number;
  min_trade_threshold_usdc: number;
  direction: "both" | "buy_only" | "sell_only";
  execution_mode: "cautious" | "standard" | "expert";
  take_profit_mode?: "none" | "double_out" | "fixed_pct";
  take_profit_bps?: number | null;
  stop_loss_bps?: number | null;
  max_open_positions?: number | null;
  cooldown_sec?: number | null;
  last_triggered_at?: string | null;
  status: "active" | "paused";
  source: "manual" | "ai_copydesk";
  created_at: string;
  updated_at: string;
}

export interface FollowManagedPositionDbRecord {
  position_key: string;
  telegram_user_id: string;
  task_id: number;
  wallet_address: string;
  market_slug: string;
  token_id: string;
  title: string;
  outcome: string;
  entry_price: number;
  amount_usdc: number;
  principal_usdc: number;
  estimated_shares: number;
  remaining_shares: number;
  take_profit_mode: string;
  take_profit_bps: number | null;
  stop_loss_bps: number | null;
  double_out_done: number;
  status: string;
  last_exit_reason: string | null;
  opened_at: string;
  closed_at: string | null;
  updated_at: string;
}

export interface UserRecord {
  telegram_user_id: string;
  telegram_chat_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language: "zh" | "en" | "ja" | "ko";
  bot_id?: string | null;
  subscribed: number;
  sports_enabled: number;
  push_enabled: number;
  push_min_score: number;
  /** Trading streak (consecutive days with at least 1 successful trade) */
  trade_streak?: number | null;
  /** Total XP points earned (10 per trade, bonus for streaks) */
  total_xp?: number | null;
  /** ISO date of last successful trade (YYYY-MM-DD) */
  last_trade_date?: string | null;
}

export interface UserTradingAccountRecord {
  telegram_user_id: string;
  status: "pending_link" | "linked_readonly" | "tradable";
  auth_mode: "external_proxy" | "managed_signer" | "safe_builder";
  relayer_tx_type: "SAFE" | "PROXY" | null;
  safe_deployed: number;
  signature_type: string | null;
  account_label: string | null;
  signer_address: string | null;
  funder_address: string | null;
  deposit_address_evm: string | null;
  deposit_address_svm: string | null;
  deposit_address_btc: string | null;
  deposit_address_tron: string | null;
  builder_enabled: number;
  geoblock_blocked: number;
  geoblock_country: string | null;
  geoblock_region: string | null;
  geoblock_checked_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeoblockSnapshot {
  blocked: boolean;
  country?: string | null;
  region?: string | null;
  checkedAt?: string | null;
}

export type RelayerTxTypeValue = "SAFE" | "PROXY";

export interface UserTradingCredentialsRecord {
  telegram_user_id: string;
  encrypted_payload: string;
  encryption_version: string;
  created_at: string;
  updated_at: string;
}

export interface RelayTransferResult {
  txHash: string | null;
  transactionId: string | null;
  transactionState: string | null;
  amountBaseUnits: string;
}

export interface UserTradingAccountSecretPayload {
  polymarketPrivateKey?: string;
  polymarketApiKey?: string;
  polymarketApiSecret?: string;
  polymarketApiPassphrase?: string;
}

export interface UserTradingAccountContext {
  account: UserTradingAccountRecord;
  credentials?: UserTradingAccountSecretPayload;
}

export interface UserTradingAccountArchiveRecord {
  id: number;
  telegram_user_id: string;
  reason: string;
  account_json: string;
  encrypted_payload: string | null;
  created_at: string;
}

export interface WalletStateSnapshot {
  depositAddress: string;
  balanceUsdc: number;
  positionsCount: number;
  openOrdersCount: number;
  status?: string;
}

export interface LivePosition {
  asset: string;
  title: string;
  outcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  cashPnl: number;
  percentPnl: number;
  slug: string;
  currentValue: number;
  settlementStatus?: "open" | "resolved_won" | "resolved_lost" | "resolved_unknown";
  winningOutcome?: string | null;
  redeemableAmountUsdc?: number | null;
}

export interface PushQueueMessage {
  telegramChatId: string;
  text: string;
  parseMode?: "HTML";
}

export interface FeePreview {
  grossAmountUsdc: number;
  platformFeeUsdc: number;
  netTradeAmountUsdc: number;
  feeBps: number;
  feeWallet?: string;
}

export interface TradeRequest {
  action: "copy" | "close";
  telegramUserId: string;
  signalId?: number;
  tokenId?: string;
  title?: string;
  outcome?: string;
  amountUsdc?: number;
  shares?: number;
  avgPrice?: number;
  curPrice?: number;
  currentValue?: number;
  idempotencyKey: string;
  /** "market" (default) or "limit" */
  orderType?: "market" | "limit";
  /** For limit orders: the target price in USDC (e.g. 0.55 for 55¢) */
  limitPriceUsdc?: number;
}

export interface BridgeQuote {
  estCheckoutTimeMs?: number;
  estInputUsd?: number;
  estOutputUsd?: number;
  estToTokenBaseUnit?: string;
  quoteId?: string;
  estFeeBreakdown?: Record<string, unknown>;
}

export interface MarketLinkResolutionRecord {
  url: string;
  slug: string;
  outcome: string | null;
  token_id: string | null;
  title_en: string | null;
  title_zh: string | null;
  market_url: string | null;
  detail_json: string | null;
  updated_at: string;
}

export interface MarketLinkPreview {
  slug: string;
  title: string;
  titleZh?: string | null;
  question?: string | null;
  marketUrl: string;
  conditionId?: string | null;
  outcomes?: string[];
  tokenIds?: string[];
  selectedOutcome: string | null;
  tokenId: string | null;
  yesPrice: number | null;
  noPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  liquidityClob: number | null;
  volume24hr: number | null;
  endDate: string | null;
  source?: "rest" | "ws";
  cached?: boolean;
  stale?: boolean;
  lastUpdatedAt?: string | null;
  cachedAt: string;
}
