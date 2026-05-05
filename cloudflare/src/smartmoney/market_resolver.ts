/**
 * Resolve Polymarket CTF token_id (ERC-1155 id) → market_slug + outcome.
 *
 * Uses D1 cache (market_token_map). Falls back to Polymarket Gamma API
 * on miss and writes the mapping back for future lookups.
 *
 * Gamma: https://gamma-api.polymarket.com/markets?clob_token_ids=<id>
 */

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface ResolvedMarket {
  tokenId: string;
  marketSlug: string;
  outcome: string;
  conditionId?: string;
}

interface GammaMarket {
  slug?: string;
  condition_id?: string;
  conditionId?: string;
  outcomes?: string | string[];
  clobTokenIds?: string | string[];
  clob_token_ids?: string | string[];
}

export async function resolveTokenId(
  db: D1Database,
  tokenId: string,
): Promise<ResolvedMarket | null> {
  const hit = await db
    .prepare(
      `SELECT token_id, market_slug, outcome, condition_id, updated_at
         FROM market_token_map WHERE token_id = ?`,
    )
    .bind(tokenId)
    .first<{ token_id: string; market_slug: string; outcome: string; condition_id: string | null; updated_at: number }>();
  const now = Math.floor(Date.now() / 1000);
  if (hit && now - hit.updated_at < CACHE_TTL_SECONDS) {
    return {
      tokenId: hit.token_id,
      marketSlug: hit.market_slug,
      outcome: hit.outcome,
      conditionId: hit.condition_id ?? undefined,
    };
  }

  const fetched = await fetchFromGamma(tokenId);
  if (!fetched) return null;
  await db
    .prepare(
      `INSERT INTO market_token_map (token_id, market_slug, outcome, condition_id, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(token_id) DO UPDATE SET
         market_slug = excluded.market_slug,
         outcome = excluded.outcome,
         condition_id = excluded.condition_id,
         updated_at = excluded.updated_at`,
    )
    .bind(fetched.tokenId, fetched.marketSlug, fetched.outcome, fetched.conditionId ?? null, now)
    .run();
  return fetched;
}

async function fetchFromGamma(tokenId: string): Promise<ResolvedMarket | null> {
  try {
    const url = `${GAMMA_BASE}/markets?clob_token_ids=${tokenId}&limit=1`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return null;
    const data = (await resp.json()) as GammaMarket[] | { markets?: GammaMarket[] };
    const list: GammaMarket[] = Array.isArray(data) ? data : data.markets ?? [];
    const m = list[0];
    if (!m || !m.slug) return null;
    const outcomes = normalizeList(m.outcomes);
    const tokenIds = normalizeList(m.clobTokenIds ?? m.clob_token_ids);
    const idx = tokenIds.indexOf(tokenId);
    const outcome = idx >= 0 && outcomes[idx] ? outcomes[idx] : "YES";
    return {
      tokenId,
      marketSlug: m.slug,
      outcome,
      conditionId: m.condition_id ?? m.conditionId,
    };
  } catch {
    return null;
  }
}

function normalizeList(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
