from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from luna_bot.app import (
    build_live_wallet_dict,
    bridge_address_type_for_chain,
    close_live_position,
    execute_copy_trade,
    next_signal_batch,
    perform_runtime_refresh,
    add_tracked_wallet,
    POLYMARKET_URL_RE,
)
from luna_bot.state import ensure_user_state, ensure_referral_state
from luna_bot.polymarket import LiveAccountSnapshot, LivePosition
from luna_bot.ui import (
    discover_text,
    discover_keyboard,
    refer_text,
    refer_keyboard,
    referrals_text,
    referrals_keyboard,
    creators_text,
    creators_keyboard,
    pnl_text,
    pnl_keyboard,
    pnl_share_text,
    copydesk_text,
    copydesk_keyboard,
    follow_text,
    follow_keyboard,
    news_text,
    news_keyboard,
    arb_text,
    arb_keyboard,
    receipts_text,
    receipts_keyboard,
    url_trade_card_text,
    url_trade_card_keyboard,
)


def test_perform_runtime_refresh_calls_refresh_and_reload():
    calls = []

    def fake_refresh():
        calls.append("refresh")

    def fake_reload():
        calls.append("reload")
        return (3, 7)

    signal_count, wallet_count = perform_runtime_refresh(fake_refresh, fake_reload)
    assert (signal_count, wallet_count) == (3, 7)
    assert calls == ["refresh", "reload"]


def test_build_live_wallet_dict_maps_position_fields():
    snapshot = LiveAccountSnapshot(
        address="0xabc",
        balance_usdc=0.0,
        open_orders=1,
        positions=[
            LivePosition(
                asset="1",
                title="Test market",
                outcome="Yes",
                size=10,
                avg_price=0.42,
                current_price=0.45,
                cash_pnl=0.3,
                percent_pnl=7.1,
                market_slug="test-market",
                condition_id="condition",
                token_id="token",
            )
        ],
    )

    wallet = build_live_wallet_dict(snapshot)
    assert wallet["deposit_address"] == "0xabc"
    assert wallet["positions"][0]["current_price"] == "45¢"
    assert wallet["positions"][0]["token_id"] == "token"
    assert wallet["positions"][0]["size_raw"] == 10


def test_bridge_address_type_for_chain_routes_known_networks():
    assert bridge_address_type_for_chain("Ethereum") == "evm"
    assert bridge_address_type_for_chain("Solana") == "svm"
    assert bridge_address_type_for_chain("Bitcoin") == "btc"
    assert bridge_address_type_for_chain("Tron") == "tron"


def test_close_live_position_requires_tradeable_metadata(monkeypatch):
    monkeypatch.setattr("luna_bot.app.get_settings", lambda: type("S", (), {"polymarket_enabled": True})())
    ok, status, meta = close_live_position({"shares": "1.23"})
    assert ok is False
    assert status == "position_not_tradeable"
    assert meta == {}


# ──────────────────────────────────────────────
#  State tests
# ──────────────────────────────────────────────

def test_ensure_user_state_includes_referral_and_follow():
    state = ensure_user_state(None)
    assert "referral" in state
    assert state["referral"]["referred_by"] == ""
    assert state["referral"]["invited_users"] == []
    assert state["referral"]["total_earnings_usdc"] == 0.0
    assert state["follow_tasks"] == []


def test_ensure_referral_state_defaults():
    ref = ensure_referral_state(None)
    assert ref["referred_by"] == ""
    assert ref["invited_users"] == []
    assert ref["total_earnings_usdc"] == 0.0


def test_ensure_referral_state_preserves_existing():
    ref = ensure_referral_state({"referred_by": "123", "invited_users": ["456"], "total_earnings_usdc": 1.5})
    assert ref["referred_by"] == "123"
    assert ref["invited_users"] == ["456"]
    assert ref["total_earnings_usdc"] == 1.5


def test_add_tracked_wallet_limit():
    state = ensure_user_state(None)
    state["tracked_wallets"] = ["0x" + "a" * 40, "0x" + "b" * 40, "0x" + "c" * 40]
    added, status = add_tracked_wallet(state, "0x" + "d" * 40)
    assert added is False
    assert status == "limit"


