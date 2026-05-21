<p align="center">
  <a href="https://x.com/AaronYonW"><img src="https://img.shields.io/badge/X-%40AaronYonW-000000.svg" alt="X / Twitter"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Platform-Telegram-26A5E4?logo=telegram" alt="Telegram">
  <img src="https://img.shields.io/badge/Market-Polymarket-4B32C3" alt="Polymarket">
  <img src="https://img.shields.io/badge/Backend-Cloudflare_Workers-F38020?logo=cloudflare" alt="Cloudflare Workers">
</p>

# Luna AI

**A Polymarket smart-money copilot that ranks wallets by verifiable performance — not follower count. Telegram bot + Cloudflare Workers backend.**

**一个 Polymarket 聪明钱助手——用可验证的真实战绩给钱包排名，而非粉丝数。Telegram Bot + Cloudflare Workers 后端。**

---

## What makes Luna different / Luna 有什么不同

Most Polymarket copy-trade bots blindly mirror a fixed set of wallets. Luna scores every wallet on **win rate**, **ROI**, and **sample quality** before you risk capital. Every signal comes with a **public receipt** — timestamped, tracked, and settled on-chain. If a wallet's performance decays, its Smart Score drops. You see it. You decide.

大多数 Polymarket 跟单机器人无脑镜像固定钱包。Luna 在你下注之前，先用**胜率、ROI、样本质量**给每个钱包打分。每条信号都附带**公开战绩收据**——时间戳、追踪记录、链上结算，全透明。钱包表现变差，Smart Score 就下降。你看见，你决定。

| | Typical Copy Bots | **Luna** |
|---|---|---|
| Wallet selection | Fixed list / manual | **Smart Score ranking** |
| Track record | Hidden or cherry-picked | **Public on-chain receipts** |
| Signal quality | Unknown | **Filtered by win rate + sample size** |
| Language | EN only | **Bilingual CN / EN** |
| Backend cost | $20+/mo VPS | **Serverless (free tier works)** |
| AI insights | ❌ | **LLM-powered trade analysis** |
| Backtesting | ❌ | **Built-in engine** |
| Open source | Some | **MIT** |

---

## Architecture / 架构

```
                    ┌────────── Telegram ──────────┐
                    │  Users send commands & chat   │
                    └──────────┬────────────────────┘
                               │
                    ┌──────────▼────────────────────┐
                    │     Python Bot (luna_bot/)     │
                    │  • Command routing & UI        │
                    │  • Polymarket API client       │
                    │  • Real-time signal delivery   │
                    │  • Portfolio & P&L views       │
                    └──────────┬────────────────────┘
                               │
                    ┌──────────▼────────────────────┐
                    │  Cloudflare Workers (cf/)      │
                    │  • Signal storage & dispatch   │
                    │  • Smart Score engine          │
                    │  • News ingestion + AI curation│
                    │  • Trade execution             │
                    │  • i18n (CN/EN)                │
                    └──────────┬────────────────────┘
                               │
                    ┌──────────▼────────────────────┐
                    │   Cloudflare D1 (SQLite edge)  │
                    │  • Wallet scores & history     │
                    │  • Signal receipts & outcomes  │
                    │  • User preferences & state    │
                    └────────────────────────────────┘
```

Luna's Python bot handles the Telegram UX — menus, keyboards, card rendering. The Cloudflare Workers backend runs the heavy logic at the edge: wallet scoring, signal dispatch, news processing, trade execution, and LLM integration. D1 stores everything in SQLite, globally replicated.

Luna 的 Python Bot 负责 Telegram 交互层（菜单、键盘、卡片渲染）。Cloudflare Workers 后端在边缘节点跑核心逻辑：钱包评分、信号分发、新闻处理、交易执行、LLM 集成。D1 用 SQLite 存所有数据，全球边缘复制。

---

## Core Features / 核心功能

**🏆 Smart Score ranking** — Composite metric: win rate × ROI × sample quality. Penalizes lucky streaks, rewards consistent edge. Every wallet gets a score you can audit.

**🏆 Smart Score 排名** — 综合胜率、ROI、样本质量三维评分。惩罚运气好的短期连胜，奖励经得起大样本检验的真实能力。每个钱包的分数你都可以审计。

**📈 Public verifiable receipts** — Every signal is timestamped when issued, tracked to settlement, and recorded on-chain. No cherry-picking. No deleting losers. Full transparency.

**📈 公开可验证战绩** — 每条信号发出时加盖时间戳，追踪到结算，记录上链。无法挑着晒，无法删亏损。全透明。

**⚡ Real-time signal feed** — When a high-score wallet moves, you know immediately. No delays, no paid group gatekeeping.

**⚡ 实时信号推送** — 高分钱包一动，你马上知道。无延迟，无付费群门槛。

**📊 Built-in portfolio & P&L** — Track your own Polymarket positions, deposits, and profit/loss inside the bot. No need to switch apps.

**📊 内置投资组合 & 盈亏** — 在 Bot 内直接查看 Polymarket 持仓、充提和盈亏。不用切 App。

**🔔 AI-curated news** — LLM filters and summarizes market-moving events so you trade on information, not noise.

