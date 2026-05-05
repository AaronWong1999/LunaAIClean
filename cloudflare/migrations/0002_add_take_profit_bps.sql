-- Migration 0002: Add fixed-percentage take-profit support for follow managed positions
-- Run with: npx wrangler d1 execute luna-bot-db --remote --file=migrations/0002_add_take_profit_bps.sql

ALTER TABLE follow_tasks ADD COLUMN take_profit_bps INTEGER;
ALTER TABLE follow_managed_positions ADD COLUMN take_profit_bps INTEGER;
