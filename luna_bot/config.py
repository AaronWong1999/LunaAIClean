from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    persistence_path: str
    push_interval_sec: int
    polymarket_enabled: bool
    polymarket_host: str
    polymarket_gamma_host: str
    polymarket_data_host: str
    polymarket_bridge_host: str
    polymarket_private_key: str
    polymarket_api_key: str
    polymarket_api_secret: str
    polymarket_api_passphrase: str
    polymarket_funder_address: str
    polymarket_user_address: str
    polymarket_signature_type: int


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name, "")
    if not value:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_settings() -> Settings:
    load_dotenv()
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    return Settings(
        telegram_bot_token=token,
        persistence_path=os.environ.get("LUNA_PERSISTENCE_PATH", ".luna-bot-state.pkl"),
        push_interval_sec=int(os.environ.get("LUNA_PUSH_INTERVAL_SEC", "180")),
        polymarket_enabled=_env_bool("POLYMARKET_ENABLED", False),
        polymarket_host=os.environ.get("POLYMARKET_HOST", "https://clob.polymarket.com").strip(),
        polymarket_gamma_host=os.environ.get("POLYMARKET_GAMMA_HOST", "https://gamma-api.polymarket.com").strip(),
        polymarket_data_host=os.environ.get("POLYMARKET_DATA_HOST", "https://data-api.polymarket.com").strip(),
        polymarket_bridge_host=os.environ.get("POLYMARKET_BRIDGE_HOST", "https://bridge.polymarket.com").strip(),
        polymarket_private_key=os.environ.get("POLYMARKET_PRIVATE_KEY", "").strip(),
        polymarket_api_key=os.environ.get("POLYMARKET_API_KEY", "").strip(),
        polymarket_api_secret=os.environ.get("POLYMARKET_API_SECRET", "").strip(),
        polymarket_api_passphrase=os.environ.get("POLYMARKET_API_PASSPHRASE", "").strip(),
        polymarket_funder_address=os.environ.get("POLYMARKET_FUNDER_ADDRESS", "").strip(),
        polymarket_user_address=os.environ.get("POLYMARKET_USER_ADDRESS", "").strip(),
        polymarket_signature_type=int(os.environ.get("POLYMARKET_SIGNATURE_TYPE", "2")),
    )
