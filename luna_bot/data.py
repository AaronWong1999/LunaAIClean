from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from luna_bot.models import Position, Signal, SignalOutcome, WalletProfile

_logger = logging.getLogger(__name__)


REPLY_KEYBOARD = [
    ["📋 最新信号", "💰 钱包"],
    ["📈 公开战绩", "🏆 聪明钱榜单"],
    ["⚙️ 设置", "📊 主控台"],
]

REPLY_KEYBOARD_EN = [
    ["📋 Latest Signals", "💰 Wallet"],
    ["📈 Track Record", "🏆 Leaderboard"],
    ["⚙️ Settings", "📊 Menu"],
]

DEPOSIT_CHAINS = [
    "Ethereum", "Optimism", "Solana", "Polygon", "Monad", "Abstract",
    "Arbitrum", "Ethereal", "BNB", "Tron", "Bitcoin", "Base", "HyperEVM",
]

DEFAULT_SIGNALS = [
    Signal(
        id=1,
        title_zh="比特币会在三月份达到 75,000 美元吗？",
        title_en="Will Bitcoin hit $75,000 in March?",
        action_zh="🎯 买入 Yes @ 51¢",
        action_en="🎯 Buy Yes @ 51¢",
        score=81,
        current_price="51¢",
        expected_return="+98.0%",
        daily_return="4.5%",
        liquidity="$148,950",
        expiry_zh="2026-04-01（21 天）",
        expiry_en="2026-04-01 (21 days)",
        source_count="1 位聪明钱，$2,720",
        detail_url="https://thealiceai.com/tg/714182a9",
        market_url="https://polymarket.com",
        analysis_zh="多个预测市场显示比特币在 3 月底前达到 75,000 美元的概率高于当前定价。价格只需要从约 68,404 美元再上涨约 9.5%，真正的关键催化剂是 3 月中旬的美联储决议和风险偏好回升。",
        analysis_en="Cross-market pricing suggests the probability of Bitcoin touching $75,000 before month-end is higher than current odds imply. BTC only needs roughly a 9.5% move from the low $68k range, with the March Fed decision acting as the main catalyst.",
    ),
    Signal(
        id=2,
        title_zh="原油（CL）的最高价会在 3 月底前达到 200 美元吗？",
        title_en="Will crude oil (CL) trade at $200 before month-end?",
        action_zh="🎯 买入 No @ 97¢",
        action_en="🎯 Buy No @ 97¢",
        score=91,
        current_price="97¢",
        expected_return="+3.0%",
        daily_return="0.2%",
        liquidity="$92,340",
        expiry_zh="2026-03-31（20 天）",
        expiry_en="2026-03-31 (20 days)",
        source_count="2 位聪明钱，$8,410",
        detail_url="https://thealiceai.com/tg/c4014b48",
        market_url="https://polymarket.com",
        analysis_zh="这是典型的高概率低收益 No 信号。原油在短时间内从当前区间冲到 200 美元需要极端地缘事件，当前赔率更像是在卖尾部风险。适合低风险偏好的用户。",
        analysis_en="This is a classic high-probability, low-yield No setup. Crude reaching $200 in the current time window would require an extreme geopolitical shock, so the market is effectively pricing tail risk here.",
    ),
    Signal(
        id=3,
        title_zh="印第安维尔斯公开赛：卡洛斯·阿尔卡拉斯 vs 亚瑟·林德内克",
        title_en="Indian Wells: Carlos Alcaraz vs Arthur Rinderknech",
        action_zh="🎯 买入 Yes @ 87¢",
        action_en="🎯 Buy Yes @ 87¢",
        score=88,
        current_price="87¢",
        expected_return="+14.9%",
        daily_return="6.1%",
        liquidity="$204,880",
        expiry_zh="今日结算",
        expiry_en="Settles today",
        source_count="3 位聪明钱，$5,980",
        detail_url="https://thealiceai.com/tg/a0ec199b",
        market_url="https://polymarket.com",
        analysis_zh="体育市场是 Polymarket 当前最活跃的交易场景。该场比赛赔率和聪明钱方向一致，且市场深度足够，属于 Luna 高分信号的典型样本。",
        analysis_en="Sports markets now dominate Polymarket flow. Here, market odds and tracked smart-money behavior line up, while liquidity is deep enough to make this a clean high-score signal.",
        sports=True,
    ),
    Signal(
        id=4,
        title_zh="美国与伊朗会在 4 月 30 日前停火吗？",
        title_en="Will the US and Iran reach a ceasefire by April 30?",
        action_zh="🎯 买入 No @ 56¢",
        action_en="🎯 Buy No @ 56¢",
        score=87,
        current_price="56¢",
        expected_return="+79%",
        daily_return="2.3%",
        liquidity="$133,420",
        expiry_zh="2026-04-30（34 天）",
        expiry_en="2026-04-30 (34 days)",
        source_count="2 位聪明钱，$4,950",
        detail_url="https://thealiceai.com/tg/f4f59e80",
        market_url="https://polymarket.com/market/us-x-iran-ceasefire-by-april-30-194-679",
        analysis_zh="地缘政治相关市场仍然容易受突发新闻驱动。当前赔率显示市场对快速停火偏乐观，而追踪钱包更偏向于做 No，认为实际谈判和公开宣布之间仍有时间差。",
        analysis_en="Geopolitical contracts remain highly news-sensitive. Current pricing leans too optimistic on a fast ceasefire, while tracked wallets are leaning No on the view that negotiations and a formal announcement are still far apart.",
    ),
    Signal(
        id=5,
        title_zh="快船 vs 步行者",
        title_en="Clippers vs. Pacers",
        action_zh="🎯 买入 Clippers @ 80¢",
        action_en="🎯 Buy Clippers @ 80¢",
        score=87,
        current_price="80¢",
        expected_return="+25%",
        daily_return="8.5%",
        liquidity="$98,770",
        expiry_zh="今日结算",
        expiry_en="Settles today",
        source_count="2 位聪明钱，$3,400",
        detail_url="https://thealiceai.com/tg/5b1a2c7e",
        market_url="https://polymarket.com/market/nba-lac-ind-2026-03-27",
        analysis_zh="这类高赔率偏热的比赛市场，关键不是简单跟赔率，而是看盘口变化和聪明钱加仓时点。该信号属于 Luna 后续最适合做战绩公开的标准化体育样本。",
        analysis_en="In heavily traded sports contracts, the edge is less about raw odds and more about timing, line movement, and where tracked wallets are adding. This is the kind of clean sports setup Luna can later benchmark with public outcome tracking.",
        sports=True,
    ),
]

