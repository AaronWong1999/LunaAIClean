/**
 * CryptoPanic REST adapter — polled every 60s via cron.
 * API docs: https://cryptopanic.com/developers/api/
 */
import type { NewsEvent, NewsAdapter } from "./types";

interface CryptoPanicPost {
  id: number;
  title: string;
  published_at: string; // ISO 8601
  url: string;
  source: { title: string };
  kind: "news" | "media" | "analysis";
  currencies?: Array<{ code: string }>;
}

interface CryptoPanicResponse {
  results: CryptoPanicPost[];
  next?: string;
}

export class CryptoPanicAdapter implements NewsAdapter {
  readonly name = "cryptopanic" as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async poll(): Promise<NewsEvent[]> {
    const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${this.apiKey}&filter=important&kind=news&public=true`;
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
      throw new Error(`CryptoPanic API ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const data = (await resp.json()) as CryptoPanicResponse;
    return (data.results ?? []).map((post): NewsEvent => ({
      source: "cryptopanic",
      source_key: `cp_${post.id}`,
      title: post.title,
      published_at: Math.floor(new Date(post.published_at).getTime() / 1000),
      lang: "en",
      category: "crypto",
    }));
  }
}
