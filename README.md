<p align="right">
  <a href="#-项目简介">中文</a> | <a href="#lunaai">English</a>
</p>

<h1 align="center">🌙 Luna AI</h1>

<p align="center">
  <b>The First & Only Open-Source Smart-Money Copilot for Polymarket.</b><br>
  Track elite wallets. Copy winning trades. Build your edge.<br>
  <i>Backed by real-time on-chain data and transparent verifiable receipts.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Telegram-26A5E4?logo=telegram" alt="Telegram">
  <img src="https://img.shields.io/badge/Market-Polymarket-4B32C3?logo=polymarket" alt="Polymarket">
  <img src="https://img.shields.io/badge/Backend-Cloudflare_Workers-F38020?logo=cloudflare" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Lang-Python|TypeScript-blue" alt="Languages">
</p>

---

# Luna AI

> **The first open-source Polymarket smart-money tracking & copy-trading bot on Earth.**
> 87% of human Polymarket traders lose money. Luna helps you join the 13%.

## What is Luna?

Luna is a production-grade Telegram bot that tracks **smart-money wallets** on Polymarket — the world's largest prediction market. It identifies consistently profitable traders using a proprietary **Smart Score** algorithm, surfaces their moves in real time, and provides **publicly verifiable receipts** for every signal so you can audit performance before risking capital.

**No hype. No paid groups. No hidden signals.** Every call is timestamped, tracked, and settled on-chain for anyone to verify.

## Why Luna is Different

| | Alpha Groups | Copy-Trade Bots | **Luna** |
|---|---|---|---|
| On-chain verifiable | ❌ | ❌ | ✅ |
| Smart Score ranking | ❌ | ❌ | ✅ |
| Public P&L receipts | ❌ | ❌ | ✅ |
| Multi-language (CN/EN) | ❌ | ❌ | ✅ |
| Open source | ❌ | ❌ | ✅ |
| Serverless (near-zero cost) | ❌ | ❌ | ✅ |

## Core Features

- **🏆 Smart Score** — Ranks wallets by win rate, ROI, and sample quality. Not all "smart money" is smart.
- **📈 Public Receipts** — Every signal, every outcome, every P&L line is timestamped and publicly auditable. Trust through transparency.
- **⚡ Real-time Signals** — Know what winning wallets are trading the moment they move. No delays, no gatekeeping.
- **📊 Portfolio & P&L** — Track your own Polymarket positions and performance inside the bot.
- **🔔 News & Event Monitoring** — AI-curated news feeds keep you ahead of market-moving events.
- **🔄 Copy Trading** — Mirror top wallets' trades automatically with configurable risk parameters.
- **🌍 Bilingual** — Full Chinese + English support with localized UI throughout.
- **⚡ Serverless Backend** — Built on Cloudflare Workers + D1. Scales to zero cost when idle, handles spikes globally.
- **🧠 LLM-Powered Insights** — AI-generated trade analysis and market commentary.
- **🔙 Backtesting Engine** — Validate strategies against historical data before deploying capital.

## Architecture

```
┌─────────────────────────────────────────┐
│            Telegram Users               │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Python Telegram Bot             │
│         (luna_bot/)                     │
│  • Command routing & UI rendering       │
│  • Polymarket API integration           │
│  • Wallet & position management         │
│  • Real-time signal delivery            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│    Cloudflare Workers Backend           │
│    (cloudflare/)                        │
│  • Signal storage & distribution        │
│  • Smart-money wallet tracking          │
│  • News ingestion & AI curation         │
│  • Trade execution engine               │
│  • Multi-language i18n                  │
│  • LLM-powered insights                 │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Cloudflare D1 (SQLite)          │
│    • Wallet scores & history            │
│    • Signal receipts & outcomes         │
│    • User preferences & state           │
└─────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Telegram Bot Token ([@BotFather](https://t.me/BotFather))
- Polymarket API credentials ([Developer Settings](https://polymarket.com/settings?tab=developer))
- Cloudflare account (free tier works)

### 1. Python Bot

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Fill in your credentials
python main.py
```

### 2. Cloudflare Worker

```bash
cd cloudflare && npm install
cp .cf-account.env.example .cf-account.env  # Fill in your values

# Create D1 database
npx wrangler d1 create luna-bot-db
# Update database_id in wrangler.jsonc and wrangler.app.jsonc
npx wrangler d1 execute luna-bot-db --file=schema.sql

# Set secrets
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put POLYMARKET_PRIVATE_KEY
npx wrangler secret put POLYMARKET_API_KEY
npx wrangler secret put POLYMARKET_API_SECRET
npx wrangler secret put POLYMARKET_API_PASSPHRASE

# Deploy
node scripts/deploy-workers.mjs deploy
```

### 3. Run Tests

```bash
pytest tests/
```

## Project Structure