POSITIONS = [
    Position(
        market_id=1466014,
        title_zh="美国与伊朗会在 3 月 15 日前停火吗？",
        title_en="US x Iran ceasefire by March 15?",
        side_zh="No",
        side_en="No",
        shares="2.17",
        avg_cost="$0.92",
        current_price="$1.00",
        cost_basis="$2.00",
        current_value="$2.17",
        pnl_abs="+$0.17",
        pnl_pct="+8.70%",
        market_url="https://polymarket.com/market/us-x-iran-ceasefire-by-march-15",
    ),
]

DEFAULT_SMART_WALLETS = [
    WalletProfile(
        address="0x7a11c0ffee1234567890abcdef12345678904b9e",
        name="beachboy4",
        score=95,
        grade="S",
        roi_30d="+65%",
        win_rate_30d="96.9%",
        activity="96 settled trades",
        specialty_zh="体育 + 高频强势市场",
        specialty_en="Sports + high-frequency conviction markets",
        note_zh="近期表现极强，是 Luna 当前最值得关注的钱包之一。",
        note_en="Extremely strong recent performance; one of Luna's highest-priority wallets to watch.",
    ),
    WalletProfile(
        address="0x0f55babe1234567890abcdef1234567890abd812",
        name="majorexploiter",
        score=98,
        grade="S",
        roi_30d="+72%",
        win_rate_30d="100%",
        activity="55 settled trades",
        specialty_zh="体育 + 风险收益比高的 No 仓位",
        specialty_en="Sports + asymmetric No positions",
        note_zh="样本量还需继续验证，但当前战绩非常夸张。",
        note_en="Needs more sample size, but current performance is exceptionally strong.",
    ),
    WalletProfile(
        address="0x2c44faded1234567890abcdef1234567890ab0191",
        name="FTWUTB",
        score=82,
        grade="A",
        roi_30d="+39%",
        win_rate_30d="72.7%",
        activity="55 settled trades",
        specialty_zh="体育 + 中赔率方向盘",
        specialty_en="Sports + mid-odds directional plays",
        note_zh="不是最顶尖，但足够稳定，适合做 A 级示例。",
        note_en="Not elite, but stable enough to represent Luna's A-tier wallets.",
    ),
]

SIGNAL_OUTCOMES = [
    SignalOutcome(1, "待结算", "Open", "市场尚未结算", "Market has not settled yet"),
    SignalOutcome(2, "待结算", "Open", "高概率 No 仓位", "High-probability No position"),
    SignalOutcome(3, "已赢", "Won", "已按 Yes 方向结算", "Settled in favor of Yes"),
    SignalOutcome(4, "待结算", "Open", "等待地缘政治进展", "Awaiting geopolitical developments"),
    SignalOutcome(5, "待结算", "Open", "比赛进行中", "Game still in progress"),
]

