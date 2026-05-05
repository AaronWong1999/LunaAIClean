/**
 * Tree of Alpha WebSocket adapter.
 * Connects to wss://news.treeofalpha.com/ws and receives real-time crypto news.
 * Designed to run inside a Durable Object for persistent WebSocket connection.
 */
import type { NewsEvent, NewsAdapter } from "./types";

const WS_URL = "wss://news.treeofalpha.com/ws";
const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 60_000;

interface TreeOfAlphaMessage {
  _id?: string;
  title?: string;
  body?: string;
  time?: number; // Unix ms
  source?: string;
  url?: string;
  symbols?: string[];
  en?: string;
  suggestions?: Array<{ action: string }>;
}

/**
 * Non-blocking adapter: accumulates events from WS into a buffer.
 * `poll()` drains the buffer. The caller (DO alarm) invokes poll() periodically.
 */
export class TreeOfAlphaAdapter implements NewsAdapter {
  readonly name = "treeofalpha" as const;
  private buffer: NewsEvent[] = [];
  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private apiKey: string;
  private _connected = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Connect (or reconnect) the WebSocket. Call once from DO constructor/alarm. */
  async connect(): Promise<void> {
    if (this.ws) return;
    try {
      const resp = await fetch(WS_URL, {
        headers: {
          Upgrade: "websocket",
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      const ws = resp.webSocket;
      if (!ws) {
        throw new Error("WebSocket upgrade failed — no webSocket on response");
      }
      ws.accept();
      this.ws = ws;
      this._connected = true;
      this.reconnectDelay = RECONNECT_DELAY_MS;

      ws.addEventListener("message", (event) => {
        try {
          const data: TreeOfAlphaMessage =
            typeof event.data === "string" ? JSON.parse(event.data) : {};
          if (!data.title && !data.en) return; // heartbeat or irrelevant
          this.buffer.push({
            source: "treeofalpha",
            source_key: `toa_${data._id ?? data.time ?? Date.now()}`,
            title: data.title ?? data.en ?? "",
            body: data.body,
            published_at: data.time ? Math.floor(data.time / 1000) : Math.floor(Date.now() / 1000),
            lang: "en",
            category: "crypto",
          });
        } catch {
          // Skip malformed messages
        }
      });

      ws.addEventListener("close", () => {
        this._connected = false;
        this.ws = null;
      });

      ws.addEventListener("error", () => {
        this._connected = false;
        try { ws.close(); } catch {}
        this.ws = null;
      });
    } catch {
      this._connected = false;
      this.ws = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    }
  }

  /** Drain buffered events. Non-blocking. */
  async poll(): Promise<NewsEvent[]> {
    const events = this.buffer.splice(0);
    return events;
  }

  close(): void {
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this._connected = false;
  }
}
