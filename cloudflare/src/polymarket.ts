import { BuilderConfig } from "@polymarket/builder-signing-sdk";
import { OperationType, RelayClient, RelayerTxType, type Transaction } from "@polymarket/builder-relayer-client";
import { ClobClient, Side } from "@polymarket/clob-client";
import { deriveProxyWallet, deriveSafe } from "@polymarket/builder-relayer-client/dist/builder/derive";
import { getContractConfig } from "@polymarket/builder-relayer-client/dist/config";
import { Contract, Wallet, providers, utils } from "ethers";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import type { BridgeQuote, Env, FeePreview, LivePosition, MarketLinkPreview, RelayTransferResult, RuntimeSignal, UserTradingAccountContext, WalletStateSnapshot } from "./types";

const TELEGRAM_HOST = "https://api.telegram.org";
const POLYGON_USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
const NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function approve(address spender, uint256 value) returns (bool)",
];
const ERC1155_ABI = [
  "function setApprovalForAll(address operator, bool approved)",
];
const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

export const WITHDRAW_PRESETS = [
  {
    key: "polygon_usdc_e",
    chainLabel: "Polygon (USDC.e)",
    chainId: "137",
    tokenSymbol: "USDC.e",
    tokenAddress: POLYGON_USDC_E,
    bridgeKey: "evm",
    description: "For Polymarket internal transfers - keeps USDC.e format",
  },
  {
    key: "polygon_usdc",
    chainLabel: "Polygon",
    chainId: "137",
    tokenSymbol: "USDC",
    tokenAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    bridgeKey: "evm",
  },
  {
    key: "eth_usdc",
    chainLabel: "Ethereum",
    chainId: "1",
    tokenSymbol: "USDC",
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    bridgeKey: "evm",
  },
  {
    key: "base_usdc",
    chainLabel: "Base",
    chainId: "8453",
    tokenSymbol: "USDC",
    tokenAddress: "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913",
    bridgeKey: "evm",
  },
  {
    key: "arb_usdc",
    chainLabel: "Arbitrum",
    chainId: "42161",
    tokenSymbol: "USDC",
    tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    bridgeKey: "evm",
  },
];

export async function telegramApi(env: Env, method: string, body: unknown): Promise<Response> {
  return fetch(`${TELEGRAM_HOST}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function sendTelegramMessage(env: Env, chatId: string, text: string, inlineKeyboard?: unknown): Promise<number | null> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (inlineKeyboard) {
    payload.reply_markup = { inline_keyboard: inlineKeyboard };
  }
  const response = await telegramApi(env, "sendMessage", payload);
  const json = await response.json<any>().catch(() => null);
  return Number(json?.result?.message_id ?? 0) || null;
}

export async function sendTelegramReplyKeyboardMessage(
  env: Env,
  chatId: string,
  text: string,
  keyboard: string[][],
): Promise<number | null> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: keyboard.map((row) => row.map((label) => ({ text: label }))),
      resize_keyboard: true,
      one_time_keyboard: false,
      is_persistent: false,
      input_field_placeholder: "Tap a menu item or type a command",
    },
  };
  const response = await telegramApi(env, "sendMessage", payload);
  const json = await response.json<any>().catch(() => null);
  return Number(json?.result?.message_id ?? 0) || null;
}

export async function editTelegramMessage(env: Env, chatId: string, messageId: number, text: string, inlineKeyboard?: unknown): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };
  if (inlineKeyboard) {
    payload.reply_markup = { inline_keyboard: inlineKeyboard };
  }
  await telegramApi(env, "editMessageText", payload);
}

export async function answerCallbackQuery(env: Env, callbackQueryId: string): Promise<void> {
  await telegramApi(env, "answerCallbackQuery", { callback_query_id: callbackQueryId });
}

export async function fetchBridgeAddresses(env: Env, account: UserTradingAccountContext): Promise<Record<string, string>> {
  const address = account.account.funder_address || account.account.signer_address;
  if (!address) {
    throw new Error("Linked account is missing a funder address");
  }
  const response = await fetch(`${env.POLYMARKET_BRIDGE_HOST}/deposit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!response.ok) {
    throw new Error(`Bridge API failed: ${response.status}`);
  }
  const payload = await response.json<{ address?: Record<string, string> }>();
  return payload.address ?? {};
}

