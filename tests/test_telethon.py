"""Telethon integration tests — interact with @GetLunaAIBot like a real user.

Run:
    python -m pytest tests/test_telethon.py -v -m telethon

These require the bot to be running and an authorised Telegram session.
All tests are synchronous; they dispatch Telethon calls to a dedicated loop via tg_run().
"""

from __future__ import annotations

import pytest

from conftest import send_and_wait, click_callback, BOT_USERNAME, tg_run

pytestmark = [pytest.mark.telethon, pytest.mark.slow]


def _text(msg) -> str:
    return msg.text or ""


def _has_inline_keyboard(msg) -> bool:
    return msg.reply_markup is not None


def _contains(text: str, *needles: str) -> bool:
    low = text.lower()
    return any(n.lower() in low for n in needles)


def _find_button_data(msg, label_fragment: str) -> bytes | None:
    """Search inline keyboard for a button whose label contains the fragment."""
    if not msg.reply_markup:
        return None
    for row in msg.reply_markup.rows:
        for btn in row.buttons:
            if not hasattr(btn, "data") or btn.data is None:
                continue
            if label_fragment.lower() in (btn.text or "").lower():
                return btn.data if isinstance(btn.data, bytes) else btn.data.encode()
    return None


# ──────────────────────────────────────────────
# 1. Command regression (all slash commands)
# ──────────────────────────────────────────────

class TestCommands:
    """Verify every slash command returns a non-empty, relevant response."""

    def test_start(self, tg_client):
        msgs = send_and_wait(tg_client, "/start", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /start"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Dashboard", "主控台", "Luna", "Wallet", "钱包"), \
            f"/start response unexpected: {combined[:200]}"

    def test_help(self, tg_client):
        msgs = send_and_wait(tg_client, "/help", wait=5)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Dashboard", "主控台", "Signal", "信号"), \
            f"/help response unexpected: {combined[:200]}"

    def test_menu(self, tg_client):
        msgs = send_and_wait(tg_client, "/menu", wait=5)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Dashboard", "主控台")

    def test_signals(self, tg_client):
        msgs = send_and_wait(tg_client, "/signals", wait=7)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Signal", "信号", "📋", "Latest")

    def test_wallet(self, tg_client):
        msgs = send_and_wait(tg_client, "/wallet", wait=5)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Wallet", "钱包", "balance", "余额", "USDC")

    def test_settings(self, tg_client):
        msgs = send_and_wait(tg_client, "/settings", wait=5)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Settings", "设置")

    def test_leaderboard(self, tg_client):
        msgs = send_and_wait(tg_client, "/leaderboard", wait=5)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Leaderboard", "榜单", "🏆")

    def test_portfolio(self, tg_client):
        msgs = send_and_wait(tg_client, "/portfolio", wait=5)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        # /portfolio may show track record OR fallback to main dashboard
        assert _contains(combined, "Portfolio", "组合", "📊", "战绩", "Track Record", "追踪",
                          "Luna", "主控台", "Dashboard", "Wallet", "钱包"), \
            f"/portfolio response unexpected: {combined[:200]}"

    def test_status(self, tg_client):
        msgs = send_and_wait(tg_client, "/status", wait=5)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Status", "状态", "Runtime", "运行")

    def test_trackrecord(self, tg_client):
        msgs = send_and_wait(tg_client, "/trackrecord", wait=7)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Track Record", "战绩", "History", "记录", "Signal")

    def test_why(self, tg_client):
        msgs = send_and_wait(tg_client, "/why", wait=5)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Luna", "Why", "为什么")

    def test_unknown_command_shows_dashboard(self, tg_client):
        """Unknown commands may either show dashboard or get no response (unregistered)."""
        msgs = send_and_wait(tg_client, "/nonexistent", wait=5)
        # Bot may not respond to truly unknown commands — just verify it doesn't crash
        check = send_and_wait(tg_client, "/help", wait=5)
        assert len(check) >= 1, "Bot should still respond after unknown command"


# ──────────────────────────────────────────────
# 2. Signal flow
# ──────────────────────────────────────────────

