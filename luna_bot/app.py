from __future__ import annotations

import asyncio
import hashlib
import logging
import json
import re
import time

from telegram import Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    PicklePersistence,
    filters,
)

from luna_bot.config import load_settings
from luna_bot.data import (
    DEPOSIT_CHAINS,
    SIGNALS,
    is_valid_wallet_address,
    normalize_wallet_address,
    reload_runtime_data,
)
from luna_bot.state import ensure_user_state, ensure_referral_state
from luna_bot.state import ensure_wallet_state
from luna_bot.polymarket import (
    LiveAccountSnapshot,
    PolymarketConfigError,
    PolymarketPublicClient,
    PolymarketTradingClient,
)
from luna_bot.ui import (
    arb_keyboard,
    arb_text,
    copy_keyboard,
    copy_text,
    copydesk_keyboard,
    copydesk_text,
    creators_keyboard,
    creators_text,
    dashboard_keyboard,
    dashboard_text,
    deposit_detail_text,
    deposit_keyboard,
    deposit_text,
    discover_keyboard,
    discover_text,
    follow_keyboard,
    follow_text,
    language_notice,
    leaderboard_keyboard,
    leaderboard_text,
    localized_reply_keyboard,
    news_keyboard,
    news_text,
    pnl_keyboard,
    pnl_share_text,
    pnl_text,
    portfolio_keyboard,
    portfolio_text,
    position_detail_keyboard,
    position_detail_text,
    receipts_keyboard,
    receipts_text,
    refer_keyboard,
    refer_text,
    referrals_keyboard,
    referrals_text,
    render_position_detail_text,
    render_wallet_main_text,
    runtime_status_text,
    settings_keyboard,
    settings_text,
    signal_history_summary_text,
    signal_history_text,
    signal_detail_keyboard,
    signal_detail_text,
    signal_list_keyboard,
    signal_list_text,
    simple_wallet_page,
    subscribe_success_keyboard,
    subscribe_success_text,
    unsubscribe_done,
    unsubscribe_prompt,
    url_trade_card_keyboard,
    url_trade_card_text,
    wallet_profile_keyboard,
    wallet_profile_text,
    wallet_main_keyboard,
    wallet_main_text,
    welcome_keyboard,
    welcome_text,
    why_luna_keyboard,
    why_luna_text,
)
from scripts import refresh_luna_runtime


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
LOGGER = logging.getLogger(__name__)
DEFAULT_PUSH_BATCH_SIZE = 2
DEMO_TOPUP_AMOUNT = 50.0
REFRESH_COOLDOWN_SEC = 120
_last_refresh_time: float = 0.0
EVM_DEPOSIT_CHAINS = {"Ethereum", "Optimism", "Polygon", "Monad", "Abstract", "Arbitrum", "Ethereal", "BNB", "Base", "HyperEVM"}
SVM_DEPOSIT_CHAINS = {"Solana"}
BTC_DEPOSIT_CHAINS = {"Bitcoin"}
TRON_DEPOSIT_CHAINS = {"Tron"}
POLYMARKET_URL_RE = re.compile(r"https?://(?:www\.)?polymarket\.com/(?:event|market)/[\w-]+", re.IGNORECASE)
AUTO_REFRESH_INTERVAL_SEC = 600  # 10 minutes


def get_state(context: ContextTypes.DEFAULT_TYPE) -> dict:
    context.user_data.update(ensure_user_state(context.user_data))
    return context.user_data


def get_settings():
    return load_settings()


def get_wallet(state: dict) -> dict:
    wallet = ensure_wallet_state(state.get("wallet"))
    state["wallet"] = wallet
    return wallet


async def get_display_wallet(state: dict) -> dict:
    wallet = get_wallet(state)
    if live_trading_enabled():
        try:
            snapshot = await asyncio.to_thread(fetch_live_snapshot)
            wallet = build_live_wallet_dict(snapshot)
        except Exception:
            LOGGER.exception("Failed to load live Polymarket wallet snapshot")
    return wallet


def live_trading_enabled() -> bool:
    settings = get_settings()
    return bool(settings.polymarket_enabled and settings.polymarket_user_address)


def bridge_address_type_for_chain(chain: str) -> str:
    if chain in EVM_DEPOSIT_CHAINS:
        return "evm"
    if chain in SVM_DEPOSIT_CHAINS:
        return "svm"
    if chain in BTC_DEPOSIT_CHAINS:
        return "btc"
    if chain in TRON_DEPOSIT_CHAINS:
        return "tron"
    raise PolymarketConfigError(f"Unsupported deposit chain: {chain}")


def _safe_json_list(raw) -> list:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return []
    return []


def fetch_live_snapshot() -> LiveAccountSnapshot:
    settings = get_settings()
    if not settings.polymarket_enabled:
        raise PolymarketConfigError("POLYMARKET_ENABLED is false")
    account_address = settings.polymarket_funder_address or settings.polymarket_user_address
    if not account_address:
        raise PolymarketConfigError("POLYMARKET_FUNDER_ADDRESS or POLYMARKET_USER_ADDRESS is required")
    client = PolymarketPublicClient(settings)
    snapshot = client.get_live_snapshot(account_address)
    try:
        trading = PolymarketTradingClient(settings)
        return LiveAccountSnapshot(
            address=account_address,
            balance_usdc=trading.get_available_balance(),
            positions=snapshot.positions,
            open_orders=trading.get_open_orders_count(),
        )
    except PolymarketConfigError:
        return LiveAccountSnapshot(
            address=account_address,
            balance_usdc=snapshot.balance_usdc,
            positions=snapshot.positions,
            open_orders=snapshot.open_orders,
        )