_HEX_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
RUNTIME_SIGNALS_PATH = DATA_DIR / "runtime_signals.json"
RUNTIME_WALLETS_PATH = DATA_DIR / "runtime_wallet_profiles.json"
RUNTIME_META_PATH = DATA_DIR / "runtime_meta.json"
RUNTIME_HISTORY_PATH = DATA_DIR / "runtime_signal_history.json"


def _signal_from_dict(item: dict) -> Signal:
    return Signal(
        id=int(item["id"]),
        title_zh=item["title_zh"],
        title_en=item["title_en"],
        action_zh=item["action_zh"],
        action_en=item["action_en"],
        score=int(item["score"]),
        current_price=item["current_price"],
        expected_return=item["expected_return"],
        daily_return=item["daily_return"],
        liquidity=item["liquidity"],
        expiry_zh=item["expiry_zh"],
        expiry_en=item["expiry_en"],
        source_count=item["source_count"],
        detail_url=item["detail_url"],
        market_url=item["market_url"],
        analysis_zh=item["analysis_zh"],
        analysis_en=item["analysis_en"],
        sports=bool(item.get("sports", False)),
        slug=item.get("slug"),
        selected_outcome=item.get("selected_outcome"),
    )


def _wallet_from_dict(item: dict) -> WalletProfile:
    return WalletProfile(
        address=item["address"],
        name=item["name"],
        score=int(item["score"]),
        grade=item["grade"],
        roi_30d=item["roi_30d"],
        win_rate_30d=item["win_rate_30d"],
        activity=item["activity"],
        specialty_zh=item["specialty_zh"],
        specialty_en=item["specialty_en"],
        note_zh=item["note_zh"],
        note_en=item["note_en"],
    )


def _load_runtime_signals() -> list[Signal]:
    if not RUNTIME_SIGNALS_PATH.exists():
        return DEFAULT_SIGNALS
    try:
        payload = json.loads(RUNTIME_SIGNALS_PATH.read_text())
        signals = [_signal_from_dict(item) for item in payload]
        return signals or DEFAULT_SIGNALS
    except Exception:
        _logger.warning("Failed to load runtime signals from %s, using defaults", RUNTIME_SIGNALS_PATH, exc_info=True)
        return DEFAULT_SIGNALS


def _load_runtime_wallets() -> list[WalletProfile]:
    if not RUNTIME_WALLETS_PATH.exists():
        return DEFAULT_SMART_WALLETS
    try:
        payload = json.loads(RUNTIME_WALLETS_PATH.read_text())
        wallets = [_wallet_from_dict(item) for item in payload]
        return wallets or DEFAULT_SMART_WALLETS
    except Exception:
        _logger.warning("Failed to load runtime wallets from %s, using defaults", RUNTIME_WALLETS_PATH, exc_info=True)
        return DEFAULT_SMART_WALLETS


SIGNALS = _load_runtime_signals()
SMART_WALLETS = _load_runtime_wallets()


def reload_runtime_data() -> tuple[int, int]:
    global SIGNALS, SMART_WALLETS
    SIGNALS = _load_runtime_signals()
    SMART_WALLETS = _load_runtime_wallets()
    return len(SIGNALS), len(SMART_WALLETS)


def get_runtime_meta() -> dict:
    if not RUNTIME_META_PATH.exists():
        return {}
    try:
        payload = json.loads(RUNTIME_META_PATH.read_text())
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def get_signal_history() -> list[dict]:
    if not RUNTIME_HISTORY_PATH.exists():
        return []
    try:
        payload = json.loads(RUNTIME_HISTORY_PATH.read_text())
        return payload if isinstance(payload, list) else []
    except Exception:
        return []


