from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from luna_bot.app import next_signal_batch
from luna_bot.state import ensure_user_state
from luna_bot.data import DEFAULT_SIGNALS, SIGNALS, SMART_WALLETS
from luna_bot.ui import (
    copy_keyboard,
    leaderboard_text,
    localized_reply_keyboard,
    portfolio_text,
    runtime_status_text,
    simple_wallet_page,
    signal_history_summary_text,
    signal_history_text,
    signal_detail_text,
    signal_list_text,
)


def test_state_defaults():
    state = ensure_user_state({})
    assert state["language"] == "zh"
    assert state["tracked_wallets"] == []
    assert state["subscribed"] is False
    assert state["last_pushed_signal_ids"] == []


def test_reply_keyboard_expands_to_six_buttons():
    keyboard = localized_reply_keyboard("zh")
    rows = keyboard.keyboard
    assert len(rows) == 3
    assert [button.text for button in rows[1]] == ["📈 公开战绩", "🏆 聪明钱榜单"]


def test_signal_list_filters_sports_when_disabled():
    text_without_sports = signal_list_text("zh", sports_enabled=False)
    text_with_sports = signal_list_text("zh", sports_enabled=True)
    non_sports = [signal for signal in SIGNALS if not signal.sports]
    sports = [signal for signal in SIGNALS if signal.sports]
    if non_sports:
        assert non_sports[0].title_zh in text_without_sports
        for signal in sports:
            assert signal.title_zh not in text_without_sports
            assert signal.title_zh in text_with_sports
    else:
        # All runtime signals are sports — verify DEFAULT_SIGNALS has the expected mix
        default_non_sports = [s for s in DEFAULT_SIGNALS if not s.sports]
        default_sports = [s for s in DEFAULT_SIGNALS if s.sports]
        assert default_non_sports, "DEFAULT_SIGNALS should have non-sports entries"
        assert default_sports, "DEFAULT_SIGNALS should have sports entries"
        # When all runtime signals are sports and sports disabled, the list should be empty
        assert "没有可展示的实时信号" in text_without_sports or "No live signals" in text_without_sports


def test_signal_detail_contains_outcome_tracking():
    text = signal_detail_text(3, "zh")
    assert "结果追踪" in text
    assert "已赢" in text


def test_portfolio_and_leaderboard_pages_render():
    assert "公开战绩" in portfolio_text("zh")
    assert "/track 0x..." in leaderboard_text("zh", [])
    tracked = [SMART_WALLETS[0].address]
    tracked_text = leaderboard_text("zh", tracked)
    assert "你正在追踪的钱包" in tracked_text
    assert SMART_WALLETS[0].name in tracked_text


def test_runtime_status_renders():
    text = runtime_status_text("zh")
    assert "运行时状态" in text


def test_signal_history_renders():
    text = signal_history_text("zh")
    assert "信号历史" in text
    if "当前还没有历史快照" not in text:
        assert "头部信号" in text
        assert any(keyword in text for keyword in ["待结算", "已赢", "已输", "Open", "Won", "Lost"])


def test_signal_history_summary_renders():
    text = signal_history_summary_text("zh")
    assert "公开战绩" in text


def test_next_signal_batch_skips_pushed_items():
    state = ensure_user_state({"last_pushed_signal_ids": [SIGNALS[0].id]})
    batch = next_signal_batch(state, limit=2)
    assert len(batch) == 2
    assert SIGNALS[0].id not in batch


def test_simple_wallet_page_positions_renders_live_position_list():
    wallet = {
        "positions": [
            {
                "signal_id": 123,
                "title_zh": "测试市场",
                "title_en": "Test Market",
                "side_zh": "Yes",
                "side_en": "Yes",
                "amount_usdc": 1.0,
                "entry_price": "42¢",
                "current_price": "45¢",
                "shares": "2.38",
                "pnl_abs": "+0.07 USDC",
                "pnl_pct": "+7.0%",
            }
        ]
    }
    text, keyboard = simple_wallet_page("positions", "zh", wallet)
    assert "测试市场" in text
    assert "2.38 股" in text
    assert keyboard.inline_keyboard[0][0].callback_data == "position_detail:123"


def test_copy_keyboard_filters_sizes_to_available_balance():
    keyboard = copy_keyboard(1, "zh", 9.91)
    labels = [button.text for row in keyboard.inline_keyboard for button in row]
    assert "$1" in labels
    assert "$5" in labels
    assert "$10" not in labels
