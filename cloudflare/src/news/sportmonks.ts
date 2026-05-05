/**
 * Sportmonks Football API — structured events (goals, cards, lineups, injuries).
 * Best source for breaking World Cup lineup + injury signals.
 *
 * Free tier covers 180 leagues. Upgrade to World Cup plan (~€39/mo) before
 * the 2026 tournament for full coverage.
 *
 * API docs: https://docs.sportmonks.com/football/
 */
import type { NewsEvent, NewsAdapter } from "./types";

interface SportmonksLivescoreFixture {
  id: number;
  name?: string;
  starting_at?: string;
  state?: { state?: string; short_name?: string };
  scores?: Array<{ score?: { goals?: number; participant?: string } }>;
  events?: Array<{
    id: number;
    type_id?: number;
    player_name?: string;
    minute?: number;
    extra_minute?: number;
    addition?: string;
    updated_at?: string;
  }>;
}

const EVENT_TYPE_MAP: Record<number, string> = {
  14: "GOAL",
  15: "OWN_GOAL",
  16: "PENALTY_GOAL",
  17: "MISSED_PENALTY",
  18: "SUBSTITUTION",
  19: "YELLOW_CARD",
  20: "RED_CARD",
  21: "YELLOW_RED_CARD",
  26: "INJURY",
};

export class SportmonksAdapter implements NewsAdapter {
  readonly name = "sportmonks" as const;
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async poll(): Promise<NewsEvent[]> {
    if (!this.token) return [];
    const url = `https://api.sportmonks.com/v3/football/livescores/inplay?include=events;state&api_token=${this.token}`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) {
      throw new Error(`Sportmonks API ${resp.status}`);
    }
    const data = (await resp.json()) as { data?: SportmonksLivescoreFixture[] };
    const events: NewsEvent[] = [];
    for (const fx of data.data ?? []) {
      for (const ev of fx.events ?? []) {
        const kind = EVENT_TYPE_MAP[ev.type_id ?? -1];
        if (!kind) continue;
        const tsRaw = ev.updated_at ?? fx.starting_at;
        const ts = tsRaw ? Math.floor(new Date(tsRaw).getTime() / 1000) : Math.floor(Date.now() / 1000);
        const minute = ev.minute != null ? `${ev.minute}'` : "";
        events.push({
          source: "sportmonks",
          source_key: `sm_${fx.id}_${ev.id}`,
          title: `[${fx.name ?? "Match"}] ${kind} ${minute} ${ev.player_name ?? ""}`.trim(),
          body: ev.addition ?? undefined,
          published_at: ts,
          lang: "en",
          category: "sports",
        });
      }
    }
    return events;
  }
}
