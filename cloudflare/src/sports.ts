import type { Env, RuntimeSignal } from "./types";

interface GammaMarket {
  slug?: string;
  question?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  liquidityNum?: number;
  volumeNum?: number;
  endDate?: string;
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}¢`;
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeList(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) return raw.map((item) => String(item));
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function outcomePricesFor(market: GammaMarket): Array<{ name: string; price: number }> {
  const names = normalizeList(market.outcomes);
  const prices = normalizeList(market.outcomePrices)
    .map((item) => Number(item))
    .filter((value) => Number.isFinite(value));
  return names.map((name, index) => ({
    name,
    price: prices[index] ?? 0,
  }));
}

function pickOutcome(market: GammaMarket): { outcome: string; price: number } | null {
  const priced = outcomePricesFor(market).filter((item) => item.name && item.price > 0);
  if (!priced.length) return null;
  const yes = priced.find((item) => item.name.toLowerCase() === "yes");
  if (yes) return yes;
  return priced.sort((left, right) => right.price - left.price)[0] ?? null;
}

function buildSportsSignal(market: GammaMarket, score: number): RuntimeSignal | null {
  const chosen = pickOutcome(market);
  if (!market.slug || !market.question || !chosen) return null;
  const liquidity = Number(market.liquidityNum ?? market.volumeNum ?? 0);
  const expiry = market.endDate ? new Date(market.endDate) : null;
  const expiryText = expiry && !Number.isNaN(expiry.getTime()) ? `${expiry.toISOString().slice(0, 19).replace("T", " ")} UTC` : "TBD";
  const expectedReturn = clamp((1 / Math.max(chosen.price, 0.05) - 1) * 100, 8, 180);
  const dailyReturn = clamp(expectedReturn / 24, 0.4, 6.5);
  return {
    id: 0,
    slug: market.slug,
    title_en: market.question,
    title_zh: market.question,
    action_en: `Buy ${chosen.outcome} @ ${formatPct(chosen.price)}`,
    action_zh: `买入 ${chosen.outcome} @ ${formatPct(chosen.price)}`,
    score,
    current_price: formatPct(chosen.price),
    expected_return: `+${expectedReturn.toFixed(1)}%`,
    daily_return: `+${dailyReturn.toFixed(1)}%`,
    liquidity: formatMoney(liquidity),
    expiry_en: expiryText,
    expiry_zh: expiryText,
    source_count: "Sports wallets",
    detail_url: `https://polymarket.com/event/${market.slug}`,
    market_url: `https://polymarket.com/event/${market.slug}`,
    analysis_en: `Sports conviction is clustered around ${chosen.outcome}. This market is live and prioritized for fast small-size execution before kickoff windows move.`,
    analysis_zh: `体育高分钱包当前集中在 ${chosen.outcome} 方向，这是一条适合赛前快速小额执行的实时市场。`,
    selected_outcome: chosen.outcome,
    sports: 1,
    status_en: "Open",
    status_zh: "开放中",
  };
}

export async function fetchLiveSportsSignals(env: Env): Promise<RuntimeSignal[]> {
  const tagIds = [100639, 100350];
  const responses = await Promise.all(
    tagIds.map(async (tagId) => {
      const endpoint = `${env.POLYMARKET_GAMMA_HOST}/markets?tag_id=${tagId}&closed=false&active=true&limit=18`;
      const response = await fetch(endpoint, { headers: { accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`Gamma sports refresh failed for tag ${tagId} (${response.status})`);
      }
      return (await response.json()) as GammaMarket[];
    }),
  );

  const bySlug = new Map<string, GammaMarket>();
  for (const bucket of responses) {
    for (const market of bucket) {
      if (!market.slug) continue;
      if (!bySlug.has(market.slug)) bySlug.set(market.slug, market);
    }
  }
  const markets = Array.from(bySlug.values());
  const qualifierSignals = markets
    .filter((market) => /qualify/i.test(market.question ?? ""))
    .slice(0, 3)
    .map((market, index) => buildSportsSignal(market, 66 - index * 4))
    .filter((signal): signal is RuntimeSignal => !!signal);

  const outrightSignals = markets
    .filter((market) => /win the 2026 fifa world cup/i.test(market.question ?? ""))
    .filter((market) => {
      const selected = pickOutcome(market);
      return selected?.outcome === "Yes" && selected.price >= 0.08 && selected.price <= 0.3;
    })
    .slice(0, 3)
    .map((market, index) => buildSportsSignal(market, 89 - index * 2))
    .filter((signal): signal is RuntimeSignal => !!signal);

  return [...outrightSignals, ...qualifierSignals];
}
