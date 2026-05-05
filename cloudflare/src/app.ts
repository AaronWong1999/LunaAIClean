import { DurableObject } from "cloudflare:workers";
import { getTopRuntimeSignals, getTopRuntimeWallets, getUser, getUserMonetizationSummary, getUserWalletState, listTopReferrers, listTradeEvents } from "./db";
import { renderCreatorDirectoryPage, renderCreatorProfile, renderCreatorSpotlightPage, renderDiscoverPage, renderLandingPage } from "./render";

interface AppEnv {
  DB: D1Database;
  EXEC_SERVICE: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  APP_ENV: string;
  LUNA_VERSION: string;
  LUNA_SITE_URL: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  INTERNAL_ADMIN_SECRET?: string;
}

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const INTERNAL_WEBHOOK_VERIFIED_HEADER = "x-luna-telegram-webhook-verified";

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({
        ok: true,
        env: env.APP_ENV,
        version: env.LUNA_VERSION,
        layer: "app-global",
      });
    }

    if (request.method === "GET" && url.pathname === "/version") {
      return json({
        version: env.LUNA_VERSION,
        site: env.LUNA_SITE_URL,
        layer: "app-global",
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(renderLandingPage(env.LUNA_VERSION), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60",
        },
      });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/creators") {
      if (request.method === "HEAD") {
        return new Response(null, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        });
      }
      const creators = await listTopReferrers(env.DB, { limit: 24 });
      return new Response(
        renderCreatorDirectoryPage(
          creators.map((row) => ({
            displayName: row.username ? `@${row.username}` : row.first_name ?? `User ${row.telegram_user_id.slice(-4)}`,
            telegramUserId: row.telegram_user_id,
            referralCount: Number(row.referral_count),
            referralEarnedUsdc: Number(row.referral_earned_usdc),
            tradeCount: Number(row.trade_count),
            grossAmountUsdc: Number(row.gross_amount_usdc),
          })),
        ),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        },
      );
    }

    const creatorMatch = url.pathname.match(/^\/creator\/([^/]+)$/);
    if ((request.method === "GET" || request.method === "HEAD") && creatorMatch) {
      const telegramUserId = creatorMatch[1];
      if (request.method === "HEAD") {
        const profileUser = await getUser(env.DB, telegramUserId);
        return profileUser
          ? new Response(null, {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "public, max-age=60",
              },
            })
          : new Response("Not found", { status: 404 });
      }
      const [profileUser, summary, trades, walletState] = await Promise.all([
        getUser(env.DB, telegramUserId),
        getUserMonetizationSummary(env.DB, telegramUserId),
        listTradeEvents(env.DB, { telegramUserId, limit: 10 }),
        getUserWalletState(env.DB, telegramUserId),
      ]);
      if (!profileUser) {
        return new Response("Not found", { status: 404 });
      }
      const displayName = profileUser.username ? `@${profileUser.username}` : profileUser.first_name ?? `User ${telegramUserId}`;
      return new Response(
        renderCreatorSpotlightPage({
          displayName,
          telegramUserId,
          referralCount: summary.referralCount,
          referralEarnedUsdc: summary.referralEarnedUsdc,
          tradeCount: summary.tradeCount,
          grossAmountUsdc: summary.grossAmountUsdc,
          liveBalanceUsdc: Number(walletState?.last_balance_usdc ?? 0),
          livePositionsCount: Number(walletState?.last_positions_count ?? 0),
          snapshotLabel: walletState?.updated_at ? `Cached snapshot · ${walletState.updated_at}` : undefined,
          recentTrades: trades.map((trade) => ({
            title: trade.title ?? "Untitled trade",
            amount: trade.amount_usdc,
            eventType: trade.event_type,
          })),
        }),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        },
      );
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/discover") {
      if (request.method === "HEAD") {
        return new Response(null, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        });
      }
      const [topSignals, sportsSignals, wallets] = await Promise.all([
        getTopRuntimeSignals(env.DB, { sports: 0, limit: 6 }),
        getTopRuntimeSignals(env.DB, { sports: 1, limit: 6 }),
        getTopRuntimeWallets(env.DB, 6),
      ]);
      return new Response(
        renderDiscoverPage({
          topSignals: topSignals.map((signal) => ({
            title: signal.title_en ?? signal.title_zh ?? signal.slug,
            score: signal.score,
            action: signal.action_en ?? signal.action_zh ?? null,
            expiry: signal.expiry_en ?? signal.expiry_zh ?? null,
          })),
          sportsSignals: sportsSignals.map((signal) => ({
            title: signal.title_en ?? signal.title_zh ?? signal.slug,
            score: signal.score,
            action: signal.action_en ?? signal.action_zh ?? null,
            expiry: signal.expiry_en ?? signal.expiry_zh ?? null,
          })),
          wallets: wallets.map((wallet) => ({
            name: wallet.name,
            score: wallet.score,
            specialty: wallet.specialty_en ?? wallet.specialty_zh ?? null,
          })),
        }),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        },
      );
    }

    const shareMatch = url.pathname.match(/^\/share\/([^/]+)$/);
    if ((request.method === "GET" || request.method === "HEAD") && shareMatch) {
      const telegramUserId = shareMatch[1];
      const [profileUser, summary, trades, walletState] = await Promise.all([
        getUser(env.DB, telegramUserId),
        request.method === "HEAD" ? Promise.resolve(null) : getUserMonetizationSummary(env.DB, telegramUserId),
        request.method === "HEAD" ? Promise.resolve([]) : listTradeEvents(env.DB, { telegramUserId, limit: 10 }),
        request.method === "HEAD" ? Promise.resolve(null) : getUserWalletState(env.DB, telegramUserId),
      ]);
      if (!profileUser) {
        return new Response("Not found", { status: 404 });
      }
      if (request.method === "HEAD") {
        return new Response(null, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        });
      }
      const displayName = profileUser.username ? `@${profileUser.username}` : profileUser.first_name ?? `User ${telegramUserId}`;
      const snapshotLabel = walletState?.updated_at ? `Cached snapshot · ${walletState.updated_at}` : undefined;
      const subtitle = snapshotLabel
        ? `Follow public receipts, not vibes. ${summary.tradeCount} public receipts, $${summary.grossAmountUsdc.toFixed(2)} gross traded, $${summary.platformFeeUsdc.toFixed(2)} fees paid. ${snapshotLabel}.`
        : `Follow public receipts, not vibes. ${summary.tradeCount} public receipts, $${summary.grossAmountUsdc.toFixed(2)} gross traded, $${summary.platformFeeUsdc.toFixed(2)} fees paid.`;
      return new Response(
        renderCreatorProfile({
          displayName,
          subtitle,
          inviteLink: `https://t.me/GetLunaAIBot?start=ref_${encodeURIComponent(telegramUserId)}`,
          receiptsCount: summary.tradeCount,
          grossAmountUsdc: summary.grossAmountUsdc,
          feeAmountUsdc: summary.platformFeeUsdc,
          referralCount: summary.referralCount,
          referralEarnedUsdc: summary.referralEarnedUsdc,
          liveBalanceUsdc: Number(walletState?.last_balance_usdc ?? 0),
          livePositionsCount: Number(walletState?.last_positions_count ?? 0),
          livePositionValueUsdc: 0,
          liveUnrealizedPnlUsdc: 0,
          recentTrades: trades.map((trade) => ({
            title: trade.title ?? "Untitled trade",
            amount: trade.amount_usdc,
            eventType: trade.event_type,
          })),
        }),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        },
      );
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const secret = request.headers.get(TELEGRAM_SECRET_HEADER);
        if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
          return json({ error: "Unauthorized" }, 401);
        }
      }
      return proxyToExec(request, env, { telegramWebhookVerified: true });
    }

    return proxyToExec(request, env);
  },

  async queue(batch: MessageBatch<{
    chatId: string;
    botId?: string;
    request: {
      text: string;
      inlineKeyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
    };
  }>, env: AppEnv): Promise<void> {
    for (const message of batch.messages) {
      try {
        const response = await env.EXEC_SERVICE.fetch("https://exec.internal/internal/queue/send", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-luna-via": "app-global",
          },
          body: JSON.stringify(message.body),
        });
        if (!response.ok) {
          throw new Error(`exec_queue_forward_failed:${response.status}`);
        }
        message.ack();
      } catch {
        message.retry();
      }
    }
  },
};

export class TradeCoordinator extends DurableObject<AppEnv> {}
export class MarketStreamCoordinator extends DurableObject<AppEnv> {}
export class BotFanoutCoordinator extends DurableObject<AppEnv> {}
export class FollowEngineCoordinator extends DurableObject<AppEnv> {}

async function proxyToExec(
  request: Request,
  env: AppEnv,
  options?: { telegramWebhookVerified?: boolean },
): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, "https://exec.internal");
  const headers = new Headers(request.headers);
  headers.set("x-luna-via", "app-global");
  if (options?.telegramWebhookVerified) {
    headers.delete(TELEGRAM_SECRET_HEADER);
    if (env.INTERNAL_ADMIN_SECRET) {
      headers.set(INTERNAL_WEBHOOK_VERIFIED_HEADER, env.INTERNAL_ADMIN_SECRET);
    } else {
      headers.set(INTERNAL_WEBHOOK_VERIFIED_HEADER, "1");
    }
  }
  const forwarded = new Request(target.toString(), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
  return env.EXEC_SERVICE.fetch(forwarded);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
