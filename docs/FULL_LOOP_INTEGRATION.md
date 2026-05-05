# Full-Loop Integration Guide

Foundation modules for the 11-point闭环 (news → smart-money → auto-copy → mirror-exit)
are now shipped as isolated, testable files. This doc is the handoff: exactly where
to wire them into `cloudflare/src/index.ts` and what Aaron still needs to decide.

## New files (this PR)

| Area | File | Role |
|------|------|------|
| Migration | `migrations/0005_full_loop.sql` | `category`, `auto_follow_rules`, `auto_exec_events`, `market_token_map`, `user_preferences`, `system_flags`, `user_tracked_wallets`, `exit_strategy` on positions |
| Sports news | `src/news/espn.ts` | ESPN REST (soccer/NBA/NFL) — free, no auth |
| Sports news | `src/news/sportmonks.ts` | Football live events (goals/cards/injuries) — API token via env |
| Sports news | `src/news/bbc_sports.ts` | BBC Sport RSS (World Cup, tennis) — free |
| News types | `src/news/types.ts` | Added `category: NewsCategory`; all 4 legacy crypto adapters already updated |
| Smart money | `src/smartmoney/market_resolver.ts` | token_id → market_slug cache (Gamma API + D1) |
| Smart money | `src/smartmoney/ingestor.ts` | Cron-driven fills ingestor — block cursor, idempotent insert, 2h prune |
| Smart money | `src/smartmoney/discovery.ts` | Nightly leaderboard scan + weekly rescore |
| Auto-exec | `src/auto_exec/flags.ts` | `system_flags` kill-switch + rate caps (D1-backed, no redeploy) |
| Auto-exec | `src/auto_exec/rules.ts` | CRUD for `auto_follow_rules` (dual_signal + wallet_mirror) |
| Auto-exec | `src/auto_exec/executor.ts` | Orchestrator: `processConfirmedNewsTrigger()` + `processSmartMoneyBuy()` |
| Auto-exec | `src/auto_exec/mirror_exit.ts` | Decide mirror-exit when tracked wallet sells |
| Push | `src/preferences.ts` | Per-user category subscriptions + default copy/exit |
| Push | `src/news_push.ts` | TG card renderer + `smnews:`/`smcopy:`/`smunsub:` callback helpers |

## Apply the migration first

```bash
npx wrangler d1 execute luna-bot-db --remote --file=migrations/0005_full_loop.sql
```

## Wire-up points in `cloudflare/src/index.ts`

### 1. Imports (top of file)
```ts
import { EspnAdapter } from "./news/espn";
import { SportmonksAdapter } from "./news/sportmonks";
import { BbcSportsAdapter } from "./news/bbc_sports";
import { ingestSmartMoneyFills } from "./smartmoney/ingestor";
import { discoverFromLeaderboard, rescoreExistingWallets } from "./smartmoney/discovery";
import { processConfirmedNewsTrigger, processSmartMoneyBuy } from "./auto_exec/executor";
import { findMirrorExits, shouldExitOnPriceMultiple } from "./auto_exec/mirror_exit";
import { loadPreferences, loadSubscribersForCategory } from "./preferences";
import { renderConfirmedNewsCard, renderSmartMoneyDrillDown, fetchSmartMoneyForTrigger } from "./news_push";
```

### 2. Register the 3 new adapters in `NewsIngestCoordinator`
Find where `TreeOfAlphaAdapter` / `CryptoPanicAdapter` / `SixNineAdapter` / `FangchengshiAdapter`
are constructed and added to the adapter list. Add:
```ts
new EspnAdapter(),
new BbcSportsAdapter(),
...(env.SPORTMONKS_API_TOKEN ? [new SportmonksAdapter(env.SPORTMONKS_API_TOKEN)] : []),
```

### 3. Persist `category` when inserting into `news_triggers`
Find the `INSERT INTO news_triggers` statement in the ingest flow. Add `category` to
the column list and bind `event.category`.

