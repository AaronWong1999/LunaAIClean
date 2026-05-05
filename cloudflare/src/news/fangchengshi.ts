/**
 * 方程式新闻 (Fangchengshi) RSS adapter.
 * Chinese-language crypto news aggregator.
 * Polled every 60s via cron alongside CryptoPanic.
 */
import type { NewsEvent, NewsAdapter } from "./types";

const RSS_URL = "https://www.fangchengshi.com/rss";

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  guid?: string;
}

/** Minimal RSS XML parser — extracts <item> elements without a full XML lib */
function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const description = extractTag(block, "description");
    const guid = extractTag(block, "guid");
    if (title) {
      items.push({ title, link: link ?? "", pubDate: pubDate ?? "", description: description ?? undefined, guid: guid ?? undefined });
    }
  }
  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle both <tag>value</tag> and <tag><![CDATA[value]]></tag>
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const m = xml.match(regex);
  return m ? m[1].trim() : null;
}

export class FangchengshiAdapter implements NewsAdapter {
  readonly name = "fangchengshi" as const;

  async poll(): Promise<NewsEvent[]> {
    const resp = await fetch(RSS_URL, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!resp.ok) {
      throw new Error(`Fangchengshi RSS ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const xml = await resp.text();
    const items = parseRSSItems(xml);
    return items.map((item): NewsEvent => ({
      source: "fangchengshi",
      source_key: `fcs_${item.guid ?? hashString(item.title + item.pubDate)}`,
      title: item.title,
      body: item.description,
      published_at: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
      lang: "zh",
      category: "crypto",
    }));
  }
}

/** Simple hash for generating source_key when no guid is available */
function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
