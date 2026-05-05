from __future__ import annotations

import html as html_mod

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup

from luna_bot.data import (
    DEPOSIT_CHAINS,
    POSITIONS,
    REPLY_KEYBOARD,
    REPLY_KEYBOARD_EN,
    SIGNAL_OUTCOMES,
    SIGNALS,
    SMART_WALLETS,
    build_signal_list_text,
    build_tracked_wallet,
    format_wallet_label,
    get_signal_history,
    get_runtime_meta,
    get_position,
    get_signal,
    summarize_signal_history,
    normalize_wallet_address,
)


def reply_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(REPLY_KEYBOARD, resize_keyboard=True, is_persistent=True)


def localized_reply_keyboard(language: str) -> ReplyKeyboardMarkup:
    keyboard = REPLY_KEYBOARD_EN if language == "en" else REPLY_KEYBOARD
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True, is_persistent=True)


def welcome_text(language: str) -> str:
    if language == "en":
        return (
            "🌙 <b>Welcome to Luna</b>\n\n"
            "87% of human Polymarket traders lose money.\n"
            "Luna solves one problem only: <b>who is actually worth following</b>.\n\n"
            "🏆 <b>Smart Score</b> ranks wallets by win rate, ROI, and sample quality.\n"
            "📈 <b>Public receipts</b> show every tracked signal and every outcome.\n"
            "⚡ <b>Live feed</b> shows what winning wallets are doing right now.\n\n"
            "Don't follow vibes. Follow winners."
        )
    return (
        "🌙 <b>欢迎使用 Luna</b>\n\n"
        "87% 的 Polymarket 人类交易者在亏钱。\n"
        "Luna 只解决一件事：<b>谁值得你跟</b>。\n\n"
        "🏆 <b>Smart Score</b> 用胜率、ROI 和样本质量给钱包排名。\n"
        "📈 <b>公开战绩</b> 让每条信号、每个结果都有凭据。\n"
        "⚡ <b>实时信号</b> 让你看到赢家钱包此刻在做什么。\n\n"
        "别跟情绪，跟赢家。"
    )


def welcome_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("🚀 Get Started", callback_data="subscribe_confirm")],
            [InlineKeyboardButton("🤔 Why Luna?", callback_data="why_luna")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("🚀 立即开始", callback_data="subscribe_confirm")],
            [InlineKeyboardButton("🤔 为什么选 Luna？", callback_data="why_luna")],
        ]
    return InlineKeyboardMarkup(rows)


def subscribe_success_text(language: str) -> str:
    if language == "en":
        return (
            "<b>✅ You're in.</b>\n\n"
            "Luna is now tracking the highest-conviction wallets on Polymarket for you.\n\n"
            "🔥 New signals land when high-score wallets move.\n"
            "📊 Open /trackrecord anytime to inspect the public receipts."
        )
    return (
        "<b>✅ 订阅成功</b>\n\n"
        "Luna 已开始为你追踪 Polymarket 上最值得跟的钱包。\n\n"
        "🔥 当高评分钱包有新动作时，你会收到信号。\n"
        "📊 随时打开 /trackrecord 查看公开凭据。"
    )


def subscribe_success_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [[
            InlineKeyboardButton("📈 Track Record", callback_data="trackrecord"),
            InlineKeyboardButton("📊 Dashboard", callback_data="menu"),
        ]]
    else:
        rows = [[
            InlineKeyboardButton("📈 查看公开战绩", callback_data="trackrecord"),
            InlineKeyboardButton("📊 进入主控台", callback_data="menu"),
        ]]
    return InlineKeyboardMarkup(rows)


def dashboard_text(language: str, subscribed: bool) -> str:
    if language == "en":
        status = "🟢 Active" if subscribed else "⚪ Inactive"
        return (
            "🌙 <b>Luna Dashboard</b>\n\n"
            f"Signal alerts: <b>{status}</b>\n\n"
            "Follow <b>who wins</b>, not random market noise.\n\n"
            "🔥 <b>Signals</b> — live trades from ranked wallets\n"
            "🏆 <b>Leaderboard</b> — who deserves attention now\n"
            "📈 <b>Track Record</b> — public receipts before execution\n\n"
            "Use the keyboard below to navigate."
        )
    status = "🟢 已激活" if subscribed else "⚪ 未激活"
    return (
        "🌙 <b>Luna 主控台</b>\n\n"
        f"信号推送：<b>{status}</b>\n\n"
        "先看谁在赢，再决定跟不跟。\n\n"
        "🔥 <b>信号</b> — 高评分钱包实时动作\n"
        "🏆 <b>榜单</b> — 谁现在最值得关注\n"
        "📈 <b>战绩</b> — 公开凭据先于交易执行\n\n"
        "使用下方键盘导航。"
    )


def dashboard_keyboard(language: str, subscribed: bool) -> InlineKeyboardMarkup:
    if not subscribed:
        if language == "en":
            rows = [[InlineKeyboardButton("🔔 Subscribe", callback_data="subscribe_confirm")]]
        else:
            rows = [[InlineKeyboardButton("🔔 订阅信号", callback_data="subscribe_confirm")]]
        return InlineKeyboardMarkup(rows)

    if language == "en":
        rows = [[
            InlineKeyboardButton("📋 Latest Signals", callback_data="recent_signals"),
            InlineKeyboardButton("📈 Track Record", callback_data="trackrecord"),
        ]]
    else:
        rows = [[
            InlineKeyboardButton("📋 最新信号", callback_data="recent_signals"),
            InlineKeyboardButton("📈 公开战绩", callback_data="trackrecord"),
        ]]
    return InlineKeyboardMarkup(rows)


def signal_list_keyboard(language: str, sports_enabled: bool) -> InlineKeyboardMarkup:
    visible = [signal for signal in SIGNALS if sports_enabled or not signal.sports]
    rows = []
    for start in range(0, len(visible), 4):
        chunk = visible[start:start + 4]
        rows.append([InlineKeyboardButton(str(signal.id), callback_data=f"signal:{signal.id}") for signal in chunk])
    if language == "en":
        rows.append([InlineKeyboardButton("« Back to Dashboard", callback_data="menu")])
    else:
        rows.append([InlineKeyboardButton("« 返回主控台", callback_data="menu")])
    return InlineKeyboardMarkup(rows)


def _confidence_dot(score: int) -> str:
    if score >= 85:
        return "🟢"
    if score >= 70:
        return "🟡"
    return "🔴"


def signal_detail_text(signal_id: int, language: str) -> str:
    signal = get_signal(signal_id)
    if signal is None:
        return ("❌ Signal not found." if language == "en" else "❌ 未找到该信号。")
    outcome = next((item for item in SIGNAL_OUTCOMES if item.signal_id == signal_id), None)
    dot = _confidence_dot(signal.score)
    if language == "en":
        outcome_line = f"\n<b>Outcome</b>\n{outcome.status_en} · {outcome.result_en}\n" if outcome else ""
        return (
            f"{dot} <b>Signal #{signal.id}</b> · Smart Score {signal.score}\n\n"
            f"<b>{signal.title_en}</b>\n\n"
            f"<b>Trade</b>\n{signal.action_en}\n"
            f"Expected: {signal.expected_return} · Daily: {signal.daily_return}\n\n"
            f"<b>Market</b>\nPrice: {signal.current_price} · Liquidity: {signal.liquidity}\nExpiry: {signal.expiry_en}\n\n"
            f"<b>Why this trade</b>\n{signal.analysis_en}\n\n"
            f"<b>Source</b>\n{signal.source_count}"
            f"{outcome_line}"
        )
    outcome_line = f"\n<b>结果追踪</b>\n{outcome.status_zh} · {outcome.result_zh}\n" if outcome else ""
    return (
        f"{dot} <b>信号 #{signal.id}</b> · Smart Score {signal.score}\n\n"
        f"<b>{signal.title_zh}</b>\n\n"
        f"<b>交易建议</b>\n{signal.action_zh}\n"
        f"预期：{signal.expected_return} · 日化：{signal.daily_return}\n\n"
        f"<b>市场</b>\n价格：{signal.current_price} · 流动性：{signal.liquidity}\n到期：{signal.expiry_zh}\n\n"
        f"<b>为什么跟这单</b>\n{signal.analysis_zh}\n\n"
        f"<b>来源</b>\n{signal.source_count}"
        f"{outcome_line}"
    )