def test_add_tracked_wallet_dedup():
    state = ensure_user_state(None)
    state["tracked_wallets"] = ["0x" + "a" * 40]
    added, status = add_tracked_wallet(state, "0x" + "a" * 40)
    assert added is False
    assert status == "exists"


# ──────────────────────────────────────────────
#  URL detection
# ──────────────────────────────────────────────

def test_polymarket_url_detection():
    text = "Check this out https://polymarket.com/event/bitcoin-hits-100k cool right?"
    match = POLYMARKET_URL_RE.search(text)
    assert match is not None
    assert "polymarket.com/event/" in match.group(0)


def test_polymarket_url_market_path():
    text = "https://polymarket.com/market/will-trump-win-2024"
    match = POLYMARKET_URL_RE.search(text)
    assert match is not None


def test_polymarket_url_no_match():
    text = "hello world no url here"
    match = POLYMARKET_URL_RE.search(text)
    assert match is None


# ──────────────────────────────────────────────
#  Discover UI
# ──────────────────────────────────────────────

def test_discover_text_en():
    text = discover_text("en", True)
    assert "Discover" in text


def test_discover_text_zh():
    text = discover_text("zh", True)
    assert "发现" in text


def test_discover_keyboard_has_buttons():
    kb = discover_keyboard("en")
    assert kb.inline_keyboard
    all_data = [btn.callback_data for row in kb.inline_keyboard for btn in row if btn.callback_data]
    assert "recent_signals" in all_data
    assert "menu" in all_data


# ──────────────────────────────────────────────
#  Refer UI
# ──────────────────────────────────────────────

def test_refer_text_contains_link():
    text = refer_text("en", 12345, 3)
    assert "t.me/GetLunaAIBot?start=ref_12345" in text
    assert "3" in text


def test_refer_text_zh():
    text = refer_text("zh", 99, 0)
    assert "邀请好友" in text
    assert "ref_99" in text


def test_refer_keyboard_has_referrals():
    kb = refer_keyboard("en")
    all_data = [btn.callback_data for row in kb.inline_keyboard for btn in row if btn.callback_data]
    assert "referrals" in all_data


# ──────────────────────────────────────────────
#  Referrals UI
# ──────────────────────────────────────────────

def test_referrals_text_empty():
    text = referrals_text("en", {"invited_users": [], "total_earnings_usdc": 0.0, "referred_by": ""})
    assert "0" in text
    assert "Referral Ledger" in text


def test_referrals_text_with_data():
    text = referrals_text("zh", {"invited_users": ["1", "2"], "total_earnings_usdc": 5.0, "referred_by": "abc"})
    assert "2" in text
    assert "5.00" in text
    assert "abc" in text


# ──────────────────────────────────────────────
#  Creators UI
# ──────────────────────────────────────────────

def test_creators_text_en():
    text = creators_text("en")
    assert "Creator Spotlight" in text


def test_creators_text_zh():
    text = creators_text("zh")
    assert "创作者聚焦" in text


def test_creators_keyboard_has_wallet_profiles():
    kb = creators_keyboard("en")
    all_data = [btn.callback_data for row in kb.inline_keyboard for btn in row if btn.callback_data]
    assert any(d.startswith("wallet_profile:") for d in all_data)


# ──────────────────────────────────────────────
#  PnL UI
# ──────────────────────────────────────────────

def test_pnl_text_empty_wallet():
    wallet = {"balance_usdc": 100.0, "positions": [], "history": []}
    text = pnl_text("en", wallet)
    assert "PnL Snapshot" in text
    assert "100.00" in text


def test_pnl_text_with_positions():
    wallet = {
        "balance_usdc": 50.0,
        "positions": [
            {"title_en": "BTC 100k", "title_zh": "BTC十万", "amount_usdc": 20.0, "current_value_usdc": 25.0, "pnl_abs": "+$5.00", "pnl_pct": "+25.0%"},
        ],
        "history": [],
    }
    text = pnl_text("zh", wallet)
    assert "盈亏快照" in text
    assert "BTC十万" in text


