/**
 * BBC Sport RSS — free, authoritative confirmation layer for sports news.
 * 2-10 min lag vs. Twitter/Sportmonks, but zero cost and unlimited.
 *
 * Feeds: football (incl. World Cup), rugby, tennis, cricket.
 */
import type { NewsEvent, NewsAdapter } from "./types";

const FEEDS: Array<{ url: string; label: string }> = [
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", label: "Football" },
  { url: "https://feeds.bbci.co.uk/sport/football/world-cup/rss.xml", label: "World Cup" },
  { url: "https://feeds.bbci.co.uk/sport/tennis/rss.xml", label: "Tennis" },
];

export class BbcSportsAdapter implements NewsAdapter {
  readonly name = "bbc_sports" as const;

  async poll(): Promise<NewsEvent[]> {
    const out: NewsEvent[] = [];
    for (const feed of FEEDS) {
      try {
        const resp = await fetch(feed.url, { headers: { Accept: "application/rss+xml, application/xml" } });
        if (!resp.ok) continue;
        const xml = await resp.text();
        out.push(...parseRss(xml, feed.label));
      } catch {
        // skip
      }
    }
    return out;
  }
}

function parseRss(xml: string, label: string): NewsEvent[] {
  const items: NewsEvent[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const desc = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");
    const guid = extractTag(block, "guid") ?? title;
    if (!title || !pubDate) continue;
    const ts = Math.floor(new Date(pubDate).getTime() / 1000);
    if (!Number.isFinite(ts)) continue;
    items.push({
      source: "bbc_sports",
      source_key: `bbc_${hash(guid)}`,
      title: `[${label}] ${title}`,
      body: desc ?? undefined,
      published_at: ts,
      lang: "en",
      category: "sports",
    });
  }
  return items;
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`);
  const m = block.match(re);
  if (!m) return null;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
