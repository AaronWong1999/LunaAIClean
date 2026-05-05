export type AutoFollowMode = "dual_signal" | "wallet_mirror";

export interface AutoFollowRule {
  id: number;
  telegramUserId: string;
  mode: AutoFollowMode;
  enabled: boolean;
  categories: string[];           // dual_signal only
  minSmartWallets: number;        // dual_signal only
  minNetBuyUsdc: number;          // dual_signal only
  minConfidence: number;          // dual_signal only
  trackedWallets: string[];       // wallet_mirror only
  tradeAmountUsdc: number;
  maxTradesPerHour: number;
}

export interface NewsTriggerRow {
  id: number;
  title: string;
  market_slug: string | null;
  selected_outcome: string | null;
  confidence: number | null;
  dual_signal: number;
  published_at: number;
  category: string;
  status: string;
}

export interface SmartMoneyFillRow {
  id: number;
  wallet: string;
  market_slug: string;
  side: string;
  amount_usdc: number;
  ts: number;
  tx_hash: string | null;
}

export type AutoExecStatus =
  | "dry_run"
  | "placed"
  | "failed"
  | "blocked_rate"
  | "blocked_pause";

export interface AutoExecAttempt {
  telegramUserId: string;
  ruleId: number;
  source: "news_trigger" | "wallet_mirror";
  sourceRef: string;
  marketSlug: string;
  outcome: string;
  tradeAmountUsdc: number;
  status: AutoExecStatus;
  error?: string;
}