export async function fetchWithdrawQuote(
  env: Env,
  payload: {
    amountUsdc: number;
    destinationChainId: string;
    destinationTokenAddress: string;
    recipientAddress: string;
  },
): Promise<BridgeQuote> {
  const response = await fetch(`${env.POLYMARKET_BRIDGE_HOST}/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fromAmountBaseUnit: toUsdcBaseUnits(payload.amountUsdc),
      fromChainId: "137",
      fromTokenAddress: POLYGON_USDC_E,
      recipientAddress: payload.recipientAddress,
      toChainId: payload.destinationChainId,
      toTokenAddress: payload.destinationTokenAddress,
    }),
  });
  if (!response.ok) {
    throw new Error(`Bridge quote failed: ${response.status}`);
  }
  const result = await response.json<Record<string, unknown>>();
  return {
    quoteId: typeof result.quoteId === "string" ? result.quoteId : undefined,
    estCheckoutTimeMs: Number(result.estCheckoutTimeMs ?? result.estimatedTimeMs ?? 0) || undefined,
    estInputUsd: Number(result.estInputUsd ?? result.inputUsd ?? 0) || undefined,
    estOutputUsd: Number(result.estOutputUsd ?? result.outputUsd ?? 0) || undefined,
    estToTokenBaseUnit: typeof result.estToTokenBaseUnit === "string" ? result.estToTokenBaseUnit : undefined,
    estFeeBreakdown: result.estFeeBreakdown && typeof result.estFeeBreakdown === "object" ? (result.estFeeBreakdown as Record<string, unknown>) : undefined,
  };
}

export async function createWithdrawalAddresses(
  env: Env,
  account: UserTradingAccountContext,
  payload: {
    destinationChainId: string;
    destinationTokenAddress: string;
    recipientAddress: string;
  },
): Promise<Record<string, string>> {
  const address = account.account.funder_address || account.account.signer_address;
  if (!address) {
    throw new Error("Linked account is missing a funder address");
  }
  const response = await fetch(`${env.POLYMARKET_BRIDGE_HOST}/withdraw`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address,
      toChainId: payload.destinationChainId,
      toTokenAddress: payload.destinationTokenAddress,
      recipientAddr: payload.recipientAddress,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bridge withdrawal address creation failed: ${response.status} ${body}`.trim());
  }
  const result = await response.json<{ address?: Record<string, string> }>();
  return result.address ?? {};
}