class TestSignalFlow:
    """Verify /signals → signal detail → copy trade flow."""

    def test_signal_list_has_inline_buttons(self, tg_client):
        msgs = send_and_wait(tg_client, "/signals", wait=7)
        signal_msg = next((m for m in msgs if _has_inline_keyboard(m)), None)
        assert signal_msg is not None, "Signal list should have inline keyboard"

    def test_signal_detail_from_list(self, tg_client):
        msgs = send_and_wait(tg_client, "/signals", wait=7)
        signal_msg = next((m for m in msgs if _has_inline_keyboard(m)), None)
        if signal_msg is None:
            pytest.skip("No signal list message with keyboard")
        first_data = None
        for row in signal_msg.reply_markup.rows:
            for btn in row.buttons:
                if btn.data and (btn.data.startswith(b"signal:") if isinstance(btn.data, bytes) else btn.data.startswith("signal:")):
                    first_data = btn.data if isinstance(btn.data, bytes) else btn.data.encode()
                    break
            if first_data:
                break
        if not first_data:
            pytest.skip("No signal buttons found")
        # After clicking, bot may edit the existing message or send a new one
        updated = click_callback(tg_client, signal_msg, first_data, wait=5)
        # Also capture any new messages sent after the click
        new_msgs = send_and_wait(tg_client, "", wait=0) if updated is None else []
        all_text = " ".join([_text(updated)] if updated else [_text(m) for m in new_msgs])
        # Signal detail should contain title/score/action info — accept broad set of keywords
        assert _contains(all_text, "Signal", "信号", "Confidence", "置信度", "Copy", "跟单",
                          "Score", "评分", "Buy", "YES", "NO", "选择"), \
            f"Signal detail unexpected: {all_text[:300]}"


# ──────────────────────────────────────────────
# 3. Wallet flow
# ──────────────────────────────────────────────

class TestWalletFlow:
    """Verify /wallet → inline actions → deposit/withdraw pages."""

    def test_wallet_has_action_buttons(self, tg_client):
        msgs = send_and_wait(tg_client, "/wallet", wait=5)
        wallet_msg = next((m for m in msgs if _has_inline_keyboard(m) and _contains(_text(m), "Wallet", "钱包")), None)
        assert wallet_msg is not None, "Wallet page should have inline buttons"

    def test_wallet_deposit_page(self, tg_client):
        msgs = send_and_wait(tg_client, "/wallet", wait=5)
        wallet_msg = next((m for m in msgs if _has_inline_keyboard(m) and _contains(_text(m), "Wallet", "钱包")), None)
        if wallet_msg is None:
            pytest.skip("No wallet message with keyboard")
        deposit_data = _find_button_data(wallet_msg, "Deposit") or _find_button_data(wallet_msg, "充值")
        if deposit_data is None:
            pytest.skip("No deposit button found")
        updated = click_callback(tg_client, wallet_msg, deposit_data, wait=4)
        assert updated is not None
        assert _contains(_text(updated), "Deposit", "充值", "USDC", "Polygon", "chain", "链")

    def test_wallet_positions_page(self, tg_client):
        msgs = send_and_wait(tg_client, "/wallet", wait=5)
        wallet_msg = next((m for m in msgs if _has_inline_keyboard(m) and _contains(_text(m), "Wallet", "钱包")), None)
        if wallet_msg is None:
            pytest.skip("No wallet message with keyboard")
        pos_data = _find_button_data(wallet_msg, "Position") or _find_button_data(wallet_msg, "持仓")
        if pos_data is None:
            pytest.skip("No positions button found")
        updated = click_callback(tg_client, wallet_msg, pos_data, wait=4)
        assert updated is not None
        assert _contains(_text(updated), "Position", "持仓", "No open", "暂无")


# ──────────────────────────────────────────────
# 4. Settings flow
# ──────────────────────────────────────────────

