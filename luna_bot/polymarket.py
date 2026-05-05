from __future__ import annotations

import json
import logging
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass

from luna_bot.config import Settings

_logger = logging.getLogger(__name__)


class PolymarketConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class LivePosition:
    asset: str
    title: str
    outcome: str
    size: float
    avg_price: float
    current_price: float
    cash_pnl: float
    percent_pnl: float
    market_slug: str
    condition_id: str
    token_id: str


@dataclass(frozen=True)
class LiveAccountSnapshot:
    address: str
    balance_usdc: float
    positions: list[LivePosition]
    open_orders: int


def _fetch_json(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": "LunaAI/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


def _post_json(url: str, payload: dict, headers: dict[str, str] | None = None) -> object:
    body = json.dumps(payload).encode()
    merged_headers = {
        "Content-Type": "application/json",
        "User-Agent": "LunaAI/1.0",
    }
    if headers:
        merged_headers.update(headers)
    req = urllib.request.Request(url, data=body, headers=merged_headers, method="POST")
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


class PolymarketPublicClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.gamma_host = settings.polymarket_gamma_host.rstrip("/")
        self.data_host = settings.polymarket_data_host.rstrip("/")
        self.bridge_host = settings.polymarket_bridge_host.rstrip("/")

    def get_market_by_slug(self, slug: str) -> dict | None:
        query = urllib.parse.urlencode({"slug": slug})
        payload = _fetch_json(f"{self.gamma_host}/markets?{query}")
        if isinstance(payload, list) and payload:
            return payload[0]
        return None

    def resolve_token_id(self, slug: str, selected_outcome: str) -> str:
        market = self.get_market_by_slug(slug)
        if not market:
            raise PolymarketConfigError(f"Market slug not found: {slug}")
        outcomes = market.get("outcomes") or []
        if isinstance(outcomes, str):
            outcomes = json.loads(outcomes)
        token_ids = market.get("clobTokenIds") or market.get("clobTokenids") or []
        if isinstance(token_ids, str):
            token_ids = json.loads(token_ids)
        if not isinstance(outcomes, list) or not isinstance(token_ids, list):
            raise PolymarketConfigError(f"Market metadata missing outcomes/token ids for {slug}")
        if selected_outcome not in outcomes:
            raise PolymarketConfigError(f"Outcome {selected_outcome} not found for {slug}")
        idx = outcomes.index(selected_outcome)
        if idx >= len(token_ids):
            raise PolymarketConfigError(f"Token id missing for outcome {selected_outcome} on {slug}")
        return str(token_ids[idx])

    def get_current_positions(self, user_address: str, limit: int = 50) -> list[dict]:
        query = urllib.parse.urlencode({"user": user_address, "size": limit})
        payload = _fetch_json(f"{self.data_host}/positions?{query}")
        return payload if isinstance(payload, list) else []

    def get_open_orders(self, user_address: str) -> list[dict]:
        query = urllib.parse.urlencode({"id": user_address})
        payload = _fetch_json(f"{self.data_host}/orders?{query}")
        return payload if isinstance(payload, list) else []

    def create_deposit_addresses(self, wallet_address: str) -> dict:
        result = _post_json(f"{self.bridge_host}/deposit", {"address": wallet_address})
        if isinstance(result, dict):
            return result
        raise PolymarketConfigError("Unexpected bridge deposit response")

    def get_live_snapshot(self, user_address: str) -> LiveAccountSnapshot:
        raw_positions = self.get_current_positions(user_address)
        positions: list[LivePosition] = []
        total_value = 0.0
        for item in raw_positions:
            try:
                size = float(item.get("size") or item.get("quantity") or 0)
                avg_price = float(item.get("avgPrice") or item.get("avg_price") or 0)
                current_price = float(item.get("curPrice") or item.get("currentPrice") or item.get("current_price") or avg_price or 0)
                cash_pnl = float(item.get("cashPnl") or item.get("cash_pnl") or 0)
                percent_pnl = float(item.get("percentPnl") or item.get("percent_pnl") or 0)
            except (ValueError, TypeError) as exc:
                _logger.warning("Skipping position with unparseable fields: %s — %s", item, exc)
                continue
            total_value += max(0.0, size * current_price)
            positions.append(
                LivePosition(
                    asset=str(item.get("asset") or item.get("market") or ""),
                    title=str(item.get("title") or item.get("question") or item.get("market_slug") or "Unknown market"),
                    outcome=str(item.get("outcome") or item.get("side") or ""),
                    size=size,
                    avg_price=avg_price,
                    current_price=current_price,
                    cash_pnl=cash_pnl,
                    percent_pnl=percent_pnl,
                    market_slug=str(item.get("market_slug") or item.get("slug") or ""),
                    condition_id=str(item.get("conditionId") or item.get("condition_id") or ""),
                    token_id=str(item.get("asset") or item.get("tokenId") or item.get("token_id") or ""),
                )
            )
        return LiveAccountSnapshot(
            address=user_address,
            balance_usdc=0.0,
            positions=positions,
            open_orders=0,
        )


class PolymarketTradingClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        if not settings.polymarket_private_key:
            raise PolymarketConfigError("POLYMARKET_PRIVATE_KEY is required for live trading")
        if not settings.polymarket_funder_address:
            raise PolymarketConfigError("POLYMARKET_FUNDER_ADDRESS is required for live trading")
        if not settings.polymarket_api_key or not settings.polymarket_api_secret or not settings.polymarket_api_passphrase:
            raise PolymarketConfigError("POLYMARKET_API_KEY / SECRET / PASSPHRASE are required for live trading")
        try:
            from py_clob_client.client import ClobClient
            from py_clob_client.clob_types import ApiCreds
        except Exception as exc:
            raise PolymarketConfigError(
                f"py-clob-client is unavailable under Python {sys.version.split()[0]}; use Python >= 3.9.10 and reinstall requirements"
            ) from exc

        self._clob_types = None
        self._api_creds = ApiCreds(
            api_key=settings.polymarket_api_key,
            api_secret=settings.polymarket_api_secret,
            api_passphrase=settings.polymarket_api_passphrase,
        )
        self.client = ClobClient(
            settings.polymarket_host,
            137,
            key=settings.polymarket_private_key,
            creds=self._api_creds,
            signature_type=settings.polymarket_signature_type,
            funder=settings.polymarket_funder_address,
        )

    def _load_order_types(self):
        if self._clob_types is None:
            from py_clob_client.clob_types import AssetType, BalanceAllowanceParams, MarketOrderArgs, OpenOrderParams, OrderType

            self._clob_types = {
                "AssetType": AssetType,
                "BalanceAllowanceParams": BalanceAllowanceParams,
                "MarketOrderArgs": MarketOrderArgs,
                "OpenOrderParams": OpenOrderParams,
                "OrderType": OrderType,
            }
        return self._clob_types

    def get_available_balance(self) -> float:
        types = self._load_order_types()
        params = types["BalanceAllowanceParams"](
            asset_type=types["AssetType"].COLLATERAL,
            signature_type=self.settings.polymarket_signature_type,
        )
        payload = self.client.get_balance_allowance(params)
        raw_value = payload.get("balance") or payload.get("available") or 0.0
        value = float(raw_value)
        # Polymarket returns collateral balances in 6-decimal USDC units.
        if value >= 1000:
            value = value / 1_000_000
        return value

    def get_open_orders_count(self) -> int:
        types = self._load_order_types()
        params = types["OpenOrderParams"](id=self.settings.polymarket_funder_address)
        payload = self.client.get_orders(params)
        if isinstance(payload, dict):
            data = payload.get("data") or payload.get("orders") or []
            return len(data) if isinstance(data, list) else 0
        return len(payload) if isinstance(payload, list) else 0

    def place_market_order(self, token_id: str, amount_usdc: float, side: str) -> dict:
        types = self._load_order_types()
        order_args = types["MarketOrderArgs"](
            token_id=token_id,
            amount=amount_usdc,
            side=side,
            order_type=types["OrderType"].FOK,
        )
        signed = self.client.create_market_order(order_args)
        return self.client.post_order(signed, orderType=types["OrderType"].FOK)