def build_live_wallet_dict(snapshot: LiveAccountSnapshot) -> dict:
    positions = []
    for position in snapshot.positions[:20]:
        side_label = position.outcome or "Outcome"
        market_url = f"https://polymarket.com/market/{position.market_slug}" if position.market_slug else "https://polymarket.com"
        signal_id = int(hashlib.md5(f"{position.market_slug}:{position.token_id}".encode()).hexdigest()[:8], 16)
        positions.append(
            {
                "signal_id": signal_id,
                "title_zh": position.title,
                "title_en": position.title,
                "side_zh": side_label,
                "side_en": side_label,
                "amount_usdc": round(position.size * position.avg_price, 2),
                "entry_price": f"{round(position.avg_price * 100):.0f}¢",
                "current_price": f"{round(position.current_price * 100):.0f}¢",
                "shares": f"{position.size:.2f}",
                "pnl_abs": f"{position.cash_pnl:+.2f} USDC",
                "pnl_pct": f"{position.percent_pnl:+.1f}%",
                "market_url": market_url,
                "token_id": position.token_id,
                "size_raw": position.size,
                "current_value_usdc": round(position.size * position.current_price, 2),
            }
        )
    return {
        "deposit_address": snapshot.address,
        "balance_usdc": snapshot.balance_usdc,
        "positions": positions,
        "history": [],
    }


def place_live_copy_trade(signal_id: int, amount_usdc: float) -> tuple[bool, str, dict]:
    settings = get_settings()
    if not settings.polymarket_enabled:
        return False, "live_trading_disabled", {}
    signal = next((item for item in SIGNALS if item.id == signal_id), None)
    if signal is None or not signal.slug or not signal.selected_outcome:
        return False, "signal_not_tradeable", {}
    try:
        public_client = PolymarketPublicClient(settings)
        token_id = public_client.resolve_token_id(signal.slug, signal.selected_outcome)
        side = "BUY"
        trading_client = PolymarketTradingClient(settings)
        result = trading_client.place_market_order(token_id, amount_usdc, side)
        return True, "executed", result
    except PolymarketConfigError:
        raise
    except Exception as exc:
        LOGGER.exception("Live copy trade failed for signal_id=%s amount=%.2f", signal_id, amount_usdc)
        return False, f"order_failed: {type(exc).__name__}", {}


def close_live_position(position: dict) -> tuple[bool, str, dict]:
    settings = get_settings()
    if not settings.polymarket_enabled:
        return False, "live_trading_disabled", {}
    token_id = position.get("token_id")
    shares = float(position.get("size_raw") or 0)
    if not token_id or shares <= 0:
        return False, "position_not_tradeable", {}
    try:
        trading_client = PolymarketTradingClient(settings)
        result = trading_client.place_market_order(str(token_id), shares, "SELL")
        return True, "closed", result
    except PolymarketConfigError:
        raise
    except Exception as exc:
        LOGGER.exception("Live close-position failed for token_id=%s shares=%.4f", token_id, shares)
        return False, f"close_failed: {type(exc).__name__}", {}


def add_tracked_wallet(state: dict, address: str) -> tuple[bool, str]:
    normalized = normalize_wallet_address(address)
    tracked = state["tracked_wallets"]
    if normalized in tracked:
        return False, "exists"
    if len(tracked) >= 3:
        return False, "limit"
    tracked.append(normalized)
    return True, "added"


def perform_runtime_refresh(refresh_fn, reload_fn) -> tuple[int, int]:
    refresh_fn()
    return reload_fn()


def next_signal_batch(state: dict, limit: int = DEFAULT_PUSH_BATCH_SIZE) -> list[int]:
    pushed = set(state.get("last_pushed_signal_ids", []))
    return [signal.id for signal in SIGNALS if signal.id not in pushed][:limit]


async def dispatch_signal_pushes(application: Application) -> None:
    reload_runtime_data()
    for chat_id, raw_state in application.user_data.items():
        state = ensure_user_state(raw_state)
        if not state["subscribed"]:
            continue
        pending_ids = next_signal_batch(state)
        if not pending_ids:
            continue
        for signal_id in pending_ids:
            try:
                await application.bot.send_message(
                    chat_id=chat_id,
                    text=signal_detail_text(signal_id, state["language"]),
                    reply_markup=signal_detail_keyboard(signal_id, state["language"]),
                    parse_mode="HTML",
                )
            except Exception:
                LOGGER.warning("Failed to push signal %d to chat %s", signal_id, chat_id, exc_info=True)
                continue
            pushed = state["last_pushed_signal_ids"]
            pushed.append(signal_id)
            state["last_pushed_signal_ids"] = pushed[-20:]


async def signal_push_loop(application: Application, interval_sec: int) -> None:
    await asyncio.sleep(5)
    while True:
        try:
            await dispatch_signal_pushes(application)
        except Exception:
            LOGGER.exception("Signal push loop failed")
        await asyncio.sleep(interval_sec)