### 4. Cron: smart-money fills ingestion
In the `scheduled()` handler, branch `*/1 * * * *` already calls `tickNewsIngest()`.
Add a sibling call (or append to the same path) after news ingest completes:
```ts
if (env.POLYGON_RPC_URL) {
  const stats = await ingestSmartMoneyFills(env.DB, env.POLYGON_RPC_URL);
  console.log("sm_fills", stats);
}
```

### 5. Cron: discovery / rescore
Add two new cron entries to `wrangler.jsonc`:
```json
{"cron": "0 3 * * *"},    // nightly 03:00 UTC — leaderboard discovery
{"cron": "0 5 * * 0"}     // Sunday 05:00 UTC — weekly rescore
```
Then in `scheduled()`:
```ts
if (controller.cron === "0 3 * * *") await discoverFromLeaderboard(env.DB);
if (controller.cron === "0 5 * * 0") await rescoreExistingWallets(env.DB);
```

### 6. After M3 cross-check flips a trigger to `confirmed`
Locate `news_triggers.status='confirmed'` write (around `index.ts:1690-1709`).
Immediately after, fan out:
```ts
const matchedWallets = await env.DB.prepare(
  `SELECT DISTINCT wallet FROM smart_money_fills
     WHERE market_slug=? AND side=? AND ts BETWEEN ? AND ?`
).bind(trig.market_slug, trig.selected_outcome, trig.published_at - 3600, trig.published_at)
 .all<{wallet:string}>();

await processConfirmedNewsTrigger(
  { db: env.DB, dryRun: env.DRY_RUN !== "false",
    placeOrder: (rule, slug, outcome, amt) => /* delegate to TradeCoordinator */,
    notifyAdmin: (m) => tgSend(env, env.LUNA_ADMIN_CHAT_ID, m),
    notifyUser: (uid, m) => tgSend(env, uid, m) },
  confirmedTriggerRow,
  (matchedWallets.results ?? []).map(r => r.wallet),
);

// Also push to subscribers
const subs = await loadSubscribersForCategory(env.DB, confirmedTriggerRow.category);
const card = renderConfirmedNewsCard(cardTrigger, { count: matchedWallets.results.length, netBuyUsdc });
for (const uid of subs) { await tgSendMarkdown(env, uid, card.text, card.reply_markup); }
```

### 7. After each new smart_money_fills row
Inside `ingestSmartMoneyFills`'s post-insert loop, call (in executor) `processSmartMoneyBuy`
for BUY fills, and `findMirrorExits` for SELL fills.

Note: `ingestor.ts` currently inserts but does NOT yet invoke these — intentionally, so the
caller in `index.ts` can control env + TradeCoordinator injection. Suggested shape:
```ts
const stats = await ingestSmartMoneyFills(env.DB, env.POLYGON_RPC_URL);
// then, for fills newly inserted in the last pass:
const freshFills = await env.DB.prepare(
  `SELECT * FROM smart_money_fills WHERE ts >= ? ORDER BY ts ASC`
).bind(Math.floor(Date.now()/1000) - 120).all<SmartMoneyFillRow>();

for (const f of freshFills.results ?? []) {
  if (f.side !== "NO") await processSmartMoneyBuy(ctx, f);
  // SELL detection is currently encoded in the `side` flip on Polymarket — evaluate per your
  // ingestor's convention. If your ingestor only records BUY fills, SELL detection needs a
  // second code path (trade-side inference from order direction in OrderFilled data[32:64]).
  const exits = await findMirrorExits(env.DB, f);
  for (const d of exits) { /* call existing close-position path */ }
}
```

