-- Migration 0005: Full-loop MVP — categories, sports, auto-follow rules,
-- mirror-exit, kill-switch, per-user preferences.
-- Run with: npx wrangler d1 execute luna-bot-db --remote --file=migrations/0005_full_loop.sql

-- 1. News category tagging (crypto | sports | macro | politics)
ALTER TABLE news_triggers ADD COLUMN category TEXT NOT NULL DEFAULT 'crypto';
CREATE INDEX IF NOT EXISTS idx_news_triggers_category_status
  ON news_triggers (category, status, published_at);

-- 2. Enrich smart_money_fills with the raw chain data we now ingest
ALTER TABLE smart_money_fills ADD COLUMN token_id TEXT;
ALTER TABLE smart_money_fills ADD COLUMN tx_hash TEXT;
ALTER TABLE smart_money_fills ADD COLUMN block_number INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_money_fills_dedup
  ON smart_money_fills (tx_hash, wallet, token_id) WHERE tx_hash IS NOT NULL;

-- 3. Polymarket token_id → market_slug + outcome mapping cache
CREATE TABLE IF NOT EXISTS market_token_map (
  token_id TEXT PRIMARY KEY,
  market_slug TEXT NOT NULL,
  outcome TEXT NOT NULL,
  condition_id TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_token_map_slug
  ON market_token_map (market_slug);

-- 4. Auto-follow rules — two modes: dual_signal and wallet_mirror
CREATE TABLE IF NOT EXISTS auto_follow_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  mode TEXT NOT NULL,                    -- 'dual_signal' | 'wallet_mirror'
  enabled INTEGER NOT NULL DEFAULT 1,
  -- dual_signal params
  categories TEXT,                       -- JSON array: ['crypto','sports',...]
  min_smart_wallets INTEGER DEFAULT 1,
  min_net_buy_usdc REAL DEFAULT 500,
  min_confidence REAL DEFAULT 0.6,
  -- wallet_mirror params
  tracked_wallets TEXT,                  -- JSON array of addresses
  -- common sizing + caps
  trade_amount_usdc REAL NOT NULL DEFAULT 5,
  max_trades_per_hour INTEGER NOT NULL DEFAULT 5,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auto_follow_rules_user
  ON auto_follow_rules (telegram_user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_auto_follow_rules_mode
  ON auto_follow_rules (mode, enabled);

-- 5. Audit log for auto-exec firings (drives admin TG alerts + rate caps)
CREATE TABLE IF NOT EXISTS auto_exec_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT NOT NULL,
  rule_id INTEGER NOT NULL,
  source TEXT NOT NULL,                  -- 'news_trigger' | 'wallet_mirror'
  source_ref TEXT NOT NULL,              -- news_trigger.id or tx_hash
  market_slug TEXT NOT NULL,
  outcome TEXT NOT NULL,
  trade_amount_usdc REAL NOT NULL,
  status TEXT NOT NULL,                  -- 'dry_run' | 'placed' | 'failed' | 'blocked_rate' | 'blocked_pause'
  error TEXT,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auto_exec_events_user_ts
  ON auto_exec_events (telegram_user_id, ts);
CREATE INDEX IF NOT EXISTS idx_auto_exec_events_global_ts
  ON auto_exec_events (ts);

-- 6. Mirror-exit strategy per managed position
-- (follow_managed_positions already exists from earlier migration)
ALTER TABLE follow_managed_positions ADD COLUMN exit_strategy TEXT;
-- JSON blob, e.g.:
--   {"type":"mirror","wallets":["0x..","0x.."],"threshold":"majority"}
--   {"type":"multiple","target_x":3}
--   {"type":"double_out"}            (existing behaviour)
--   {"type":"manual"}

-- 7. User preferences — news categories, default copy amount, default exit
CREATE TABLE IF NOT EXISTS user_preferences (
  telegram_user_id TEXT PRIMARY KEY,
  subscribed_categories TEXT NOT NULL DEFAULT '["crypto","sports"]',
  default_copy_amount_usdc REAL NOT NULL DEFAULT 5,
  default_exit_strategy TEXT NOT NULL DEFAULT '{"type":"double_out"}',
  min_dual_signal_wallets INTEGER NOT NULL DEFAULT 1,
  push_on_confirmed INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

-- 8. Global kill-switch + soft rate caps (admin-flippable without redeploy)
CREATE TABLE IF NOT EXISTS system_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO system_flags (key, value, updated_at) VALUES
  ('auto_exec_paused', 'false', strftime('%s','now')),
  ('max_auto_trades_per_hour_global', '50', strftime('%s','now')),
  ('max_auto_trades_per_hour_per_user', '5', strftime('%s','now'));

-- 9. Track which smart wallets each user is explicitly following (manual list)
-- Distinct from auto_follow_rules.tracked_wallets so users can browse/pin
-- without auto-trading.
CREATE TABLE IF NOT EXISTS user_tracked_wallets (
  telegram_user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (telegram_user_id, wallet_address)
);
CREATE INDEX IF NOT EXISTS idx_user_tracked_wallets_wallet
  ON user_tracked_wallets (wallet_address);

-- 10. Smart wallet discovery provenance
ALTER TABLE smart_wallets ADD COLUMN discovered_at INTEGER;
ALTER TABLE smart_wallets ADD COLUMN discovery_source TEXT;
-- 'seed' | 'pnl_scan' | 'manual_admin'
