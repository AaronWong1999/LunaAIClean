/**
 * SimHash-based dedup for news titles.
 * Two titles with SimHash hamming distance ≤ 3 within a 10-minute window
 * are considered duplicates.
 */

const HASH_BITS = 64;
const HAMMING_THRESHOLD = 3;
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/** Simple string hash (FNV-1a 32-bit) used as token hash for SimHash */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

/** Tokenize: lowercase, split on non-alphanumeric, filter short tokens */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((t) => t.length > 1);
}

/**
 * Compute a SimHash fingerprint (as two 32-bit numbers packed into bigint
 * would be ideal, but CF Workers support BigInt — we use a number[] of
 * bit-counts then collapse to a 32-bit hash for practical use).
 *
 * For MVP we use 32-bit SimHash which is sufficient for near-dup detection
 * within a 10-minute window.
 */
export function simHash32(text: string): number {
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0;
  const counts = new Int32Array(32);
  for (const token of tokens) {
    const h = fnv1a(token);
    for (let i = 0; i < 32; i++) {
      counts[i] += (h >> i) & 1 ? 1 : -1;
    }
  }
  let hash = 0;
  for (let i = 0; i < 32; i++) {
    if (counts[i] > 0) hash |= 1 << i;
  }
  return hash >>> 0;
}

/** Hamming distance between two 32-bit integers */
export function hammingDistance(a: number, b: number): number {
  let xor = (a ^ b) >>> 0;
  let dist = 0;
  while (xor) {
    dist += xor & 1;
    xor >>>= 1;
  }
  return dist;
}

interface DedupEntry {
  hash: number;
  timestamp: number;
}

/**
 * In-memory sliding-window dedup cache.
 * Keeps hashes for the last 10 minutes and checks new titles
 * against them using SimHash hamming distance.
 */
export class DedupCache {
  private entries: DedupEntry[] = [];

  /** Evict entries older than 10 minutes */
  private prune(now: number): void {
    const cutoff = now - DEDUP_WINDOW_MS;
    this.entries = this.entries.filter((e) => e.timestamp >= cutoff);
  }

  /**
   * Returns true if the title is a near-duplicate of something
   * seen in the last 10 minutes. If not a duplicate, records it.
   */
  isDuplicate(title: string, timestampMs: number): boolean {
    this.prune(timestampMs);
    const hash = simHash32(title);
    for (const entry of this.entries) {
      if (hammingDistance(hash, entry.hash) <= HAMMING_THRESHOLD) {
        return true;
      }
    }
    this.entries.push({ hash, timestamp: timestampMs });
    return false;
  }

  get size(): number {
    return this.entries.length;
  }
}
