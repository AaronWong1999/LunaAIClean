# LunaAI

A Telegram bot for Polymarket prediction market signals, powered by smart-money wallet tracking and a Cloudflare Workers backend.

## Architecture

- **`luna_bot/`** — Python Telegram bot (python-telegram-bot + py-clob-client)
- **`cloudflare/`** — Cloudflare Workers backend (TypeScript): signal storage, trade execution, news ingestion, smart-money tracking

## Setup

### Python Bot

1. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

   Required values:
   - `TELEGRAM_BOT_TOKEN` — from [@BotFather](https://t.me/BotFather)
   - `POLYMARKET_*` — from [Polymarket developer settings](https://polymarket.com/settings?tab=developer)

3. Run:
   ```bash
   python main.py
   ```

### Cloudflare Worker

1. Install dependencies:
   ```bash
   cd cloudflare && npm install
   ```

2. Copy config files and fill in your values:
   ```bash
   cp cloudflare/.cf-account.env.example cloudflare/.cf-account.env
   ```
   Edit `cloudflare/wrangler.jsonc` and `cloudflare/wrangler.app.jsonc` — replace all `YOUR_*` placeholders.

   Edit `cloudflare/account.guard.json` with your Cloudflare account details.

3. Create a D1 database and apply migrations:
   ```bash
   cd cloudflare
   npx wrangler d1 create luna-bot-db
   # Update database_id in wrangler.jsonc and wrangler.app.jsonc
   npx wrangler d1 execute luna-bot-db --file=schema.sql
   ```

4. Set Worker secrets:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put POLYMARKET_PRIVATE_KEY
   npx wrangler secret put POLYMARKET_API_KEY
   npx wrangler secret put POLYMARKET_API_SECRET
   npx wrangler secret put POLYMARKET_API_PASSPHRASE
   ```

5. Deploy:
   ```bash
   node scripts/deploy-workers.mjs deploy
   ```

## Tests

```bash
pytest tests/
```
