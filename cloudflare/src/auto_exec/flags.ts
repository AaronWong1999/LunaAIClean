/**
 * System-wide kill switch and rate caps, stored in D1.system_flags so admin
 * can flip without a redeploy. Caller decides whether to honour.
 */

export interface SystemFlags {
  autoExecPaused: boolean;
  maxPerUserPerHour: number;
  maxGlobalPerHour: number;
}

export async function readSystemFlags(db: D1Database): Promise<SystemFlags> {
  const rows = await db
    .prepare(`SELECT key, value FROM system_flags WHERE key IN (?, ?, ?)`)
    .bind("auto_exec_paused", "max_auto_trades_per_hour_per_user", "max_auto_trades_per_hour_global")
    .all<{ key: string; value: string }>();
  const map = new Map((rows.results ?? []).map((r) => [r.key, r.value]));
  return {
    autoExecPaused: (map.get("auto_exec_paused") ?? "false").toLowerCase() === "true",
    maxPerUserPerHour: intOr(map.get("max_auto_trades_per_hour_per_user"), 5),
    maxGlobalPerHour: intOr(map.get("max_auto_trades_per_hour_global"), 50),
  };
}

export async function setSystemFlag(db: D1Database, key: string, value: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO system_flags (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, now)
    .run();
}

export interface RateCheckResult {
  allowed: boolean;
  reason?: "paused" | "user_cap" | "global_cap";
  userCount: number;
  globalCount: number;
  flags: SystemFlags;
}

export async function checkRateLimits(
  db: D1Database,
  telegramUserId: string,
): Promise<RateCheckResult> {
  const flags = await readSystemFlags(db);
  if (flags.autoExecPaused) {
    return { allowed: false, reason: "paused", userCount: 0, globalCount: 0, flags };
  }

  const windowStart = Math.floor(Date.now() / 1000) - 3600;

  const userRow = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM auto_exec_events
         WHERE telegram_user_id = ? AND status = 'placed' AND ts >= ?`,
    )
    .bind(telegramUserId, windowStart)
    .first<{ c: number }>();
  const userCount = userRow?.c ?? 0;
  if (userCount >= flags.maxPerUserPerHour) {
    return { allowed: false, reason: "user_cap", userCount, globalCount: 0, flags };
  }

  const globalRow = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM auto_exec_events
         WHERE status = 'placed' AND ts >= ?`,
    )
    .bind(windowStart)
    .first<{ c: number }>();
  const globalCount = globalRow?.c ?? 0;
  if (globalCount >= flags.maxGlobalPerHour) {
    return { allowed: false, reason: "global_cap", userCount, globalCount, flags };
  }

  return { allowed: true, userCount, globalCount, flags };
}

function intOr(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}
