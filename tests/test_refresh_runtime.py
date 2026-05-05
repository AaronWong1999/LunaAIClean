from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import refresh_luna_runtime as runtime
from luna_bot.data import summarize_signal_history


def test_outcome_status_for_market_open_market():
    market = {
        "closed": False,
        "outcomes": '["Yes", "No"]',
        "outcomePrices": '["0.6", "0.4"]',
    }
    status_en, status_zh = runtime.outcome_status_for_market(market, "Yes")
    assert status_en == "open"
    assert status_zh == "待结算"


def test_outcome_status_for_market_won_market():
    market = {
        "closed": True,
        "outcomes": '["Yes", "No"]',
        "outcomePrices": '["1", "0"]',
    }
    status_en, status_zh = runtime.outcome_status_for_market(market, "Yes")
    assert status_en == "won"
    assert status_zh == "已赢"


def test_reconcile_history_updates_pending_items():
    history = [
        {
            "generated_at": "2026-03-27T10:00:00+00:00",
            "signal_count": 1,
            "top_signal": "Test signal",
            "signals": [
                {
                    "title_en": "Test signal",
                    "title_zh": "测试信号",
                    "action_en": "Buy Yes",
                    "action_zh": "买入 Yes",
                    "score": 80,
                    "slug": "test-market",
                    "selected_outcome": "Yes",
                    "current_price": "60¢",
                    "status_en": "Open",
                    "status_zh": "待结算",
                }
            ],
        }
    ]

    def fetch_market(slug: str):
        assert slug == "test-market"
        return {
            "closed": True,
            "outcomes": '["Yes", "No"]',
            "outcomePrices": '["1", "0"]',
        }

    reconciled = runtime.reconcile_history(history, fetch_market)
    signal = reconciled[0]["signals"][0]
    assert signal["status_en"] == "Won"
    assert signal["status_zh"] == "已赢"


def test_summarize_signal_history_counts_statuses_and_category():
    history = [
        {
            "generated_at": "2026-03-27T10:00:00+00:00",
            "top_signal": "Bitcoin Up or Down on March 27?",
            "signals": [
                {"slug": "bitcoin-up-or-down-on-march-27-2026", "title_en": "Bitcoin Up or Down on March 27?", "title_zh": "Bitcoin Up or Down on March 27?", "status_en": "Won"},
                {"slug": "iran-x-israelus-conflict-ends-by-may-15", "title_en": "Iran conflict", "title_zh": "伊朗冲突", "status_en": "Lost"},
                {"slug": "nba-lac-ind-2026-03-27", "title_en": "Clippers vs. Pacers", "title_zh": "Clippers vs. Pacers", "status_en": "Open"},
            ],
        }
    ]
    summary = summarize_signal_history(history)
    assert summary["total"] == 3
    assert summary["won"] == 1
    assert summary["lost"] == 1
    assert summary["open"] == 1
    assert summary["settled"] == 2
    assert summary["win_rate"] == 50.0
    assert summary["dominant_category"] in {"crypto", "politics", "sports"}


def test_summarize_signal_history_deduplicates_same_signal_across_snapshots():
    history = [
        {
            "generated_at": "2026-03-27T10:00:00+00:00",
            "signals": [
                {"slug": "bitcoin-up-or-down-on-march-27-2026", "selected_outcome": "Down", "title_en": "Bitcoin Up or Down on March 27?", "title_zh": "Bitcoin Up or Down on March 27?", "status_en": "Open"},
            ],
        },
        {
            "generated_at": "2026-03-27T11:00:00+00:00",
            "signals": [
                {"slug": "bitcoin-up-or-down-on-march-27-2026", "selected_outcome": "Down", "title_en": "Bitcoin Up or Down on March 27?", "title_zh": "Bitcoin Up or Down on March 27?", "status_en": "Lost"},
            ],
        },
    ]
    summary = summarize_signal_history(history)
    assert summary["total"] == 1
    assert summary["lost"] == 1
    assert summary["open"] == 0


def test_summarize_signal_history_prefers_resolved_status_over_later_open():
    history = [
        {
            "generated_at": "2026-03-27T10:00:00+00:00",
            "signals": [
                {"slug": "bitcoin-up-or-down-on-march-27-2026", "selected_outcome": "Down", "title_en": "Bitcoin Up or Down on March 27?", "title_zh": "Bitcoin Up or Down on March 27?", "status_en": "Lost"},
            ],
        },
        {
            "generated_at": "2026-03-27T11:00:00+00:00",
            "signals": [
                {"slug": "bitcoin-up-or-down-on-march-27-2026", "selected_outcome": "Down", "title_en": "Bitcoin Up or Down on March 27?", "title_zh": "Bitcoin Up or Down on March 27?", "status_en": "Open"},
            ],
        },
    ]
    summary = summarize_signal_history(history)
    assert summary["total"] == 1
    assert summary["lost"] == 1
    assert summary["open"] == 0
