-- Migration 0004: Smart money tables for M3
-- Run with: npx wrangler d1 execute luna-bot-db --remote --file=migrations/0004_smart_money.sql

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

CREATE INDEX IF NOT EXISTS idx_smart_money_fills_lookup
  ON smart_money_fills (market_slug, ts, side);

CREATE INDEX IF NOT EXISTS idx_smart_money_fills_wallet
  ON smart_money_fills (wallet, ts);
