"""Shared fixtures for the LunaAI test suite.

Telethon integration tests require an authorised .session file.
Set TG_SESSION env var to override the default 852.session path.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).parent.parent

# Telethon credentials
TG_API_ID = 32692718
TG_API_HASH = "699fd59ab02a0f09b89db38c4a6ff149"
BOT_USERNAME = "@GetLunaAIBot"
DEFAULT_SESSION = str(PROJECT_ROOT / "852.session")

_tg_client = None
_tg_loop: asyncio.AbstractEventLoop | None = None


def _ensure_loop() -> asyncio.AbstractEventLoop:
    global _tg_loop
    if _tg_loop is None or _tg_loop.is_closed():
        _tg_loop = asyncio.new_event_loop()
    return _tg_loop


def tg_run(coro):
    """Run an async coroutine on the dedicated Telethon loop (blocking)."""
    return _ensure_loop().run_until_complete(coro)


@pytest.fixture(scope="session")
def tg_client():
    """Session-scoped sync fixture: an authorised Telethon client."""
    global _tg_client
    from telethon import TelegramClient

    loop = _ensure_loop()
    asyncio.set_event_loop(loop)
    session_path = os.environ.get("TG_SESSION", DEFAULT_SESSION)
    _tg_client = TelegramClient(session_path, TG_API_ID, TG_API_HASH, loop=loop)
    loop.run_until_complete(_tg_client.connect())
    if not loop.run_until_complete(_tg_client.is_user_authorized()):
        pytest.skip("Telegram session not authorised – run manual login first")
    yield _tg_client
    try:
        result = _tg_client.disconnect()
        if result is not None:
            loop.run_until_complete(result)
    except Exception:
        pass
    _tg_client = None


async def _send_and_wait(client, command: str, wait: float = 5.0):
    before = await client.get_messages(BOT_USERNAME, limit=1)
    before_max_id = before[0].id if before else 0
    await client.send_message(BOT_USERNAME, command)
    await asyncio.sleep(wait)
    messages = await client.get_messages(BOT_USERNAME, limit=10)
    captured = []
    for msg in reversed(messages):
        if msg.out or msg.id <= before_max_id:
            continue
        captured.append(msg)
    return captured


def send_and_wait(client, command: str, wait: float = 5.0):
    """Send a message to the bot and return captured responses (blocking)."""
    return tg_run(_send_and_wait(client, command, wait))


async def _click_callback(client, message, callback_data: bytes, wait: float = 3.0):
    from telethon.tl.functions.messages import GetBotCallbackAnswerRequest

    try:
        await client(GetBotCallbackAnswerRequest(
            peer=BOT_USERNAME,
            msg_id=message.id,
            data=callback_data,
        ))
    except Exception:
        pass
    await asyncio.sleep(wait)
    updated = await client.get_messages(BOT_USERNAME, ids=[message.id])
    return updated[0] if updated else None


def click_callback(client, message, callback_data: bytes, wait: float = 3.0):
    """Click inline button and return updated message (blocking)."""
    return tg_run(_click_callback(client, message, callback_data, wait))
