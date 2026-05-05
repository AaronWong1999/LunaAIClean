/**
 * News → Polymarket market mapper.
 *
 * Pipeline:
 * 1. Fetch active markets from Gamma API
 * 2. Compute text similarity (keyword overlap) for rough top-N recall
 * 3. Send top candidates to LLM for precise mapping via function call
 * 4. Update news_triggers with mapped market_slug, selected_outcome, confidence
 *
 * MVP uses keyword-based recall instead of embedding vectors to avoid
 * additional infra (Vectorize). Upgrade path is clear: swap step 2 for
 * cosine similarity on cached embeddings.
 */
import { chatCompletion, type ChatMessage } from "./openrouter";
import { SYSTEM_PROMPT, PICK_MARKET_FUNCTION, buildMappingPrompt } from "./prompts";

interface MarketCandidate {
  slug: string;
  title: string;
  description?: string;
}

interface MappingResult {
  slug: string | null;
  side: "Yes" | "No";
  confidence: number;
  reasoning: string;
}

const CANDIDATE_LIMIT = 15;

/**
 * Fetch active markets from Polymarket Gamma API.
 * Returns lightweight candidates for matching.
 */
export async function fetchActiveMarkets(gammaHost: string): Promise<MarketCandidate[]> {
  const resp = await fetch(`${gammaHost}/markets?active=true&closed=false&limit=200`);
  if (!resp.ok) {
    throw new Error(`Gamma API ${resp.status}`);
  }
  const markets = (await resp.json()) as Array<{
    slug?: string;
    question?: string;
    description?: string;
    active?: boolean;
  }>;
  return markets
    .filter((m) => m.slug && m.question)
    .map((m) => ({
      slug: m.slug!,
      title: m.question!,
      description: m.description?.slice(0, 200),
    }));
}

/**
 * Keyword-based recall: score each market by token overlap with the news title.
 * Returns top N candidates sorted by relevance.
 */
function recallByKeywords(newsTitle: string, markets: MarketCandidate[], limit: number): MarketCandidate[] {
  const queryTokens = new Set(
    newsTitle
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
  if (queryTokens.size === 0) return markets.slice(0, limit);

  const scored = markets.map((m) => {
    const marketText = `${m.title} ${m.description ?? ""}`.toLowerCase();
    const marketTokens = new Set(
      marketText.split(/[^a-z0-9]+/).filter((t) => t.length > 2),
    );
    let overlap = 0;
    for (const qt of queryTokens) {
      if (marketTokens.has(qt)) overlap++;
    }
    return { market: m, score: overlap / queryTokens.size };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((s) => s.score > 0)
    .map((s) => s.market);
}

/**
 * Map a news event to a Polymarket market via keyword recall + LLM.
 * Returns null if no confident mapping found.
 */
export async function mapNewsToMarket(
  newsTitle: string,
  newsBody: string | undefined,
  openrouterApiKey: string,
  gammaHost: string,
  llmModel?: string,
): Promise<MappingResult | null> {
  // Step 1: Fetch active markets
  const allMarkets = await fetchActiveMarkets(gammaHost);
  if (allMarkets.length === 0) return null;

  // Step 2: Keyword recall
  const candidates = recallByKeywords(newsTitle, allMarkets, CANDIDATE_LIMIT);
  if (candidates.length === 0) return null;

  // Step 3: LLM function call
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildMappingPrompt(newsTitle, newsBody, candidates) },
  ];

  const response = await chatCompletion(openrouterApiKey, messages, {
    model: llmModel,
    functions: [PICK_MARKET_FUNCTION],
    temperature: 0.1,
    maxTokens: 512,
  });

  if (!response.functionCall) return null;

  try {
    const result = JSON.parse(response.functionCall.arguments) as MappingResult;
    // Validate slug exists in candidates
    if (result.slug && !candidates.some((c) => c.slug === result.slug)) {
      result.slug = null;
    }
    return result;
  } catch {
    return null;
  }
}