export async function getBridgeTransactionStatus(env: Env, address: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${env.POLYMARKET_BRIDGE_HOST}/status/${encodeURIComponent(address)}`);
  if (!response.ok) {
    throw new Error(`Bridge status failed: ${response.status}`);
  }
  return response.json<Record<string, unknown>>();
}

export async function fetchLiveWalletState(env: Env, account: UserTradingAccountContext): Promise<{ snapshot: WalletStateSnapshot; positions: LivePosition[] }> {
  const address = account.account.funder_address || account.account.signer_address;
  if (!address) {
    throw new Error("Linked account is missing a tradable address");
  }
  const [balanceUsdc, openOrders, positions] = await Promise.all([
    getAvailableBalance(env, account),
    getOpenOrdersCount(env, account, address),
    getCurrentPositions(env, address),
  ]);

  return {
    snapshot: {
      depositAddress: address,
      balanceUsdc,
      positionsCount: positions.length,
      openOrdersCount: openOrders,
      status: account.account.status,
    },
    positions,
  };
}

export async function provisionManagedTradingAccount(env: Env, payload?: { accountLabel?: string }) {
  const signer = Wallet.createRandom();
  const contractConfig = getContractConfig(Number(env.POLYMARKET_CHAIN_ID || "137"));
  const derivedSafe = deriveSafe(
    signer.address as `0x${string}`,
    contractConfig.SafeContracts.SafeFactory as `0x${string}`,
  ).toLowerCase();
  const signatureType = "2";
  const client = new ClobClient(
    env.POLYMARKET_HOST,
    Number(env.POLYMARKET_CHAIN_ID || "137"),
    signer,
    undefined,
    Number(signatureType),
    derivedSafe,
  );
  const creds = await client.createOrDeriveApiKey();
  return {
    signerAddress: signer.address.toLowerCase(),
    funderAddress: derivedSafe,
    signatureType,
    accountLabel: payload?.accountLabel ?? "Luna Managed Wallet",
    credentials: {
      polymarketPrivateKey: signer.privateKey,
      polymarketApiKey: creds.key,
      polymarketApiSecret: creds.secret,
      polymarketApiPassphrase: creds.passphrase,
    },
  };
}

export async function copyTrade(env: Env, account: UserTradingAccountContext, signal: RuntimeSignal, amountUsdc: number) {
  if (!signal.slug || !signal.selected_outcome) {
    throw new Error("Signal is missing trade metadata");
  }
  const tokenId = await resolveTokenId(env, signal.slug, signal.selected_outcome);
  const client = createTradingClient(env, account);
  const result = await client.createMarketOrder({
    tokenID: tokenId,
    amount: amountUsdc,
    side: Side.BUY,
  });
  const posted = validateTradeResponse(await client.postOrder(result, "FOK"));
  return { tokenId, result: posted };
}

export async function copyTradeByToken(env: Env, account: UserTradingAccountContext, payload: { tokenId: string; amountUsdc: number }) {
  const client = createTradingClient(env, account);
  const result = await client.createMarketOrder({
    tokenID: payload.tokenId,
    amount: payload.amountUsdc,
    side: Side.BUY,
  });
  const posted = validateTradeResponse(await client.postOrder(result, "FOK"));
  return { tokenId: payload.tokenId, result: posted };
}

export async function copyTradeLimitOrder(
  env: Env,
  account: UserTradingAccountContext,
  payload: { tokenId: string; amountUsdc: number; limitPriceUsdc: number },
) {
  if (payload.limitPriceUsdc <= 0 || payload.limitPriceUsdc >= 1) {
    throw new Error("Limit price must be between 0 and 1 (e.g. 0.55 for 55¢)");
  }
  const client = createTradingClient(env, account);
  // Calculate shares from amount / price
  const shares = payload.amountUsdc / payload.limitPriceUsdc;
  const result = await client.createLimitOrder({
    tokenID: payload.tokenId,
    price: payload.limitPriceUsdc,
    size: shares,
    side: Side.BUY,
  });
  const posted = validateTradeResponse(await client.postOrder(result, "GTC"));
  return { tokenId: payload.tokenId, result: posted, orderType: "limit" as const };
}

export async function closePosition(env: Env, account: UserTradingAccountContext, position: LivePosition) {
  const client = createTradingClient(env, account);
  const result = await client.createMarketOrder({
    tokenID: position.asset,
    amount: position.size,
    side: Side.SELL,
  });
  const posted = validateTradeResponse(await client.postOrder(result, "FOK"));
  return { tokenId: position.asset, result: posted };
}

export async function transferUsdcToBridge(
  env: Env,
  account: UserTradingAccountContext,
  payload: {
    bridgeAddress: string;
    amountUsdc: number;
  },
): Promise<RelayTransferResult> {
  if (!account.credentials?.polymarketPrivateKey) {
    throw new Error("This wallet does not have a signer private key for withdrawals");
  }
  // Use BigNumber for all paths to avoid type mismatch in ABI encoding
  const transferAmount = utils.parseUnits(payload.amountUsdc.toFixed(6), 6);
  const amountBaseUnits = transferAmount.toString();

  // Pre-flight balance check (applies to both relayer and direct paths)
  const provider = new providers.StaticJsonRpcProvider(
    env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com",
    { chainId: 137, name: "matic" },
  );
  const signerWallet = new Wallet(account.credentials.polymarketPrivateKey, provider);
  const token = new Contract(POLYGON_USDC_E, ERC20_ABI, signerWallet);
  
  // For SAFE wallets, check balance on funder (SAFE) address; for others check signer
  const relayerShape = buildRelayerTransactionShape(account);
  const balanceCheckAddress = relayerShape.txType === RelayerTxType.SAFE && account.account.funder_address
    ? account.account.funder_address
    : signerWallet.address;
  const currentBalance = await token.balanceOf(balanceCheckAddress);
  if (currentBalance.lt(transferAmount)) {
    throw new Error("Insufficient USDC.e balance for withdrawal");
  }

  if (relayerShape.txType === RelayerTxType.PROXY) {
    const contractConfig = getContractConfig(Number(env.POLYMARKET_CHAIN_ID || "137"));
    const derivedProxyWallet = deriveProxyWallet(
      signerWallet.address as `0x${string}`,
      contractConfig.ProxyContracts.ProxyFactory as `0x${string}`,
    ).toLowerCase();
    const proxyBalance = await token.balanceOf(derivedProxyWallet);

    // Legacy regression path: early managed wallets held USDC.e directly on the signer EOA,
    // while relayer PROXY execution spends from the derived proxy wallet. In that shape,
    // relayer execution will always revert because the proxy has no collateral.
    if (proxyBalance.lt(transferAmount) && currentBalance.gte(transferAmount)) {
      const nativeBalance = await signerWallet.getBalance();
      if (nativeBalance.lte(0)) {
        throw new Error(
          "Legacy signer wallet holds USDC.e directly while the derived proxy wallet is empty. " +
          "Relayer PROXY transfers cannot move these funds. This one-time legacy migration now requires a minimal POL balance " +
          `on the signer wallet ${signerWallet.address} to execute a direct transfer.`,
        );
      }
      // Use high gas price for Polygon network (minimum 150 gwei for congested periods)
      const feeData = await provider.getFeeData();
      const minPriorityFee = utils.parseUnits("150", "gwei");
      const minMaxFee = utils.parseUnits("300", "gwei");
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas?.gt(minPriorityFee)
        ? feeData.maxPriorityFeePerGas
        : minPriorityFee;
      const maxFeePerGas = feeData.maxFeePerGas?.gt(minMaxFee)
        ? feeData.maxFeePerGas
        : minMaxFee;
      const tx = await token.transfer(payload.bridgeAddress, transferAmount, {
        maxPriorityFeePerGas,
        maxFeePerGas,
      });
      return {
        txHash: tx.hash,
        transactionId: null,
        transactionState: "STATE_SUBMITTED",
        amountBaseUnits,
      };
    }
  }

  if (getBuilderStatus(env).enabled) {
    const { txType } = relayerShape;
    const client = createRelayClient(env, account);
    const erc20 = new utils.Interface(ERC20_ABI);
    let response: Awaited<ReturnType<RelayClient["execute"]>> | null = null;
    try {
      response = await client.execute(
        [
          {
            to: POLYGON_USDC_E,
            // Pass BigNumber (not string) to encodeFunctionData so the ABI encoder
            // correctly packs the uint256 amount into the calldata.
            data: erc20.encodeFunctionData("transfer", [payload.bridgeAddress, transferAmount]),
            value: "0",
            operation: OperationType.Call,
          },
        ],
        "Bridge withdrawal transfer for Luna user",
      );
      const result = await response.wait();
      return {
        txHash: result?.transactionHash || response.transactionHash || null,
        transactionId: result?.transactionID ?? response.transactionID ?? null,
        transactionState: result?.state ?? response.state ?? null,
        amountBaseUnits,
      };
    } catch (error) {
      const errorPayload = {
        message: error instanceof Error ? error.message : String(error ?? "Unknown relayer error"),
        txType,
        responseState: response?.state ?? null,
        transactionId: response?.transactionID ?? null,
        transactionHash: response?.transactionHash ?? null,
      };
      throw new Error(`Relayer bridge withdrawal failed: ${JSON.stringify(errorPayload)}`);
    }
  } else {
    // Direct signer transfer (non-relayer fallback)
    const tx = await token.transfer(payload.bridgeAddress, transferAmount);
    return {
      txHash: tx.hash,
      transactionId: null,
      transactionState: null,
      amountBaseUnits,
    };
  }
}

export async function getRelayerTransaction(env: Env, account: UserTradingAccountContext, transactionId: string) {
  const client = createRelayClient(env, account);
  const rows = await client.getTransaction(transactionId);
  return rows[0];
}

export async function getPolygonTransactionReceipt(env: Env, txHash: string): Promise<{ status?: string | null } | null> {
  const response = await fetch(env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getTransactionReceipt",
      params: [txHash],
      id: 1,
    }),
  });
  if (!response.ok) {
    throw new Error(`Polygon receipt lookup failed with status ${response.status}`);
  }
  const payload = await response.json<{ result?: { status?: string | null } | null }>();
  return payload.result ?? null;
}

export function buildRelayerTransactionShape(account: UserTradingAccountContext): { txType: RelayerTxType; safeDeployed: boolean } {
  const txType = account.account.relayer_tx_type === RelayerTxType.PROXY ? RelayerTxType.PROXY : RelayerTxType.SAFE;
  return {
    txType,
    safeDeployed: account.account.safe_deployed === 1,
  };
}

export async function deployTradingSafe(env: Env, account: UserTradingAccountContext): Promise<{
  txType: RelayerTxType;
  transactionId: string;
  transactionHash?: string;
  proxyAddress?: string;
  state?: string;
}> {
  if (!account.credentials?.polymarketPrivateKey) {
    throw new Error("Trading account is missing a signer private key for Safe deployment");
  }
  const { txType } = buildRelayerTransactionShape(account);
  if (txType !== RelayerTxType.SAFE) {
    throw new Error("Safe deployment only applies to SAFE relayer accounts");
  }
  const client = createRelayClient(env, account);
  const response = await client.deploy();
  const result = await response.wait();
  return {
    txType,
    transactionId: response.transactionID,
    transactionHash: result?.transactionHash ?? response.transactionHash,
    proxyAddress: result?.proxyAddress,
    state: result?.state ?? response.state,
  };
}

export async function executeTradingApprovals(env: Env, account: UserTradingAccountContext): Promise<{
  txType: RelayerTxType;
  transactionId: string;
  transactionHash?: string;
  state?: string;
  approvals: {
    usdcSpenders: string[];
    outcomeTokenSpenders: string[];
  };
}> {
  if (!account.credentials?.polymarketPrivateKey) {
    throw new Error("Trading account is missing a signer private key for relayer approvals");
  }
  const { txType } = buildRelayerTransactionShape(account);
  const client = createRelayClient(env, account);
  const txs = createAllApprovalTransactions();
  const response = await client.execute(txs, "Set Luna trading approvals");
  const result = await response.wait();
  return {
    txType,
    transactionId: response.transactionID,
    transactionHash: result?.transactionHash ?? response.transactionHash,
    state: result?.state ?? response.state,
    approvals: {
      usdcSpenders: [CTF_CONTRACT, NEG_RISK_ADAPTER, CTF_EXCHANGE, NEG_RISK_CTF_EXCHANGE],
      outcomeTokenSpenders: [CTF_EXCHANGE, NEG_RISK_CTF_EXCHANGE, NEG_RISK_ADAPTER],
    },
  };
}

export async function collectIntegratorFee(
  env: Env,
  account: UserTradingAccountContext,
  payload: {
    amountUsdc: number;
    destinationWallet: string;
    note?: string;
  },
): Promise<{
  txType: RelayerTxType;
  transactionId: string;
  transactionHash?: string;
  state?: string;
  amountBaseUnits: string;
  destinationWallet: string;
}> {
  if (!account.credentials?.polymarketPrivateKey) {
    throw new Error("Trading account is missing a signer private key for fee collection");
  }
  if (!payload.destinationWallet?.trim()) {
    throw new Error("Integrator fee destination wallet is required");
  }
  if (!(payload.amountUsdc > 0)) {
    throw new Error("Integrator fee amount must be greater than zero");
  }
  const { txType } = buildRelayerTransactionShape(account);
  const client = createRelayClient(env, account);
  const transferAmount = utils.parseUnits(payload.amountUsdc.toFixed(6), 6);
  const amountBaseUnits = transferAmount.toString();
  const erc20 = new utils.Interface(ERC20_ABI);
  const response = await client.execute(
    [
      {
        to: POLYGON_USDC_E,
        data: erc20.encodeFunctionData("transfer", [payload.destinationWallet, transferAmount]),
        value: "0",
        operation: OperationType.Call,
      },
    ],
    payload.note ?? "Collect Luna integrator fee",
  );
  const result = await response.wait();
  return {
    txType,
    transactionId: response.transactionID,
    transactionHash: result?.transactionHash ?? response.transactionHash,
    state: result?.state ?? response.state,
    amountBaseUnits,
    destinationWallet: payload.destinationWallet,
  };
}

export async function fetchMarketSettlement(env: Env, slug: string): Promise<{
  marketSlug: string;
  resolved: boolean;
  winningOutcome: string | null;
  resolvedAt: string | null;
  conditionId: string | null;
  outcomes: string[];
  negRisk: boolean;
  detail: Record<string, unknown>;
}> {
  const response = await fetch(`${env.POLYMARKET_GAMMA_HOST}/markets?slug=${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Gamma lookup failed: ${response.status}`);
  }
  const markets = await response.json<Array<Record<string, unknown>>>();
  const market = markets[0];
  if (!market) {
    return { marketSlug: slug, resolved: false, winningOutcome: null, resolvedAt: null, conditionId: null, outcomes: [], negRisk: false, detail: {} };
  }
  const resolved = Boolean(market.resolved ?? market.closed ?? false) || typeof market.winningOutcome === "string";
  const outcomes = parseMaybeJsonArray(market.outcomes).map(String);
  let winningOutcome = typeof market.winningOutcome === "string" ? market.winningOutcome : null;
  if (!winningOutcome && Array.isArray(market.tokens)) {
    const winner = (market.tokens as Array<Record<string, unknown>>).find((token) => token.winner === true);
    if (winner && typeof winner.outcome === "string") {
      winningOutcome = winner.outcome;
    }
  }
  if (!winningOutcome && resolved && outcomes.length === 2) {
    const prices = parseMaybeJsonArray(market.outcomePrices).map((item) => Number(item));
    const winningIndex = prices.findIndex((price) => price >= 0.99);
    if (winningIndex >= 0 && outcomes[winningIndex]) {
      winningOutcome = outcomes[winningIndex];
    }
  }
  return {
    marketSlug: slug,
    resolved,
    winningOutcome,
    resolvedAt: typeof market.endDate === "string" ? market.endDate : typeof market.updatedAt === "string" ? market.updatedAt : null,
    conditionId: typeof market.conditionId === "string" ? market.conditionId : null,
    outcomes,
    negRisk: Boolean(market.negRisk),
    detail: market,
  };
}

export async function fetchMarketLinkPreview(env: Env, slug: string, preferredOutcome?: string | null): Promise<MarketLinkPreview> {
  const market = await fetchGammaMarket(env, slug);
  const outcomes = parseMaybeJsonArray(market.outcomes).map(String);
  const outcomePrices = parseMaybeJsonArray(market.outcomePrices).map((item) => Number(item));
  const tokenIds = parseMaybeJsonArray(market.clobTokenIds ?? market.clobTokenids).map(String);
  const selectedOutcome = preferredOutcome && outcomes.includes(preferredOutcome)
    ? preferredOutcome
    : outcomes[0] ?? null;
  const selectedIndex = selectedOutcome ? outcomes.indexOf(selectedOutcome) : -1;
  const yesIndex = outcomes.findIndex((item) => item.toLowerCase() === "yes");
  const noIndex = outcomes.findIndex((item) => item.toLowerCase() === "no");
  const bestBid = Number(market.bestBid ?? market.best_bid ?? outcomePrices[selectedIndex >= 0 ? selectedIndex : 0] ?? 0) || null;
  const bestAsk = Number(market.bestAsk ?? market.best_ask ?? outcomePrices[selectedIndex >= 0 ? selectedIndex : 0] ?? 0) || null;
  return {
    slug,
    title: String(market.question ?? market.title ?? slug),
    titleZh: null,
    question: String(market.question ?? market.title ?? slug),
    marketUrl: String(market.url ?? market.marketUrl ?? `https://polymarket.com/event/${slug}`),
    conditionId: typeof market.conditionId === "string" ? String(market.conditionId) : null,
    outcomes,
    tokenIds,
    selectedOutcome,
    tokenId: selectedIndex >= 0 ? tokenIds[selectedIndex] ?? null : null,
    yesPrice: yesIndex >= 0 ? outcomePrices[yesIndex] ?? null : null,
    noPrice: noIndex >= 0 ? outcomePrices[noIndex] ?? null : null,
    bestBid,
    bestAsk,
    liquidityClob: Number(market.liquidityClob ?? market.liquidityNum ?? market.liquidity ?? 0) || null,
    volume24hr: Number(market.volume24hr ?? market.volume24hrClob ?? market.volume ?? 0) || null,
    endDate: typeof market.endDate === "string" ? market.endDate : null,
    source: "rest",
    cached: false,
    stale: false,
    lastUpdatedAt: new Date().toISOString(),
    cachedAt: new Date().toISOString(),
  };
}

