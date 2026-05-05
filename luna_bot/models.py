from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Signal:
    id: int
    title_zh: str
    title_en: str
    action_zh: str
    action_en: str
    score: int
    current_price: str
    expected_return: str
    daily_return: str
    liquidity: str
    expiry_zh: str
    expiry_en: str
    source_count: str
    detail_url: str
    market_url: str
    analysis_zh: str
    analysis_en: str
    sports: bool = False
    slug: str | None = None
    selected_outcome: str | None = None


@dataclass(frozen=True)
class Position:
    market_id: int
    title_zh: str
    title_en: str
    side_zh: str
    side_en: str
    shares: str
    avg_cost: str
    current_price: str
    cost_basis: str
    current_value: str
    pnl_abs: str
    pnl_pct: str
    market_url: str


@dataclass(frozen=True)
class WalletProfile:
    address: str
    name: str
    score: int
    grade: str
    roi_30d: str
    win_rate_30d: str
    activity: str
    specialty_zh: str
    specialty_en: str
    note_zh: str
    note_en: str


@dataclass(frozen=True)
class SignalOutcome:
    signal_id: int
    status_zh: str
    status_en: str
    result_zh: str
    result_en: str