def signal_detail_keyboard(signal_id: int, language: str) -> InlineKeyboardMarkup:
    signal = get_signal(signal_id)
    if signal is None:
        back = "« Back" if language == "en" else "« 返回"
        return InlineKeyboardMarkup([[InlineKeyboardButton(back, callback_data="recent_signals")]])
    if language == "en":
        rows = [
            [
                InlineKeyboardButton("📊 Details", url=signal.detail_url),
                InlineKeyboardButton("🌐 Market", url=signal.market_url),
                InlineKeyboardButton("⚡ Copy", callback_data=f"copy:{signal.id}"),
            ],
            [InlineKeyboardButton("« Back to list", callback_data="recent_signals")],
        ]
    else:
        rows = [
            [
                InlineKeyboardButton("📊 详情", url=signal.detail_url),
                InlineKeyboardButton("🌐 查看市场", url=signal.market_url),
                InlineKeyboardButton("⚡ 跟单", callback_data=f"copy:{signal.id}"),
            ],
            [InlineKeyboardButton("« 返回列表", callback_data="recent_signals")],
        ]
    return InlineKeyboardMarkup(rows)


def wallet_main_text(language: str) -> str:
    raise NotImplementedError("Use render_wallet_main_text with user wallet state.")


def render_wallet_main_text(language: str, balance_usdc: float, positions_count: int, deposit_address: str) -> str:
    if language == "en":
        return (
            "💼 <b>My Wallet</b>\n\n"
            f"Trading balance: <b>{balance_usdc:.2f} USDC</b>\n"
            f"Active positions: <b>{positions_count}</b>\n"
            f"Trading wallet: <code>{deposit_address}</code>\n\n"
            "Linked to a real Polymarket account when credentials are configured.\n"
            "Use Deposit to fetch the real bridge address for your chain."
        )
    return (
        "💼 <b>我的钱包</b>\n\n"
        f"交易余额：<b>{balance_usdc:.2f} USDC</b>\n"
        f"当前持仓：<b>{positions_count}</b>\n"
        f"交易钱包：<code>{deposit_address}</code>\n\n"
        "配置真实凭据后，这里会直接连接真实 Polymarket 账户。\n"
        "点“充值”再查看对应链的真实桥接入金地址。"
    )


def wallet_main_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("📊 Positions", callback_data="wallet:positions"), InlineKeyboardButton("📜 History", callback_data="wallet:history")],
            [InlineKeyboardButton("💰 Deposit", callback_data="wallet:deposit"), InlineKeyboardButton("💸 Withdraw", callback_data="wallet:withdraw")],
            [InlineKeyboardButton("🧪 Demo Top-up +50", callback_data="wallet:demo_topup"), InlineKeyboardButton("🔄 Refresh", callback_data="wallet_refresh")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("📊 我的持仓", callback_data="wallet:positions"), InlineKeyboardButton("📜 交易记录", callback_data="wallet:history")],
            [InlineKeyboardButton("💰 充值", callback_data="wallet:deposit"), InlineKeyboardButton("💸 提现", callback_data="wallet:withdraw")],
            [InlineKeyboardButton("🧪 测试充值 +50", callback_data="wallet:demo_topup"), InlineKeyboardButton("🔄 刷新", callback_data="wallet_refresh")],
        ]
    return InlineKeyboardMarkup(rows)


def simple_wallet_page(kind: str, language: str, wallet: dict) -> tuple[str, InlineKeyboardMarkup]:
    if kind == "positions":
        positions = wallet.get("positions", [])
        if not positions:
            text = (
                "📊 <b>My Positions</b>\n\nNo copied positions yet.\nFund the wallet and tap any signal to start."
                if language == "en"
                else
                "📊 <b>我的持仓</b>\n\n还没有跟单持仓。\n先充值，再去信号页点跟单。"
            )
            back = "🔙 Back to Wallet" if language == "en" else "🔙 返回钱包"
            return text, InlineKeyboardMarkup([[InlineKeyboardButton(back, callback_data="show_wallet")]])
        if language == "en":
            lines = ["📊 <b>My Positions</b>", ""]
            keyboard_rows = []
            for idx, position in enumerate(positions[:5], start=1):
                lines.append(f"{idx}. {position['title_en']}")
                lines.append(f"   🎯 {position['side_en']} · {position['shares']} shares")
                lines.append(f"   💵 Cost: ${position['amount_usdc']:.2f} → Entry: {position['entry_price']}")
                lines.append(f"   📈 P&L: {position['pnl_abs']} ({position['pnl_pct']})")
                lines.append("")
                keyboard_rows.append([InlineKeyboardButton(str(idx), callback_data=f"position_detail:{position['signal_id']}")])
            lines.append("Tap below to view detail.")
            keyboard = InlineKeyboardMarkup(
                keyboard_rows
                + [
                    [InlineKeyboardButton("🔄 Refresh", callback_data="wallet_refresh")],
                    [InlineKeyboardButton("🔙 Back to Wallet", callback_data="show_wallet")],
                ]
            )
            text = "\n".join(lines)
            return text, keyboard
        lines = ["📊 <b>我的持仓</b>", ""]
        keyboard_rows = []
        for idx, position in enumerate(positions[:5], start=1):
            lines.append(f"{idx}. {position['title_zh']}")
            lines.append(f"   🎯 {position['side_zh']} · {position['shares']} 股")
            lines.append(f"   💵 金额：${position['amount_usdc']:.2f} → 入场价：{position['entry_price']}")
            lines.append(f"   📈 P&L：{position['pnl_abs']} ({position['pnl_pct']})")
            lines.append("")
            keyboard_rows.append([InlineKeyboardButton(str(idx), callback_data=f"position_detail:{position['signal_id']}")])
        lines.append("点击下方按钮查看详情。")
        keyboard = InlineKeyboardMarkup(
            keyboard_rows
            + [
                [InlineKeyboardButton("🔄 刷新", callback_data="wallet_refresh")],
                [InlineKeyboardButton("🔙 返回钱包", callback_data="show_wallet")],
            ]
        )
        text = "\n".join(lines)
        return text, keyboard
    elif kind == "history":
        history = wallet.get("history", [])
        if not history:
            text = (
                "📜 <b>Trade History</b>\n\nNo executions yet."
                if language == "en"
                else
                "📜 <b>交易记录</b>\n\n还没有执行记录。"
            )
        else:
            lines = ["📜 <b>Trade History</b>", ""] if language == "en" else ["📜 <b>交易记录</b>", ""]
            for idx, item in enumerate(history[:5], start=1):
                title = item["title_en"] if language == "en" else item["title_zh"]
                side = item["side_en"] if language == "en" else item["side_zh"]
                status = item["status_en"] if language == "en" else item["status_zh"]
                lines.append(f"{idx}. {title}")
                lines.append(f"   {side} · ${item['amount_usdc']:.2f} · {status}")
            text = "\n".join(lines)
    elif kind == "withdraw":
        text = (
            "💸 <b>Withdraw</b>\n\n"
            "Reply with your destination wallet address. Live withdrawal is not wired yet, so this flow is disabled for production accounts."
            if language == "en"
            else
            "💸 <b>提现</b>\n\n"
            "回复你的目标钱包地址。真实提现链路还没接完，所以生产账户下这个流程暂时禁用。"
        )
        if language == "en":
            keyboard = InlineKeyboardMarkup([[InlineKeyboardButton("❌ Cancel", callback_data="withdraw_cancel")]])
        else:
            keyboard = InlineKeyboardMarkup([[InlineKeyboardButton("❌ 取消", callback_data="withdraw_cancel")]])
        return text, keyboard
    else:
        text = "Unsupported wallet page."
    back = "🔙 Back to Wallet" if language == "en" else "🔙 返回钱包"
    return text, InlineKeyboardMarkup([[InlineKeyboardButton(back, callback_data="show_wallet")]])


def deposit_text(language: str) -> str:
    if language == "en":
        return "💰 <b>Deposit</b>\n\nChoose a chain to view your Polymarket bridge deposit address."
    return "💰 <b>充值</b>\n\n请选择链查看你的 Polymarket Bridge 充值地址。"


def deposit_keyboard(language: str) -> InlineKeyboardMarkup:
    rows = []
    for start in range(0, len(DEPOSIT_CHAINS), 2):
        chunk = DEPOSIT_CHAINS[start:start + 2]
        rows.append([
            InlineKeyboardButton(chain, callback_data=f"deposit:{chain}") for chain in chunk
        ])
    topup = "🧪 Demo Top-up +50" if language == "en" else "🧪 测试充值 +50"
    rows.append([InlineKeyboardButton(topup, callback_data="wallet:demo_topup")])
    back = "🔙 Back to Wallet" if language == "en" else "🔙 返回钱包"
    rows.append([InlineKeyboardButton(back, callback_data="show_wallet")])
    return InlineKeyboardMarkup(rows)


def deposit_detail_text(chain: str, language: str, address: str) -> str:
    if language == "en":
        return (
            f"💰 <b>{chain} Deposit</b>\n\n"
            f"Deposit address:\n<code>{address}</code>\n\n"
            "Send supported assets to this bridge address and wait for Polymarket settlement."
        )
    return (
        f"💰 <b>{chain} 充值</b>\n\n"
        f"充值地址：\n<code>{address}</code>\n\n"
        "把支持的资产转到这个桥接地址，等待 Polymarket 入账。"
    )


