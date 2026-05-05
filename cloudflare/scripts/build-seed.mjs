import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(process.cwd(), "..");
const dataDir = path.join(root, "data");
const outPath = path.join(process.cwd(), "seed.sql");
const worldCupMarketsPath = path.join(dataDir, "worldcup_markets.json");
const SPORTS_TAG_ID = "100350";
const SPORTS_LIMIT = 6;

const runtimeSignals = JSON.parse(fs.readFileSync(path.join(dataDir, "runtime_signals.json"), "utf8"));
const runtimeWallets = JSON.parse(fs.readFileSync(path.join(dataDir, "runtime_wallet_profiles.json"), "utf8"));
const runtimeMeta = JSON.parse(fs.readFileSync(path.join(dataDir, "runtime_meta.json"), "utf8"));
const runtimeHistory = JSON.parse(fs.readFileSync(path.join(dataDir, "runtime_signal_history.json"), "utf8"));

const q = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
};

function formatPct(value) {
  const numeric = Number.isFinite(value) ? value : 0;
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(1)}%`;
}

function formatMoney(value) {
  const numeric = Number(value || 0);
  if (numeric >= 1_000_000) return `$${(numeric / 1_000_000).toFixed(2)}M`;
  if (numeric >= 1_000) return `$${(numeric / 1_000).toFixed(1)}K`;
  return `$${numeric.toFixed(0)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function outcomePricesFor(market) {
  try {
    const outcomes = JSON.parse(market.outcomes ?? "[]");
    const outcomePrices = JSON.parse(market.outcomePrices ?? "[]").map((item) => Number(item));
    return outcomes.map((outcome, index) => ({ outcome, price: outcomePrices[index] ?? 0 }));
  } catch {
    return [];
  }
}

function pickOutcome(market) {
  const pairs = outcomePricesFor(market);
  if (!pairs.length) return { outcome: "Yes", price: 0.5 };
  const yesPair = pairs.find((item) => item.outcome === "Yes");
  const question = String(market.question || "").toLowerCase();
  if (yesPair) {
    if (question.includes("qualify for the 2026 fifa world cup") && yesPair.price >= 0.3 && yesPair.price <= 0.85) {
      return yesPair;
    }
    if (question.includes("win the 2026 fifa world cup") && yesPair.price >= 0.08 && yesPair.price <= 0.3) {
      return yesPair;
    }
  }
  const sorted = [...pairs].sort((left, right) => right.price - left.price);
  return sorted[0];
}

function buildSportsSignal(market, id) {
  const { outcome, price } = pickOutcome(market);
  const endDate = market.endDate || market.events?.[0]?.endDate || "";
  const expiry = endDate ? endDate.replace("T", " ").replace("Z", " UTC") : "Unknown";
  const event = Array.isArray(market.events) ? market.events[0] : null;
  const context = event?.eventMetadata?.context_description || "";
  const liquidity = Number(market.liquidityNum ?? market.liquidityClob ?? market.liquidity ?? 0);
  const volume24hr = Number(market.volume24hrClob ?? market.volume24hr ?? 0);
  const volume = Number(market.volumeNum ?? market.volumeClob ?? market.volume ?? 0);
  const priceCents = clamp(price * 100, 1, 99);
  const expectedReturn = price > 0 ? ((1 - price) / price) * 100 : 0;
  const now = Date.now();
  const msLeft = endDate ? new Date(endDate).getTime() - now : 0;
  const daysLeft = msLeft > 0 ? Math.max(msLeft / 86400000, 0.1) : 1;
  const dailyReturn = expectedReturn / daysLeft;
  const conviction = Math.abs(price - 0.5) * 100;
  const score = clamp(58 + conviction * 0.28 + Math.min(volume24hr / 60000, 18) + Math.min(liquidity / 50000, 16), 62, 94);
  const summary = context
    ? context.slice(0, 280).trim()
    : `${market.question} is live with ${formatMoney(volume24hr)} 24h volume and ${formatMoney(liquidity)} liquidity.`;

  return {
    id,
    slug: market.slug,
    title_en: market.question,
    title_zh: market.question,
    action_en: `🎯 Buy ${outcome} @ ${priceCents}¢`,
    action_zh: `🎯 买入 ${outcome} @ ${priceCents}¢`,
    score,
    current_price: `${priceCents}¢`,
    expected_return: formatPct(expectedReturn),
    daily_return: formatPct(dailyReturn),
    liquidity: formatMoney(liquidity || volume),
    expiry_en: expiry,
    expiry_zh: expiry,
    source_count: `World Cup pulse · ${formatMoney(volume24hr)} 24h vol`,
    detail_url: `https://polymarket.com/event/${event?.slug || market.slug}`,
    market_url: `https://polymarket.com/market/${market.slug}`,
    analysis_en: summary,
    analysis_zh: summary,
    selected_outcome: outcome,
    sports: true,
    status_en: "Open",
    status_zh: "待结算",
  };
}

async function fetchLiveSportsSignals(startId) {
  let payload;
  if (fs.existsSync(worldCupMarketsPath)) {
    payload = JSON.parse(fs.readFileSync(worldCupMarketsPath, "utf8"));
  } else {
    const url = new URL("https://gamma-api.polymarket.com/markets");
    url.searchParams.set("tag_id", SPORTS_TAG_ID);
    url.searchParams.set("closed", "false");
    url.searchParams.set("active", "true");
    url.searchParams.set("limit", "18");
    const raw = execFileSync("curl", ["-s", url.toString()], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    payload = JSON.parse(raw);
  }
  const markets = Array.isArray(payload) ? payload : [];
  const normalized = markets
    .filter((market) => market?.active && !market?.closed && market?.acceptingOrders && market?.slug)
    .filter((market) => String(market.slug).includes("fifa-world-cup"));
  const rankByDemand = (left, right) => {
    const leftRank = Number(left.volume24hrClob ?? left.volume24hr ?? 0) + Number(left.liquidityNum ?? left.liquidity ?? 0);
    const rightRank = Number(right.volume24hrClob ?? right.volume24hr ?? 0) + Number(right.liquidityNum ?? right.liquidity ?? 0);
    return rightRank - leftRank;
  };
  const qualifiers = normalized
    .filter((market) => String(market.question).includes("qualify for the 2026 FIFA World Cup"))
    .sort(rankByDemand)
    .slice(0, 3);
  const outrights = normalized
    .filter((market) => String(market.question).includes("win the 2026 FIFA World Cup"))
    .filter((market) => {
      const yesPair = outcomePricesFor(market).find((item) => item.outcome === "Yes");
      return yesPair && yesPair.price >= 0.08 && yesPair.price <= 0.3;
    })
    .sort(rankByDemand)
    .slice(0, 3);
  const usable = [...qualifiers, ...outrights].slice(0, SPORTS_LIMIT);

  return usable.map((market, index) => buildSportsSignal(market, startId + index));
}

const nonSportsSignals = runtimeSignals.filter((signal) => !signal.sports);
let sportsSignals = [];
try {
  sportsSignals = await fetchLiveSportsSignals(nonSportsSignals.length + 1);
} catch (error) {
  console.warn(`Unable to fetch live sports signals: ${error.message}`);
}
const combinedSignals = [...nonSportsSignals, ...sportsSignals];
const combinedMeta = {
  ...runtimeMeta,
  signal_count: combinedSignals.length,
  top_signal: combinedSignals[0]?.title_en ?? runtimeMeta.top_signal ?? null,
  sports_signal_count: sportsSignals.length,
};

const lines = [
  "-- Generated by cloudflare/scripts/build-seed.mjs",
  "DELETE FROM runtime_signals;",
  "DELETE FROM runtime_wallet_profiles;",
  "DELETE FROM runtime_meta;",
  "DELETE FROM signal_history_snapshots;"
];

for (const signal of combinedSignals) {
  lines.push(
    `INSERT INTO runtime_signals (id, slug, title_en, title_zh, action_en, action_zh, score, current_price, expected_return, daily_return, liquidity, expiry_en, expiry_zh, source_count, detail_url, market_url, analysis_en, analysis_zh, selected_outcome, sports, status_en, status_zh) VALUES (${q(signal.id)}, ${q(signal.slug)}, ${q(signal.title_en)}, ${q(signal.title_zh)}, ${q(signal.action_en)}, ${q(signal.action_zh)}, ${q(signal.score)}, ${q(signal.current_price)}, ${q(signal.expected_return)}, ${q(signal.daily_return)}, ${q(signal.liquidity)}, ${q(signal.expiry_en)}, ${q(signal.expiry_zh)}, ${q(signal.source_count)}, ${q(signal.detail_url)}, ${q(signal.market_url)}, ${q(signal.analysis_en)}, ${q(signal.analysis_zh)}, ${q(signal.selected_outcome)}, ${signal.sports ? 1 : 0}, ${q(signal.status_en)}, ${q(signal.status_zh)});`
  );
}

for (const wallet of runtimeWallets) {
  lines.push(
    `INSERT INTO runtime_wallet_profiles (address, name, score, grade, roi_30d, win_rate_30d, activity, specialty_zh, specialty_en, note_zh, note_en) VALUES (${q(wallet.address)}, ${q(wallet.name)}, ${q(wallet.score)}, ${q(wallet.grade)}, ${q(wallet.roi_30d)}, ${q(wallet.win_rate_30d)}, ${q(wallet.activity)}, ${q(wallet.specialty_zh)}, ${q(wallet.specialty_en)}, ${q(wallet.note_zh)}, ${q(wallet.note_en)});`
  );
}

lines.push(
  `INSERT INTO runtime_meta (singleton_key, generated_at, duration_sec, wallet_count, signal_count, top_wallet, top_signal, payload_json) VALUES ('runtime', ${q(combinedMeta.generated_at)}, ${q(combinedMeta.duration_sec)}, ${q(combinedMeta.wallet_count)}, ${q(combinedMeta.signal_count)}, ${q(combinedMeta.top_wallet)}, ${q(combinedMeta.top_signal)}, ${q(JSON.stringify(combinedMeta))});`
);

for (const snapshot of runtimeHistory) {
  lines.push(
    `INSERT INTO signal_history_snapshots (generated_at, signal_count, top_signal, payload_json) VALUES (${q(snapshot.generated_at)}, ${q(snapshot.signal_count ?? 0)}, ${q(snapshot.top_signal ?? null)}, ${q(JSON.stringify(snapshot))});`
  );
}

fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
console.log(`Wrote ${outPath} with ${combinedSignals.length} signals, including ${sportsSignals.length} live sports signals.`);
