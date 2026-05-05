CREATE TABLE IF NOT EXISTS users (
  telegram_user_id TEXT PRIMARY KEY,
  telegram_chat_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language TEXT NOT NULL DEFAULT 'zh',
  bot_id TEXT NOT NULL DEFAULT 'primary',
  subscribed INTEGER NOT NULL DEFAULT 0,
  sports_enabled INTEGER NOT NULL DEFAULT 0,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  push_min_score INTEGER NOT NULL DEFAULT 80,
  trade_streak INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  last_trade_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracked_wallets (
  telegram_user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (telegram_user_id, wallet_address)
);

CREATE TABLE IF NOT EXISTS follow_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  wallet_name TEXT,
  wallet_score INTEGER,
  wallet_specialty TEXT,
  scope TEXT NOT NULL DEFAULT 'all',
  sizing_mode TEXT NOT NULL DEFAULT 'fixed_usdc',
  copy_amount_usdc REAL NOT NULL,
  max_per_trade_usdc REAL NOT NULL,
  min_trade_threshold_usdc REAL NOT NULL DEFAULT 1,
  direction TEXT NOT NULL DEFAULT 'both',
  execution_mode TEXT NOT NULL DEFAULT 'standard',
  take_profit_mode TEXT NOT NULL DEFAULT 'none',
  take_profit_bps INTEGER,
  stop_loss_bps INTEGER,
  max_open_positions INTEGER NOT NULL DEFAULT 3,
  cooldown_sec INTEGER NOT NULL DEFAULT 30,
  last_triggered_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_tasks_user_wallet_scope
  ON follow_tasks (telegram_user_id, wallet_address, scope);

CREATE TABLE IF NOT EXISTS user_wallet_state (
  telegram_user_id TEXT PRIMARY KEY,
  deposit_address TEXT,
  last_balance_usdc REAL NOT NULL DEFAULT 0,
  last_positions_count INTEGER NOT NULL DEFAULT 0,
  last_open_orders_count INTEGER NOT NULL DEFAULT 0,
  status TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_trading_accounts (
  telegram_user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending_link',
  auth_mode TEXT NOT NULL DEFAULT 'external_proxy',
  relayer_tx_type TEXT,
  safe_deployed INTEGER NOT NULL DEFAULT 0,
  signature_type TEXT,
  account_label TEXT,
  signer_address TEXT,
  funder_address TEXT,
  deposit_address_evm TEXT,
  deposit_address_svm TEXT,
  deposit_address_btc TEXT,
  deposit_address_tron TEXT,
  builder_enabled INTEGER NOT NULL DEFAULT 0,
  geoblock_blocked INTEGER NOT NULL DEFAULT 0,
  geoblock_country TEXT,
  geoblock_region TEXT,
  geoblock_checked_at TEXT,
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_trading_credentials (
  telegram_user_id TEXT PRIMARY KEY,
  encrypted_payload TEXT NOT NULL,
  encryption_version TEXT NOT NULL DEFAULT 'v1',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_account_link_sessions (
  token_hash TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_account_export_sessions (
  token_hash TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_account_restore_sessions (
  token_hash TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_account_withdraw_sessions (
  token_hash TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_trading_account_archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  account_json TEXT NOT NULL,
  encrypted_payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_safe_onboarding_sessions (
  token_hash TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signal_id INTEGER,
  title TEXT,
  outcome TEXT,
  token_id TEXT,
  amount_usdc REAL,
  shares REAL,
  status TEXT NOT NULL,
  order_id TEXT,
  tx_hash TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fee_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  signal_id INTEGER,
  trade_event_type TEXT NOT NULL,
  gross_amount_usdc REAL NOT NULL,
  platform_fee_usdc REAL NOT NULL,
  net_trade_amount_usdc REAL NOT NULL,
  fee_bps INTEGER NOT NULL,
  fee_wallet TEXT,
  status TEXT NOT NULL,
  settlement_batch_id TEXT,
  settlement_tx_ref TEXT,
  settled_at TEXT,
  detail TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fee_revenue_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fee_ledger_id INTEGER NOT NULL,
  telegram_user_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  amount_usdc REAL NOT NULL,
  destination_wallet TEXT,
  status TEXT NOT NULL DEFAULT 'reserved',
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS builder_attribution_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  signal_id INTEGER,
  action TEXT NOT NULL,
  builder_enabled INTEGER NOT NULL DEFAULT 0,
  builder_key_hint TEXT,
  order_id TEXT,
  tx_hash TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  destination_chain TEXT NOT NULL,
  destination_chain_id TEXT NOT NULL,
  destination_token_symbol TEXT NOT NULL,
  destination_token_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  bridge_address TEXT NOT NULL,
  amount_usdc REAL NOT NULL,
  amount_base_units TEXT NOT NULL,
  quote_id TEXT,
  quote_json TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  bridge_status TEXT,
  source_transaction_id TEXT,
  source_transaction_state TEXT,
  source_tx_hash TEXT,
  bridge_tx_hash TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  trade_event_id INTEGER NOT NULL,
  market_slug TEXT NOT NULL,
  title TEXT,
  selected_outcome TEXT,
  winning_outcome TEXT,
  settlement_status TEXT NOT NULL DEFAULT 'open',
  redeemable_amount_usdc REAL,
  resolved_at TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runtime_signals (
  id INTEGER PRIMARY KEY,
  slug TEXT,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  action_en TEXT NOT NULL,
  action_zh TEXT NOT NULL,
  score INTEGER NOT NULL,
  current_price TEXT NOT NULL,
  expected_return TEXT NOT NULL,
  daily_return TEXT NOT NULL,
  liquidity TEXT NOT NULL,
  expiry_en TEXT NOT NULL,
  expiry_zh TEXT NOT NULL,
  source_count TEXT NOT NULL,
  detail_url TEXT NOT NULL,
  market_url TEXT NOT NULL,
  analysis_en TEXT NOT NULL,
  analysis_zh TEXT NOT NULL,
  selected_outcome TEXT,
  sports INTEGER NOT NULL DEFAULT 0,
  status_en TEXT,
  status_zh TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runtime_wallet_profiles (
  address TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  roi_30d TEXT NOT NULL,
  win_rate_30d TEXT NOT NULL,
  activity TEXT NOT NULL,
  specialty_zh TEXT NOT NULL,
  specialty_en TEXT NOT NULL,
  note_zh TEXT NOT NULL,
  note_en TEXT NOT NULL,
  settled_trade_count INTEGER,
  avg_holding_period_hours REAL,
  kelly_consistency_score REAL,
  copy_suitability_score REAL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runtime_meta (
  singleton_key TEXT PRIMARY KEY DEFAULT 'runtime',
  generated_at TEXT,
  duration_sec REAL,
  wallet_count INTEGER,
  signal_count INTEGER,
  top_wallet TEXT,
  top_signal TEXT,
  payload_json TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signal_history_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generated_at TEXT NOT NULL,
  signal_count INTEGER NOT NULL,
  top_signal TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cron_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signal_push_receipts (
  telegram_user_id TEXT NOT NULL,
  signal_slug TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sports',
  pushed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (telegram_user_id, signal_slug, channel)
);

CREATE TABLE IF NOT EXISTS referral_attributions (
  referee_telegram_user_id TEXT PRIMARY KEY,
  referrer_telegram_user_id TEXT NOT NULL,
  attribution_source TEXT NOT NULL DEFAULT 'telegram_start',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_telegram_user_id TEXT NOT NULL,
  referee_telegram_user_id TEXT NOT NULL,
  bot_id TEXT NOT NULL DEFAULT 'primary',
  fee_ledger_id INTEGER,
  event_type TEXT NOT NULL DEFAULT 'trade_fee_share',
  tier TEXT NOT NULL DEFAULT 'standard',
  discount_bps INTEGER NOT NULL DEFAULT 0,
  rebate_bps INTEGER NOT NULL DEFAULT 0,
  creator_telegram_user_id TEXT,
  amount_usdc REAL NOT NULL DEFAULT 0,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_link_resolutions (
  url TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  outcome TEXT,
  token_id TEXT,
  title_en TEXT,
  title_zh TEXT,
  market_url TEXT,
  detail_json TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  published_at INTEGER,
  market_slug TEXT,
  selected_outcome TEXT,
  confidence REAL,
  dual_signal INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'detected',
  execution_ref TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_source_health (
  source TEXT PRIMARY KEY,
  last_heartbeat INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS arb_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  polymarket_slug TEXT NOT NULL,
  kalshi_ticker TEXT,
  spread_bps REAL NOT NULL DEFAULT 0,
  net_edge_bps REAL NOT NULL DEFAULT 0,
  liquidity_score REAL,
  status TEXT NOT NULL DEFAULT 'open',
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_shards (
  bot_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_user_count INTEGER NOT NULL DEFAULT 0,
  send_budget_per_second INTEGER NOT NULL DEFAULT 25,
  detail_json TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follow_managed_positions (
  position_key TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  task_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  market_slug TEXT NOT NULL,
  token_id TEXT NOT NULL,
  title TEXT NOT NULL,
  outcome TEXT NOT NULL,
  entry_price REAL NOT NULL,
  amount_usdc REAL NOT NULL,
  principal_usdc REAL NOT NULL,
  estimated_shares REAL NOT NULL,
  remaining_shares REAL NOT NULL,
  take_profit_mode TEXT NOT NULL DEFAULT 'none',
  take_profit_bps INTEGER,
  stop_loss_bps INTEGER,
  double_out_done INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  last_exit_reason TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_key TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smart_wallets (
  address TEXT PRIMARY KEY,
  seed INTEGER NOT NULL DEFAULT 0,
  qualified INTEGER NOT NULL DEFAULT 0,
  win_rate_30d REAL,
  volume_30d REAL,
  avg_hold_days REAL,
  settled_count_30d INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smart_money_fills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet TEXT NOT NULL,
  market_slug TEXT NOT NULL,
  side TEXT NOT NULL,
  amount_usdc REAL NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_events_user_created_at ON trade_events (telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_ledger_user_created_at ON fee_ledger (telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_ledger_status_created_at ON fee_ledger (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_revenue_allocations_bucket_created_at ON fee_revenue_allocations (bucket, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_signals_score ON runtime_signals (score DESC);
CREATE INDEX IF NOT EXISTS idx_user_trading_accounts_status ON user_trading_accounts (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_account_link_sessions_user ON user_account_link_sessions (telegram_user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_account_export_sessions_user ON user_account_export_sessions (telegram_user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_account_restore_sessions_user ON user_account_restore_sessions (telegram_user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_account_withdraw_sessions_user ON user_account_withdraw_sessions (telegram_user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_trading_account_archives_user ON user_trading_account_archives (telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_created_at ON withdrawal_requests (telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created_at ON withdrawal_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_settlements_user_created_at ON trade_settlements (telegram_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_settlements_trade_event_id ON trade_settlements (trade_event_id);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer ON referral_attributions (referrer_telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer_created_at ON referral_events (referrer_telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_bot_id ON users (bot_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_link_resolutions_slug ON market_link_resolutions (slug, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_triggers_source_key ON news_triggers (source, source_key);
CREATE INDEX IF NOT EXISTS idx_arb_opportunities_status ON arb_opportunities (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_managed_positions_user_status ON follow_managed_positions (telegram_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_managed_positions_task_status ON follow_managed_positions (task_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_events_user_created_at ON execution_events (telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_events_entity_created_at ON execution_events (entity_type, entity_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_money_fills_lookup ON smart_money_fills (market_slug, ts, side);
CREATE INDEX IF NOT EXISTS idx_smart_money_fills_wallet ON smart_money_fills (wallet, ts);