### 8. TG callback handlers (new)
In the webhook `callback_query` switch, add:
```ts
if (data.startsWith("smnews:")) {
  const tid = parseInt(data.split(":")[1], 10);
  const { trigger, hits } = await fetchSmartMoneyForTrigger(env.DB, tid);
  if (!trigger) return answerCallback(cb.id, "Trigger not found");
  const payload = renderSmartMoneyDrillDown(trigger, hits);
  return sendOrEditMarkdown(env, chatId, msgId, payload.text, payload.reply_markup);
}
if (data.startsWith("smcopy:")) { /* open copy-amount sheet for that market/outcome */ }
if (data.startsWith("smunsub:")) {
  const cat = data.split(":")[1] as NewsCategory;
  const prefs = await loadPreferences(env.DB, userId);
  prefs.subscribedCategories = prefs.subscribedCategories.filter(c => c !== cat);
  await savePreferences(env.DB, prefs);
  return answerCallback(cb.id, `Muted ${cat}`);
}
```

### 9. `/settings` panel
Extend `renderSettingsPanel()` with category multi-select, default copy amount,
default exit strategy, and dual-signal min-wallet slider. Bind state via `loadPreferences` /
`savePreferences`.

## Env vars to add (`wrangler.jsonc`)

| Var | Purpose | Required? |
|-----|---------|-----------|
| `SPORTMONKS_API_TOKEN` | Sportmonks football live events | Optional (falls back to ESPN+BBC) |
| `POLYGON_RPC_URL` | JSON-RPC for OrderFilled logs | **Required** for fills ingestion |
| `LUNA_ADMIN_CHAT_ID` | Aaron 的 admin TG chat ID — `2030090789` (@Aaron0x10, zh-hans) | **Required** |
| `DRY_RUN` | Default `"true"` — flip to `"false"` after 2-week paper trading | **Required** |

## Decisions locked in (2026-04-19)

| # | Decision | Code effect |
|---|----------|-------------|
| 1 | Fee wallet stays `0x925d31A907c4945b51aB9D4255488cBb3a77D694` for now | `wrangler.jsonc LUNA_PLATFORM_FEE_WALLET` unchanged |
| 2 | Admin TG chat = `2030090789` (@Aaron0x10) | Set `LUNA_ADMIN_CHAT_ID=2030090789` |
| 3 | **Dual-signal min smart wallets default = 1**, user can raise in `/settings` | `auto_follow_rules.min_smart_wallets DEFAULT 1`; `user_preferences.min_dual_signal_wallets DEFAULT 1` |
| 4 | Auto-buy amount default = $5, user-configurable, admin can override global default | `trade_amount_usdc DEFAULT 5`; `/settings` slider |
| 5 | **Mirror-exit 1:1 binding — 跟谁进场跟谁出场** (not quorum/threshold) | `exit_strategy = {"type":"mirror","source_wallet":"0x..."}`; `executor.processSmartMoneyBuy` writes this on open; `mirror_exit.findMirrorExits` matches on `source_wallet` only |

## End-to-end smoke (after wiring)

```
# 1. Deploy + migration
npx wrangler d1 execute luna-bot-db --remote --file=migrations/0005_full_loop.sql
npm run cf:deploy

# 2. Seed fake user with dual_signal rule (dry-run)
INSERT INTO auto_follow_rules (telegram_user_id, mode, enabled, categories,
  min_smart_wallets, min_net_buy_usdc, min_confidence, trade_amount_usdc,
  max_trades_per_hour, created_at, updated_at)
VALUES ('2030090789','dual_signal',1,'["crypto","sports"]',2,500,0.6,5,5,
  strftime('%s','now'),strftime('%s','now'));

# 3. Inject test news
INSERT INTO news_triggers (source, source_key, title, category, lang,
  published_at, status) VALUES ('espn','smoke_1','Test injury','sports','en',
  strftime('%s','now'),'detected');

# 4. Wait one cron tick (60s). Verify:
SELECT status FROM news_triggers WHERE source_key='smoke_1';    -- expect 'mapped' or 'confirmed'
SELECT * FROM auto_exec_events ORDER BY ts DESC LIMIT 5;        -- expect 'dry_run' rows
```

## Files NOT touched this round

`cloudflare/src/index.ts` (7406 lines) — too risky to edit without incremental
smoke runs. All wire-up points are documented above. Recommend doing the
insertions in a focused next session with a `wrangler dev` running so each
edit can be verified.