export async function redeemWinningPositions(
  env: Env,
  account: UserTradingAccountContext,
  settlements: Array<{
    tradeEventId: number;
    marketSlug: string;
    selectedOutcome: string | null;
  }>,
): Promise<{
  txType: RelayerTxType;
  transactionId: string;
  transactionHash?: string;
  state?: string;
  attempted: number;
}> {
  if (!account.credentials?.polymarketPrivateKey) {
    throw new Error("Trading account is missing a signer private key for redemption");
  }
  const client = createRelayClient(env, account);
  const ctf = new utils.Interface([
    "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)",
  ]);
  const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const txs: Transaction[] = [];

  for (const settlement of settlements) {
    const market = await fetchMarketSettlement(env, settlement.marketSlug);
    if (!market.resolved || !market.winningOutcome || !market.conditionId || market.negRisk || !settlement.selectedOutcome) {
      continue;
    }
    const outcomeIndex = market.outcomes.findIndex(
      (outcome) => outcome.toLowerCase() === settlement.selectedOutcome!.toLowerCase(),
    );
    if (outcomeIndex < 0) continue;
    const indexSet = (1n << BigInt(outcomeIndex)).toString();
    txs.push({
      to: CTF_CONTRACT,
      data: ctf.encodeFunctionData("redeemPositions", [POLYGON_USDC_E, zeroBytes32, market.conditionId, [indexSet]]),
      value: "0",
      operation: OperationType.Call,
    });
  }

  if (!txs.length) {
    throw new Error("No redeemable non-negative-risk winning positions were eligible for redemption");
  }

  const { txType } = buildRelayerTransactionShape(account);
  const response = await client.execute(txs, "Redeem winning Luna positions");
  const result = await response.wait();
  return {
    txType,
    transactionId: response.transactionID,
    transactionHash: result?.transactionHash ?? response.transactionHash,
    state: result?.state ?? response.state,
    attempted: txs.length,
  };
}