def settings_text(language: str, subscribed: bool, sports_enabled: bool) -> str:
    if not subscribed:
        return (
            "⚙️ <b>Settings</b>\n\nSubscribe first to unlock signal preferences."
            if language == "en"
            else
            "⚙️ <b>设置</b>\n\n请先订阅信号，再解锁偏好设置。"
        )

    if language == "en":
        sports = "🟢 On" if sports_enabled else "⚪ Off"
        return (
            "⚙️ <b>Settings</b>\n\n"
            f"Language: English\n"
            f"Sports signals: {sports}\n\n"
            "Toggle language, manage signal categories, or adjust your subscription."
        )

    sports = "🟢 开启" if sports_enabled else "⚪ 关闭"
    return (
        "⚙️ <b>设置</b>\n\n"
        f"语言：简体中文\n"
        f"体育信号：{sports}\n\n"
        "切换语言、管理信号分类或调整订阅。"
    )


def settings_keyboard(language: str, subscribed: bool, sports_enabled: bool) -> InlineKeyboardMarkup:
    if not subscribed:
        if language == "en":
            rows = [
                [InlineKeyboardButton("🔔 Subscribe now", callback_data="subscribe_confirm")],
                [InlineKeyboardButton("« Back to Dashboard", callback_data="menu")],
            ]
        else:
            rows = [
                [InlineKeyboardButton("🔔 立即订阅", callback_data="subscribe_confirm")],
                [InlineKeyboardButton("« 返回主控台", callback_data="menu")],
            ]
        return InlineKeyboardMarkup(rows)

    if language == "en":
        sports_label = "🏈 Disable Sports Signals" if sports_enabled else "🏈 Enable Sports Signals"
        rows = [
            [InlineKeyboardButton("🌐 切换到中文", callback_data="settings:toggle_language")],
            [InlineKeyboardButton(sports_label, callback_data="settings:toggle_sports")],
            [InlineKeyboardButton("🔕 Unsubscribe", callback_data="unsubscribe_prompt")],
            [InlineKeyboardButton("« Back to Dashboard", callback_data="menu")],
        ]
    else:
        sports_label = "🏈 关闭体育信号" if sports_enabled else "🏈 开启体育信号"
        rows = [
            [InlineKeyboardButton("🌐 Switch to English", callback_data="settings:toggle_language")],
            [InlineKeyboardButton(sports_label, callback_data="settings:toggle_sports")],
            [InlineKeyboardButton("🔕 取消订阅", callback_data="unsubscribe_prompt")],
            [InlineKeyboardButton("« 返回主控台", callback_data="menu")],
        ]
    return InlineKeyboardMarkup(rows)


def unsubscribe_prompt(language: str) -> tuple[str, InlineKeyboardMarkup]:
    if language == "en":
        text = "🔕 <b>Unsubscribe</b>\n\nAre you sure? You can subscribe again anytime."
        rows = [
            [InlineKeyboardButton("❌ Confirm", callback_data="unsubscribe_confirm")],
            [InlineKeyboardButton("« Back", callback_data="settings:show")],
        ]
    else:
        text = "🔕 <b>取消订阅</b>\n\n确定要取消订阅吗？你随时可以重新订阅。"
        rows = [
            [InlineKeyboardButton("❌ 确认取消", callback_data="unsubscribe_confirm")],
            [InlineKeyboardButton("« 返回", callback_data="settings:show")],
        ]
    return text, InlineKeyboardMarkup(rows)


def unsubscribe_done(language: str) -> tuple[str, InlineKeyboardMarkup]:
    if language == "en":
        text = "✅ <b>Unsubscribed</b>\n\nYou will no longer receive Luna signals."
        rows = [[InlineKeyboardButton("🔔 Subscribe again", callback_data="subscribe_confirm")]]
    else:
        text = "✅ <b>已取消订阅</b>\n\n你将不再收到 Luna 信号推送。"
        rows = [[InlineKeyboardButton("🔔 重新订阅", callback_data="subscribe_confirm")]]
    return text, InlineKeyboardMarkup(rows)


def copy_text(signal_id: int, language: str, balance_usdc: float) -> str:
    signal = get_signal(signal_id)
    if signal is None:
        return ("❌ Signal not found." if language == "en" else "❌ 未找到该信号。")
    if language == "en":
        return (
            f"⚡ <b>Copy Trade</b>\n\n"
            f"{signal.title_en}\n\n"
            f"Available balance: <b>{balance_usdc:.2f} USDC</b>\n\n"
            "Choose a size below to send a real Polymarket order once live trading is configured."
        )
    return (
        f"⚡ <b>跟单</b>\n\n"
        f"{signal.title_zh}\n\n"
        f"当前可用余额：<b>{balance_usdc:.2f} USDC</b>\n\n"
        "配置真实交易凭据后，选择下方金额会直接发送真实 Polymarket 订单。"
    )


def copy_keyboard(signal_id: int, language: str, balance_usdc: float) -> InlineKeyboardMarkup:
    candidate_amounts = [1, 5, 10, 25, 50]
    available_amounts = [amount for amount in candidate_amounts if amount <= max(balance_usdc, 0)]
    rows = []
    if available_amounts:
        rows.append([
            InlineKeyboardButton(f"${amount}", callback_data=f"copy_amount:{signal_id}:{amount}")
            for amount in available_amounts[:3]
        ])
        if len(available_amounts) > 3:
            rows.append([
                InlineKeyboardButton(f"${amount}", callback_data=f"copy_amount:{signal_id}:{amount}")
                for amount in available_amounts[3:]
            ])
    if balance_usdc < 1:
        topup = "🧪 Demo Top-up +50" if language == "en" else "🧪 先测试充值 +50"
        rows.append([InlineKeyboardButton(topup, callback_data="wallet:demo_topup")])
    back = "« Back to signal" if language == "en" else "« 返回信号"
    rows.append([InlineKeyboardButton(back, callback_data=f"signal:{signal_id}")])
    return InlineKeyboardMarkup(rows)


def language_notice(language: str) -> str:
    return "✓ Language updated to English" if language == "en" else "✓ 语言已切换为简体中文"


def runtime_status_text(language: str) -> str:
    meta = get_runtime_meta()
    if not meta:
        if language == "en":
            return "🛰️ <b>Runtime Status</b>\n\nNo runtime snapshot is loaded yet. Run the refresh script first."
        return "🛰️ <b>运行时状态</b>\n\n当前还没有运行时快照。请先执行刷新脚本。"

    generated_at = meta.get("generated_at", "unknown")
    duration = meta.get("duration_sec", "?")
    wallet_count = meta.get("wallet_count", 0)
    signal_count = meta.get("signal_count", 0)
    top_wallet = meta.get("top_wallet", "-")
    top_signal = meta.get("top_signal", "-")
    if language == "en":
        return (
            "🛰️ <b>Runtime Status</b>\n\n"
            f"Generated at: {generated_at}\n"
            f"Refresh duration: {duration}s\n"
            f"Wallet profiles: {wallet_count}\n"
            f"Live signals: {signal_count}\n"
            f"Top wallet: {top_wallet}\n"
            f"Top signal: {top_signal}"
        )
    return (
        "🛰️ <b>运行时状态</b>\n\n"
        f"生成时间：{generated_at}\n"
        f"刷新耗时：{duration} 秒\n"
        f"钱包画像：{wallet_count}\n"
        f"实时信号：{signal_count}\n"
        f"头部钱包：{top_wallet}\n"
        f"头部信号：{top_signal}"
    )


def signal_history_text(language: str) -> str:
    history = get_signal_history()
    if not history:
        if language == "en":
            return "🧾 <b>Signal History</b>\n\nNo historical snapshots yet. Run the refresh pipeline first."
        return "🧾 <b>信号历史</b>\n\n当前还没有历史快照。请先执行实时刷新。"

    lines = ["🧾 <b>Signal History</b>", ""] if language == "en" else ["🧾 <b>信号历史</b>", ""]
    for snapshot in history[-3:][::-1]:
        generated_at = snapshot.get("generated_at", "unknown")
        signal_count = snapshot.get("signal_count", 0)
        top_signal = snapshot.get("top_signal", "-")
        if language == "en":
            lines.append(f"{generated_at} · {signal_count} signals")
            lines.append(f"Top: {top_signal}")
        else:
            lines.append(f"{generated_at} · {signal_count} 条信号")
            lines.append(f"头部信号：{top_signal}")
        for item in snapshot.get("signals", [])[:2]:
            title = item.get("title_en") if language == "en" else item.get("title_zh")
            action = item.get("action_en") if language == "en" else item.get("action_zh")
            status = item.get("status_en") if language == "en" else item.get("status_zh")
            if not status:
                status = "Open" if language == "en" else "待结算"
            lines.append(f"• {title} · {action} · {item.get('score')} · {status}")
        lines.append("")
    return "\n".join(lines).strip()