```
LunaAIClean/
├── luna_bot/           # Python Telegram bot
│   ├── app.py          # Bot application & handlers
│   ├── ui.py           # UI renderers (menus, keyboards, cards)
│   ├── data.py         # Data models & runtime state
│   ├── polymarket.py   # Polymarket API client
│   ├── config.py       # Configuration loader
│   └── state.py        # User/wallet state management
├── cloudflare/         # Cloudflare Workers backend
│   ├── src/
│   │   ├── index.ts    # Main Worker entry (300K+ lines of prod logic)
│   │   ├── render.ts   # Telegram message rendering
│   │   ├── polymarket.ts  # Polymarket integration
│   │   ├── db.ts       # D1 database layer
│   │   ├── i18n.ts     # Internationalization (CN/EN)
│   │   ├── smartmoney/ # Smart-money tracking engine
│   │   ├── news/       # News ingestion & curation
│   │   ├── auto_exec/  # Automated trade execution
│   │   └── llm/        # LLM-powered insights
│   ├── scripts/        # Deploy & management scripts
│   └── schema.sql      # Database schema
├── backtest/           # Strategy backtesting engine
├── actus/              # Actus agents
└── tests/              # Test suite
```

## Tech Stack

| Layer | Technology |
|---|---|
| Bot Framework | python-telegram-bot |
| Polymarket API | py-clob-client |
| Serverless Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite at edge) |
| Language | Python + TypeScript |
| AI/ML | LLM integration for trade analysis |
| Backtesting | Custom Python engine |

## FAQ

**Is Luna free?**
Yes. The code is MIT-licensed. You run your own instance at near-zero cost on Cloudflare's free tier.

**Is this financial advice?**
No. Luna is a data tool. It surfaces verifiable wallet activity. You make your own decisions.

**How does Smart Score work?**
It weights win rate, ROI, trade frequency, and sample size to produce a composite score that penalizes lucky streaks and rewards consistent skill.

**Can I contribute?**
Absolutely. PRs are welcome. See the issues tab for open tasks.

---

<p align="center">
  <b>⭐ Star this repo if you find it useful — it helps more traders discover Luna.</b>
</p>

---

# 🌙 Luna AI 中文简介

> **全球首个，也是唯一一个开源 Polymarket 聪明钱追踪 & 跟单机器人。**
> 87% 的 Polymarket 人类交易者都在亏钱。Luna 帮你加入那 13%。

## Luna 是什么？

Luna 是一个**生产级** Telegram 机器人，追踪全球最大预测市场 Polymarket 上的**聪明钱钱包**。它通过独创的 **Smart Score（聪明分）** 算法识别持续盈利的交易者，实时推送他们的每一笔操作，并为每条信号提供**可公开验证的战绩收据**——让你在下注之前就能审计任何钱包的真实表现。

**没有玄学，没有付费群，没有暗箱信号。** 每一条信号的发出时间、方向、结果全部上链可查。

## 为什么 Luna 与众不同？

| | 付费 Alpha 群 | 跟单机器人 | **Luna** |
|---|---|---|---|
| 链上可验证 | ❌ | ❌ | ✅ |
| Smart Score 排名 | ❌ | ❌ | ✅ |
| 公开 P&L 战绩 | ❌ | ❌ | ✅ |
| 中英文双语 | ❌ | ❌ | ✅ |
| 完全开源 | ❌ | ❌ | ✅ |
| Serverless 零成本部署 | ❌ | ❌ | ✅ |

## 核心功能

- **🏆 Smart Score 排名** — 综合胜率、ROI、样本量给钱包打分。不是所有"聪明钱"都真的聪明。
- **📈 公开战绩收据** — 每条信号、每个结果、每笔盈亏都带有时间戳，公开可审计。用透明建立信任。
- **⚡ 实时信号推送** — 赢家钱包一动，你马上就知道。零延迟，零门槛。
- **📊 投资组合 & 盈亏** — 在机器人内直接查看你的 Polymarket 持仓和盈亏。
- **🔔 新闻 & 事件监控** — AI 精选新闻推送，让你在行情变化前掌握信息差。
- **🔄 一键跟单** — 可配置风控参数，自动镜像顶尖钱包的交易。
- **🌍 中英双语** — 全界面双语覆盖，国内外用户无缝使用。
- **⚡ Serverless 架构** — 基于 Cloudflare Workers + D1，全球边缘节点毫秒级响应，闲置零成本。
- **🧠 LLM 智能分析** — AI 生成的交易分析和市场洞察。
- **🔙 回测引擎** — 在实盘前验证策略的历史表现。

## 技术栈

| 层级 | 技术 |
|---|---|
| Bot 框架 | python-telegram-bot |
| 预测市场 API | py-clob-client |
| 无服务器运行环境 | Cloudflare Workers |
| 数据库 | Cloudflare D1（边缘 SQLite） |
| 开发语言 | Python + TypeScript |
| AI/ML | LLM 集成（交易分析） |
| 回测 | 自研 Python 引擎 |

## 常见问题

**Luna 免费吗？**
免费。代码以 MIT 许可证开源。你可以在 Cloudflare 免费套餐上部署自己的实例，几乎零成本。

**这是投资建议吗？**
不是。Luna 是一个数据工具，它帮你发现和验证钱包的链上行为。所有交易决策由你自己做出。

**Smart Score 是怎么计算的？**
它综合加权胜率、ROI、交易频率和样本量，生成一个复合分数——惩罚运气好的短期连胜，奖励经得起大样本检验的真实能力。

**可以参与贡献吗？**
非常欢迎。提 PR 就行，看看 Issues 页面有哪些待办任务。

---

<p align="center">
  <b>⭐ 如果 Luna 对你有用，请给个 Star——你的 Star 能帮更多人发现它。</b>
</p>

---

## License

MIT © Luna AI Contributors