export function buildFeePreview(env: Env, tradeAmountUsdc: number): FeePreview {
  // Fee is calculated ON TOP of trade amount, not deducted from it
  // User selects $1 -> trades $1 -> pays $0.01 fee -> total cost $1.01
  const feeBps = getPlatformFeeBps(env);
  const tradeAmount = normalizeUsd(tradeAmountUsdc);
  const platformFeeUsdc = normalizeUsd(tradeAmount * (feeBps / 10_000));
  const grossAmountUsdc = normalizeUsd(tradeAmount + platformFeeUsdc); // Total cost to user
  return {
    grossAmountUsdc,           // Total deducted from user balance (trade + fee)
    platformFeeUsdc,           // Fee collected by Luna
    netTradeAmountUsdc: tradeAmount, // Actual trade amount sent to Polymarket
    feeBps,
    feeWallet: env.LUNA_PLATFORM_FEE_WALLET,
  };
}

export function getBuilderStatus(env: Env): { enabled: boolean; keyHint?: string } {
  const key = env.POLYMARKET_BUILDER_API_KEY?.trim();
  if (!key || !env.POLYMARKET_BUILDER_API_SECRET?.trim() || !env.POLYMARKET_BUILDER_API_PASSPHRASE?.trim()) {
    return { enabled: false };
  }
  return {
    enabled: true,
    keyHint: `${key.slice(0, 6)}...${key.slice(-4)}`,
  };
}