def signal_history_summary_text(language: str) -> str:
    summary = summarize_signal_history()
    if summary["total"] == 0:
        if language == "en":
            return "📈 <b>公开战绩</b>\n\nNo settled history yet. Signals are being tracked — check back after the first refresh."
        return "📈 <b>公开战绩</b>\n\n当前还没有可统计的历史信号。信号正在追踪中 — 刷新后即可查看。"

    category_map_en = {
        "sports": "Sports",
        "crypto": "Crypto",
        "politics": "Politics / Geopolitics",
        "other": "Mixed",
    }
    category_map_zh = {
        "sports": "体育",
        "crypto": "加密",
        "politics": "政治 / 地缘",
        "other": "综合",
    }
    category = category_map_en[summary["dominant_category"]] if language == "en" else category_map_zh[summary["dominant_category"]]
    category_counts = summary["category_counts"]

    win_rate = summary["win_rate"]
    rate_indicator = "🟢" if win_rate >= 55 else ("🟡" if win_rate >= 45 else "🔴")

    recent_lines = []
    for item in summary["recent_settled"]:
        title = item["title_en"] if language == "en" else item["title_zh"]
        status = item["status_en"] if language == "en" else item["status_zh"]
        icon = "✅" if status in {"Won", "已赢"} else "❌"
        recent_lines.append(f"{icon} {title}")
    recent_block = "\n".join(recent_lines) if recent_lines else ("No settled signals yet." if language == "en" else "最近还没有已结算信号。")

    if language == "en":
        return (
            "📈 <b>Luna Public Scorecard</b>\n\n"
            f"{rate_indicator} <b>Win Rate: {win_rate:.1f}%</b>\n"
            f"(Avg human trader on Polymarket: ~12%)\n\n"
            f"Signals tracked: {summary['total']}\n"
            f"Settled: {summary['settled']} · Open: {summary['open']}\n"
            f"Wins: {summary['won']} · Losses: {summary['lost']}\n\n"
            f"Focus: {category}\n"
            f"Mix: 🏀 {category_counts['sports']} · 📈 {category_counts['crypto']} · 🌐 {category_counts['politics']}\n\n"
            f"<b>Recent Results</b>\n{recent_block}\n\n"
            "Every signal is tracked. Every outcome is public.\n"
            "This is how Luna earns your trust."
        )
    return (
        "📈 <b>Luna 公开战绩</b>\n\n"
        f"{rate_indicator} <b>胜率：{win_rate:.1f}%</b>\n"
        f"（Polymarket 人类交易者平均：~12%）\n\n"
        f"追踪信号：{summary['total']}\n"
        f"已结算：{summary['settled']} · 待结算：{summary['open']}\n"
        f"已赢：{summary['won']} · 已输：{summary['lost']}\n\n"
        f"主要方向：{category}\n"
        f"分布：🏀 {category_counts['sports']} · 📈 {category_counts['crypto']} · 🌐 {category_counts['politics']}\n\n"
        f"<b>最近结果</b>\n{recent_block}\n\n"
        "每条信号可追踪，每个结果公开透明。\n"
        "这就是 Luna 赢得信任的方式。"
    )


def why_luna_text(language: str) -> str:
    summary = summarize_signal_history()
    win_rate_line = f"{summary['win_rate']:.1f}%" if summary["settled"] else "—"
    signals_line = str(summary["total"]) if summary["total"] else "—"

    if language == "en":
        return (
            "🌙 <b>Why Luna?</b>\n\n"
            "<b>The problem</b>\n"
            "87% of human Polymarket traders lose money. "
            "Meanwhile, 14 of the top 20 leaderboard wallets are bots. "
            "You're not competing against other humans — you're competing against machines.\n\n"
            "<b>Luna's approach</b>\n"
            "Instead of building another opaque copy-trade tool, Luna ranks wallets with <b>Smart Score</b> — "
            "a transparent rating based on win rate (65%), ROI (25%), and sample size (10%). "
            "No vanity metrics. No hidden algorithms.\n\n"
            "<b>What makes Luna different</b>\n"
            "• 🏆 <b>Smart Score</b> — ranks who to follow, not just what to buy\n"
            "• 📈 <b>Public track record</b> — every signal tracked, every outcome published\n"
            "• 🔍 <b>Wallet quality filter</b> — recent performance matters more than all-time PnL\n"
            "• 🔒 <b>Non-custodial</b> — your keys, your funds\n"
            "• ⚡ <b>Telegram-native</b> — no app downloads, no web dashboards\n\n"
            f"<b>Live stats</b>\n"
            f"Signals tracked: {signals_line}\n"
            f"Win rate: {win_rate_line}\n\n"
            "Luna earns your trust before asking for your money."
        )
    return (
        "🌙 <b>为什么选 Luna？</b>\n\n"
        "<b>问题</b>\n"
        "87% 的 Polymarket 人类交易者在亏钱。"
        "而排行榜前 20 的钱包中，14 个是机器人。"
        "你的对手不是其他人 — 是机器。\n\n"
        "<b>Luna 的方法</b>\n"
        "Luna 不做另一个黑箱跟单工具。我们用 <b>Smart Score</b> 给钱包打分 — "
        "基于胜率（65%）、ROI（25%）、样本量（10%）的透明评级。"
        "没有虚荣指标，没有隐藏算法。\n\n"
        "<b>Luna 的不同</b>\n"
        "• 🏆 <b>Smart Score</b> — 评估跟谁，而不只是买什么\n"
        "• 📈 <b>公开战绩</b> — 每条信号可追踪，每个结果公开\n"
        "• 🔍 <b>钱包质量筛选</b> — 近期表现比历史总 PnL 更重要\n"
        "• 🔒 <b>非托管</b> — 资产始终由你掌控\n"
        "• ⚡ <b>Telegram 原生</b> — 无需下载 App，无需网页\n\n"
        f"<b>实时数据</b>\n"
        f"追踪信号：{signals_line}\n"
        f"胜率：{win_rate_line}\n\n"
        "Luna 先赢得你的信任，再开放交易。"
    )


def why_luna_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("🔥 See Live Signals", callback_data="recent_signals")],
            [InlineKeyboardButton("🏆 Smart Money Leaderboard", callback_data="leaderboard")],
            [InlineKeyboardButton("📈 Public Track Record", callback_data="trackrecord")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("🔥 查看实时信号", callback_data="recent_signals")],
            [InlineKeyboardButton("🏆 聪明钱榜单", callback_data="leaderboard")],
            [InlineKeyboardButton("📈 公开战绩", callback_data="trackrecord")],
        ]
    return InlineKeyboardMarkup(rows)


def signal_list_text(language: str, sports_enabled: bool) -> str:
    return build_signal_list_text(language, sports_enabled)


def portfolio_text(language: str) -> str:
    summary = summarize_signal_history()
    win_rate = f"{summary['win_rate']:.1f}%"
    if language == "en":
        return (
            "📈 <b>Public Track Record</b>\n\n"
            f"Tracked signals: <b>{summary['total']}</b>\n"
            f"Settled: <b>{summary['settled']}</b>\n"
            f"Win rate: <b>{win_rate}</b>\n\n"
            "Luna is not asking you to trust a black box.\n"
            "Start with the receipts, then inspect the wallets."
        )
    return (
        "📈 <b>公开战绩</b>\n\n"
        f"追踪信号：<b>{summary['total']}</b>\n"
        f"已结算：<b>{summary['settled']}</b>\n"
        f"胜率：<b>{win_rate}</b>\n\n"
        "Luna 不要求你先相信黑箱。\n"
        "先看凭据，再决定跟谁。"
    )


def portfolio_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("📈 Open Scorecard", callback_data="trackrecord")],
            [InlineKeyboardButton("🏆 View Leaderboard", callback_data="leaderboard")],
            [InlineKeyboardButton("« Back to Dashboard", callback_data="menu")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("📈 打开公开战绩", callback_data="trackrecord")],
            [InlineKeyboardButton("🏆 查看聪明钱榜单", callback_data="leaderboard")],
            [InlineKeyboardButton("« 返回主控台", callback_data="menu")],
        ]
    return InlineKeyboardMarkup(rows)


