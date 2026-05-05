/**
 * News push renderer + smart-money drill-down builder.
 *
 * When a news_trigger transitions to 'confirmed', we push to every user
 * whose preferences include that category and push_on_confirmed=1.
 *
 * The card has three buttons:
 *   🐋 View smart money — callback `smnews:<trigger_id>` — re-queries
 *      smart_money_fills for the live list (time-progressive, so it MUST
 *      be re-fetched on every click, not cached)
 *   ⚡ Copy now         — callback `smcopy:<trigger_id>` — opens copy sheet
 *   🔕 Unsub category   — callback `smunsub:<category>`
 */

import type { NewsCategory } from "./news/types";

export interface ConfirmedTrigger {
  id: number;
  title: string;
  marketSlug: string;
  outcome: string;
  confidence: number;
  publishedAt: number;
  category: NewsCategory;
  source: string;
}

export interface SmartMoneyHitRow {
  wallet: string;
  amount_usdc: number;
  ts: number;
  label: string | null;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface NewsCardPayload {
  text: string;
  reply_markup: { inline_keyboard: InlineKeyboardButton[][] };
}

export function renderConfirmedNewsCard(
  t: ConfirmedTrigger,
  matched: { count: number; netBuyUsdc: number },
): NewsCardPayload {
  const emoji = categoryEmoji(t.category);
  const conf = (t.confidence * 100).toFixed(0);
  const text =
    `${emoji} *${escape(t.title)}*\n\n` +
    `📊 Market: \`${t.marketSlug}\`\n` +
    `🎯 Side: *${t.outcome}* · Confidence ${conf}%\n` +
    `🐋 Smart money (pre-news 1h): ${matched.count} wallets · $${matched.netBuyUsdc.toFixed(0)}\n` +
    `🗞 Source: ${t.source} · ${formatRelative(t.publishedAt)}`;

  return {
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🐋 View smart money", callback_data: `smnews:${t.id}` },
          { text: "⚡ Copy now", callback_data: `smcopy:${t.id}` },
        ],
        [{ text: `🔕 Mute ${t.category}`, callback_data: `smunsub:${t.category}` }],
      ],
    },
  };
}

/**
 * Resolve the live smart-money list for a trigger. Called every time the
 * user taps "View smart money" — the list grows over time (time-progressive),
 * so we query D1 fresh each call (no caching).
 */
export async function fetchSmartMoneyForTrigger(
  db: D1Database,
  triggerId: number,
): Promise<{ trigger: ConfirmedTrigger | null; hits: SmartMoneyHitRow[] }> {
  const trig = await db
    .prepare(
      `SELECT id, title, market_slug, selected_outcome, confidence, published_at, category, source
         FROM news_triggers WHERE id = ?`,
    )
    .bind(triggerId)
    .first<{
      id: number;
      title: string;
      market_slug: string | null;
      selected_outcome: string | null;
      confidence: number | null;
      published_at: number | null;
      category: string;
      source: string;
    }>();

  if (!trig || !trig.market_slug || !trig.selected_outcome || !trig.published_at) {
    return { trigger: null, hits: [] };
  }

  // Widen to 2h: 1h pre-news + up to 1h post-confirmation, so users can see
  // who's still piling in after the news dropped.
  const from = trig.published_at - 3600;
  const to = Math.floor(Date.now() / 1000);

  const rows = await db
    .prepare(
      `SELECT f.wallet, f.amount_usdc, f.ts, uw.label
         FROM smart_money_fills f
         LEFT JOIN smart_wallets s ON s.address = f.wallet
         LEFT JOIN user_tracked_wallets uw ON uw.wallet_address = f.wallet
        WHERE f.market_slug = ?
          AND f.side = ?
          AND f.ts BETWEEN ? AND ?
          AND (s.seed = 1 OR s.qualified = 1)
        ORDER BY f.ts ASC`,
    )
    .bind(trig.market_slug, trig.selected_outcome, from, to)
    .all<SmartMoneyHitRow>();

  return {
    trigger: {
      id: trig.id,
      title: trig.title,
      marketSlug: trig.market_slug,
      outcome: trig.selected_outcome,
      confidence: trig.confidence ?? 0,
      publishedAt: trig.published_at,
      category: (trig.category as NewsCategory) ?? "crypto",
      source: trig.source,
    },
    hits: rows.results ?? [],
  };
}

export function renderSmartMoneyDrillDown(
  trig: ConfirmedTrigger,
  hits: SmartMoneyHitRow[],
): NewsCardPayload {
  const header = `🐋 *Smart money on* ${escape(trig.marketSlug)} · ${trig.outcome}\n`;
  const sub = `Window: news-1h → now (${formatRelative(trig.publishedAt)} → now)\n\n`;
  if (hits.length === 0) {
    return {
      text: header + sub + "_No qualified smart wallets yet — keep an eye, list updates in real time._",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Refresh", callback_data: `smnews:${trig.id}` }],
          [{ text: "⚡ Copy now", callback_data: `smcopy:${trig.id}` }],
        ],
      },
    };
  }
  const lines = hits.slice(-15).map((h) => {
    const tag = h.label ? `_${escape(h.label)}_` : shortAddr(h.wallet);
    const rel = formatRelative(h.ts);
    return `• ${tag} · \`$${h.amount_usdc.toFixed(0)}\` · ${rel}`;
  });
  const total = hits.reduce((s, h) => s + h.amount_usdc, 0);
  const body = `Total: *$${total.toFixed(0)}* across *${hits.length}* wallets\n\n` + lines.join("\n");
  return {
    text: header + sub + body,
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔄 Refresh", callback_data: `smnews:${trig.id}` }],
        [{ text: "⚡ Copy now", callback_data: `smcopy:${trig.id}` }],
      ],
    },
  };
}

function categoryEmoji(c: NewsCategory): string {
  if (c === "sports") return "⚽";
  if (c === "macro") return "📈";
  if (c === "politics") return "🏛";
  return "💎";
}

function shortAddr(a: string): string {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function formatRelative(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escape(s: string): string {
  // markdown-v2-lite: escape *, _, ` which we use as delimiters
  return s.replace(/([_*`\[\]])/g, "\\$1");
}
