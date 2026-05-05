/**
 * 6551.io MCP adapter — multi-language news via MCP service.
 * Uses standard HTTP fetch to the MCP endpoint.
 */
import type { NewsEvent, NewsAdapter } from "./types";

const MCP_BASE_URL = "https://mcp.6551.io";

interface SixNineNewsItem {
  id?: string;
  title: string;
  content?: string;
  published_at?: string; // ISO 8601
  lang?: string;
  source?: string;
  url?: string;
}

export class SixNineAdapter implements NewsAdapter {
  readonly name = "sixnine" as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async poll(): Promise<NewsEvent[]> {
    const resp = await fetch(`${MCP_BASE_URL}/api/news/latest`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    if (!resp.ok) {
      throw new Error(`6551.io MCP ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const data = (await resp.json()) as { items?: SixNineNewsItem[] } | SixNineNewsItem[];
    const items = Array.isArray(data) ? data : data.items ?? [];
    return items.map((item): NewsEvent => ({
      source: "sixnine",
      source_key: `69_${item.id ?? hashString(item.title + (item.published_at ?? ""))}`,
      title: item.title,
      body: item.content,
      published_at: item.published_at
        ? Math.floor(new Date(item.published_at).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      lang: detectLang(item.lang, item.title),
      category: "crypto",
    }));
  }
}

function detectLang(hint?: string, title?: string): "en" | "zh" {
  if (hint === "zh" || hint === "cn" || hint === "zh-CN") return "zh";
  if (hint === "en") return "en";
  // Simple CJK detection
  if (title && /[\u4e00-\u9fff]/.test(title)) return "zh";
  return "en";
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