def summarize_signal_history(history: list[dict] | None = None) -> dict:
    history = get_signal_history() if history is None else history
    deduped: dict[str, dict] = {}
    for snapshot in history:
        for item in snapshot.get("signals", []):
            slug = item.get("slug") or item.get("title_en") or item.get("title_zh") or "unknown"
            outcome = item.get("selected_outcome") or item.get("action_en") or item.get("action_zh") or ""
            key = f"{slug}::{outcome}"
            existing = deduped.get(key)
            if not existing:
                deduped[key] = item
                continue
            existing_status = existing.get("status_en")
            new_status = item.get("status_en")
            existing_resolved = existing_status in {"Won", "Lost"}
            new_resolved = new_status in {"Won", "Lost"}
            if existing_resolved and not new_resolved:
                continue
            deduped[key] = item

    signals = list(deduped.values())

    total = len(signals)
    won = sum(1 for item in signals if item.get("status_en") == "Won")
    lost = sum(1 for item in signals if item.get("status_en") == "Lost")
    open_count = total - won - lost
    settled = won + lost
    win_rate = (won / settled * 100) if settled else 0.0

    category_guess = {"sports": 0, "crypto": 0, "politics": 0, "other": 0}
    for item in signals:
        slug = (item.get("slug") or "").lower()
        title = f"{item.get('title_en', '')} {item.get('title_zh', '')}".lower()
        text = f"{slug} {title}"
        if any(keyword in text for keyword in ["bitcoin", "btc", "crypto", "eth", "solana"]):
            category_guess["crypto"] += 1
        elif any(keyword in text for keyword in ["iran", "trump", "ceasefire", "election", "war", "israel"]):
            category_guess["politics"] += 1
        elif any(keyword in text for keyword in ["nba", "nhl", "ufc", "vs", "fight", "fc", "march madness"]):
            category_guess["sports"] += 1
        else:
            category_guess["other"] += 1

    dominant_category = max(category_guess, key=category_guess.get) if total else "other"
    last_snapshot = history[-1] if history else {}
    recent_settled = []
    for item in reversed(signals):
        status = item.get("status_en")
        if status in {"Won", "Lost"}:
            recent_settled.append(
                {
                    "title_en": item.get("title_en"),
                    "title_zh": item.get("title_zh"),
                    "status_en": status,
                    "status_zh": "已赢" if status == "Won" else "已输",
                }
            )
        if len(recent_settled) >= 3:
            break
    return {
        "total": total,
        "won": won,
        "lost": lost,
        "open": open_count,
        "settled": settled,
        "win_rate": win_rate,
        "dominant_category": dominant_category,
        "category_counts": category_guess,
        "snapshots": len(history),
        "latest_top_signal": last_snapshot.get("top_signal"),
        "latest_generated_at": last_snapshot.get("generated_at"),
        "recent_settled": recent_settled,
    }


def build_signal_list_text(language: str, sports_enabled: bool) -> str:
    visible = [signal for signal in SIGNALS if sports_enabled or not signal.sports]
    if not visible:
        if language == "en":
            return "📋 Latest Signals\n\nNo live signals are available right now. Run a data refresh or try again later."
        return "📋 最新信号\n\n当前没有可展示的实时信号。请先刷新数据，或稍后再试。"
    if language == "en":
        lines = [
            "📋 Latest Signals",
            "",
            "Only signals backed by tracked high-score wallets show up here.",
            "",
        ]
        for signal in visible:
            lines.append(
                f"{signal.id}. {'🏀 ' if signal.sports else '📈 '}{signal.title_en}\n"
                f"   {signal.action_en} · 🏆 {signal.score}"
            )
        lines.append("")
        lines.append("Reply with a visible number or tap a button below.")
        return "\n".join(lines)

    lines = [
        "📋 最新信号",
        "",
        "这里只展示被高评分钱包验证过的信号。",
        "",
    ]
    for signal in visible:
        lines.append(
            f"{signal.id}. {'🏀 ' if signal.sports else '📈 '}{signal.title_zh}\n"
            f"   {signal.action_zh} · 🏆 {signal.score}"
        )
    lines.append("")
    lines.append("回复编号查看详情，或点击下方按钮。")
    return "\n".join(lines)


def get_signal(signal_id: int) -> Signal | None:
    return next((signal for signal in SIGNALS if signal.id == signal_id), None)


def get_position(market_id: int) -> Position | None:
    return next((position for position in POSITIONS if position.market_id == market_id), None)


def normalize_wallet_address(address: str) -> str:
    return address.strip().lower()


def is_valid_wallet_address(address: str) -> bool:
    return bool(_HEX_ADDRESS_RE.fullmatch(address.strip()))


def abbreviate_wallet_address(address: str) -> str:
    normalized = normalize_wallet_address(address)
    if len(normalized) <= 12:
        return normalized
    return f"{normalized[:6]}...{normalized[-4:]}"


def get_wallet(address: str) -> WalletProfile | None:
    normalized = normalize_wallet_address(address)
    for wallet in SMART_WALLETS:
        if normalize_wallet_address(wallet.address) == normalized:
            return wallet
    return None


def format_wallet_label(wallet: WalletProfile) -> str:
    return f"{wallet.name} · {wallet.grade}{wallet.score}"


def build_tracked_wallet(address: str) -> WalletProfile:
    wallet = get_wallet(address)
    if wallet:
        return wallet
    normalized = normalize_wallet_address(address)
    label = abbreviate_wallet_address(normalized)
    return WalletProfile(
        address=normalized,
        name=label,
        score=70,
        grade="B",
        roi_30d="+12%",
        win_rate_30d="58.0%",
        activity="Tracking started",
        specialty_zh="等待更多链上样本",
        specialty_en="Waiting for more on-chain samples",
        note_zh="这是用户手动添加的地址。Luna 已预留追踪位，后续会用真实交易历史补齐画像。",
        note_en="This address was manually added by the user. Luna reserved the tracking slot and will backfill the profile once real history is connected.",
    )