async def auto_refresh_loop(interval_sec: int) -> None:
    """Background loop that refreshes runtime data every interval_sec seconds."""
    await asyncio.sleep(30)  # Initial delay
    while True:
        try:
            LOGGER.info("Auto-refresh: starting runtime data refresh")
            signal_count, wallet_count = await asyncio.to_thread(
                perform_runtime_refresh,
                refresh_luna_runtime.main,
                reload_runtime_data,
            )
            LOGGER.info("Auto-refresh: completed — %d signals, %d wallets", signal_count, wallet_count)
        except Exception:
            LOGGER.exception("Auto-refresh loop failed")
        await asyncio.sleep(interval_sec)


async def start_background_jobs(application: Application) -> None:
    settings = load_settings()
    application.bot_data["signal_push_task"] = asyncio.create_task(
        signal_push_loop(application, settings.push_interval_sec)
    )
    application.bot_data["auto_refresh_task"] = asyncio.create_task(
        auto_refresh_loop(AUTO_REFRESH_INTERVAL_SEC)
    )


async def send_welcome(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    state = get_state(context)
    if state["subscribed"]:
        text = dashboard_text(state["language"], True)
        keyboard = dashboard_keyboard(state["language"], True)
    else:
        text = welcome_text(state["language"])
        keyboard = welcome_keyboard(state["language"])

    await update.effective_message.reply_text(
        text,
        reply_markup=keyboard,
        parse_mode="HTML",
    )

    await update.effective_message.reply_text(
        "💡 可使用下方按钮快速操作" if state["language"] == "zh" else "💡 Use the persistent keyboard below for quick actions",
        reply_markup=localized_reply_keyboard(state["language"]),
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    state = get_state(context)
    # Handle deep link referral: /start ref_<user_id>
    args = context.args
    if args and args[0].startswith("ref_"):
        referrer_id = args[0][4:]
        referral = state.get("referral", {})
        if not referral.get("referred_by") and str(update.effective_user.id) != referrer_id:
            referral["referred_by"] = referrer_id
            state["referral"] = referral
            # Credit the referrer if their data is accessible
            try:
                referrer_data = context.application.user_data.get(int(referrer_id))
                if referrer_data:
                    referrer_state = ensure_user_state(referrer_data)
                    ref = ensure_referral_state(referrer_state.get("referral"))
                    invited = ref.get("invited_users", [])
                    uid = str(update.effective_user.id)
                    if uid not in invited:
                        invited.append(uid)
                        ref["invited_users"] = invited
                        referrer_state["referral"] = ref
            except Exception:
                LOGGER.warning("Failed to credit referrer %s", referrer_id, exc_info=True)
    await send_welcome(update, context)


async def show_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = dashboard_text(state["language"], state["subscribed"])
    keyboard = dashboard_keyboard(state["language"], state["subscribed"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_signals(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = signal_list_text(state["language"], state["sports_enabled"])
    keyboard = signal_list_keyboard(state["language"], state["sports_enabled"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_wallet(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    wallet = await get_display_wallet(state)
    text = render_wallet_main_text(
        state["language"],
        wallet["balance_usdc"],
        len(wallet["positions"]),
        wallet["deposit_address"],
    )
    keyboard = wallet_main_keyboard(state["language"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_settings(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = settings_text(state["language"], state["subscribed"], state["sports_enabled"])
    keyboard = settings_keyboard(state["language"], state["subscribed"], state["sports_enabled"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_portfolio(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = portfolio_text(state["language"])
    keyboard = portfolio_keyboard(state["language"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = leaderboard_text(state["language"], state["tracked_wallets"])
    keyboard = leaderboard_keyboard(state["language"], state["tracked_wallets"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_discover(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = discover_text(state["language"], state["sports_enabled"])
    keyboard = discover_keyboard(state["language"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_refer(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    referral = state.get("referral", {})
    count = len(referral.get("invited_users", []))
    user_id = update.effective_user.id if update.effective_user else 0
    text = refer_text(state["language"], user_id, count)
    keyboard = refer_keyboard(state["language"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_referrals(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    referral = state.get("referral", {})
    text = referrals_text(state["language"], referral)
    keyboard = referrals_keyboard(state["language"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_creators(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = creators_text(state["language"])
    keyboard = creators_keyboard(state["language"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_pnl(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    wallet = await get_display_wallet(state)
    text = pnl_text(state["language"], wallet)
    keyboard = pnl_keyboard(state["language"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_copydesk(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = copydesk_text(state["language"], state["sports_enabled"])
    keyboard = copydesk_keyboard(state["language"], state["sports_enabled"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_follow(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    follow_tasks = state.get("follow_tasks", [])
    text = follow_text(state["language"], follow_tasks, state["tracked_wallets"])
    keyboard = follow_keyboard(state["language"], follow_tasks, state["tracked_wallets"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_news(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = news_text(state["language"], state["sports_enabled"])
    keyboard = news_keyboard(state["language"], state["sports_enabled"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_arb(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    text = arb_text(state["language"], state["sports_enabled"])
    keyboard = arb_keyboard(state["language"], state["sports_enabled"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def show_receipts(update: Update, context: ContextTypes.DEFAULT_TYPE, *, edit: bool = False) -> None:
    state = get_state(context)
    wallet = await get_display_wallet(state)
    text = receipts_text(state["language"], wallet)
    keyboard = receipts_keyboard(state["language"])
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
    else:
        await update.effective_message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def handle_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    command = update.effective_message.text.lower().strip()
    LOGGER.info("Command received: %s (user=%s)", command, update.effective_user.id if update.effective_user else "?")
    if command == "/why":
        state = get_state(context)
        await update.effective_message.reply_text(
            why_luna_text(state["language"]),
            reply_markup=why_luna_keyboard(state["language"]),
            parse_mode="HTML",
        )
        return
    if command in {"/help", "/menu"}:
        await show_dashboard(update, context)
    elif command == "/signals":
        await show_signals(update, context)
    elif command == "/wallet":
        await show_wallet(update, context)
    elif command == "/walletdebug":
        state = get_state(context)
        try:
            snapshot = await asyncio.to_thread(fetch_live_snapshot)
            lines = [
                "🧪 <b>Wallet Debug</b>" if state["language"] == "en" else "🧪 <b>钱包调试</b>",
                "",
                f"signer: <code>{get_settings().polymarket_user_address or '-'}</code>",
                f"funder: <code>{get_settings().polymarket_funder_address or '-'}</code>",
                f"wallet: <code>{snapshot.address}</code>",
                f"balance: <b>{snapshot.balance_usdc:.6f} USDC</b>",
                f"positions: <b>{len(snapshot.positions)}</b>",
                f"open_orders: <b>{snapshot.open_orders}</b>",
            ]
            await update.effective_message.reply_text("\n".join(lines), parse_mode="HTML")
        except Exception as exc:
            await update.effective_message.reply_text(
                (f"walletdebug failed: {exc}") if state["language"] == "en" else f"walletdebug 失败：{exc}"
            )
    elif command == "/settings":
        await show_settings(update, context)
    elif command == "/leaderboard":
        await show_leaderboard(update, context)
    elif command == "/portfolio":
        await show_portfolio(update, context)
    elif command == "/discover":
        await show_discover(update, context)
    elif command in {"/refer", "/invite"}:
        await show_refer(update, context)
    elif command in {"/referrals", "/ledger"}:
        await show_referrals(update, context)
    elif command == "/creators":
        await show_creators(update, context)
    elif command == "/pnl":
        await show_pnl(update, context)
    elif command == "/copydesk":
        await show_copydesk(update, context)
    elif command == "/follow":
        await show_follow(update, context)
    elif command == "/news":
        await show_news(update, context)
    elif command == "/arb":
        await show_arb(update, context)
    elif command == "/receipts":
        await show_receipts(update, context)
    elif command == "/reload":
        signal_count, wallet_count = reload_runtime_data()
        message = (
            f"Reloaded runtime data: {signal_count} signals, {wallet_count} wallets."
            if get_state(context)["language"] == "en"
            else f"运行时数据已重载：{signal_count} 条信号，{wallet_count} 个钱包。"
        )
        await update.effective_message.reply_text(message)
    elif command == "/refreshnow":
        global _last_refresh_time
        state = get_state(context)
        now = time.monotonic()
        if now - _last_refresh_time < REFRESH_COOLDOWN_SEC:
            remaining = int(REFRESH_COOLDOWN_SEC - (now - _last_refresh_time))
            cooldown_msg = (
                f"⏳ Please wait {remaining}s before refreshing again."
                if state["language"] == "en"
                else f"⏳ 请等待 {remaining} 秒后再刷新。"
            )
            await update.effective_message.reply_text(cooldown_msg)
            return
        _last_refresh_time = now
        start_message = (
            "Refreshing live runtime data. This may take around 1-2 minutes."
            if state["language"] == "en"
            else "正在刷新实时数据，通常需要 1-2 分钟。"
        )
        await update.effective_message.reply_text(start_message)
        try:
            signal_count, wallet_count = await asyncio.to_thread(
                perform_runtime_refresh,
                refresh_luna_runtime.main,
                reload_runtime_data,
            )
            done_message = (
                f"Refresh completed: {signal_count} signals, {wallet_count} wallets."
                if state["language"] == "en"
                else f"刷新完成：{signal_count} 条信号，{wallet_count} 个钱包。"
            )
        except Exception as exc:
            LOGGER.exception("Runtime refresh failed")
            done_message = (
                f"Refresh failed: {exc}"
                if state["language"] == "en"
                else f"刷新失败：{exc}"
            )
        await update.effective_message.reply_text(done_message)
    elif command == "/status":
        await update.effective_message.reply_text(runtime_status_text(get_state(context)["language"]), parse_mode="HTML")
    elif command == "/trackrecord":
        language = get_state(context)["language"]
        await update.effective_message.reply_text(signal_history_summary_text(language), parse_mode="HTML")
        await update.effective_message.reply_text(signal_history_text(language), parse_mode="HTML")
    elif command.startswith("/track"):
        await handle_track_command(update, context)
    else:
        await show_dashboard(update, context)


async def handle_track_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    state = get_state(context)
    parts = (update.effective_message.text or "").split(maxsplit=1)
    if len(parts) < 2:
        message = (
            "Usage: /track 0x..." if state["language"] == "en" else "用法：/track 0x..."
        )
        await update.effective_message.reply_text(message)
        return
    address = normalize_wallet_address(parts[1].strip())
    if not is_valid_wallet_address(address):
        message = (
            "Please provide a valid EVM address like /track 0x..." if state["language"] == "en" else "请提供合法的 EVM 地址，例如 /track 0x..."
        )
        await update.effective_message.reply_text(message)
        return
    added, status = add_tracked_wallet(state, address)
    if status == "exists":
        message = "Already tracked." if state["language"] == "en" else "该地址已经在追踪列表中。"
    elif status == "limit":
        message = "You can track up to 3 addresses." if state["language"] == "en" else "最多只能追踪 3 个地址。"
    else:
        message = (
            f"Tracking added: <code>{address}</code>"
            if state["language"] == "en"
            else
            f"已添加追踪地址：<code>{address}</code>"
        )
    await update.effective_message.reply_text(message, parse_mode="HTML")
    await show_leaderboard(update, context)


def execute_copy_trade(state: dict, signal_id: int, amount_usdc: float) -> tuple[bool, str, dict]:
    if live_trading_enabled():
        return place_live_copy_trade(signal_id, amount_usdc)

    wallet = get_wallet(state)
    signal = next((item for item in SIGNALS if item.id == signal_id), None)
    if signal is None:
        return False, "signal_missing", {}
    if wallet["balance_usdc"] < amount_usdc:
        return False, "insufficient_balance", {}

    wallet["balance_usdc"] -= amount_usdc
    position = {
        "signal_id": signal.id,
        "title_zh": signal.title_zh,
        "title_en": signal.title_en,
        "side_zh": signal.action_zh.replace("🎯 ", ""),
        "side_en": signal.action_en.replace("🎯 ", ""),
        "amount_usdc": amount_usdc,
        "entry_price": signal.current_price,
        "current_price": signal.current_price,
        "shares": f"{amount_usdc / max(0.01, float(signal.current_price.replace('¢', '')) / 100):.2f}",
        "pnl_abs": "+$0.00",
        "pnl_pct": "+0.0%",
        "market_url": signal.market_url,
    }
    wallet["positions"].insert(0, position)
    wallet["history"].insert(0, {
        "kind": "buy",
        "title_zh": signal.title_zh,
        "title_en": signal.title_en,
        "amount_usdc": amount_usdc,
        "side_zh": position["side_zh"],
        "side_en": position["side_en"],
        "status_zh": "已执行",
        "status_en": "Executed",
    })
    wallet["history"] = wallet["history"][:20]
    return True, "executed", {}


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    state = get_state(context)
    wallet = await get_display_wallet(state)
    text = (update.effective_message.text or "").strip()

    if text in {"📋 最新信号", "Latest Signals"}:
        await show_signals(update, context)
        return
    if text in {"💰 钱包", "Wallet"}:
        await show_wallet(update, context)
        return
    if text in {"📂 个人主页", "📂 Portfolio", "Portfolio", "📈 公开战绩", "📈 Track Record", "Track Record"}:
        await show_portfolio(update, context)
        return
    if text in {"🏆 聪明钱榜单", "🏆 Leaderboard", "Leaderboard"}:
        await show_leaderboard(update, context)
        return
    if text in {"⚙️ 设置", "Settings"}:
        await show_settings(update, context)
        return
    if text in {"📊 主控台", "📊 Menu", "Dashboard", "Menu"}:
        await show_dashboard(update, context)
        return

    if state["pending_withdraw"]:
        if live_trading_enabled():
            state["pending_withdraw"] = False
            await update.effective_message.reply_text(
                "Live withdrawals are not wired yet." if state["language"] == "en" else "真实提现链路还没接完。"
            )
            await show_wallet(update, context)
            return
        state["pending_withdraw"] = False
        amount = wallet["balance_usdc"]
        wallet["balance_usdc"] = 0.0
        wallet["history"].insert(0, {
            "kind": "withdraw",
            "title_zh": "提现",
            "title_en": "Withdraw",
            "amount_usdc": amount,
            "side_zh": "转出",
            "side_en": "Outgoing",
            "status_zh": "已提交",
            "status_en": "Submitted",
        })
        if state["language"] == "en":
            message = (
                "✅ <b>Withdraw request submitted</b>\n\n"
                f"Destination: <code>{text}</code>\n\n"
                f"Amount: <b>{amount:.2f} USDC</b>\n\n"
                "This is a simulated withdrawal in the current prototype."
            )
        else:
            message = (
                "✅ <b>提现请求已提交</b>\n\n"
                f"目标地址：<code>{text}</code>\n\n"
                f"金额：<b>{amount:.2f} USDC</b>\n\n"
                "当前原型中这是一笔模拟提现。"
            )
        await update.effective_message.reply_text(message, parse_mode="HTML")
        await show_wallet(update, context)
        return

    if is_valid_wallet_address(text):
        added, status = add_tracked_wallet(state, text)
        if status == "exists":
            message = "Already tracked." if state["language"] == "en" else "该地址已经在追踪列表中。"
        elif status == "limit":
            message = "You can track up to 3 addresses." if state["language"] == "en" else "最多只能追踪 3 个地址。"
        else:
            message = (
                f"已添加追踪地址：<code>{normalize_wallet_address(text)}</code>"
                if state["language"] == "zh"
                else f"Tracking added: <code>{normalize_wallet_address(text)}</code>"
            )
        await update.effective_message.reply_text(message, parse_mode="HTML")
        await show_leaderboard(update, context)
        return

    # Polymarket URL detection → trade card
    url_match = POLYMARKET_URL_RE.search(text)
    if url_match:
        url = url_match.group(0)
        await update.effective_message.reply_text(
            url_trade_card_text(state["language"], url),
            reply_markup=url_trade_card_keyboard(state["language"], url),
            parse_mode="HTML",
        )
        return

    if text.isdigit():
        signal_id = int(text)
        if any(signal.id == signal_id for signal in SIGNALS):
            await update.effective_message.reply_text(
                signal_detail_text(signal_id, state["language"]),
                reply_markup=signal_detail_keyboard(signal_id, state["language"]),
                parse_mode="HTML",
            )
            return

    await show_dashboard(update, context)


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    state = get_state(context)
    data = query.data or ""
    LOGGER.debug("Callback: %s (user=%s)", data, update.effective_user.id if update.effective_user else "?")

    if data == "why_luna":
        await query.edit_message_text(
            why_luna_text(state["language"]),
            reply_markup=why_luna_keyboard(state["language"]),
            parse_mode="HTML",
        )
        return

    if data == "subscribe_confirm":
        state["subscribed"] = True
        text = subscribe_success_text(state["language"])
        keyboard = subscribe_success_keyboard(state["language"])
        await query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
        return

    if data == "menu":
        await show_dashboard(update, context, edit=True)
        return

    if data == "recent_signals":
        await show_signals(update, context, edit=True)
        return

    if data.startswith("signal:"):
        signal_id = int(data.split(":", 1)[1])
        await query.edit_message_text(
            signal_detail_text(signal_id, state["language"]),
            reply_markup=signal_detail_keyboard(signal_id, state["language"]),
            parse_mode="HTML",
        )
        return

    if data.startswith("copy:"):
        signal_id = int(data.split(":", 1)[1])
        wallet = await get_display_wallet(state)
        await query.message.reply_text(
            copy_text(signal_id, state["language"], wallet["balance_usdc"]),
            reply_markup=copy_keyboard(signal_id, state["language"], wallet["balance_usdc"]),
            parse_mode="HTML",
        )
        return

    if data.startswith("copy_amount:"):
        _, signal_id_raw, amount_raw = data.split(":")
        signal_id = int(signal_id_raw)
        amount_usdc = float(amount_raw)
        try:
            ok, status, meta = execute_copy_trade(state, signal_id, amount_usdc)
        except PolymarketConfigError as exc:
            ok, status, meta = False, str(exc), {}
        if state["language"] == "en":
            if ok:
                order_id = meta.get("orderID")
                tx_hashes = meta.get("transactionsHashes") or []
                detail_lines = [f"✅ Copy trade executed for ${amount_usdc:.2f}."]
                if order_id:
                    detail_lines.append(f"order: <code>{order_id}</code>")
                if tx_hashes:
                    detail_lines.append(f"tx: <code>{tx_hashes[0]}</code>")
                message = "\n".join(detail_lines)
            elif status == "insufficient_balance":
                message = "❌ Insufficient balance. Top up the demo wallet first."
            elif status == "live_trading_disabled":
                message = "❌ Live trading is not enabled."
            elif status == "signal_not_tradeable":
                message = "❌ This signal is missing Polymarket market metadata."
            elif status == "order_failed":
                message = "❌ Polymarket order submission failed."
            else:
                message = f"❌ {status}"
        else:
            if ok:
                order_id = meta.get("orderID")
                tx_hashes = meta.get("transactionsHashes") or []
                detail_lines = [f"✅ 已执行跟单，金额 ${amount_usdc:.2f}。"]
                if order_id:
                    detail_lines.append(f"订单：<code>{order_id}</code>")
                if tx_hashes:
                    detail_lines.append(f"交易：<code>{tx_hashes[0]}</code>")
                message = "\n".join(detail_lines)
            elif status == "insufficient_balance":
                message = "❌ 余额不足，请先测试充值。"
            elif status == "live_trading_disabled":
                message = "❌ 真实交易还没有启用。"
            elif status == "signal_not_tradeable":
                message = "❌ 这条信号缺少可交易的 Polymarket 市场元数据。"
            elif status == "order_failed":
                message = "❌ Polymarket 订单提交失败。"
            else:
                message = f"❌ {status}"
        await query.message.reply_text(message, parse_mode="HTML")
        await show_wallet(update, context)
        return

    if data == "show_wallet":
        await show_wallet(update, context, edit=True)
        return

    if data == "portfolio":
        await show_portfolio(update, context, edit=True)
        return

    if data == "leaderboard":
        await show_leaderboard(update, context, edit=True)
        return

    if data == "wallet_refresh":
        await show_wallet(update, context, edit=True)
        return

    if data.startswith("wallet:"):
        kind = data.split(":", 1)[1]
        wallet = await get_display_wallet(state)
        if kind == "demo_topup":
            if live_trading_enabled():
                message = (
                    "Demo top-up is disabled in live trading mode."
                    if state["language"] == "en"
                    else "真实交易模式下已禁用测试充值。"
                )
                await query.message.reply_text(message)
                return
            wallet["balance_usdc"] += DEMO_TOPUP_AMOUNT
            wallet["history"].insert(0, {
                "kind": "deposit",
                "title_zh": "测试充值",
                "title_en": "Demo top-up",
                "amount_usdc": DEMO_TOPUP_AMOUNT,
                "side_zh": "转入",
                "side_en": "Incoming",
                "status_zh": "已到账",
                "status_en": "Completed",
            })
            await show_wallet(update, context, edit=True)
            return
        if kind == "deposit":
            await query.edit_message_text(
                deposit_text(state["language"]),
                reply_markup=deposit_keyboard(state["language"]),
                parse_mode="HTML",
            )
            return
        if kind == "withdraw":
            if live_trading_enabled():
                await query.message.reply_text(
                    "Live withdrawals are not wired yet." if state["language"] == "en" else "真实提现链路还没接完。"
                )
                return
            state["pending_withdraw"] = True
        text, keyboard = simple_wallet_page(kind, state["language"], wallet)
        await query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
        return

    if data.startswith("position_detail:"):
        signal_id = int(data.split(":", 1)[1])
        wallet = await get_display_wallet(state)
        position = next((item for item in wallet["positions"] if item["signal_id"] == signal_id), None)
        if position is None:
            await query.message.reply_text("Position not found." if state["language"] == "en" else "未找到持仓。")
            return
        await query.edit_message_text(
            render_position_detail_text(position, state["language"]),
            reply_markup=position_detail_keyboard(signal_id, state["language"]),
            parse_mode="HTML",
        )
        return

    if data.startswith("close_position:"):
        if live_trading_enabled():
            signal_id = int(data.split(":", 1)[1])
            wallet = await get_display_wallet(state)
            position = next((item for item in wallet["positions"] if item["signal_id"] == signal_id), None)
            if position is None:
                message = "Position not found." if state["language"] == "en" else "未找到持仓。"
                await query.message.reply_text(message)
                return
            try:
                ok, status, meta = close_live_position(position)
            except PolymarketConfigError as exc:
                ok, status, meta = False, str(exc), {}
            if state["language"] == "en":
                if ok:
                    order_id = meta.get("orderID")
                    tx_hashes = meta.get("transactionsHashes") or []
                    lines = [f"✅ Position close submitted for {position['shares']} shares."]
                    if order_id:
                        lines.append(f"order: <code>{order_id}</code>")
                    if tx_hashes:
                        lines.append(f"tx: <code>{tx_hashes[0]}</code>")
                    message = "\n".join(lines)
                elif status == "position_not_tradeable":
                    message = "❌ This live position is missing trade metadata."
                elif status == "close_failed":
                    message = "❌ Polymarket close-position submission failed."
                else:
                    message = f"❌ {status}"
            else:
                if ok:
                    order_id = meta.get("orderID")
                    tx_hashes = meta.get("transactionsHashes") or []
                    lines = [f"✅ 已提交平仓，份额 {position['shares']}。"]
                    if order_id:
                        lines.append(f"订单：<code>{order_id}</code>")
                    if tx_hashes:
                        lines.append(f"交易：<code>{tx_hashes[0]}</code>")
                    message = "\n".join(lines)
                elif status == "position_not_tradeable":
                    message = "❌ 这笔真实持仓缺少可交易元数据。"
                elif status == "close_failed":
                    message = "❌ Polymarket 平仓提交失败。"
                else:
                    message = f"❌ {status}"
            await query.message.reply_text(message, parse_mode="HTML")
            return
        signal_id = int(data.split(":", 1)[1])
        wallet = get_wallet(state)
        position = next((item for item in wallet["positions"] if item["signal_id"] == signal_id), None)
        if position is None:
            message = "Position not found." if state["language"] == "en" else "未找到持仓。"
            await query.message.reply_text(message)
            return
        wallet["positions"] = [item for item in wallet["positions"] if item["signal_id"] != signal_id]
        wallet["balance_usdc"] += position["amount_usdc"]
        wallet["history"].insert(0, {
            "kind": "close",
            "title_zh": position["title_zh"],
            "title_en": position["title_en"],
            "amount_usdc": position["amount_usdc"],
            "side_zh": "平仓",
            "side_en": "Closed",
            "status_zh": "已完成",
            "status_en": "Completed",
        })
        message = (
            f"✅ Position closed. ${position['amount_usdc']:.2f} returned to wallet."
            if state["language"] == "en"
            else
            f"✅ 持仓已平仓，${position['amount_usdc']:.2f} 已回到钱包。"
        )
        await query.message.reply_text(message)
        await show_wallet(update, context)
        return

    if data.startswith("deposit:"):
        chain = data.split(":", 1)[1]
        if chain not in DEPOSIT_CHAINS:
            return
        back = "🔙 Back to Wallet" if state["language"] == "en" else "🔙 返回钱包"
        address = get_wallet(state)["deposit_address"]
        if live_trading_enabled():
            settings = get_settings()
            wallet_address = settings.polymarket_funder_address or settings.polymarket_user_address
            if not wallet_address:
                raise PolymarketConfigError("POLYMARKET_FUNDER_ADDRESS or POLYMARKET_USER_ADDRESS is required")
            try:
                bridge_client = PolymarketPublicClient(settings)
                bridge_payload = await asyncio.to_thread(bridge_client.create_deposit_addresses, wallet_address)
                bridge_addresses = bridge_payload.get("address") if isinstance(bridge_payload, dict) else None
                if not isinstance(bridge_addresses, dict):
                    raise PolymarketConfigError("Bridge API did not return an address bundle")
                address_type = bridge_address_type_for_chain(chain)
                address = bridge_addresses.get(address_type) or address
            except Exception:
                LOGGER.exception("Failed to load bridge deposit address for %s", chain)
        await query.edit_message_text(
            deposit_detail_text(chain, state["language"], address),
            reply_markup=wallet_back(back),
            parse_mode="HTML",
        )
        return

    if data == "withdraw_cancel":
        state["pending_withdraw"] = False
        await show_wallet(update, context, edit=True)
        return

    if data == "trackrecord":
        language = state["language"]
        await query.edit_message_text(
            signal_history_summary_text(language),
            parse_mode="HTML",
        )
        return

    if data == "settings:show":
        await show_settings(update, context, edit=True)
        return

    if data == "settings:toggle_language":
        state["language"] = "en" if state["language"] == "zh" else "zh"
        await query.edit_message_text(
            settings_text(state["language"], state["subscribed"], state["sports_enabled"]),
            reply_markup=settings_keyboard(state["language"], state["subscribed"], state["sports_enabled"]),
            parse_mode="HTML",
        )
        await query.message.reply_text(
            language_notice(state["language"]),
            reply_markup=localized_reply_keyboard(state["language"]),
        )
        return

    if data == "settings:toggle_sports":
        state["sports_enabled"] = not state["sports_enabled"]
        await query.edit_message_text(
            settings_text(state["language"], state["subscribed"], state["sports_enabled"]),
            reply_markup=settings_keyboard(state["language"], state["subscribed"], state["sports_enabled"]),
            parse_mode="HTML",
        )
        return

    if data == "unsubscribe_prompt":
        text, keyboard = unsubscribe_prompt(state["language"])
        await query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
        return

    if data == "unsubscribe_confirm":
        state["subscribed"] = False
        text, keyboard = unsubscribe_done(state["language"])
        await query.edit_message_text(text, reply_markup=keyboard, parse_mode="HTML")
        return

    if data.startswith("wallet_profile:"):
        address = data.split(":", 1)[1]
        await query.edit_message_text(
            wallet_profile_text(address, state["language"], state["tracked_wallets"]),
            reply_markup=wallet_profile_keyboard(address, state["language"], state["tracked_wallets"]),
            parse_mode="HTML",
        )
        return

    if data.startswith("wallet_track:"):
        address = normalize_wallet_address(data.split(":", 1)[1])
        add_tracked_wallet(state, address)
        await query.edit_message_text(
            wallet_profile_text(address, state["language"], state["tracked_wallets"]),
            reply_markup=wallet_profile_keyboard(address, state["language"], state["tracked_wallets"]),
            parse_mode="HTML",
        )
        return

    if data.startswith("wallet_untrack:"):
        address = normalize_wallet_address(data.split(":", 1)[1])
        state["tracked_wallets"] = [item for item in state["tracked_wallets"] if normalize_wallet_address(item) != address]
        await show_leaderboard(update, context, edit=True)
        return

    # New feature callbacks
    if data == "discover":
        await show_discover(update, context, edit=True)
        return

    if data == "discover_refresh":
        await show_discover(update, context, edit=True)
        return

    if data == "refer":
        await show_refer(update, context, edit=True)
        return

    if data == "referrals":
        await show_referrals(update, context, edit=True)
        return

    if data == "creators":
        await show_creators(update, context, edit=True)
        return

    if data == "pnl":
        await show_pnl(update, context, edit=True)
        return

    if data == "pnl_share":
        wallet = await get_display_wallet(state)
        user_id = update.effective_user.id if update.effective_user else 0
        share_text = pnl_share_text(state["language"], wallet, user_id)
        await query.message.reply_text(share_text)
        return

    if data == "copydesk":
        await show_copydesk(update, context, edit=True)
        return

    if data == "follow":
        await show_follow(update, context, edit=True)
        return

    if data.startswith("follow_add:"):
        address = normalize_wallet_address(data.split(":", 1)[1])
        follow_tasks = state.get("follow_tasks", [])
        existing = next((t for t in follow_tasks if t.get("wallet_address", "").lower() == address.lower()), None)
        if existing:
            existing["active"] = True
        else:
            follow_tasks.append({"wallet_address": address, "active": True, "created_at": "", "last_signal_id": 0})
        state["follow_tasks"] = follow_tasks
        await show_follow(update, context, edit=True)
        return

    if data.startswith("follow_remove:"):
        address = normalize_wallet_address(data.split(":", 1)[1])
        follow_tasks = state.get("follow_tasks", [])
        state["follow_tasks"] = [t for t in follow_tasks if t.get("wallet_address", "").lower() != address.lower()]
        await show_follow(update, context, edit=True)
        return

    if data == "news":
        await show_news(update, context, edit=True)
        return

    if data == "arb":
        await show_arb(update, context, edit=True)
        return

    if data == "receipts":
        await show_receipts(update, context, edit=True)
        return

    await show_dashboard(update, context, edit=True)


def wallet_back(label: str):
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup

    return InlineKeyboardMarkup([[InlineKeyboardButton(label, callback_data="show_wallet")]])


def build_app() -> Application:
    settings = load_settings()
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required")

    persistence = PicklePersistence(filepath=settings.persistence_path)
    app = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .persistence(persistence)
        .post_init(start_background_jobs)
        .build()
    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler([
        "help", "menu", "signals", "wallet", "walletdebug", "settings",
        "leaderboard", "portfolio", "track", "reload", "refreshnow",
        "status", "trackrecord", "why",
        "discover", "refer", "invite", "referrals", "ledger", "creators",
        "pnl", "copydesk", "follow", "news", "arb", "receipts",
    ], handle_command))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    return app


def main() -> None:
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())
    app = build_app()
    LOGGER.info("Starting Luna bot...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