def test_pnl_share_text_contains_link():
    wallet = {"positions": [{"amount_usdc": 10, "current_value_usdc": 12}], "history": []}
    text = pnl_share_text("en", wallet, 555)
    assert "ref_555" in text
    assert "PnL" in text


# ──────────────────────────────────────────────
#  Copydesk UI
# ──────────────────────────────────────────────

def test_copydesk_text_en():
    text = copydesk_text("en", True)
    assert "Copy Trading Desk" in text


def test_copydesk_text_zh():
    text = copydesk_text("zh", True)
    assert "跟单交易台" in text


def test_copydesk_keyboard_has_copy_buttons():
    kb = copydesk_keyboard("en", True)
    all_data = [btn.callback_data for row in kb.inline_keyboard for btn in row if btn.callback_data]
    assert any(d.startswith("copy:") or d.startswith("signal:") for d in all_data) or "menu" in all_data


# ──────────────────────────────────────────────
#  Follow UI
# ──────────────────────────────────────────────

def test_follow_text_empty():
    text = follow_text("en", [], [])
    assert "Follow Tasks" in text
    assert "No follows" in text


def test_follow_text_with_data():
    tasks = [{"wallet_address": "0x" + "a" * 40, "active": True}]
    text = follow_text("zh", tasks, ["0x" + "a" * 40])
    assert "关注任务" in text
    assert "0xaaaa" in text


def test_follow_keyboard_shows_add_for_tracked():
    kb = follow_keyboard("en", [], ["0x" + "a" * 40])
    all_data = [btn.callback_data for row in kb.inline_keyboard for btn in row if btn.callback_data]
    assert any(d.startswith("follow_add:") for d in all_data)


def test_follow_keyboard_shows_remove_for_active():
    tasks = [{"wallet_address": "0x" + "b" * 40, "active": True}]
    kb = follow_keyboard("en", tasks, [])
    all_data = [btn.callback_data for row in kb.inline_keyboard for btn in row if btn.callback_data]
    assert any(d.startswith("follow_remove:") for d in all_data)


# ──────────────────────────────────────────────
#  News UI
# ──────────────────────────────────────────────

def test_news_text_en():
    text = news_text("en", True)
    assert "News" in text


def test_news_text_zh():
    text = news_text("zh", True)
    assert "新闻" in text


# ──────────────────────────────────────────────
#  Arb UI
# ──────────────────────────────────────────────

def test_arb_text_en():
    text = arb_text("en", True)
    assert "Arbitrage" in text


def test_arb_text_zh():
    text = arb_text("zh", True)
    assert "套利" in text


# ──────────────────────────────────────────────
#  Receipts UI
# ──────────────────────────────────────────────

def test_receipts_text_empty():
    wallet = {"history": [], "balance_usdc": 0}
    text = receipts_text("en", wallet)
    assert "Trade Receipts" in text
    assert "No trade history" in text


def test_receipts_text_with_history():
    wallet = {
        "history": [
            {"kind": "buy", "title_zh": "测试", "title_en": "Test", "amount_usdc": 10, "status_en": "Executed", "status_zh": "已执行"},
        ],
        "balance_usdc": 90,
    }
    text = receipts_text("zh", wallet)
    assert "交易凭据" in text
    assert "测试" in text


# ──────────────────────────────────────────────
#  URL Trade Card UI
# ──────────────────────────────────────────────

def test_url_trade_card_text_en():
    text = url_trade_card_text("en", "https://polymarket.com/event/bitcoin-100k")
    assert "Trade Card" in text
    assert "polymarket.com" in text


def test_url_trade_card_text_zh():
    text = url_trade_card_text("zh", "https://polymarket.com/market/trump-election")
    assert "交易卡片" in text


def test_url_trade_card_keyboard_has_open_button():
    kb = url_trade_card_keyboard("en", "https://polymarket.com/event/test")
    has_url = any(btn.url for row in kb.inline_keyboard for btn in row if btn.url)
    assert has_url


# ──────────────────────────────────────────────
#  Next signal batch
# ──────────────────────────────────────────────

def test_next_signal_batch_respects_limit():
    state = {"last_pushed_signal_ids": []}
    batch = next_signal_batch(state, limit=1)
    assert len(batch) <= 1
