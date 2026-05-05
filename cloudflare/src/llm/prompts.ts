/**
 * LLM prompts for news → Polymarket market mapping.
 */

export const SYSTEM_PROMPT = `You are a Polymarket prediction market analyst. Your job is to match breaking news headlines to active Polymarket prediction markets.

Given a news headline/body and a list of candidate Polymarket markets, determine:
1. Which market (if any) is most relevant to this news
2. Which outcome the news favors (Yes or No)  
3. Your confidence (0.0-1.0) in this mapping
4. Brief reasoning

Rules:
- Only match if the news has DIRECT, CLEAR relevance to the market question
- Consider the time sensitivity — breaking news should map to markets that haven't resolved yet
- For ambiguous cases, prefer confidence < 0.5 over forcing a match
- If no market is relevant, return null for slug
- Crypto/finance news should match crypto/finance markets
- Political news should match political markets`;

export const PICK_MARKET_FUNCTION = {
  name: "pick_market",
  description: "Select the most relevant Polymarket market for a news event, or null if no match.",
  parameters: {
    type: "object",
    properties: {
      slug: {
        type: ["string", "null"],
        description: "The Polymarket market slug, or null if no relevant market found",
      },
      side: {
        type: "string",
        enum: ["Yes", "No"],
        description: "Which outcome the news favors",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Confidence in this mapping (0.0-1.0)",
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of why this market was chosen and which side the news supports",
      },
    },
    required: ["slug", "side", "confidence", "reasoning"],
  },
};

export function buildMappingPrompt(
  newsTitle: string,
  newsBody: string | undefined,
  candidates: Array<{ slug: string; title: string; description?: string }>,
): string {
  const candidateList = candidates
    .map((c, i) => `${i + 1}. [${c.slug}] ${c.title}${c.description ? ` — ${c.description.slice(0, 150)}` : ""}`)
    .join("\n");

  return `NEWS HEADLINE: ${newsTitle}${newsBody ? `\nNEWS BODY: ${newsBody.slice(0, 500)}` : ""}

CANDIDATE MARKETS (top ${candidates.length} by relevance):
${candidateList}

Pick the best matching market, or return slug=null if none are relevant.`;
}