export async function resolveTokenId(env: Env, slug: string, selectedOutcome: string): Promise<string> {
  const market = await fetchGammaMarket(env, slug);
  const outcomes = parseMaybeJsonArray(market.outcomes);
  const tokenIds = parseMaybeJsonArray(market.clobTokenIds ?? market.clobTokenids);
  const index = outcomes.indexOf(selectedOutcome);
  if (index < 0 || index >= tokenIds.length) {
    throw new Error(`Token id not found for ${slug}/${selectedOutcome}`);
  }
  return String(tokenIds[index]);
}

async function getCurrentPositions(env: Env, address: string): Promise<LivePosition[]> {
  const response = await fetch(`${env.POLYMARKET_DATA_HOST}/positions?user=${encodeURIComponent(address)}&size=50`);
  if (!response.ok) {
    throw new Error(`Positions API failed: ${response.status}`);
  }
  const payload = await response.json<Record<string, unknown> | Array<Record<string, unknown>>>();
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? (payload.data as Array<Record<string, unknown>>)
      : [];
  return rows.map((item) => ({
    asset: String(item.asset ?? ""),
    title: String(item.title ?? item.question ?? "Unknown market"),
    outcome: String(item.outcome ?? item.side ?? ""),
    size: Number(item.size ?? item.quantity ?? 0),
    avgPrice: Number(item.avgPrice ?? item.avg_price ?? 0),
    curPrice: Number(item.curPrice ?? item.currentPrice ?? item.current_price ?? 0),
    cashPnl: Number(item.cashPnl ?? item.cash_pnl ?? 0),
    percentPnl: Number(item.percentPnl ?? item.percent_pnl ?? 0),
    slug: String(item.slug ?? item.market_slug ?? ""),
    currentValue: Number(item.currentValue ?? 0),
  }));
}