**🔔 AI 精选新闻** — LLM 筛选和总结影响市场的事件，让你基于信息交易而非噪音。

**🔄 Copy trading with guardrails** — Mirror top wallets automatically, with configurable position sizing and risk limits.

**🔄 带风控的跟单** — 自动镜像顶尖钱包交易，可配置仓位大小和风险上限。

**🌍 Full bilingual (CN/EN)** — Every menu, every card, every alert is localized. Switch language anytime.

**🌍 中英双语全覆盖** — 每个菜单、每张卡片、每条提醒都有中英文。随时切换语言。

**🧠 LLM-powered trade analysis** — AI-generated commentary on market context and trade rationale for high-signal moves.

**🧠 LLM 交易分析** — 对高信号交易，AI 生成市场背景和交易逻辑解读。

**🔙 Backtesting engine** — Validate any strategy or wallet-following approach against historical data before risking capital.

**🔙 回测引擎** — 在实盘下注前，用历史数据验证任何策略或跟单方案。

---

## Quick Start / 快速开始

### Prerequisites / 前置条件

- Python 3.10+ · Node.js 18+ · Telegram Bot Token ([@BotFather](https://t.me/BotFather)) · Polymarket API credentials ([Developer Settings](https://polymarket.com/settings?tab=developer)) · Cloudflare account (free tier works / 免费套餐可用)

### 1. Python Bot

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Fill in your credentials / 填入你的凭证
python main.py
```

### 2. Cloudflare Worker

```bash
cd cloudflare && npm install
cp .cf-account.env.example .cf-account.env

# Create D1 database / 创建 D1 数据库
npx wrangler d1 create luna-bot-db
# Update database_id in wrangler.jsonc and wrangler.app.jsonc
npx wrangler d1 execute luna-bot-db --file=schema.sql

# Set secrets / 设置密钥
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put POLYMARKET_PRIVATE_KEY
npx wrangler secret put POLYMARKET_API_KEY
npx wrangler secret put POLYMARKET_API_SECRET
npx wrangler secret put POLYMARKET_API_PASSPHRASE

# Deploy / 部署
node scripts/deploy-workers.mjs deploy
```

### 3. Run Tests / 运行测试

```bash
pytest tests/
```

---

## Project Structure / 项目结构

```text
LunaAIClean/
├── luna_bot/           # Python Telegram bot
│   ├── app.py          # Bot handlers & routing
│   ├── ui.py           # Menu rendering, keyboards, cards
│   ├── data.py         # Runtime state & data models
│   ├── polymarket.py   # Polymarket API client
│   └── state.py        # User/wallet session state
├── cloudflare/         # Cloudflare Workers backend
│   ├── src/
│   │   ├── index.ts    # Main Worker entry
│   │   ├── render.ts   # Telegram message rendering
│   │   ├── polymarket.ts  # Polymarket integration
│   │   ├── db.ts       # D1 database layer
│   │   ├── i18n.ts     # Internationalization (CN/EN)
│   │   ├── smartmoney/ # Smart Score engine
│   │   ├── news/       # News ingestion & AI curation
│   │   ├── auto_exec/  # Automated trade execution
│   │   └── llm/        # LLM-powered insights
│   ├── scripts/        # Deploy & management
│   └── schema.sql      # Database schema
├── backtest/           # Strategy backtesting engine
├── actus/              # Actus agents
└── tests/              # pytest suite
```

---

## Tech Stack / 技术栈

| Layer / 层 | Technology / 技术 |
|---|---|
| Bot Framework | python-telegram-bot |
| Prediction Market API | py-clob-client |
| Serverless Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite at edge) |
| Languages | Python + TypeScript |
| AI / Insights | LLM integration |
| Backtesting | Custom Python engine |

---

## FAQ / 常见问题

**Q: Is this free? / 免费吗？**
A: Yes. MIT license. Run your own instance on Cloudflare's free tier at near-zero cost. / 免费。MIT 许可证。在 Cloudflare 免费套餐上部署你自己的实例，近乎零成本。

**Q: Is this financial advice? / 这是投资建议吗？**
A: No. Luna is a data tool. It surfaces verifiable wallet activity. You make your own trading decisions. / 不是。Luna 是数据工具，帮你发现和验证钱包的链上行为。所有交易决策由你自己做出。

**Q: How is Smart Score calculated? / Smart Score 怎么算的？**
A: Composite of win rate, ROI, trade frequency, and sample size. Designed to penalize lucky short streaks and reward consistent skill over large samples. / 胜率、ROI、交易频率、样本量的综合评分，惩罚运气成分，奖励大样本下的真实能力。

**Q: Can I contribute? / 可以参与贡献吗？**
A: PRs welcome. Check the Issues tab. / 非常欢迎，直接提 PR 就行。

---

## Star History / Star 历史

<a href="https://www.star-history.com/#AaronWong1999/LunaAIClean&Date">
  <img src="https://api.star-history.com/svg?repos=AaronWong1999/LunaAIClean&type=Date" alt="Star History Chart" width="600">
</a>

---

## License / 许可证

[MIT](LICENSE) — by [@AaronWong1999](https://github.com/AaronWong1999) · [X @AaronYonW](https://x.com/AaronYonW)
