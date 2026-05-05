/**
 * Unified news event model — all sources normalize to this shape
 * before dedup and D1 insertion.
 */
export type NewsSource =
  | "treeofalpha"
  | "sixnine"
  | "cryptopanic"
  | "fangchengshi"
  | "espn"
  | "sportmonks"
  | "bbc_sports";

export type NewsCategory = "crypto" | "sports" | "macro" | "politics";

export interface NewsEvent {
  source: NewsSource;
  source_key: string;
  title: string;
  body?: string;
  published_at: number;
  lang: "en" | "zh";
  category: NewsCategory;
}

export interface NewsSourceHealth {
  source: NewsSource;
  last_heartbeat: number;
  consecutive_failures: number;
}

export interface NewsAdapter {
  readonly name: NewsSource;
  poll(): Promise<NewsEvent[]>;
}