def position_detail_text(market_id: int, language: str) -> str:
    position = get_position(market_id)
    if position is None:
        return ("❌ Position not found." if language == "en" else "❌ 未找到该持仓。")
    if language == "en":
        return (
            "📊 <b>Position Detail</b>\n\n"
            f"{position.title_en}\n\n"
            f"🎯 Side: {position.side_en}\n"
            f"📦 Shares: {position.shares}\n\n"
            f"💵 Avg cost: {position.avg_cost} / share\n"
            f"💵 Current: {position.current_price} / share\n\n"
            "📊 P&L Analysis\n"
            f"Cost basis: {position.cost_basis}\n"
            f"Current value: {position.current_value}\n"
            f"P&L: {position.pnl_abs} ({position.pnl_pct})"
        )
    return (
        "📊 <b>持仓详情</b>\n\n"
        f"{position.title_zh}\n\n"
        f"🎯 方向：{position.side_zh}\n"
        f"📦 份额：{position.shares}\n\n"
        f"💵 平均成本：{position.avg_cost} / 份\n"
        f"💵 当前价格：{position.current_price} / 份\n\n"
        "📊 P&L 分析\n"
        f"成本：{position.cost_basis}\n"
        f"当前价值：{position.current_value}\n"
        f"P&L：{position.pnl_abs} ({position.pnl_pct})"
    )


def render_position_detail_text(position: dict, language: str) -> str:
    _e = html_mod.escape
    if language == "en":
        return (
            "📊 <b>Position Detail</b>\n\n"
            f"{_e(str(position['title_en']))}\n\n"
            f"🎯 Side: {_e(str(position['side_en']))}\n"
            f"📦 Shares: {_e(str(position['shares']))}\n"
            f"💵 Size: ${position['amount_usdc']:.2f}\n"
            f"💵 Entry price: {_e(str(position['entry_price']))}\n"
            f"💵 Current price: {_e(str(position['current_price']))}\n\n"
            f"P&amp;L: {_e(str(position['pnl_abs']))} ({_e(str(position['pnl_pct']))})"
        )
    return (
        "📊 <b>持仓详情</b>\n\n"
        f"{_e(str(position['title_zh']))}\n\n"
        f"🎯 方向：{_e(str(position['side_zh']))}\n"
        f"📦 份额：{_e(str(position['shares']))}\n"
        f"💵 金额：${position['amount_usdc']:.2f}\n"
        f"💵 入场价：{_e(str(position['entry_price']))}\n"
        f"💵 当前价：{_e(str(position['current_price']))}\n\n"
        f"P&amp;L：{_e(str(position['pnl_abs']))} ({_e(str(position['pnl_pct']))})"
    )


def position_detail_keyboard(market_id: int, language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("💰 Close Position", callback_data=f"close_position:{market_id}")],
            [InlineKeyboardButton("🔙 Back to Portfolio", callback_data="portfolio")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("💰 平仓", callback_data=f"close_position:{market_id}")],
            [InlineKeyboardButton("🔙 返回个人主页", callback_data="portfolio")],
        ]
    return InlineKeyboardMarkup(rows)


def _grade_badge(grade: str) -> str:
    badges = {"S": "🔥", "A": "⭐", "B": "✅", "C": "⚪", "D": "⬜"}
    return badges.get(grade, "⚪")


def _wallet_line(wallet, language: str) -> str:
    badge = _grade_badge(wallet.grade)
    if language == "en":
        return f"{badge} <b>{wallet.name}</b> · {wallet.grade}{wallet.score} · ROI {wallet.roi_30d} · Win {wallet.win_rate_30d}"
    return f"{badge} <b>{wallet.name}</b> · {wallet.grade}{wallet.score} · ROI {wallet.roi_30d} · 胜率 {wallet.win_rate_30d}"


def leaderboard_text(language: str, tracked_wallets: list[str]) -> str:
    tracked_profiles = [build_tracked_wallet(address) for address in tracked_wallets]
    default_profiles = [wallet for wallet in SMART_WALLETS if normalize_wallet_address(wallet.address) not in {normalize_wallet_address(item.address) for item in tracked_profiles}]

    if tracked_wallets:
        lines = ["🏆 <b>Smart Money Leaderboard</b>", ""] if language == "en" else ["🏆 <b>聪明钱榜单</b>", ""]
        lines.append("<b>🎯 你正在追踪的钱包：</b>" if language == "zh" else "<b>🎯 Your tracked wallets:</b>")
        lines.append("")
        for wallet in tracked_profiles:
            lines.append(_wallet_line(wallet, language))
        lines.extend(["", "<b>💡 Next wallets worth watching:</b>" if language == "en" else "<b>💡 下一批值得看的钱包：</b>", ""])
        for wallet in default_profiles[:3]:
            lines.append(_wallet_line(wallet, language))
        footer = "\n\n<code>/track 0x...</code> to add more (max 3)." if language == "en" else "\n\n<code>/track 0x...</code> 添加更多（最多 3 个）。"
        return "\n".join(lines) + footer

    if language == "en":
        lines = ["🏆 <b>Smart Money Leaderboard</b>", "", "This is Luna's answer to one question: who is actually worth following?", "", "Ranked by Smart Score — win rate, ROI, sample quality:", ""]
        for wallet in SMART_WALLETS:
            lines.append(_wallet_line(wallet, language))
        lines.append("")
        lines.append("Send <code>/track 0x...</code> to track any wallet. Up to 3.")
        return "\n".join(lines)
    lines = ["🏆 <b>聪明钱榜单</b>", "", "这就是 Luna 对一个问题的回答：谁真的值得跟。", "", "基于 Smart Score 排名 — 胜率、ROI、样本质量：", ""]
    for wallet in SMART_WALLETS:
        lines.append(_wallet_line(wallet, language))
    lines.append("")
    lines.append("发送 <code>/track 0x...</code> 追踪任意钱包，最多 3 个。")
    return "\n".join(lines)


def leaderboard_keyboard(language: str, tracked_wallets: list[str]) -> InlineKeyboardMarkup:
    rows = []
    for address in tracked_wallets:
        wallet = build_tracked_wallet(address)
        rows.append([InlineKeyboardButton(f"⭐ {format_wallet_label(wallet)}", callback_data=f"wallet_profile:{wallet.address}")])
    for wallet in SMART_WALLETS:
        if normalize_wallet_address(wallet.address) in {normalize_wallet_address(item) for item in tracked_wallets}:
            continue
        rows.append([InlineKeyboardButton(format_wallet_label(wallet), callback_data=f"wallet_profile:{wallet.address}")])
    if language == "en":
        rows.append([InlineKeyboardButton("« Back to Menu", callback_data="menu")])
    else:
        rows.append([InlineKeyboardButton("« 返回主控台", callback_data="menu")])
    return InlineKeyboardMarkup(rows)


def wallet_profile_text(address: str, language: str, tracked_wallets: list[str]) -> str:
    wallet = build_tracked_wallet(address)
    badge = _grade_badge(wallet.grade)
    tracked = normalize_wallet_address(address) in {normalize_wallet_address(item) for item in tracked_wallets}
    if language == "en":
        return (
            f"{badge} <b>{wallet.name}</b> · {wallet.grade}{wallet.score}\n\n"
            f"📊 <b>30-Day Performance</b>\n"
            f"ROI: {wallet.roi_30d}\n"
            f"Win Rate: {wallet.win_rate_30d}\n"
            f"Activity: {wallet.activity}\n"
            f"Focus: {wallet.specialty_en}\n\n"
            f"💬 {wallet.note_en}\n\n"
            f"Tracking: {'🟢 On' if tracked else '⚪ Off'}\n"
            f"<code>{wallet.address}</code>"
        )
    return (
        f"{badge} <b>{wallet.name}</b> · {wallet.grade}{wallet.score}\n\n"
        f"📊 <b>30 天表现</b>\n"
        f"ROI：{wallet.roi_30d}\n"
        f"胜率：{wallet.win_rate_30d}\n"
        f"活跃度：{wallet.activity}\n"
        f"擅长：{wallet.specialty_zh}\n\n"
        f"💬 {wallet.note_zh}\n\n"
        f"追踪：{'🟢 已开启' if tracked else '⚪ 未开启'}\n"
        f"<code>{wallet.address}</code>"
    )


def wallet_profile_keyboard(address: str, language: str, tracked_wallets: list[str]) -> InlineKeyboardMarkup:
    wallet = build_tracked_wallet(address)
    market_label = "🌐 View Market" if language == "en" else "🌐 查看市场"
    back_label = "« Back to Leaderboard" if language == "en" else "« 返回榜单"
    tracked = normalize_wallet_address(address) in {normalize_wallet_address(item) for item in tracked_wallets}
    rows = []
    if wallet:
        rows.append([InlineKeyboardButton(market_label, url="https://polymarket.com")])
    if tracked:
        track_label = "➖ Stop Tracking" if language == "en" else "➖ 取消追踪"
        rows.append([InlineKeyboardButton(track_label, callback_data=f"wallet_untrack:{wallet.address}")])
    else:
        track_label = "⭐ Track Wallet" if language == "en" else "⭐ 追踪钱包"
        rows.append([InlineKeyboardButton(track_label, callback_data=f"wallet_track:{wallet.address}")])
    rows.append([InlineKeyboardButton(back_label, callback_data="leaderboard")])
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  /discover — Today's highlights page
# ──────────────────────────────────────────────

