/**
 * ESPN hidden REST API — free, no auth. Covers soccer (World Cup 2026),
 * NBA, NFL, MLB scoreboard + news. Polled every 60s.
 *
 * Endpoint docs (unofficial): https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b
 */
import type { NewsEvent, NewsAdapter } from "./types";

interface EspnArticle {
  headline: string;
  description?: string;
  published: string;
  links?: { web?: { href?: string } };
  categories?: Array<{ description?: string }>;
}

interface EspnResponse {
  articles?: EspnArticle[];
}

const LEAGUES: Array<{ slug: string; label: string }> = [
  { slug: "soccer/fifa.world", label: "FIFA World Cup" },
  { slug: "soccer/uefa.champions", label: "UCL" },
  { slug: "basketball/nba", label: "NBA" },
  { slug: "football/nfl", label: "NFL" },
];

export class EspnAdapter implements NewsAdapter {
  readonly name = "espn" as const;

  async poll(): Promise<NewsEvent[]> {
    const all: NewsEvent[] = [];
    for (const league of LEAGUES) {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${league.slug}/news?limit=30`;
        const resp = await fetch(url, { headers: { Accept: "application/json" } });
        if (!resp.ok) continue;
        const data = (await resp.json()) as EspnResponse;
        for (const art of data.articles ?? []) {
          if (!art.headline || !art.published) continue;
          const ts = Math.floor(new Date(art.published).getTime() / 1000);
          if (!Number.isFinite(ts)) continue;
          all.push({
            source: "espn",
            source_key: `espn_${league.slug.replace(/\//g, "_")}_${ts}_${hash(art.headline)}`,
            title: `[${league.label}] ${art.headline}`,
            body: art.description,
            published_at: ts,
            lang: "en",
            category: "sports",
          });
        }
      } catch {
        // one league failing shouldn't poison the batch
      }
    }
    return all;
  }
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