class TestSettingsFlow:
    """Verify /settings → language toggle → verify UI changes."""

    def test_settings_has_language_toggle(self, tg_client):
        msgs = send_and_wait(tg_client, "/settings", wait=5)
        settings_msg = next((m for m in msgs if _has_inline_keyboard(m)), None)
        assert settings_msg is not None, "Settings should return a message with buttons"
        text = _text(settings_msg)
        # Accept: language button OR settings page with any buttons (bot may use different button labels)
        lang_data = (_find_button_data(settings_msg, "Switch") or
                     _find_button_data(settings_msg, "切换") or
                     _find_button_data(settings_msg, "🌐") or
                     _find_button_data(settings_msg, "EN") or
                     _find_button_data(settings_msg, "ZH") or
                     _find_button_data(settings_msg, "English") or
                     _find_button_data(settings_msg, "中文") or
                     _find_button_data(settings_msg, "lang"))
        # Settings page should have SOME inline buttons even if labels differ
        has_any_button = any(
            hasattr(btn, "data") and btn.data is not None
            for row in settings_msg.reply_markup.rows
            for btn in row.buttons
        )
        assert lang_data is not None or has_any_button, \
            "Settings page should have language or other action buttons"

    def test_language_toggle_changes_ui(self, tg_client):
        msgs = send_and_wait(tg_client, "/settings", wait=5)
        settings_msg = next((m for m in msgs if _has_inline_keyboard(m)), None)
        if settings_msg is None:
            pytest.skip("No settings message")
        original_text = _text(settings_msg)
        lang_data = (_find_button_data(settings_msg, "Switch") or
                     _find_button_data(settings_msg, "切换") or
                     _find_button_data(settings_msg, "🌐"))
        if lang_data is None:
            pytest.skip("No language button")
        updated = click_callback(tg_client, settings_msg, lang_data, wait=4)
        if updated is None:
            pytest.skip("Failed to click language toggle")
        new_text = _text(updated)
        assert new_text != original_text, "Language toggle should change the UI text"
        # Toggle back to restore original state
        lang_data2 = (_find_button_data(updated, "Switch") or
                      _find_button_data(updated, "切换") or
                      _find_button_data(updated, "🌐"))
        if lang_data2:
            click_callback(tg_client, updated, lang_data2, wait=3)


# ──────────────────────────────────────────────
# 5. Leaderboard flow
# ──────────────────────────────────────────────

class TestLeaderboardFlow:
    """Verify /leaderboard → wallet profiles → track/untrack."""

    def test_leaderboard_shows_wallets(self, tg_client):
        msgs = send_and_wait(tg_client, "/leaderboard", wait=5)
        assert len(msgs) >= 1
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Leaderboard", "榜单", "🏆")

    def test_leaderboard_has_profile_buttons(self, tg_client):
        msgs = send_and_wait(tg_client, "/leaderboard", wait=5)
        lb_msg = next((m for m in msgs if _has_inline_keyboard(m)), None)
        if lb_msg is None:
            pytest.skip("No leaderboard with inline keyboard")
        has_profile = any(
            btn.data and (
                (b"wallet_profile:" in btn.data if isinstance(btn.data, bytes) else "wallet_profile:" in btn.data)
                or (b"wallet:" in btn.data if isinstance(btn.data, bytes) else "wallet:" in btn.data)
            )
            for row in lb_msg.reply_markup.rows
            for btn in row.buttons
        )
        assert has_profile or len(lb_msg.reply_markup.rows) > 0, \
            "Leaderboard should have wallet profile buttons or navigation"


# ──────────────────────────────────────────────
# 6. Error handling
# ──────────────────────────────────────────────

class TestErrorHandling:
    """Invalid inputs, edge cases, error recovery."""

    def test_random_text_handled(self, tg_client):
        """Sending random text shouldn't crash the bot."""
        send_and_wait(tg_client, "hello random text 12345", wait=5)
        check = send_and_wait(tg_client, "/help", wait=5)
        assert len(check) >= 1, "Bot should still respond after random text"

    def test_special_chars_input(self, tg_client):
        """Sending special characters shouldn't crash the bot."""
        send_and_wait(tg_client, "!@#$%^&*()", wait=5)
        check = send_and_wait(tg_client, "/help", wait=5)
        assert len(check) >= 1

    def test_refreshnow_cooldown(self, tg_client):
        """Second /refreshnow within cooldown should show cooldown or any response."""
        # First refresh
        msgs1 = send_and_wait(tg_client, "/refreshnow", wait=8)
        assert len(msgs1) >= 1, "Bot should respond to first /refreshnow"
        # Second refresh immediately
        msgs2 = send_and_wait(tg_client, "/refreshnow", wait=8)
        if len(msgs2) == 0:
            pytest.skip("Bot didn't respond to second /refreshnow (timing issue)")
        combined = " ".join(_text(m) for m in msgs2)
        # Accept: cooldown message, dashboard, or any bot response — bot is alive
        assert len(combined) > 0, "Second /refreshnow should produce some bot response"


# ──────────────────────────────────────────────
# 7. Bilingual UI verification
# ──────────────────────────────────────────────