def discover_text(language: str, sports_enabled: bool) -> str:
    visible = [s for s in SIGNALS if sports_enabled or not s.sports]
    top_wallets = SMART_WALLETS[:3]

    if language == "en":
        lines = [
            "🔍 <b>Discover</b>",
            "",
            "Today's highlights from Luna's smart-money radar.",
            "",
        ]
        if visible:
            top = visible[0]
            lines.append(f"🔥 <b>Top Signal</b>")
            lines.append(f"   {top.title_en}")
            lines.append(f"   {top.action_en} · Score {top.score}")
            lines.append(f"   Expected: {top.expected_return}")
            lines.append("")
        if len(visible) > 1:
            lines.append("📋 <b>More Signals</b>")
            for s in visible[1:4]:
                lines.append(f"   • {s.title_en} ({s.score})")
            lines.append("")
        if top_wallets:
            lines.append("🏆 <b>Wallets to Watch</b>")
            for w in top_wallets:
                lines.append(f"   {w.name} · {w.grade}{w.score} · WR {w.win_rate_30d} · ROI {w.roi_30d}")
            lines.append("")
        if not visible and not top_wallets:
            lines.append("No discoveries available right now. Try /refreshnow first.")
        return "\n".join(lines)

    lines = [
        "🔍 <b>发现</b>",
        "",
        "今日来自 Luna 聪明钱雷达的亮点。",
        "",
    ]
    if visible:
        top = visible[0]
        lines.append(f"🔥 <b>头号信号</b>")
        lines.append(f"   {top.title_zh}")
        lines.append(f"   {top.action_zh} · 评分 {top.score}")
        lines.append(f"   预期收益：{top.expected_return}")
        lines.append("")
    if len(visible) > 1:
        lines.append("📋 <b>更多信号</b>")
        for s in visible[1:4]:
            lines.append(f"   • {s.title_zh}（{s.score}）")
        lines.append("")
    if top_wallets:
        lines.append("🏆 <b>值得关注的钱包</b>")
        for w in top_wallets:
            lines.append(f"   {w.name} · {w.grade}{w.score} · 胜率 {w.win_rate_30d} · ROI {w.roi_30d}")
        lines.append("")
    if not visible and not top_wallets:
        lines.append("暂无发现，请先 /refreshnow 刷新数据。")
    return "\n".join(lines)


def discover_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("📋 All Signals", callback_data="recent_signals"),
             InlineKeyboardButton("🏆 Leaderboard", callback_data="leaderboard")],
            [InlineKeyboardButton("🔄 Refresh", callback_data="discover_refresh"),
             InlineKeyboardButton("📊 Menu", callback_data="menu")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("📋 全部信号", callback_data="recent_signals"),
             InlineKeyboardButton("🏆 榜单", callback_data="leaderboard")],
            [InlineKeyboardButton("🔄 刷新", callback_data="discover_refresh"),
             InlineKeyboardButton("📊 主控台", callback_data="menu")],
        ]
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  /refer — Referral link generation
# ──────────────────────────────────────────────

def refer_text(language: str, user_id: int, referral_count: int = 0) -> str:
    link = f"https://t.me/GetLunaAIBot?start=ref_{user_id}"
    if language == "en":
        return (
            "🎁 <b>Invite Friends to Luna</b>\n\n"
            "Share your personal referral link:\n"
            f"<code>{link}</code>\n\n"
            f"Friends invited so far: <b>{referral_count}</b>\n\n"
            "Each friend who subscribes earns you priority signal access "
            "and future fee rebates.\n\n"
            "🔗 Tap the link above to copy it."
        )
    return (
        "🎁 <b>邀请好友加入 Luna</b>\n\n"
        "分享你的专属邀请链接：\n"
        f"<code>{link}</code>\n\n"
        f"已邀请好友：<b>{referral_count}</b>\n\n"
        "每位订阅的好友将为你解锁优先信号推送和未来手续费返利。\n\n"
        "🔗 点击上方链接复制。"
    )


def refer_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("📊 My Referrals", callback_data="referrals")],
            [InlineKeyboardButton("« Menu", callback_data="menu")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("📊 我的邀请记录", callback_data="referrals")],
            [InlineKeyboardButton("« 主控台", callback_data="menu")],
        ]
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  /referrals — Referral ledger
# ──────────────────────────────────────────────

def referrals_text(language: str, referral_state: dict) -> str:
    count = len(referral_state.get("invited_users", []))
    earnings = referral_state.get("total_earnings_usdc", 0.0)
    referred_by = referral_state.get("referred_by", "")

    if language == "en":
        lines = [
            "📊 <b>Referral Ledger</b>",
            "",
            f"👥 Total invited: <b>{count}</b>",
            f"💰 Total earnings: <b>${earnings:.2f} USDC</b>",
        ]
        if referred_by:
            lines.append(f"🔗 Referred by: <code>{referred_by}</code>")
        lines.append("")
        if count == 0:
            lines.append("Share your /refer link to start earning!")
        else:
            lines.append("Keep sharing — more referrals = more rewards.")
        return "\n".join(lines)

    lines = [
        "📊 <b>邀请记录</b>",
        "",
        f"👥 已邀请：<b>{count}</b> 人",
        f"💰 累计收益：<b>${earnings:.2f} USDC</b>",
    ]
    if referred_by:
        lines.append(f"🔗 邀请人：<code>{referred_by}</code>")
    lines.append("")
    if count == 0:
        lines.append("分享你的 /refer 链接开始赚取奖励！")
    else:
        lines.append("继续分享 — 邀请越多，奖励越多。")
    return "\n".join(lines)


def referrals_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("🎁 Share Link", callback_data="refer")],
            [InlineKeyboardButton("« Menu", callback_data="menu")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("🎁 分享链接", callback_data="refer")],
            [InlineKeyboardButton("« 主控台", callback_data="menu")],
        ]
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  /creators — Creator spotlight
# ──────────────────────────────────────────────

def creators_text(language: str) -> str:
    wallets = SMART_WALLETS[:5]
    if language == "en":
        lines = [
            "⭐ <b>Creator Spotlight</b>",
            "",
            "Top-performing wallets tracked by Luna's Smart Score algorithm.",
            "",
        ]
        for i, w in enumerate(wallets, 1):
            lines.append(
                f"{i}. <b>{html_mod.escape(w.name)}</b> · {w.grade}{w.score}\n"
                f"   WR {w.win_rate_30d} · ROI {w.roi_30d} · {w.activity}\n"
                f"   {w.specialty_en}"
            )
            lines.append("")
        if not wallets:
            lines.append("No creators available yet. Run /refreshnow to load data.")
        return "\n".join(lines)

    lines = [
        "⭐ <b>创作者聚焦</b>",
        "",
        "Luna Smart Score 算法追踪的顶级钱包。",
        "",
    ]
    for i, w in enumerate(wallets, 1):
        lines.append(
            f"{i}. <b>{html_mod.escape(w.name)}</b> · {w.grade}{w.score}\n"
            f"   胜率 {w.win_rate_30d} · ROI {w.roi_30d} · {w.activity}\n"
            f"   {w.specialty_zh}"
        )
        lines.append("")
    if not wallets:
        lines.append("暂无创作者数据。请先 /refreshnow 刷新。")
    return "\n".join(lines)


def creators_keyboard(language: str) -> InlineKeyboardMarkup:
    wallets = SMART_WALLETS[:5]
    rows = []
    for w in wallets:
        label = f"👤 {w.name} ({w.grade}{w.score})"
        rows.append([InlineKeyboardButton(label, callback_data=f"wallet_profile:{w.address}")])
    back = "« Menu" if language == "en" else "« 主控台"
    rows.append([InlineKeyboardButton(back, callback_data="menu")])
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  /pnl — PnL snapshot
# ──────────────────────────────────────────────

