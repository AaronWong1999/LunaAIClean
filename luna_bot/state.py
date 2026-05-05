from __future__ import annotations

import secrets
from typing import TypedDict


class WalletPosition(TypedDict, total=False):
    signal_id: int
    title_zh: str
    title_en: str
    side_zh: str
    side_en: str
    amount_usdc: float
    entry_price: str
    current_price: str
    shares: str
    pnl_abs: str
    pnl_pct: str
    market_url: str


class WalletHistoryEntry(TypedDict, total=False):
    kind: str
    title_zh: str
    title_en: str
    amount_usdc: float
    side_zh: str
    side_en: str
    status_zh: str
    status_en: str


class WalletState(TypedDict, total=False):
    deposit_address: str
    balance_usdc: float
    positions: list[WalletPosition]
    history: list[WalletHistoryEntry]


class ReferralState(TypedDict, total=False):
    referred_by: str
    invited_users: list[str]
    total_earnings_usdc: float


class FollowTask(TypedDict, total=False):
    wallet_address: str
    active: bool
    created_at: str
    last_signal_id: int


class UserState(TypedDict, total=False):
    subscribed: bool
    language: str
    sports_enabled: bool
    pending_withdraw: bool
    tracked_wallets: list[str]
    last_pushed_signal_ids: list[int]
    wallet: WalletState
    referral: ReferralState
    follow_tasks: list[FollowTask]


def _generate_demo_address() -> str:
    return "0x" + secrets.token_hex(20)


def ensure_wallet_state(raw: dict | None) -> WalletState:
    wallet: WalletState = dict(raw or {})
    wallet.setdefault("deposit_address", _generate_demo_address())
    wallet.setdefault("balance_usdc", 0.0)
    wallet.setdefault("positions", [])
    wallet.setdefault("history", [])
    return wallet


def ensure_referral_state(raw: dict | None) -> ReferralState:
    referral: ReferralState = dict(raw or {})
    referral.setdefault("referred_by", "")
    referral.setdefault("invited_users", [])
    referral.setdefault("total_earnings_usdc", 0.0)
    return referral


def ensure_user_state(raw: dict | None) -> UserState:
    data: UserState = dict(raw or {})
    data.setdefault("subscribed", False)
    data.setdefault("language", "zh")
    data.setdefault("sports_enabled", False)
    data.setdefault("pending_withdraw", False)
    data.setdefault("tracked_wallets", [])
    data.setdefault("last_pushed_signal_ids", [])
    data["wallet"] = ensure_wallet_state(data.get("wallet"))
    data["referral"] = ensure_referral_state(data.get("referral"))
    data.setdefault("follow_tasks", [])
    return data