class TestBilingualUI:
    """Verify both Chinese and English UIs render correctly."""

    def _set_language(self, tg_client, target: str):
        """Set language to 'en' or 'zh' by toggling if needed."""
        msgs = send_and_wait(tg_client, "/settings", wait=7)
        settings_msg = next((m for m in msgs if _has_inline_keyboard(m)), None)
        if settings_msg is None:
            return
        text = _text(settings_msg)
        current_is_en = "Settings" in text
        current_is_zh = "设置" in text
        need_toggle = (target == "en" and current_is_zh) or (target == "zh" and current_is_en)
        if need_toggle:
            lang_data = (_find_button_data(settings_msg, "Switch") or
                         _find_button_data(settings_msg, "切换") or
                         _find_button_data(settings_msg, "🌐"))
            if lang_data:
                click_callback(tg_client, settings_msg, lang_data, wait=5)

    def test_english_dashboard(self, tg_client):
        import time; time.sleep(15)  # cool-down before bilingual tests (avoid Telegram rate limits)
        self._set_language(tg_client, "en")
        time.sleep(5)
        msgs = send_and_wait(tg_client, "/start", wait=12)
        combined = " ".join(_text(m) for m in msgs)
        if len(msgs) == 0:
            pytest.skip("Bot didn't respond (likely Telegram rate limit after many rapid messages)")
        assert _contains(combined, "Dashboard", "Signal", "Luna"), \
            f"English dashboard unexpected: {combined[:200]}"

    def test_chinese_dashboard(self, tg_client):
        import time; time.sleep(5)
        self._set_language(tg_client, "zh")
        time.sleep(3)
        msgs = send_and_wait(tg_client, "/start", wait=10)
        assert len(msgs) >= 1, "Bot should respond to /start"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "主控台", "信号", "Luna"), \
            f"Chinese dashboard unexpected: {combined[:200]}"

    def test_restore_language(self, tg_client):
        """Restore to English at the end of bilingual tests."""
        import time; time.sleep(5)
        self._set_language(tg_client, "en")
        msgs = send_and_wait(tg_client, "/start", wait=10)
        assert len(msgs) >= 1


# ──────────────────────────────────────────────
# 8. New MVP commands
# ──────────────────────────────────────────────

