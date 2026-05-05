/**
 * Luna AI — Multi-language support
 * Supported: zh (Chinese), en (English), ja (Japanese), ko (Korean)
 */

export type Lang = "zh" | "en" | "ja" | "ko";

const strings = {
  // ── Dashboard ──
  "dashboard.title": {
    zh: "Luna 主控台",
    en: "Luna Dashboard",
    ja: "Luna ダッシュボード",
    ko: "Luna 대시보드",
  },
  "dashboard.no_account": {
    zh: "你还没有交易账户。最快上手：\n1. ✨ 一键创建钱包\n2. 充值 USDC\n3. 从世界杯或信号页面开始第一笔小额跟单",
    en: "You don't have a trading account yet. Quick start:\n1. ✨ Create Luna Wallet\n2. Deposit USDC\n3. Place your first small trade from World Cup or Signals",
    ja: "取引アカウントがまだありません。クイックスタート：\n1. ✨ ウォレットを作成\n2. USDC を入金\n3. ワールドカップまたはシグナルから初取引",
    ko: "아직 거래 계정이 없습니다. 빠른 시작:\n1. ✨ 지갑 만들기\n2. USDC 입금\n3. 월드컵이나 시그널에서 첫 거래 시작",
  },
  "dashboard.zero_balance": {
    zh: "账户已就绪。下一步：先充值，再从 ⚽ 世界杯或最新信号开始第一笔小额真单。",
    en: "Account is ready. Next: deposit funds, then start your first trade from ⚽ World Cup or Signals.",
    ja: "アカウント準備完了。次は入金して、⚽ ワールドカップまたはシグナルから初取引を。",
    ko: "계정 준비 완료. 다음: 입금 후 ⚽ 월드컵이나 시그널에서 첫 거래를 시작하세요.",
  },
  "dashboard.active": {
    zh: "一切就绪。去 ⚽ 世界杯 看比赛快讯，或打开钱包管理资产。",
    en: "All set. Jump into ⚽ World Cup for live signals, or open your wallet to manage assets.",
    ja: "準備万端。⚽ ワールドカップでライブシグナルを確認、またはウォレットで資産管理を。",
    ko: "준비 완료. ⚽ 월드컵에서 라이브 시그널을 확인하거나 지갑에서 자산을 관리하세요.",
  },
  "dashboard.best_trade": { zh: "今日最值得看的单", en: "Today's best trade", ja: "今日の注目トレード", ko: "오늘의 베스트 트레이드" },
  "dashboard.sports_focus": { zh: "体育窗口", en: "Sports window", ja: "スポーツ注目枠", ko: "스포츠 포커스" },
  "dashboard.best_wallet": { zh: "今日最强钱包", en: "Top wallet today", ja: "本日の最強ウォレット", ko: "오늘의 탑 지갑" },

  // ── Labels ──
  "label.account_status": { zh: "账户状态", en: "Status", ja: "ステータス", ko: "상태" },
  "label.mode": { zh: "模式", en: "Mode", ja: "モード", ko: "모드" },
  "label.balance": { zh: "余额", en: "Balance", ja: "残高", ko: "잔액" },
  "label.positions": { zh: "持仓", en: "Positions", ja: "ポジション", ko: "포지션" },

  // ── Buttons ──
  "btn.create_wallet": { zh: "✨ 一键创建钱包", en: "✨ Create Wallet", ja: "✨ ウォレット作成", ko: "✨ 지갑 만들기" },
  "btn.restore_wallet": { zh: "♻️ 恢复钱包", en: "♻️ Restore Wallet", ja: "♻️ ウォレット復元", ko: "♻️ 지갑 복구" },
  "btn.discover": { zh: "🚀 今日机会", en: "🚀 Discover", ja: "🚀 今日の機会", ko: "🚀 오늘의 기회" },
  "btn.copydesk": { zh: "🤖 AI 跟单", en: "🤖 AI Copy", ja: "🤖 AI コピー", ko: "🤖 AI 카피" },
  "btn.worldcup": { zh: "⚽ 世界杯", en: "⚽ World Cup", ja: "⚽ W杯", ko: "⚽ 월드컵" },
  "btn.deposit": { zh: "💳 充值", en: "💳 Deposit", ja: "💳 入金", ko: "💳 입금" },
  "btn.wallet": { zh: "💼 钱包", en: "💼 Wallet", ja: "💼 ウォレット", ko: "💼 지갑" },
  "btn.signals": { zh: "📋 最新信号", en: "📋 Signals", ja: "📋 シグナル", ko: "📋 시그널" },
  "btn.receipts": { zh: "🧾 交易回执", en: "🧾 Receipts", ja: "🧾 レシート", ko: "🧾 거래 영수증" },
  "btn.pnl": { zh: "📈 分享收益", en: "📈 Share PnL", ja: "📈 損益共有", ko: "📈 손익 공유" },
  "btn.refresh": { zh: "⚡ 刷新", en: "⚡ Refresh", ja: "⚡ 更新", ko: "⚡ 새로고침" },
  "btn.quick_signals": { zh: "📄 最新信号", en: "📄 Latest Signals", ja: "📄 最新シグナル", ko: "📄 최신 시그널" },
  "btn.quick_profile": { zh: "📁 成绩单", en: "📁 Scorecard", ja: "📁 スコアカード", ko: "📁 스코어카드" },
  "btn.quick_smart_money": { zh: "🏆 聪明钱榜单", en: "🏆 Smart Wallets", ja: "🏆 スマートマネー", ko: "🏆 스마트 머니" },
  "btn.quick_dashboard": { zh: "📊 主控台", en: "📊 Dashboard", ja: "📊 ダッシュボード", ko: "📊 대시보드" },
  "btn.settings": { zh: "⚙️ 设置", en: "⚙️ Settings", ja: "⚙️ 設定", ko: "⚙️ 설정" },
  "btn.settings_sports": { zh: "⚽ 体育模式", en: "⚽ Sports Mode", ja: "⚽ スポーツモード", ko: "⚽ 스포츠 모드" },
  "btn.settings_alerts": { zh: "🔔 信号提醒", en: "🔔 Alerts", ja: "🔔 アラート", ko: "🔔 알림" },
  "btn.settings_score": { zh: "🏆 提醒阈值", en: "🏆 Alert Score", ja: "🏆 アラート閾値", ko: "🏆 알림 점수" },
  "btn.settlements": { zh: "🏁 结算", en: "🏁 Settlements", ja: "🏁 決済", ko: "🏁 정산" },
  "btn.refer": { zh: "🎁 邀请赚佣", en: "🎁 Refer & Earn", ja: "🎁 招待して稼ぐ", ko: "🎁 추천 수익" },
  "btn.referral_ledger": { zh: "📒 返佣账本", en: "📒 Referral Ledger", ja: "📒 紹介台帳", ko: "📒 추천 원장" },
  "btn.creators": { zh: "📣 带单达人", en: "📣 Top Creators", ja: "📣 注目クリエイター", ko: "📣 탑 크리에이터" },
  "btn.addressbook": { zh: "🗂 地址库", en: "🗂 Address Book", ja: "🗂 アドレス帳", ko: "🗂 주소 라이브러리" },
  "btn.follow_tasks": { zh: "🤝 跟单任务", en: "🤝 Follow Tasks", ja: "🤝 フォロータスク", ko: "🤝 팔로우 태스크" },
  "btn.news": { zh: "📰 新闻狙击", en: "📰 News", ja: "📰 ニュース", ko: "📰 뉴스" },
  "btn.arb": { zh: "⚖️ 套利预警", en: "⚖️ Arb", ja: "⚖️ アービトラージ", ko: "⚖️ 차익거래" },
  "btn.track_wallet": { zh: "🎯 收藏地址", en: "🎯 Track Wallet", ja: "🎯 ウォレット保存", ko: "🎯 지갑 추적" },
  "btn.follow_wallet": { zh: "🤝 创建跟单", en: "🤝 Follow Wallet", ja: "🤝 フォロー作成", ko: "🤝 팔로우 만들기" },
  "btn.follow_conservative": { zh: "保守", en: "Conservative", ja: "保守", ko: "보수" },
  "btn.follow_balanced": { zh: "平衡", en: "Balanced", ja: "バランス", ko: "균형" },
  "btn.follow_aggressive": { zh: "激进", en: "Aggressive", ja: "積極", ko: "공격" },
  "btn.pause_task": { zh: "⏸ 暂停", en: "⏸ Pause", ja: "⏸ 一時停止", ko: "⏸ 일시정지" },
  "btn.resume_task": { zh: "▶️ 恢复", en: "▶️ Resume", ja: "▶️ 再開", ko: "▶️ 재개" },
  "btn.back_follow": { zh: "« 返回跟单", en: "« Back to Follow", ja: "« フォローへ戻る", ko: "« 팔로우로" },
  "btn.back_addressbook": { zh: "« 返回地址库", en: "« Back to Address Book", ja: "« アドレス帳へ戻る", ko: "« 주소록으로" },
  "btn.open_public_page": { zh: "🌐 打开公开页", en: "🌐 Open Public Page", ja: "🌐 公開ページ", ko: "🌐 공개 페이지" },
  "btn.withdraw": { zh: "💸 提币", en: "💸 Withdraw", ja: "💸 出金", ko: "💸 출금" },
  "btn.positions": { zh: "📊 持仓", en: "📊 Positions", ja: "📊 ポジション", ko: "📊 포지션" },
  "btn.back_dashboard": { zh: "« 主控台", en: "« Dashboard", ja: "« ダッシュボード", ko: "« 대시보드" },
  "btn.back_wallet": { zh: "💼 返回钱包", en: "💼 Back to wallet", ja: "💼 ウォレットへ", ko: "💼 지갑으로" },
  "cache.hint": { zh: "为保证秒开，此页优先显示缓存快照。点刷新获取最新链上状态。", en: "This page opens from a cached snapshot for speed. Tap Refresh for the latest on-chain state.", ja: "速度のため、このページはキャッシュ済みスナップショットを優先表示します。最新状態は更新をタップしてください。", ko: "속도를 위해 이 페이지는 캐시된 스냅샷을 먼저 표시합니다. 최신 온체인 상태는 새로고침을 누르세요." },
  "cache.snapshot": { zh: "缓存快照", en: "Cached snapshot", ja: "キャッシュ済みスナップショット", ko: "캐시 스냅샷" },
  "btn.back_signal": { zh: "« 返回信号", en: "« Back to signal", ja: "« シグナルへ", ko: "« 시그널로" },
  "btn.back_signals": { zh: "« 返回列表", en: "« Back", ja: "« 戻る", ko: "« 뒤로" },
  "btn.back_worldcup": { zh: "« 返回世界杯", en: "« Back to World Cup", ja: "« W杯へ戻る", ko: "« 월드컵으로" },
  "btn.back_positions": { zh: "« 返回持仓", en: "« Back to positions", ja: "« ポジションへ", ko: "« 포지션으로" },
  "btn.safe_onboarding": { zh: "🛡 官方安全认证", en: "🛡 Safe Onboarding", ja: "🛡 公式認証", ko: "🛡 공식 인증" },
  "btn.connect_wallet": { zh: "🔐 连接已有账户", en: "🔐 Connect Wallet", ja: "🔐 ウォレット接続", ko: "🔐 지갑 연결" },
  "btn.connect_wallet_secure": { zh: "🔐 安全连接已有账户", en: "🔐 Secure Connect Wallet", ja: "🔐 安全にウォレット接続", ko: "🔐 안전한 지갑 연결" },
  "btn.backup_wallet": { zh: "🧾 备份钱包", en: "🧾 Backup Wallet", ja: "🧾 バックアップ", ko: "🧾 백업" },
  "btn.download_backup": { zh: "🧾 下载备份", en: "🧾 Download Backup", ja: "🧾 バックアップDL", ko: "🧾 백업 다운로드" },
  "btn.detail": { zh: "📊 详情", en: "📊 Detail", ja: "📊 詳細", ko: "📊 상세" },
  "btn.market": { zh: "🌐 市场", en: "🌐 Market", ja: "🌐 マーケット", ko: "🌐 마켓" },
  "btn.copy": { zh: "⚡ 跟单", en: "⚡ Copy", ja: "⚡ コピー", ko: "⚡ 카피" },
  "btn.match_cards": { zh: "⚽ 比赛卡片", en: "⚽ Match Cards", ja: "⚽ マッチカード", ko: "⚽ 매치 카드" },
  "btn.sports_wallets": { zh: "🏆 体育钱包", en: "🏆 Sports Wallets", ja: "🏆 スポーツウォレット", ko: "🏆 스포츠 지갑" },
  "btn.close_position": { zh: "🧹 全部平仓", en: "🧹 Close Position", ja: "🧹 ポジション決済", ko: "🧹 포지션 청산" },
  "btn.redeem": { zh: "💸 兑付赢家仓位", en: "💸 Redeem Winners", ja: "💸 勝者ポジション換金", ko: "💸 수익 포지션 환수" },
  "btn.open_card": { zh: "⚽ 查看卡片", en: "⚽ Open Card", ja: "⚽ カードを見る", ko: "⚽ 카드 보기" },
  "btn.language": { zh: "🌐 中文", en: "🌐 English", ja: "🌐 日本語", ko: "🌐 한국어" },

  // ── Signals ──
  "signals.title": { zh: "最新信号", en: "Latest Signals", ja: "最新シグナル", ko: "최신 시그널" },
  "signals.intro": {
    zh: "只展示被高评分钱包验证过的信号。",
    en: "Only signals backed by high-score wallets are shown.",
    ja: "高スコアウォレットが裏付けるシグナルのみ表示。",
    ko: "고득점 지갑이 뒷받침하는 시그널만 표시됩니다.",
  },
  "signals.reply_hint": { zh: "回复编号查看详情。", en: "Reply with a number to open detail.", ja: "番号を入力して詳細を表示。", ko: "번호를 입력하여 상세 보기." },
  "signals.none": { zh: "暂无信号。", en: "No signals yet.", ja: "シグナルはまだありません。", ko: "아직 시그널이 없습니다." },
  "signal.not_found": { zh: "没有这个信号编号。", en: "Signal not found.", ja: "シグナルが見つかりません。", ko: "시그널을 찾을 수 없습니다." },

  // ── Signal Detail ──
  "signal.trade": { zh: "交易建议", en: "Trade", ja: "取引提案", ko: "거래 제안" },
  "signal.expected": { zh: "预期", en: "Expected", ja: "予想", ko: "예상" },
  "signal.daily": { zh: "日化", en: "Daily", ja: "日次", ko: "일별" },
  "signal.market": { zh: "市场", en: "Market", ja: "マーケット", ko: "마켓" },
  "signal.price": { zh: "价格", en: "Price", ja: "価格", ko: "가격" },
  "signal.liquidity": { zh: "流动性", en: "Liquidity", ja: "流動性", ko: "유동성" },
  "signal.expiry": { zh: "到期", en: "Expiry", ja: "期限", ko: "만기" },
  "signal.why": { zh: "为什么跟这单", en: "Why this trade", ja: "なぜこの取引？", ko: "왜 이 거래?" },
  "signal.source": { zh: "来源", en: "Source", ja: "ソース", ko: "출처" },
  "signal.outcome": { zh: "结果追踪", en: "Outcome", ja: "結果", ko: "결과" },
  "signal.open": { zh: "待结算", en: "Open", ja: "未決済", ko: "미결제" },

  // ── World Cup ──
  "worldcup.title": { zh: "World Cup / 体育专题", en: "World Cup / Sports Hub", ja: "W杯 / スポーツハブ", ko: "월드컵 / 스포츠 허브" },
  "worldcup.intro": {
    zh: "快速压球：压哪场、跟谁压、压多少。",
    en: "Bet fast: which match, whose conviction, how much.",
    ja: "素早くベット：どの試合に、誰の確信で、いくら。",
    ko: "빠르게 베팅: 어떤 경기에, 누구의 확신으로, 얼마나.",
  },
  "worldcup.top_signals": { zh: "今日体育高分信号", en: "Top sports signals", ja: "本日のスポーツシグナル", ko: "오늘의 스포츠 시그널" },
  "worldcup.specialist_wallets": { zh: "体育专精钱包", en: "Sports specialist wallets", ja: "スポーツ専門ウォレット", ko: "스포츠 전문 지갑" },
  "worldcup.no_signals": { zh: "暂无体育信号", en: "No sports signals yet", ja: "スポーツシグナルなし", ko: "스포츠 시그널 없음" },
  "worldcup.no_wallets": { zh: "暂无体育专精钱包", en: "No sports specialist wallets yet", ja: "スポーツ専門ウォレットなし", ko: "스포츠 전문 지갑 없음" },
  "worldcup.one_tap": {
    zh: "进入比赛卡片后直接一键小额跟单。",
    en: "Use match cards for one-tap small-size execution.",
    ja: "マッチカードからワンタップで少額取引。",
    ko: "매치 카드에서 원탭으로 소액 거래.",
  },
  "worldcup.sports_signals_title": { zh: "世界杯专题信号", en: "World Cup Signals", ja: "W杯シグナル", ko: "월드컵 시그널" },
  "worldcup.sports_signals_intro": {
    zh: "只看体育，按 Smart Score 排序，适合赛前快速进场。",
    en: "Sports-only, sorted by Smart Score for fast pre-match execution.",
    ja: "スポーツ限定、Smart Scoreでソート。試合前の素早い取引に最適。",
    ko: "스포츠 전용, Smart Score 순. 경기 전 빠른 거래에 적합.",
  },
  "worldcup.no_sports_signals": { zh: "暂无体育/世界杯专题信号。", en: "No sports / World Cup signals available.", ja: "スポーツ/W杯シグナルなし。", ko: "스포츠/월드컵 시그널 없음." },

  // ── Discover / Referral ──
  "discover.title": { zh: "今日机会", en: "Discover", ja: "今日の機会", ko: "오늘의 기회" },
  "discover.intro": {
    zh: "别自己翻市场。先看今天最值得做的单、最热的体育题材、以及最值得跟的钱包。",
    en: "Skip raw market browsing. Start with the best trades today, the hottest sports setups, and the wallets worth following.",
    ja: "マーケットを自力で漁る前に、今日やるべきトレード・スポーツテーマ・追うべきウォレットを先に確認。",
    ko: "시장 전체를 뒤지기 전에 오늘 가장 볼 가치 있는 트레이드, 스포츠 테마, 따라갈 지갑부터 확인하세요.",
  },
  "discover.best_trades": { zh: "今日主推", en: "Best trades today", ja: "今日の主力トレード", ko: "오늘의 메인 트레이드" },
  "discover.sports_window": { zh: "体育快线", en: "Sports window", ja: "スポーツ速報", ko: "스포츠 윈도우" },
  "discover.smart_wallets": { zh: "最值得跟的钱包", en: "Wallets worth copying", ja: "追う価値のあるウォレット", ko: "따라갈 가치가 있는 지갑" },
  "discover.copydesk": { zh: "AI 跟单台", en: "AI Copy Desk", ja: "AI コピー台", ko: "AI 카피 데스크" },
  "discover.cta": {
    zh: "先从一笔最小额真单开始。看懂后，再放大仓位。",
    en: "Start with the smallest live trade first. Scale only after you understand the edge.",
    ja: "まずは最小額の実トレードから。優位性を理解してからサイズを上げましょう。",
    ko: "먼저 최소 금액의 실거래부터 시작하세요. 엣지를 이해한 후 규모를 키우세요.",
  },
  "copydesk.title": { zh: "AI 跟单台", en: "AI Copy Desk", ja: "AI コピー台", ko: "AI 카피 데스크" },
  "copydesk.intro": {
    zh: "别盲跟。Luna 会先告诉你现在更适合跟哪类高手、看哪一笔单、以及第一笔该下多小。",
    en: "Don't copy blindly. Luna tells you which wallet cohort matters now, which setup is worth acting on, and how small your first live trade should be.",
    ja: "やみくもにコピーしないでください。Luna は今重視すべきウォレット層、実行すべきセットアップ、最初の少額サイズを示します。",
    ko: "무작정 카피하지 마세요. Luna는 지금 봐야 할 지갑 군, 실행할 만한 셋업, 첫 소액 사이즈를 알려줍니다.",
  },
  "copydesk.general_wallet": { zh: "全市场优先参考", en: "Best broad-market wallet", ja: "総合で優先するウォレット", ko: "전체 시장 우선 지갑" },
  "copydesk.sports_wallet": { zh: "体育优先参考", en: "Best sports wallet", ja: "スポーツ優先ウォレット", ko: "스포츠 우선 지갑" },
  "copydesk.best_signal": { zh: "当前最值得做的单", en: "Best setup now", ja: "今やるべきトレード", ko: "지금 가장 좋은 셋업" },
  "copydesk.sports_signal": { zh: "世界杯 / 体育单", en: "Sports / World Cup setup", ja: "スポーツ / W杯セットアップ", ko: "스포츠 / 월드컵 셋업" },
  "copydesk.why": { zh: "AI 判断理由", en: "Why Luna likes this", ja: "Luna の判断理由", ko: "Luna 판단 이유" },
  "copydesk.size_hint": {
    zh: "首笔建议先用小额真单测试，再决定是否加仓。",
    en: "Start with a small live size first, then scale only if the thesis still holds.",
    ja: "まずは少額の実トレードで試し、優位性が続くならサイズを上げましょう。",
    ko: "먼저 소액 실거래로 테스트하고, 논리가 유지될 때만 규모를 키우세요.",
  },
  "copydesk.none_wallet": { zh: "暂无可参考钱包", en: "No wallet ranking yet", ja: "参照できるウォレットなし", ko: "참고할 지갑 없음" },
  "copydesk.none_signal": { zh: "暂无可执行信号", en: "No actionable setup yet", ja: "実行可能なセットアップなし", ko: "실행할 셋업 없음" },
  "copydesk.route_general": { zh: "适合先看全市场主推", en: "Best if you're trading the main board", ja: "総合マーケット向け", ko: "메인 보드용" },
  "copydesk.route_sports": { zh: "适合赛前压球", en: "Best if you're betting sports pre-match", ja: "試合前ベット向け", ko: "경기 전 스포츠 베팅용" },
  "addressbook.title": { zh: "地址库", en: "Address Book", ja: "アドレス帳", ko: "주소 라이브러리" },
  "addressbook.intro": { zh: "别手动找地址。这里收口了 Luna 认为最值得长期观察和跟单的钱包库。", en: "Don't hunt raw addresses manually. This is Luna's curated wallet library for tracking and copy execution.", ja: "生のアドレスを手動で探さず、Luna が厳選したウォレットライブラリから追跡・コピーしてください。", ko: "원시 주소를 직접 찾지 말고 Luna가 큐레이션한 지갑 라이브러리에서 추적/카피하세요." },
  "addressbook.core": { zh: "AI 核心候选", en: "AI Core Picks", ja: "AI コア候補", ko: "AI 핵심 후보" },
  "addressbook.sports": { zh: "体育专精地址", en: "Sports Specialists", ja: "スポーツ特化アドレス", ko: "스포츠 전문 주소" },
  "addressbook.tracked": { zh: "我的收藏地址", en: "My Tracked Wallets", ja: "保存済みウォレット", ko: "내 추적 지갑" },
  "addressbook.tasks": { zh: "已启动跟单任务", en: "Live Follow Tasks", ja: "実行中フォロータスク", ko: "실행 중 팔로우 태스크" },
  "addressbook.active_tasks": { zh: "个活跃任务", en: "active tasks", ja: "件のアクティブタスク", ko: "개의 활성 작업" },
  "addressbook.hint": { zh: "先收藏，再建跟单任务。体育和全市场要分开看。", en: "Track first, then activate follow tasks. Treat sports specialists separately from broad-market wallets.", ja: "まず保存してからフォロータスクを作成。スポーツ専門と総合は分けて見ましょう。", ko: "먼저 추적하고 그다음 팔로우 작업을 만드세요. 스포츠 전문과 전체 시장 지갑은 분리해 보세요." },
  "addressbook.none": { zh: "暂无可用地址。", en: "No wallet profiles yet.", ja: "利用可能なウォレットがありません。", ko: "사용 가능한 지갑이 없습니다." },
  "addressbook.none_tracked": { zh: "你还没有收藏任何地址。", en: "You have not tracked any wallets yet.", ja: "まだ保存したウォレットがありません。", ko: "아직 추적 중인 지갑이 없습니다." },
  "addressbook.profile": { zh: "地址档案", en: "Wallet Profile", ja: "ウォレットプロフィール", ko: "지갑 프로필" },
  "addressbook.tracked_flag": { zh: "已加入收藏地址库", en: "Saved in your address library", ja: "アドレス帳に保存済み", ko: "주소 라이브러리에 저장됨" },
  "follow.title": { zh: "跟单任务", en: "Follow Tasks", ja: "フォロータスク", ko: "팔로우 태스크" },
  "follow.intro": { zh: "Luna 不只是告诉你跟谁单，还会把它变成可持续执行的跟单任务。", en: "Luna should not just tell you who to copy. It should turn that into an executable follow task.", ja: "Luna は誰をコピーするか示すだけでなく、それを実行可能なフォロータスクに変えます。", ko: "Luna는 누구를 따라야 하는지 알려줄 뿐 아니라 이를 실행 가능한 팔로우 작업으로 바꿉니다." },
  "follow.live_tasks": { zh: "当前任务", en: "Current Tasks", ja: "現在のタスク", ko: "현재 작업" },
  "follow.suggestions": { zh: "推荐先建的任务", en: "Recommended Tasks", ja: "おすすめタスク", ko: "추천 작업" },
  "follow.hint": { zh: "先用固定金额跑通，再逐步调大上限。复制交易最重要的是限额和节奏。", en: "Start with fixed-size copying, then scale caps carefully. Limits and pacing matter more than bravado.", ja: "まずは固定額で始め、上限を慎重に上げてください。コピー取引は上限とペースが重要です。", ko: "고정 금액으로 시작한 뒤 상한을 조심스럽게 키우세요. 카피 거래는 한도와 페이스가 중요합니다." },
  "follow.none": { zh: "你还没有跟单任务。先从 AI 跟单台或地址库里挑一个。", en: "You do not have any follow tasks yet. Start from AI Copy Desk or Address Book.", ja: "まだフォロータスクがありません。AI Copy Desk か Address Book から始めましょう。", ko: "아직 팔로우 작업이 없습니다. AI Copy Desk 또는 Address Book에서 시작하세요." },
  "follow.setup": { zh: "创建跟单任务", en: "Create Follow Task", ja: "フォロータスク作成", ko: "팔로우 작업 만들기" },
  "follow.preset_hint": { zh: "直接选一个风险档位即可。保守更像 Alice 的“先试小单”，激进更接近 PolyGun / PolyCop 的高强度跟单。", en: "Choose a risk preset. Conservative matches Alice-style first-test sizing; Aggressive is closer to PolyGun / PolyCop style copy execution.", ja: "リスクプリセットを選ぶだけです。保守は Alice 風の少額試し、積極は PolyGun / PolyCop に近い実行です。", ko: "위험 프리셋을 선택하세요. 보수는 Alice식 소액 테스트, 공격은 PolyGun / PolyCop 스타일에 가깝습니다." },
  "follow.general_bias": { zh: "偏向全市场跟单", en: "Broad-market bias", ja: "総合マーケット寄り", ko: "전체 시장 편향" },
  "follow.sports_bias": { zh: "偏向体育跟单", en: "Sports bias", ja: "スポーツ寄り", ko: "스포츠 편향" },
  "follow.created": { zh: "跟单任务已创建", en: "Follow task created", ja: "フォロータスクを作成しました", ko: "팔로우 작업이 생성되었습니다" },
  "follow.active": { zh: "运行中", en: "Active", ja: "稼働中", ko: "실행 중" },
  "follow.paused": { zh: "已暂停", en: "Paused", ja: "一時停止中", ko: "일시정지" },
  "follow.per_trade": { zh: "单笔上限", en: "max", ja: "1回上限", ko: "1회 최대" },
  "follow.task_live": { zh: "任务运行中", en: "Task active", ja: "タスク稼働中", ko: "작업 실행 중" },
  "refer.title": { zh: "邀请赚佣", en: "Refer & Earn", ja: "招待して稼ぐ", ko: "추천 수익" },
  "refer.intro": {
    zh: "Luna 的商业版不只靠平台抽成，也靠推荐和带单增长。把下面这个链接分享给朋友或社群。",
    en: "Luna grows through distribution, not just fees. Share the link below with friends, group chats, or your audience.",
    ja: "Luna は手数料だけでなく、紹介と配信で伸ばします。下のリンクを友人やコミュニティに共有してください。",
    ko: "Luna는 수수료뿐 아니라 추천과 배포로 성장합니다. 아래 링크를 친구나 커뮤니티에 공유하세요.",
  },
  "refer.link": { zh: "专属邀请链接", en: "Your invite link", ja: "招待リンク", ko: "내 초대 링크" },
  "refer.economics": { zh: "收入结构", en: "Economics", ja: "収益構造", ko: "수익 구조" },
  "refer.platform_fee": { zh: "平台费", en: "Platform fee", ja: "プラットフォーム手数料", ko: "플랫폼 수수료" },
  "refer.pool_split": { zh: "推荐池分成", en: "Referral pool split", ja: "紹介プール配分", ko: "추천 풀 배분" },
  "refer.share_hint": { zh: "每一笔真实交易都会给推荐池留出空间。", en: "Each live trade contributes to the referral pool.", ja: "すべての実取引が紹介プールに貢献します。", ko: "모든 실거래가 추천 풀에 기여합니다." },
  "refer.pool_wallet": { zh: "推荐池钱包", en: "Referral pool wallet", ja: "紹介プールウォレット", ko: "추천 풀 지갑" },
  "refer.kol_hint": { zh: "下一步会继续做 KOL 带单页、返佣账本和邀请排行。", en: "Next up: KOL pages, referral ledger, and invite leaderboard.", ja: "次は KOL ページ、紹介台帳、招待ランキングです。", ko: "다음 단계는 KOL 페이지, 추천 원장, 초대 리더보드입니다." },
  "refer.recent": { zh: "最近邀请收益", en: "Recent referral earnings", ja: "最近の招待収益", ko: "최근 추천 수익" },
  "refer.ledger_title": { zh: "返佣账本", en: "Referral Ledger", ja: "紹介台帳", ko: "추천 원장" },
  "refer.total_referrals": { zh: "累计邀请人数", en: "Total referrals", ja: "累計紹介人数", ko: "총 추천 수" },
  "refer.total_earned": { zh: "累计返佣收入", en: "Total referral earnings", ja: "累計紹介収益", ko: "총 추천 수익" },
  "refer.none_recent": { zh: "还没有邀请收益记录。先把你的链接发出去。", en: "No referral earnings yet. Share your link first.", ja: "招待収益はまだありません。まずはリンクを共有しましょう。", ko: "아직 추천 수익이 없습니다. 먼저 링크를 공유하세요." },
  "creators.title": { zh: "带单达人", en: "Top Creators", ja: "注目クリエイター", ko: "탑 크리에이터" },
  "creators.intro": { zh: "不是谁声音大就跟谁。先看谁真的有交易回执、邀请转化和持续成交。", en: "Don't follow whoever shouts the loudest. Start with creators who have real receipts, real conversions, and repeat trading activity.", ja: "声が大きい人ではなく、実際のレシート・紹介実績・継続取引がある人を見ましょう。", ko: "목소리 큰 사람이 아니라 실제 영수증, 전환, 반복 거래가 있는 크리에이터를 보세요." },
  "creators.none": { zh: "还没有公开带单达人数据。", en: "No public creator data yet.", ja: "公開クリエイターデータはまだありません。", ko: "공개 크리에이터 데이터가 아직 없습니다." },
  "creators.profile_title": { zh: "达人档案", en: "Creator Profile", ja: "クリエイタープロフィール", ko: "크리에이터 프로필" },
  "creators.live_balance": { zh: "实盘余额", en: "Live balance", ja: "実残高", ko: "실잔고" },
  "creators.live_positions": { zh: "实盘持仓", en: "Live positions", ja: "実ポジション", ko: "실포지션" },
  "creators.position_value": { zh: "持仓价值", en: "Position value", ja: "ポジション価値", ko: "포지션 가치" },
  "creators.unrealized": { zh: "未实现盈亏", en: "Unrealized PnL", ja: "含み損益", ko: "미실현 손익" },
  "creators.share_hint": { zh: "先看公开页和回执，再决定是否跟单。", en: "Inspect the public page and receipts before you copy.", ja: "公開ページとレシートを見てからコピーしましょう。", ko: "공개 페이지와 영수증을 본 뒤 카피하세요." },
  "settings.title": { zh: "设置", en: "Settings", ja: "設定", ko: "설정" },
  "settings.language": { zh: "当前语言", en: "Current language", ja: "現在の言語", ko: "현재 언어" },
  "settings.sports": { zh: "体育模式", en: "Sports mode", ja: "スポーツモード", ko: "스포츠 모드" },
  "settings.alerts": { zh: "信号提醒", en: "Signal alerts", ja: "シグナル通知", ko: "시그널 알림" },
  "settings.min_score": { zh: "提醒最低分", en: "Minimum alert score", ja: "通知の最低スコア", ko: "알림 최소 점수" },
  "settings.on": { zh: "开启", en: "On", ja: "オン", ko: "켜짐" },
  "settings.off": { zh: "关闭", en: "Off", ja: "オフ", ko: "꺼짐" },
  "settings.hint": { zh: "体育模式会在首页显示体育信号；提醒只推送高于你阈值的机会。", en: "Sports mode surfaces sports signals on your home screens. Alerts only push trades above your chosen score.", ja: "スポーツモードはホームにスポーツシグナルを表示します。通知は設定したスコア以上のみ届きます。", ko: "스포츠 모드는 홈에 스포츠 시그널을 보여줍니다. 알림은 설정한 점수 이상만 보냅니다." },

  // ── Wallet ──
  "wallet.title": { zh: "我的钱包", en: "My Wallet", ja: "マイウォレット", ko: "내 지갑" },
  "wallet.balance": { zh: "交易余额", en: "Trading balance", ja: "取引残高", ko: "거래 잔액" },
  "wallet.positions_count": { zh: "当前持仓", en: "Positions", ja: "ポジション", ko: "포지션" },
  "wallet.open_orders": { zh: "挂单数", en: "Open orders", ja: "未約定注文", ko: "미체결 주문" },
  "wallet.trading_wallet": { zh: "交易钱包", en: "Trading wallet", ja: "取引ウォレット", ko: "거래 지갑" },
  "wallet.hint": {
    zh: '点"充值"入金，点"提币"出金，点"结算"查看赛果仓位。',
    en: "Use Deposit to fund, Withdraw to move out, Settlements to inspect resolved markets.",
    ja: "入金・出金・決済済みマーケットの確認はそれぞれのボタンから。",
    ko: "입금·출금·정산된 마켓 확인은 각 버튼에서.",
  },

  // ── Positions ──
  "positions.title": { zh: "我的持仓", en: "My Positions", ja: "マイポジション", ko: "내 포지션" },
  "positions.none": { zh: "当前没有真实持仓。", en: "No live positions right now.", ja: "現在ポジションはありません。", ko: "현재 포지션이 없습니다." },
  "positions.shares": { zh: "股", en: "shares", ja: "株", ko: "주" },
  "positions.current_value": { zh: "当前价值", en: "Current value", ja: "現在価値", ko: "현재 가치" },
  "position.detail_title": { zh: "持仓详情", en: "Position Detail", ja: "ポジション詳細", ko: "포지션 상세" },
  "position.side": { zh: "方向", en: "Side", ja: "方向", ko: "방향" },
  "position.entry": { zh: "入场价", en: "Entry", ja: "エントリー", ko: "진입가" },
  "position.current": { zh: "当前价", en: "Current", ja: "現在価格", ko: "현재가" },
  "position.value": { zh: "当前价值", en: "Value", ja: "価値", ko: "가치" },

  // ── Copy Trade ──
  "copy.title": { zh: "跟单确认", en: "Copy Trade", ja: "コピートレード確認", ko: "카피 트레이드 확인" },
  "copy.available": { zh: "可用余额", en: "Available balance", ja: "利用可能残高", ko: "사용 가능 잔액" },
  "copy.trade_amount": { zh: "下单金额", en: "Trade amount", ja: "取引額", ko: "거래 금액" },
  "copy.fee": { zh: "平台费", en: "Platform fee", ja: "プラットフォーム手数料", ko: "플랫폼 수수료" },
  "copy.total_cost": { zh: "总花费", en: "Total cost", ja: "総コスト", ko: "총 비용" },
  "copy.fee_wallet": { zh: "费用归集钱包", en: "Fee destination", ja: "手数料先", ko: "수수료 수신처" },
  "copy.hint": {
    zh: "先用最小额真单测试。",
    en: "Start with the smallest amount to test.",
    ja: "まず最小額でテストしてください。",
    ko: "먼저 최소 금액으로 테스트하세요.",
  },

  "copy.limit_prompt": {
    zh: "🎯 限价跟单 — 输入目标价格（0–1 之间，如 0.55 代表 55¢）",
    en: "🎯 Limit Order — enter your target price (0–1, e.g. 0.55 for 55¢)",
    ja: "🎯 指値注文 — 目標価格を入力（0〜1, 例: 0.55）",
    ko: "🎯 지정가 주문 — 목표 가격 입력 (0–1, 예: 0.55)",
  },
  "copy.limit_current_price": { zh: "当前市场价", en: "Current market price", ja: "現在市場価格", ko: "현재 시장 가격" },
  "copy.limit_confirm": { zh: "✅ 确认限价单", en: "✅ Confirm limit order", ja: "✅ 指値注文確定", ko: "✅ 지정가 주문 확인" },
  "copy.limit_cancel": { zh: "❌ 取消", en: "❌ Cancel", ja: "❌ キャンセル", ko: "❌ 취소" },
  "copy.limit_invalid_price": {
    zh: "价格无效，请输入 0.01–0.99 之间的数值。",
    en: "Invalid price. Please enter a value between 0.01 and 0.99.",
    ja: "無効な価格です。0.01〜0.99の値を入力してください。",
    ko: "유효하지 않은 가격입니다. 0.01~0.99 사이 값을 입력하세요.",
  },
  "copy.limit_order_type": { zh: "限价单", en: "Limit Order", ja: "指値注文", ko: "지정가 주문" },

  // ── Trade Results ──
  "trade.copy_success": { zh: "跟单已执行", en: "Trade submitted", ja: "コピー取引完了", ko: "카피 트레이드 완료" },
  "trade.close_success": { zh: "平仓已执行", en: "Close submitted", ja: "決済完了", ko: "청산 완료" },
  "trade.copy_fail": { zh: "跟单失败", en: "Trade failed", ja: "取引失敗", ko: "거래 실패" },
  "trade.close_fail": { zh: "平仓失败", en: "Close failed", ja: "決済失敗", ko: "청산 실패" },

  // ── Leaderboard ──
  "leaderboard.title": { zh: "聪明钱榜单", en: "Smart Money Leaderboard", ja: "スマートマネーランキング", ko: "스마트 머니 리더보드" },
  "leaderboard.track_hint": { zh: "发送 /track 0x... 追踪任意钱包。", en: "Send /track 0x... to track any wallet.", ja: "/track 0x... で任意のウォレットを追跡。", ko: "/track 0x... 로 지갑을 추적하세요." },
  "leaderboard.win": { zh: "胜率", en: "Win", ja: "勝率", ko: "승률" },
  "leaderboard.sports_title": { zh: "体育专精钱包榜", en: "Sports Specialist Wallets", ja: "スポーツ専門ウォレット", ko: "스포츠 전문 지갑" },
  "leaderboard.no_sports": { zh: "暂无体育专精钱包。", en: "No sports specialist wallets yet.", ja: "スポーツ専門ウォレットなし。", ko: "스포츠 전문 지갑 없음." },

  // ── Track Record ──
  "trackrecord.title": { zh: "Luna 公开战绩", en: "Luna Public Scorecard", ja: "Luna 公開戦績", ko: "Luna 공개 성적표" },
  "trackrecord.win_rate": { zh: "胜率", en: "Win rate", ja: "勝率", ko: "승률" },
  "trackrecord.tracked": { zh: "追踪信号", en: "Tracked", ja: "追跡数", ko: "추적 수" },
  "trackrecord.settled": { zh: "已结算", en: "Settled", ja: "決済済", ko: "정산 완료" },
  "trackrecord.open": { zh: "待结算", en: "Open", ja: "未決済", ko: "미결제" },
  "trackrecord.won": { zh: "已赢", en: "Won", ja: "勝ち", ko: "승리" },
  "trackrecord.lost": { zh: "已输", en: "Lost", ja: "負け", ko: "패배" },
  "trackrecord.recent": { zh: "最近结果", en: "Recent Results", ja: "最近の結果", ko: "최근 결과" },
  "trackrecord.no_settled": { zh: "暂无已结算信号", en: "No settled signals yet", ja: "決済済シグナルなし", ko: "정산 완료 시그널 없음" },

  // ── Receipts ──
  "receipts.title": { zh: "我的交易回执", en: "My Trade Receipts", ja: "取引レシート", ko: "거래 영수증" },
  "receipts.trades": { zh: "累计成交", en: "Trades", ja: "累計取引数", ko: "누적 거래" },
  "receipts.gross": { zh: "累计总额", en: "Gross volume", ja: "累計総額", ko: "총 거래액" },
  "receipts.fees": { zh: "累计平台费", en: "Platform fees", ja: "累計手数料", ko: "누적 수수료" },
  "receipts.net": { zh: "净下单金额", en: "Net traded", ja: "実取引額", ko: "순 거래액" },
  "receipts.unsettled": { zh: "未结算平台费", en: "Unsettled fees", ja: "未決済手数料", ko: "미결제 수수료" },
  "receipts.settled_fees": { zh: "已结算平台费", en: "Settled fees", ja: "決済済手数料", ko: "정산 완료 수수료" },
  "receipts.builder_events": { zh: "Builder 记录", en: "Builder events", ja: "Builder記録", ko: "Builder 기록" },
  "receipts.recent_trades": { zh: "最近成交", en: "Recent Trades", ja: "最近の取引", ko: "최근 거래" },
  "receipts.no_trades": { zh: "暂无真实成交。", en: "No live trade receipts yet.", ja: "まだ取引レシートなし。", ko: "아직 거래 영수증 없음." },
  "receipts.recent_fees": { zh: "最近手续费回执", en: "Recent Fee Receipts", ja: "最近の手数料レシート", ko: "최근 수수료 영수증" },
  "receipts.no_fees": { zh: "暂无平台费回执。", en: "No fee receipts yet.", ja: "手数料レシートなし。", ko: "수수료 영수증 없음." },
  "receipts.recent_builder": { zh: "最近 Builder 归因", en: "Recent Builder Attribution", ja: "Builder帰属記録", ko: "Builder 귀속 기록" },
  "receipts.no_builder": { zh: "暂无 builder attribution 记录。", en: "No builder attribution events yet.", ja: "Builder帰属記録なし。", ko: "Builder 귀속 기록 없음." },
  "receipts.untitled": { zh: "未命名信号", en: "Untitled signal", ja: "無題シグナル", ko: "제목 없는 시그널" },
  "receipts.settled": { zh: "已结算", en: "settled", ja: "決済済", ko: "정산 완료" },
  "receipts.pending": { zh: "待结算", en: "pending", ja: "未決済", ko: "미결제" },
  "pnl.title": { zh: "我的收益快照", en: "My PnL Snapshot", ja: "損益スナップショット", ko: "내 손익 스냅샷" },
  "pnl.balance": { zh: "账户余额", en: "Account balance", ja: "口座残高", ko: "계정 잔액" },
  "pnl.positions": { zh: "持仓数量", en: "Open positions", ja: "保有ポジション", ko: "보유 포지션" },
  "pnl.position_value": { zh: "持仓总价值", en: "Position value", ja: "ポジション価値", ko: "포지션 가치" },
  "pnl.unrealized": { zh: "未实现盈亏", en: "Unrealized PnL", ja: "含み損益", ko: "미실현 손익" },
  "pnl.share_hint": { zh: "把这个公开链接发出去，让别人直接看到你的实盘快照和交易回执。", en: "Share this public link so others can inspect your live snapshot and receipts.", ja: "この公開リンクを共有して、実際の損益とレシートを見せましょう。", ko: "이 공개 링크를 공유해 실시간 손익과 영수증을 보여주세요." },

  // ── Settlements ──
  "settlements.title": { zh: "结算状态", en: "Settlement Status", ja: "決済ステータス", ko: "정산 상태" },
  "settlements.none": { zh: "当前没有已解析的市场。", en: "No resolved market settlements yet.", ja: "決済済マーケットなし。", ko: "정산된 마켓 없음." },
  "settlements.my_side": { zh: "我的方向", en: "My side", ja: "自分の方向", ko: "내 방향" },
  "settlements.winner": { zh: "结果", en: "Winner", ja: "結果", ko: "결과" },
  "settlements.redeemable": { zh: "可兑付", en: "Redeemable", ja: "換金可能", ko: "환수 가능" },

  // ── Deposit ──
  "deposit.title": { zh: "充值地址", en: "Deposit Address", ja: "入金アドレス", ko: "입금 주소" },
  "deposit.no_address": { zh: "当前没有可用地址，请稍后再试。", en: "No address available right now.", ja: "現在利用可能なアドレスなし。", ko: "현재 사용 가능한 주소 없음." },
  "deposit.real_address": {
    zh: "这是 Polymarket Bridge 返回的真实入金地址。",
    en: "This is the real bridge deposit address from Polymarket.",
    ja: "これはPolymarket Bridgeの実入金アドレスです。",
    ko: "이것은 Polymarket Bridge의 실제 입금 주소입니다.",
  },
  "deposit.evm_note": {
    zh: "这是共享 EVM bridge 入金地址，可用于 Ethereum / Polygon / Base / Arbitrum。",
    en: "This is the shared EVM bridge deposit address for Ethereum / Polygon / Base / Arbitrum.",
    ja: "Ethereum / Polygon / Base / Arbitrum 共通のEVMブリッジ入金アドレスです。",
    ko: "Ethereum / Polygon / Base / Arbitrum 공용 EVM 브리지 입금 주소입니다.",
  },

  // ── Withdraw ──
  "withdraw.choose": {
    zh: "选择提现目标链。\n\n⚠️ <b>重要提示</b>：仅支持提现到外部钱包（MetaMask、交易所等）。不要提现到其他 Polymarket 用户地址，否则资金可能无法找回。",
    en: "Choose your withdrawal destination.\n\n⚠️ <b>Important</b>: Only withdraw to external wallets (MetaMask, exchanges, etc.). Do NOT withdraw to other Polymarket user addresses - funds may be unrecoverable.",
    ja: "出金先チェーンを選択。\n\n⚠️ <b>重要</b>：外部ウォレット（MetaMask、取引所など）にのみ出金可能。他のPolymarketユーザーアドレスへは出金しないでください。資金が回収できなくなる可能性があります。",
    ko: "출금 대상 체인을 선택하세요.\n\n⚠️ <b>중요</b>: 외부 지갑(MetaMask, 거래소 등)으로만 출금 가능. 다른 Polymarket 사용자 주소로 출금하지 마세요 - 자금을 복구할 수 없을 수 있습니다.",
  },
  "withdraw.title": { zh: "提现到", en: "Withdraw to", ja: "出金先", ko: "출금 대상" },
  "withdraw.hint": {
    zh: "打开下方一次性安全链接，输入收款地址和金额。Luna 会生成官方 bridge 路由，再从交易钱包发起提现。",
    en: "Open the secure link below, enter recipient and amount. Luna will create the official bridge route and submit the withdrawal.",
    ja: "下のリンクを開き、受取先と金額を入力。Luna が公式ブリッジルートを作成して出金します。",
    ko: "아래 보안 링크를 열고 수신자와 금액을 입력하세요. Luna가 공식 브리지 경로를 만들어 출금합니다.",
  },
  "withdraw.link_expiry": { zh: "链接 20 分钟后失效", en: "Link expires in 20 minutes", ja: "リンクは20分後に無効", ko: "링크는 20분 후 만료" },
  "withdraw.need_wallet": {
    zh: "先创建并激活钱包，之后才能提现。",
    en: "Create and activate your wallet before withdrawing.",
    ja: "出金前にウォレットを作成・有効化してください。",
    ko: "출금 전에 지갑을 만들고 활성화하세요.",
  },
  "withdraw.gas_error": {
    zh: "交易钱包有 USDC 但没有足够的 POL 做 gas。往钱包转入少量 Polygon gas token (MATIC/POL)，再重试提现。",
    en: "Your wallet has USDC but not enough native POL for gas. Send a small amount of Polygon gas token to the wallet, then retry.",
    ja: "USDCはありますがPOLガスが不足。少量のPolygonガストークンを送金してからリトライ。",
    ko: "USDC는 있지만 POL 가스가 부족합니다. 소량의 Polygon 가스 토큰을 지갑에 보내고 다시 시도하세요.",
  },
  "withdraw.no_signer": {
    zh: "该钱包尚无法签名提现。请先完成官方 Safe/Builder 认证。",
    en: "This wallet cannot sign withdrawals yet. Complete Safe/Builder onboarding first.",
    ja: "このウォレットはまだ出金署名ができません。先にSafe/Builder認証を完了してください。",
    ko: "이 지갑은 아직 출금 서명이 불가능합니다. 먼저 Safe/Builder 인증을 완료하세요.",
  },
  "withdraw.insufficient": {
    zh: "交易钱包 USDC.e 余额不足。",
    en: "Insufficient USDC.e balance for withdrawal.",
    ja: "USDC.e残高不足です。",
    ko: "USDC.e 잔액이 부족합니다.",
  },

  // ── Connect / Onboarding ──
  "connect.title": { zh: "连接交易账户", en: "Connect Trading Account", ja: "取引アカウント接続", ko: "거래 계정 연결" },
  "connect.intro": {
    zh: "Luna 按真实多用户模式运行。每人都需要自己的交易账户。\n\n<b>推荐主路径：🛡 官方安全认证</b>\n沿官方 Builder + Safe / Proxy wallet 接入，长期更稳。\n\n<code>✨ 一键创建钱包</code> 仅作测试/应急路径。",
    en: "Luna runs in multi-user mode. Each user needs their own trading account.\n\n<b>Recommended: 🛡 Safe Onboarding</b>\nFollows the official Builder + Safe / Proxy wallet path.\n\n<code>✨ Create Wallet</code> is kept as testing / fallback only.",
    ja: "Luna はマルチユーザーモードで動作。各ユーザーに独自の取引アカウントが必要です。\n\n<b>推奨：🛡 公式認証</b>\n公式 Builder + Safe / Proxy ウォレットパスに沿って接続。\n\n<code>✨ ウォレット作成</code> はテスト/緊急用のみ。",
    ko: "Luna는 다중 사용자 모드로 운영됩니다. 각 사용자는 자체 거래 계정이 필요합니다.\n\n<b>권장: 🛡 공식 인증</b>\n공식 Builder + Safe / Proxy 지갑 경로를 따릅니다.\n\n<code>✨ 지갑 만들기</code>는 테스트/비상용만.",
  },
  "connect.secure_title": { zh: "安全连接你的交易账户", en: "Securely connect your trading account", ja: "安全に取引アカウントを接続", ko: "안전하게 거래 계정 연결" },
  "connect.secure_hint": {
    zh: "不要在 Telegram 里发送私钥。你有两条路：\n1. 点安全链接绑定已有 wallet\n2. 点创建钱包，让 Luna 为你生成\n\n安全链接 30 分钟后失效",
    en: "Do not send private keys in Telegram. Two paths:\n1. Open secure link to connect existing wallet\n2. Create Luna Wallet for a new one\n\nLink expires in 30 minutes",
    ja: "Telegramで秘密鍵を送信しないでください。2つの方法：\n1. セキュアリンクで既存ウォレットを接続\n2. Luna ウォレットを新規作成\n\nリンクは30分後に無効",
    ko: "Telegram에서 개인 키를 보내지 마세요. 두 가지 방법:\n1. 보안 링크로 기존 지갑 연결\n2. Luna 지갑 새로 만들기\n\n링크는 30분 후 만료",
  },
  "connect.readonly": {
    zh: "账户已登记，但还没完成可交易授权。推荐走 <b>🛡 官方安全认证</b>。",
    en: "Account is registered but trading authorization is incomplete. Recommended: <b>🛡 Safe Onboarding</b>.",
    ja: "アカウントは登録済みですが取引認可が未完了。<b>🛡 公式認証</b>を推奨。",
    ko: "계정이 등록되었으나 거래 인증이 미완료입니다. <b>🛡 공식 인증</b>을 권장합니다.",
  },

  // ── Safe Onboarding ──
  "safe.title": { zh: "开始官方安全认证", en: "Start Safe Onboarding", ja: "公式認証を開始", ko: "공식 인증 시작" },
  "safe.hint": {
    zh: "Luna 的官方主路径：通过 Builder + Safe / Proxy wallet 完成授权。\n\n打开下方一次性安全链接进入认证门户。\n\n链接 30 分钟后失效",
    en: "Luna's official primary path: complete Builder + Safe / Proxy wallet authorization.\n\nOpen the secure link below to enter the onboarding portal.\n\nLink expires in 30 minutes",
    ja: "Luna の公式メインパス：Builder + Safe / Proxy ウォレット認可を完了。\n\n下のリンクから認証ポータルへ。\n\nリンクは30分後に無効",
    ko: "Luna의 공식 메인 경로: Builder + Safe / Proxy 지갑 인증 완료.\n\n아래 보안 링크를 열어 인증 포털에 접속하세요.\n\n링크는 30분 후 만료",
  },

  // ── Managed Wallet Created ──
  "wallet.created_title": { zh: "Luna 钱包已创建", en: "Luna Wallet Created", ja: "Luna ウォレット作成完了", ko: "Luna 지갑 생성 완료" },
  "wallet.created_hint": {
    zh: "不需要手填任何凭据。\n\n下一步：\n1. 先下载钱包备份并离线保存\n2. 去 /wallet 查看真实余额\n3. 充值时优先走 <b>Polygon</b> 降低成本\n4. 直接从信号详情里跟单",
    en: "No manual credentials needed.\n\nNext steps:\n1. Download wallet backup and store offline\n2. Open /wallet to check balance\n3. Prefer <b>Polygon</b> for lower-cost deposits\n4. Copy trade directly from signal details",
    ja: "手動のクレデンシャル入力不要。\n\n次のステップ：\n1. バックアップをDLしてオフライン保存\n2. /wallet で残高確認\n3. 入金は<b>Polygon</b>が低コスト\n4. シグナル詳細からコピートレード",
    ko: "수동 인증 정보 입력 불필요.\n\n다음 단계:\n1. 지갑 백업 다운로드 후 오프라인 보관\n2. /wallet 로 잔액 확인\n3. 입금은 <b>Polygon</b>이 저렴\n4. 시그널 상세에서 바로 카피 트레이드",
  },

  // ── Backup / Restore ──
  "backup.title": { zh: "下载你的 Luna 钱包备份", en: "Download your Luna wallet backup", ja: "Luna ウォレットバックアップDL", ko: "Luna 지갑 백업 다운로드" },
  "backup.hint": { zh: "点击下方链接下载备份 JSON，离线保存。\n\n链接 15 分钟后失效", en: "Open the link below to download backup JSON and store offline.\n\nLink expires in 15 minutes", ja: "下のリンクからバックアップJSONをDL、オフライン保存。\n\nリンクは15分後に無効", ko: "아래 링크에서 백업 JSON 다운로드 후 오프라인 보관.\n\n링크는 15분 후 만료" },
  "backup.no_wallet": { zh: "当前没有可导出的 Luna 托管钱包。先用 /createwallet 创建。", en: "No exportable managed Luna wallet yet. Create one with /createwallet.", ja: "エクスポート可能なLunaウォレットなし。/createwallet で作成してください。", ko: "내보낼 수 있는 Luna 지갑 없음. /createwallet 로 생성하세요." },
  "restore.title": { zh: "恢复你的 Luna 钱包", en: "Restore your Luna wallet", ja: "Luna ウォレットを復元", ko: "Luna 지갑 복구" },
  "restore.hint": { zh: "打开下方链接，粘贴之前的备份 JSON 即可恢复。\n\n链接 20 分钟后失效", en: "Open the link below and paste your backup JSON to restore.\n\nLink expires in 20 minutes", ja: "下のリンクを開き、バックアップJSONを貼り付けて復元。\n\nリンクは20分後に無効", ko: "아래 링크를 열고 백업 JSON을 붙여넣어 복구.\n\n링크는 20분 후 만료" },

  // ── Misc ──
  "trading.blocked": { zh: "无法执行真钱交易", en: "Live trading unavailable", ja: "リアルマネー取引不可", ko: "실거래 불가" },
  "trading.need_wallet_withdraw": {
    zh: "先创建并激活你的 Luna 钱包，之后才能提现。",
    en: "Create and activate your Luna wallet before withdrawing.",
    ja: "出金前にLunaウォレットを作成・有効化してください。",
    ko: "출금 전에 Luna 지갑을 만들고 활성화하세요.",
  },
  "trading.readonly_copy": {
    zh: "当前账户已登记，但尚未完成可交易授权。先完成 Safe / Proxy wallet 授权后再执行跟单。",
    en: "This account is linked, but live trading authorization is not complete yet. Finish Safe / Proxy wallet authorization before executing copy trades.",
    ja: "アカウントは連携済みですが取引認可が未完了。先にSafe/Proxyウォレット認可を完了してからコピートレードを実行してください。",
    ko: "계정이 연결되었으나 거래 인증이 미완료. Safe/Proxy 지갑 인증 완료 후 카피 트레이드를 실행하세요.",
  },
  "trading.need_wallet_copy": {
    zh: "先绑定并完成你自己的 Safe / Proxy wallet 交易授权，之后才能执行跟单。",
    en: "Link and finish Safe / Proxy wallet trading authorization before executing copy trades.",
    ja: "コピートレードを実行する前にSafe/Proxyウォレット取引認可を完了してください。",
    ko: "카피 트레이드를 실행하기 전에 Safe/Proxy 지갑 거래 인증을 완료하세요.",
  },
  "trading.need_wallet_positions": {
    zh: "先绑定并授权你自己的交易账户，之后才能查看真实持仓。",
    en: "Link and authorize your own trading account before viewing live positions.",
    ja: "ポジションを表示する前に取引アカウントを連携・認可してください。",
    ko: "실제 포지션을 보려면 먼저 거래 계정을 연결하고 인증하세요.",
  },
  "trading.need_wallet_close": {
    zh: "当前账户还没有可交易授权，不能平仓。",
    en: "This account is not fully authorized for live closing yet.",
    ja: "このアカウントはまだ決済の取引認可がありません。",
    ko: "이 계정은 아직 청산 거래 인증이 완료되지 않았습니다.",
  },
  "deposit.choose_chain": {
    zh: "选择一条链查看真实充值地址。\n\n⚠️ <b>重要提示</b>：仅支持从外部钱包（MetaMask、交易所等）充值。不支持从其他 Polymarket 账户直接转入。",
    en: "Pick a chain to fetch the real deposit address.\n\n⚠️ <b>Important</b>: Only deposit from external wallets (MetaMask, exchanges, etc.). Direct transfers from other Polymarket accounts are NOT supported.",
    ja: "チェーンを選択して実際の入金アドレスを取得。\n\n⚠️ <b>重要</b>：外部ウォレット（MetaMask、取引所など）からのみ入金可能。他のPolymarketアカウントからの直接送金は対応していません。",
    ko: "체인을 선택하여 실제 입금 주소를 확인하세요.\n\n⚠️ <b>중요</b>: 외부 지갑(MetaMask, 거래소 등)에서만 입금 가능. 다른 Polymarket 계정에서의 직접 전송은 지원되지 않습니다.",
  },
  "trading.readonly_blocked": {
    zh: "当前账户已登记但未完成可交易授权。先完成 Safe / Proxy wallet 授权再执行跟单。",
    en: "Account is linked but trading authorization incomplete. Finish Safe / Proxy wallet authorization first.",
    ja: "アカウントは連携済みですが取引認可が未完了。先にSafe/Proxyウォレット認可を完了してください。",
    ko: "계정이 연결되었으나 거래 인증이 미완료. Safe/Proxy 지갑 인증을 먼저 완료하세요.",
  },
  "address.invalid": { zh: "地址格式不对。", en: "Wallet address format is invalid.", ja: "アドレス形式が無効です。", ko: "주소 형식이 잘못되었습니다." },
  "link.usage": {
    zh: "地址格式不对。请使用：/link 你的_funder_地址 [你的_signer_地址]",
    en: "Address format is invalid. Use: /link your_funder_address [your_signer_address]",
    ja: "アドレス形式が無効。使い方：/link funderアドレス [signerアドレス]",
    ko: "주소 형식이 잘못됨. 사용법: /link funder주소 [signer주소]",
  },
  "tracked.added": { zh: "已加入追踪列表。", en: "Wallet added to tracked list.", ja: "追跡リストに追加しました。", ko: "추적 목록에 추가되었습니다." },

  // ── Sports Push ──
  "push.sports_title": { zh: "世界杯快讯", en: "World Cup Alert", ja: "W杯速報", ko: "월드컵 알림" },
  "push.sports_hint": {
    zh: "新的高分体育信号已出现，适合赛前快速小额执行。",
    en: "A fresh high-score sports signal is live for fast pre-match execution.",
    ja: "新しい高スコアスポーツシグナルが配信中。試合前の素早い取引に。",
    ko: "새로운 고득점 스포츠 시그널이 라이브입니다. 경기 전 빠른 거래에 적합.",
  },

  // ── Language ──
  "lang.switched": { zh: "已切换到中文 🇨🇳", en: "Switched to English 🇬🇧", ja: "日本語に切り替えました 🇯🇵", ko: "한국어로 전환되었습니다 🇰🇷" },
  "lang.choose": { zh: "选择你的语言", en: "Choose your language", ja: "言語を選択", ko: "언어를 선택하세요" },
} as const;

type StringKey = keyof typeof strings;

/**
 * Get a localized string.
 * Falls back to English if the key or language is missing.
 */
export function t(lang: Lang, key: StringKey): string {
  const entry = strings[key];
  if (!entry) return key;
  return (entry as Record<string, string>)[lang] ?? entry.en;
}

/**
 * Pick a language-specific field from a signal/wallet record.
 * For signal titles, actions, etc. that are stored as _en/_zh in DB.
 * Falls back: ja/ko -> en (since DB only has en/zh columns).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickLang(record: any, field: string, lang: Lang): string {
  if (lang === "zh") return String(record[`${field}_zh`] ?? record[`${field}_en`] ?? "");
  // ja/ko fall back to English since DB only stores zh/en
  return String(record[`${field}_en`] ?? "");
}
