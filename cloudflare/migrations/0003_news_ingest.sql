-- Migration 0003: Extend news_triggers for full NewsEvent model + add health tracking
-- Run with: npx wrangler d1 execute luna-bot-db --remote --file=migrations/0003_news_ingest.sql

-- Add missing NewsEvent fields to news_triggers
ALTER TABLE news_triggers ADD COLUMN body TEXT;
ALTER TABLE news_triggers ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';
ALTER TABLE news_triggers ADD COLUMN published_at INTEGER; -- Unix epoch seconds
ALTER TABLE news_triggers ADD COLUMN selected_outcome TEXT;
ALTER TABLE news_triggers ADD COLUMN dual_signal INTEGER NOT NULL DEFAULT 0;

-- News source health monitoring
CREATE TABLE IF NOT EXISTS news_source_health (
  source TEXT PRIMARY KEY,
  last_heartbeat INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