def pnl_text(language: str, wallet: dict) -> str:
    positions = wallet.get("positions", [])
    balance = wallet.get("balance_usdc", 0.0)

    total_invested = sum(p.get("amount_usdc", 0) for p in positions)
    total_value = sum(p.get("current_value_usdc", p.get("amount_usdc", 0)) for p in positions)
    total_pnl = total_value - total_invested

    if language == "en":
        lines = [
            "📈 <b>Your PnL Snapshot</b>",
            "",
            f"💰 Balance: <b>${balance:.2f} USDC</b>",
            f"📊 Positions: <b>{len(positions)}</b>",
            f"💵 Invested: <b>${total_invested:.2f}</b>",
            f"📈 Current Value: <b>${total_value:.2f}</b>",
            f"{'🟢' if total_pnl >= 0 else '🔴'} PnL: <b>{'+' if total_pnl >= 0 else ''}{total_pnl:.2f} USDC</b>",
            "",
        ]
        if positions:
            lines.append("<b>Position Breakdown:</b>")
            for p in positions[:10]:
                title = p.get("title_en", p.get("title_zh", "?"))
                pnl = p.get("pnl_abs", "$0.00")
                pct = p.get("pnl_pct", "0.0%")
                lines.append(f"  • {title}: {pnl} ({pct})")
        return "\n".join(lines)

    lines = [
        "📈 <b>你的盈亏快照</b>",
        "",
        f"💰 余额：<b>${balance:.2f} USDC</b>",
        f"📊 持仓数：<b>{len(positions)}</b>",
        f"💵 已投入：<b>${total_invested:.2f}</b>",
        f"📈 当前价值：<b>${total_value:.2f}</b>",
        f"{'🟢' if total_pnl >= 0 else '🔴'} 盈亏：<b>{'+' if total_pnl >= 0 else ''}{total_pnl:.2f} USDC</b>",
        "",
    ]
    if positions:
        lines.append("<b>持仓明细：</b>")
        for p in positions[:10]:
            title = p.get("title_zh", p.get("title_en", "?"))
            pnl = p.get("pnl_abs", "$0.00")
            pct = p.get("pnl_pct", "0.0%")
            lines.append(f"  • {title}：{pnl}（{pct}）")
    return "\n".join(lines)


def pnl_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("📤 Share PnL", callback_data="pnl_share")],
            [InlineKeyboardButton("💰 Wallet", callback_data="show_wallet"),
             InlineKeyboardButton("« Menu", callback_data="menu")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("📤 分享盈亏", callback_data="pnl_share")],
            [InlineKeyboardButton("💰 钱包", callback_data="show_wallet"),
             InlineKeyboardButton("« 主控台", callback_data="menu")],
        ]
    return InlineKeyboardMarkup(rows)


def pnl_share_text(language: str, wallet: dict, user_id: int) -> str:
    positions = wallet.get("positions", [])
    total_invested = sum(p.get("amount_usdc", 0) for p in positions)
    total_value = sum(p.get("current_value_usdc", p.get("amount_usdc", 0)) for p in positions)
    total_pnl = total_value - total_invested
    link = f"https://t.me/GetLunaAIBot?start=ref_{user_id}"

    if language == "en":
        return (
            f"🌙 Luna PnL Report\n\n"
            f"Positions: {len(positions)}\n"
            f"Total PnL: {'+' if total_pnl >= 0 else ''}{total_pnl:.2f} USDC\n\n"
            f"Join Luna 👉 {link}"
        )
    return (
        f"🌙 Luna 盈亏报告\n\n"
        f"持仓数：{len(positions)}\n"
        f"总盈亏：{'+' if total_pnl >= 0 else ''}{total_pnl:.2f} USDC\n\n"
        f"加入 Luna 👉 {link}"
    )


# ──────────────────────────────────────────────
#  /copydesk — Copy trading desk
# ──────────────────────────────────────────────

def copydesk_text(language: str, sports_enabled: bool) -> str:
    visible = [s for s in SIGNALS if sports_enabled or not s.sports]

    if language == "en":
        lines = [
            "📋 <b>Copy Trading Desk</b>",
            "",
            "Curated signals ready for one-tap copy.",
            "",
        ]
        if not visible:
            lines.append("No signals available. Run /refreshnow first.")
            return "\n".join(lines)
        for s in visible[:6]:
            risk = "🟢 Low" if s.score >= 85 else ("🟡 Medium" if s.score >= 70 else "🔴 High")
            lines.append(
                f"<b>{s.title_en}</b>\n"
                f"   {s.action_en} · Score {s.score} · Risk: {risk}\n"
                f"   Price: {s.current_price} · Return: {s.expected_return}"
            )
            lines.append("")
        return "\n".join(lines)

    lines = [
        "📋 <b>跟单交易台</b>",
        "",
        "精选信号，一键跟单。",
        "",
    ]
    if not visible:
        lines.append("暂无信号，请先 /refreshnow 刷新。")
        return "\n".join(lines)
    for s in visible[:6]:
        risk = "🟢 低风险" if s.score >= 85 else ("🟡 中风险" if s.score >= 70 else "🔴 高风险")
        lines.append(
            f"<b>{s.title_zh}</b>\n"
            f"   {s.action_zh} · 评分 {s.score} · 风险：{risk}\n"
            f"   价格：{s.current_price} · 预期收益：{s.expected_return}"
        )
        lines.append("")
    return "\n".join(lines)


def copydesk_keyboard(language: str, sports_enabled: bool) -> InlineKeyboardMarkup:
    visible = [s for s in SIGNALS if sports_enabled or not s.sports]
    rows = []
    for s in visible[:4]:
        label = f"📋 {s.title_en[:25]}..." if language == "en" else f"📋 {s.title_zh[:25]}..."
        rows.append([
            InlineKeyboardButton(label, callback_data=f"signal:{s.id}"),
            InlineKeyboardButton("⚡ Copy", callback_data=f"copy:{s.id}"),
        ])
    back = "« Menu" if language == "en" else "« 主控台"
    rows.append([InlineKeyboardButton(back, callback_data="menu")])
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  /follow — Follow task management
# ──────────────────────────────────────────────

def follow_text(language: str, follow_tasks: list, tracked_wallets: list) -> str:
    active_follows = [t for t in follow_tasks if t.get("active")]

    if language == "en":
        lines = [
            "👁 <b>Follow Tasks</b>",
            "",
            f"Active follows: <b>{len(active_follows)}</b>",
            f"Tracked wallets: <b>{len(tracked_wallets)}</b>",
            "",
        ]
        if active_follows:
            lines.append("<b>Active:</b>")
            for t in active_follows:
                addr = t.get("wallet_address", "?")
                short = f"{addr[:6]}...{addr[-4:]}" if len(addr) > 12 else addr
                lines.append(f"   🟢 {short}")
            lines.append("")
        if tracked_wallets:
            lines.append("<b>Tracked (not following):</b>")
            followed_addrs = {t.get("wallet_address", "").lower() for t in active_follows}
            for addr in tracked_wallets:
                if addr.lower() not in followed_addrs:
                    short = f"{addr[:6]}...{addr[-4:]}" if len(addr) > 12 else addr
                    lines.append(f"   ⚪ {short}")
        if not active_follows and not tracked_wallets:
            lines.append("No follows or tracked wallets yet. Use /track or /leaderboard to add wallets.")
        return "\n".join(lines)

    lines = [
        "👁 <b>关注任务</b>",
        "",
        f"活跃关注：<b>{len(active_follows)}</b>",
        f"追踪钱包：<b>{len(tracked_wallets)}</b>",
        "",
    ]
    if active_follows:
        lines.append("<b>活跃关注：</b>")
        for t in active_follows:
            addr = t.get("wallet_address", "?")
            short = f"{addr[:6]}...{addr[-4:]}" if len(addr) > 12 else addr
            lines.append(f"   🟢 {short}")
        lines.append("")
    if tracked_wallets:
        lines.append("<b>已追踪（未关注）：</b>")
        followed_addrs = {t.get("wallet_address", "").lower() for t in active_follows}
        for addr in tracked_wallets:
            if addr.lower() not in followed_addrs:
                short = f"{addr[:6]}...{addr[-4:]}" if len(addr) > 12 else addr
                lines.append(f"   ⚪ {short}")
    if not active_follows and not tracked_wallets:
        lines.append("暂无关注或追踪钱包。使用 /track 或 /leaderboard 添加钱包。")
    return "\n".join(lines)


def follow_keyboard(language: str, follow_tasks: list, tracked_wallets: list) -> InlineKeyboardMarkup:
    rows = []
    active_follows = [t for t in follow_tasks if t.get("active")]
    followed_addrs = {t.get("wallet_address", "").lower() for t in active_follows}

    # Add follow buttons for tracked wallets not yet followed
    for addr in tracked_wallets[:3]:
        if addr.lower() not in followed_addrs:
            short = f"{addr[:6]}...{addr[-4:]}" if len(addr) > 12 else addr
            label = f"➕ Follow {short}" if language == "en" else f"➕ 关注 {short}"
            rows.append([InlineKeyboardButton(label, callback_data=f"follow_add:{addr}")])

    # Remove follow buttons for active follows
    for t in active_follows[:3]:
        addr = t.get("wallet_address", "")
        short = f"{addr[:6]}...{addr[-4:]}" if len(addr) > 12 else addr
        label = f"➖ Unfollow {short}" if language == "en" else f"➖ 取消关注 {short}"
        rows.append([InlineKeyboardButton(label, callback_data=f"follow_remove:{addr}")])

    back = "« Menu" if language == "en" else "« 主控台"
    rows.append([InlineKeyboardButton(back, callback_data="menu")])
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  /news — News-driven signal triggers
# ──────────────────────────────────────────────

