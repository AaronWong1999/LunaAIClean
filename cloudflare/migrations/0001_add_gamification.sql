-- Migration 0001: Add gamification fields to users table
-- Run with: npx wrangler d1 execute luna-bot-db --file=migrations/0001_add_gamification.sql

ALTER TABLE users ADD COLUMN trade_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN total_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_trade_date TEXT;