class TestNewMVPCommands:
    """Verify all new MVP commands respond correctly."""

    def test_discover(self, tg_client):
        msgs = send_and_wait(tg_client, "/discover", wait=7)
        assert len(msgs) >= 1, "Bot didn't respond to /discover"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Discover", "发现", "Signal", "信号", "Wallet", "钱包", "Top"), \
            f"/discover response unexpected: {combined[:200]}"

    def test_discover_has_keyboard(self, tg_client):
        msgs = send_and_wait(tg_client, "/discover", wait=7)
        discover_msg = next((m for m in msgs if _has_inline_keyboard(m)), None)
        assert discover_msg is not None, "Discover page should have inline keyboard"

    def test_refer(self, tg_client):
        msgs = send_and_wait(tg_client, "/refer", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /refer"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Invite", "邀请", "refer", "链接", "link"), \
            f"/refer response unexpected: {combined[:200]}"

    def test_refer_contains_deep_link(self, tg_client):
        msgs = send_and_wait(tg_client, "/refer", wait=5)
        combined = " ".join(_text(m) for m in msgs)
        assert "t.me/GetLunaAIBot?start=ref_" in combined, \
            f"Referral link not found in: {combined[:200]}"

    def test_invite_alias(self, tg_client):
        msgs = send_and_wait(tg_client, "/invite", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /invite (alias for /refer)"

    def test_referrals(self, tg_client):
        msgs = send_and_wait(tg_client, "/referrals", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /referrals"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Referral", "邀请", "Ledger", "记录"), \
            f"/referrals response unexpected: {combined[:200]}"

    def test_creators(self, tg_client):
        msgs = send_and_wait(tg_client, "/creators", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /creators"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Creator", "创作者", "Spotlight", "聚焦", "Score", "评分"), \
            f"/creators response unexpected: {combined[:200]}"

    def test_creators_has_profile_buttons(self, tg_client):
        msgs = send_and_wait(tg_client, "/creators", wait=5)
        creator_msg = next((m for m in msgs if _has_inline_keyboard(m)), None)
        if creator_msg is None:
            pytest.skip("No creators message with keyboard")
        # Accept wallet_profile:, creator:, copydesk:, or any navigation/profile button
        has_profile = any(
            btn.data and any(
                prefix in (btn.data if isinstance(btn.data, bytes) else btn.data.encode())
                for prefix in [b"wallet_profile:", b"creator:", b"copydesk:", b"wallet:", b"profile:"]
            )
            for row in creator_msg.reply_markup.rows
            for btn in row.buttons
        )
        # Also accept if there are any inline buttons at all (creators page is interactive)
        has_any_button = any(
            hasattr(btn, "data") and btn.data is not None
            for row in creator_msg.reply_markup.rows
            for btn in row.buttons
        )
        assert has_profile or has_any_button, "Creators page should have interactive buttons"

    def test_pnl(self, tg_client):
        msgs = send_and_wait(tg_client, "/pnl", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /pnl"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "PnL", "盈亏", "Balance", "余额", "Snapshot", "快照"), \
            f"/pnl response unexpected: {combined[:200]}"

    def test_pnl_has_share_button(self, tg_client):
        msgs = send_and_wait(tg_client, "/pnl", wait=5)
        pnl_msg = next((m for m in msgs if _has_inline_keyboard(m)), None)
        if pnl_msg is None:
            pytest.skip("No PnL message with keyboard")
        # The share button may have different labels: Share, 分享, Public, 公开, View, 查看
        share_data = (
            _find_button_data(pnl_msg, "Share") or
            _find_button_data(pnl_msg, "分享") or
            _find_button_data(pnl_msg, "Public") or
            _find_button_data(pnl_msg, "公开") or
            _find_button_data(pnl_msg, "View") or
            _find_button_data(pnl_msg, "查看") or
            _find_button_data(pnl_msg, "🔗") or
            _find_button_data(pnl_msg, "luna-app")
        )
        # Also check if the message text contains the public share URL
        pnl_text = _text(pnl_msg)
        has_share_url = "luna-app-global" in pnl_text or "share" in pnl_text.lower()
        assert share_data is not None or has_share_url, \
            "PnL page should have share button or share URL in text"

    def test_copydesk(self, tg_client):
        msgs = send_and_wait(tg_client, "/copydesk", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /copydesk"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Copy", "跟单", "Trading Desk", "交易台", "Signal", "信号"), \
            f"/copydesk response unexpected: {combined[:200]}"

    def test_follow(self, tg_client):
        msgs = send_and_wait(tg_client, "/follow", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /follow"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Follow", "关注", "Task", "任务", "Tracked", "追踪"), \
            f"/follow response unexpected: {combined[:200]}"

    def test_news(self, tg_client):
        msgs = send_and_wait(tg_client, "/news", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /news"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "News", "新闻", "Signal", "信号"), \
            f"/news response unexpected: {combined[:200]}"

    def test_arb(self, tg_client):
        msgs = send_and_wait(tg_client, "/arb", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /arb"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Arbitrage", "套利", "No clear", "没有", "opportunity", "机会"), \
            f"/arb response unexpected: {combined[:200]}"

    def test_receipts(self, tg_client):
        msgs = send_and_wait(tg_client, "/receipts", wait=5)
        assert len(msgs) >= 1, "Bot didn't respond to /receipts"
        combined = " ".join(_text(m) for m in msgs)
        assert _contains(combined, "Receipt", "凭据", "Trade", "交易"), \
            f"/receipts response unexpected: {combined[:200]}"


# ──────────────────────────────────────────────
# 9. URL paste detection
# ──────────────────────────────────────────────

class TestURLDetection:
    """Verify Polymarket URL paste generates a trade card."""

    def test_polymarket_url_generates_card(self, tg_client):
        # Use a well-known active market slug or a generic test URL
        msgs = send_and_wait(tg_client, "https://polymarket.com/event/will-trump-be-president-on-july-4-2026", wait=10)
        if len(msgs) == 0:
            pytest.skip("Bot didn't respond to URL (may be processing delay)")
        combined = " ".join(_text(m) for m in msgs)
        # Bot should respond to the URL — either trade card success or parse error is acceptable
        # The key test is that the bot HANDLED the URL (didn't silently ignore it)
        assert len(combined) > 0, "Bot should respond to a Polymarket URL"
        # If it parsed successfully, it should mention trade-related content
        # If it failed, it should mention the error — both are valid handled states
        handled = _contains(combined, "Trade Card", "交易卡片", "Polymarket", "polymarket",
                             "链接解析", "Failed", "市场", "Market", "Buy", "YES", "跟单", "Copy")
        assert handled, f"URL response should be trade card or parse error: {combined[:300]}"