def news_text(language: str, sports_enabled: bool) -> str:
    visible = [s for s in SIGNALS if sports_enabled or not s.sports]
    now_signals = visible[:3]

    if language == "en":
        lines = [
            "📰 <b>News-Driven Signals</b>",
            "",
            "Market-moving events matched to tradeable signals.",
            "",
        ]
        if now_signals:
            for s in now_signals:
                lines.append(
                    f"📌 <b>{s.title_en}</b>\n"
                    f"   {s.action_en} · Score {s.score}\n"
                    f"   🔗 <a href=\"{s.detail_url}\">Research</a>"
                )
                lines.append("")
        else:
            lines.append("No news-driven signals right now. Check back after a data refresh.")
        return "\n".join(lines)

    lines = [
        "📰 <b>新闻驱动信号</b>",
        "",
        "与市场事件关联的可交易信号。",
        "",
    ]
    if now_signals:
        for s in now_signals:
            lines.append(
                f"📌 <b>{s.title_zh}</b>\n"
                f"   {s.action_zh} · 评分 {s.score}\n"
                f"   🔗 <a href=\"{s.detail_url}\">研究</a>"
            )
            lines.append("")
    else:
        lines.append("暂无新闻驱动信号。数据刷新后再来看看。")
    return "\n".join(lines)


def news_keyboard(language: str, sports_enabled: bool) -> InlineKeyboardMarkup:
    visible = [s for s in SIGNALS if sports_enabled or not s.sports]
    rows = []
    for s in visible[:3]:
        label = f"⚡ {s.title_en[:30]}" if language == "en" else f"⚡ {s.title_zh[:30]}"
        rows.append([InlineKeyboardButton(label, callback_data=f"signal:{s.id}")])
    back = "« Menu" if language == "en" else "« 主控台"
    rows.append([InlineKeyboardButton(back, callback_data="menu")])
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  /arb — Arbitrage opportunities
# ──────────────────────────────────────────────

def arb_text(language: str, sports_enabled: bool) -> str:
    visible = [s for s in SIGNALS if sports_enabled or not s.sports]
    # Simulate arb detection based on price extremes
    arb_candidates = [s for s in visible if s.current_price and (
        int(s.current_price.replace("¢", "").replace("$", "").split(".")[0]) < 25
        or int(s.current_price.replace("¢", "").replace("$", "").split(".")[0]) > 80
    )]

    if language == "en":
        lines = [
            "📊 <b>Arbitrage Opportunities</b>",
            "",
            "Potential edges detected from price discrepancies and smart-money divergence.",
            "",
        ]
        if arb_candidates:
            for s in arb_candidates[:5]:
                lines.append(
                    f"💎 <b>{s.title_en}</b>\n"
                    f"   Price: {s.current_price} · Expected: {s.expected_return}\n"
                    f"   Score: {s.score} · Liquidity: {s.liquidity}"
                )
                lines.append("")
        else:
            lines.append("No clear arbitrage opportunities at the moment.")
            lines.append("Arb detection runs automatically — check back after a refresh.")
        return "\n".join(lines)

    lines = [
        "📊 <b>套利机会</b>",
        "",
        "从价格偏差和聪明钱分歧中发现的潜在机会。",
        "",
    ]
    if arb_candidates:
        for s in arb_candidates[:5]:
            lines.append(
                f"💎 <b>{s.title_zh}</b>\n"
                f"   价格：{s.current_price} · 预期收益：{s.expected_return}\n"
                f"   评分：{s.score} · 流动性：{s.liquidity}"
            )
            lines.append("")
    else:
        lines.append("目前没有明显的套利机会。")
        lines.append("套利检测自动运行 — 刷新后再来看看。")
    return "\n".join(lines)


def arb_keyboard(language: str, sports_enabled: bool) -> InlineKeyboardMarkup:
    visible = [s for s in SIGNALS if sports_enabled or not s.sports]
    arb_candidates = [s for s in visible if s.current_price and (
        int(s.current_price.replace("¢", "").replace("$", "").split(".")[0]) < 25
        or int(s.current_price.replace("¢", "").replace("$", "").split(".")[0]) > 80
    )]
    rows = []
    for s in arb_candidates[:3]:
        label = f"⚡ Trade {s.title_en[:25]}" if language == "en" else f"⚡ 交易 {s.title_zh[:25]}"
        rows.append([InlineKeyboardButton(label, callback_data=f"copy:{s.id}")])
    back = "« Menu" if language == "en" else "« 主控台"
    rows.append([InlineKeyboardButton(back, callback_data="menu")])
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  /receipts — Trade receipts
# ──────────────────────────────────────────────

def receipts_text(language: str, wallet: dict) -> str:
    history = wallet.get("history", [])

    if language == "en":
        lines = [
            "🧾 <b>Trade Receipts</b>",
            "",
            f"Total transactions: <b>{len(history)}</b>",
            "",
        ]
        if history:
            for i, h in enumerate(history[:15], 1):
                kind = h.get("kind", "unknown")
                icon = {"buy": "🟢", "close": "🔴", "deposit": "📥", "withdraw": "📤"}.get(kind, "⚪")
                title = h.get("title_en", h.get("title_zh", "—"))
                amount = h.get("amount_usdc", 0)
                status = h.get("status_en", "—")
                lines.append(f"{icon} {title} · ${amount:.2f} · {status}")
        else:
            lines.append("No trade history yet. Copy a signal to get started!")
        return "\n".join(lines)

    lines = [
        "🧾 <b>交易凭据</b>",
        "",
        f"总交易数：<b>{len(history)}</b>",
        "",
    ]
    if history:
        for i, h in enumerate(history[:15], 1):
            kind = h.get("kind", "unknown")
            icon = {"buy": "🟢", "close": "🔴", "deposit": "📥", "withdraw": "📤"}.get(kind, "⚪")
            title = h.get("title_zh", h.get("title_en", "—"))
            amount = h.get("amount_usdc", 0)
            status = h.get("status_zh", "—")
            lines.append(f"{icon} {title} · ${amount:.2f} · {status}")
    else:
        lines.append("暂无交易记录。跟单一个信号开始吧！")
    return "\n".join(lines)


def receipts_keyboard(language: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("💰 Wallet", callback_data="show_wallet"),
             InlineKeyboardButton("📈 PnL", callback_data="pnl")],
            [InlineKeyboardButton("« Menu", callback_data="menu")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("💰 钱包", callback_data="show_wallet"),
             InlineKeyboardButton("📈 盈亏", callback_data="pnl")],
            [InlineKeyboardButton("« 主控台", callback_data="menu")],
        ]
    return InlineKeyboardMarkup(rows)


# ──────────────────────────────────────────────
#  URL paste → trade card
# ──────────────────────────────────────────────

def url_trade_card_text(language: str, url: str, market_data: dict | None = None) -> str:
    if market_data:
        title = market_data.get("title", url)
        price = market_data.get("price", "—")
        volume = market_data.get("volume", "—")
    else:
        title = url.split("/")[-1].replace("-", " ").title() if "/" in url else url
        price = "—"
        volume = "—"

    if language == "en":
        return (
            f"🃏 <b>Trade Card</b>\n\n"
            f"📌 <b>{html_mod.escape(title)}</b>\n"
            f"💰 Price: {price}\n"
            f"📊 Volume: {volume}\n"
            f"🔗 <a href=\"{html_mod.escape(url)}\">View on Polymarket</a>"
        )
    return (
        f"🃏 <b>交易卡片</b>\n\n"
        f"📌 <b>{html_mod.escape(title)}</b>\n"
        f"💰 价格：{price}\n"
        f"📊 交易量：{volume}\n"
        f"🔗 <a href=\"{html_mod.escape(url)}\">在 Polymarket 查看</a>"
    )


def url_trade_card_keyboard(language: str, url: str) -> InlineKeyboardMarkup:
    if language == "en":
        rows = [
            [InlineKeyboardButton("🌐 Open Market", url=url)],
            [InlineKeyboardButton("📋 All Signals", callback_data="recent_signals"),
             InlineKeyboardButton("« Menu", callback_data="menu")],
        ]
    else:
        rows = [
            [InlineKeyboardButton("🌐 打开市场", url=url)],
            [InlineKeyboardButton("📋 全部信号", callback_data="recent_signals"),
             InlineKeyboardButton("« 主控台", callback_data="menu")],
        ]
    return InlineKeyboardMarkup(rows)