async function getOpenOrdersCount(env: Env, account: UserTradingAccountContext, address: string): Promise<number> {
  if (!account.credentials) return 0;
  const client = createTradingClient(env, account);
  try {
    const payload = await client.getOpenOrders({ id: address });
    if (Array.isArray(payload)) return payload.length;
    if (Array.isArray((payload as { data?: unknown[] })?.data)) {
      return (payload as { data: unknown[] }).data.length;
    }
    if (Array.isArray((payload as { orders?: unknown[] })?.orders)) {
      return (payload as { orders: unknown[] }).orders.length;
    }
  } catch {
    return 0;
  }
  return 0;
}

async function fetchGammaMarket(env: Env, slug: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${env.POLYMARKET_GAMMA_HOST}/markets?slug=${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Gamma lookup failed: ${response.status}`);
  }
  const markets = await response.json<Array<Record<string, unknown>>>();
  const market = markets[0];
  if (!market) {
    throw new Error(`Market not found for slug ${slug}`);
  }
  return market;
}

async function getAvailableBalance(env: Env, account: UserTradingAccountContext): Promise<number> {
  const client = createTradingClient(env, account);
  const payload = await client.getBalanceAllowance({
    asset_type: "COLLATERAL",
    signature_type: Number(account.account.signature_type ?? env.POLYMARKET_SIGNATURE_TYPE ?? "1"),
  });
  const raw = Number(payload.balance ?? payload.available ?? 0);
  return raw >= 1000 ? raw / 1_000_000 : raw;
}

function createTradingClient(env: Env, account: UserTradingAccountContext) {
  if (account.account.status !== "tradable") {
    throw new Error("This linked account is not marked tradable yet");
  }
  if (!account.credentials?.polymarketPrivateKey || !account.credentials?.polymarketApiKey || !account.credentials?.polymarketApiSecret || !account.credentials?.polymarketApiPassphrase) {
    throw new Error("This linked account is not tradable yet. Complete delegated signing or managed signer setup first.");
  }
  const signer = new Wallet(account.credentials.polymarketPrivateKey);
  const builderConfig = createBuilderConfig(env);
  return new ClobClient(
    env.POLYMARKET_HOST,
    Number(env.POLYMARKET_CHAIN_ID || "137"),
    signer,
    {
      key: account.credentials.polymarketApiKey,
      secret: account.credentials.polymarketApiSecret,
      passphrase: account.credentials.polymarketApiPassphrase,
    },
    Number(account.account.signature_type ?? env.POLYMARKET_SIGNATURE_TYPE ?? "1"),
    account.account.funder_address ?? undefined,
    undefined,
    undefined,
    builderConfig,
  );
}

function createRelayClient(env: Env, account: UserTradingAccountContext): RelayClient {
  if (!account.credentials?.polymarketPrivateKey) {
    throw new Error("Trading account is missing a signer private key");
  }
  const relayerAccount = privateKeyToAccount(account.credentials.polymarketPrivateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account: relayerAccount,
    chain: polygon,
    transport: http(env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com"),
  });
  const relayerAuthHeaders = createRelayerApiHeaders(env, account);
  const builderConfig = relayerAuthHeaders ? undefined : createBuilderConfig(env);
  const txType = account.account.relayer_tx_type === RelayerTxType.PROXY ? RelayerTxType.PROXY : RelayerTxType.SAFE;
  const client = new RelayClient(
    env.POLYMARKET_RELAYER_HOST ?? "https://relayer-v2.polymarket.com",
    Number(env.POLYMARKET_CHAIN_ID || "137"),
    walletClient,
    builderConfig,
    txType,
  );
  (client as unknown as { httpClient: { send: (endpoint: string, method: string, options?: { headers?: Record<string, string>; data?: string; params?: Record<string, string> }) => Promise<{ data: unknown }> } }).httpClient = {
    send: async (
      endpoint: string,
      method: string,
      options?: { headers?: Record<string, string>; data?: string; params?: Record<string, string> },
    ) => {
        const url = new URL(endpoint);
        if (options?.params) {
          for (const [key, value] of Object.entries(options.params)) {
            if (value !== undefined && value !== null) {
              url.searchParams.set(key, String(value));
            }
          }
        }
        const response = await fetch(url.toString(), {
          method,
          headers: {
            ...(relayerAuthHeaders ?? {}),
            ...(options?.headers ?? {}),
          },
          body: method === "GET" ? undefined : options?.data,
        });
        const contentType = response.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json") ? await response.json() : await response.text();
        if (!response.ok) {
          throw new Error(
            JSON.stringify({
              error: "request error",
              status: response.status,
              statusText: response.statusText,
              data: payload,
            }),
          );
        }
        return { data: payload };
      },
  };
  return client;
}

function createRelayerApiHeaders(env: Env, account: UserTradingAccountContext): Record<string, string> | undefined {
  const apiKey = env.POLYMARKET_RELAYER_API_KEY?.trim();
  const address = env.POLYMARKET_RELAYER_API_KEY_ADDRESS?.trim();
  if (!apiKey || !address) {
    return undefined;
  }
  const signerAddress = account.account.signer_address?.trim().toLowerCase();
  if (!signerAddress || signerAddress !== address.toLowerCase()) {
    return undefined;
  }
  return {
    RELAYER_API_KEY: apiKey,
    RELAYER_API_KEY_ADDRESS: address,
  };
}

function createBuilderConfig(env: Env): BuilderConfig | undefined {
  if (!env.POLYMARKET_BUILDER_API_KEY?.trim() || !env.POLYMARKET_BUILDER_API_SECRET?.trim() || !env.POLYMARKET_BUILDER_API_PASSPHRASE?.trim()) {
    return undefined;
  }

  return new BuilderConfig({
    localBuilderCreds: {
      key: env.POLYMARKET_BUILDER_API_KEY.trim(),
      secret: env.POLYMARKET_BUILDER_API_SECRET.trim(),
      passphrase: env.POLYMARKET_BUILDER_API_PASSPHRASE.trim(),
    },
  });
}

async function buildRelayerHeaders(
  env: Env,
  method: string,
  path: string,
  body?: string,
): Promise<Record<string, string>> {
  const builderConfig = createBuilderConfig(env);
  if (!builderConfig) {
    throw new Error("Builder credentials are not configured");
  }
  const headers = await builderConfig.generateBuilderHeaders(method, path, body);
  if (!headers) {
    throw new Error("Failed to generate builder headers for relayer request");
  }
  return headers as Record<string, string>;
}

function createAllApprovalTransactions(): Transaction[] {
  const erc20 = new utils.Interface(ERC20_ABI);
  const erc1155 = new utils.Interface(ERC1155_ABI);
  const maxUint256 = MAX_UINT256;

  const txs: Transaction[] = [];
  for (const spender of [CTF_CONTRACT, NEG_RISK_ADAPTER, CTF_EXCHANGE, NEG_RISK_CTF_EXCHANGE]) {
    txs.push({
      to: POLYGON_USDC_E,
      data: erc20.encodeFunctionData("approve", [spender, maxUint256]),
      value: "0",
      operation: OperationType.Call,
    });
  }
  for (const spender of [CTF_EXCHANGE, NEG_RISK_CTF_EXCHANGE, NEG_RISK_ADAPTER]) {
    txs.push({
      to: CTF_CONTRACT,
      data: erc1155.encodeFunctionData("setApprovalForAll", [spender, true]),
      value: "0",
      operation: OperationType.Call,
    });
  }
  return txs;
}

function getPlatformFeeBps(env: Env): number {
  const parsed = Number(env.LUNA_PLATFORM_FEE_BPS || "100");
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function toUsdcBaseUnits(amountUsdc: number): string {
  return utils.parseUnits(amountUsdc.toFixed(6), 6).toString();
}

function normalizeUsd(value: number): number {
  return Number(value.toFixed(2));
}

function parseMaybeJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function validateTradeResponse(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("Trade response was empty");
  }

  const result = value as Record<string, unknown>;
  const status = Number(result.status ?? 0);
  const error = typeof result.error === "string" ? result.error : typeof result.errorMsg === "string" ? result.errorMsg : "";

  if (error) {
    throw new Error(error);
  }
  if (Number.isFinite(status) && status >= 400) {
    throw new Error(`Polymarket rejected order with status ${status}`);
  }

  return result;
}
