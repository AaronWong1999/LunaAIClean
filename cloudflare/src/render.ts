import type { FeePreview, FollowTaskRecord, LivePosition, RuntimeSignal, RuntimeWalletProfile, UserRecord, UserTradingAccountRecord } from "./types";
import { t, pickLang, type Lang } from "./i18n";

export function renderLandingPage(version: string): string {
  return `<!doctype html>
<html lang=”en”>
<head>
  <meta charset=”utf-8”/>
  <meta name=”viewport” content=”width=device-width,initial-scale=1”/>
  <title>Luna AI — Polymarket Smart Money Bot</title>
  <meta name=”description” content=”Follow the wallets that actually win on Polymarket. Real-time signals, one-tap copy trading, sports hub, and public receipts — all inside Telegram.”/>
  <meta property=”og:title” content=”Luna AI — Polymarket Smart Money Bot”/>
  <meta property=”og:description” content=”Follow the wallets that actually win. Real-time signals, one-tap copy trading, sports hub.”/>
  <meta property=”og:type” content=”website”/>
  <meta name=”twitter:card” content=”summary_large_image”/>
  <meta name=”twitter:title” content=”Luna AI — Polymarket Smart Money Bot”/>
  <meta name=”twitter:description” content=”Follow the wallets that actually win on Polymarket. Real-time WS signals, one-tap copy.”/>
  <style>
    :root{
      --bg:#060d18;--card:rgba(12,22,38,.85);--line:rgba(255,255,255,.07);
      --text:#f0f4ff;--muted:#8fa3bf;--accent:#3dffa0;--gold:#ffd166;--rose:#ff7eb3;
      --border-radius:20px;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    body{
      color:var(--text);
      font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,”Segoe UI”,sans-serif;
      background:var(--bg);
      overflow-x:hidden;
    }
    /* ── orb background ── */
    .bg-orbs{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
    .orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.22;animation:drift 18s ease-in-out infinite alternate}
    .orb1{width:700px;height:700px;background:radial-gradient(circle,#3dffa0,transparent 70%);top:-200px;left:-200px;animation-delay:0s}
    .orb2{width:500px;height:500px;background:radial-gradient(circle,#ffd166,transparent 70%);top:30%;right:-150px;animation-delay:-6s}
    .orb3{width:400px;height:400px;background:radial-gradient(circle,#ff7eb3,transparent 70%);bottom:-100px;left:30%;animation-delay:-12s}
    @keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(40px,30px) scale(1.08)}}
    /* ── layout ── */
    .shell{position:relative;z-index:1;max-width:1160px;margin:0 auto;padding:0 24px}
    /* ── nav ── */
    nav{display:flex;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:1px solid var(--line)}
    .logo{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;letter-spacing:-.01em}
    .logo-dot{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#a0ffda);display:grid;place-items:center;font-size:14px}
    .nav-cta{padding:9px 18px;border-radius:999px;background:var(--accent);color:#031a0d;font-weight:700;font-size:14px;text-decoration:none;white-space:nowrap}
    /* ── hero ── */
    .hero{padding:80px 0 60px;display:grid;grid-template-columns:1fr 420px;gap:48px;align-items:center}
    .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:var(--accent);margin-bottom:18px}
    h1{font-size:clamp(40px,6vw,80px);line-height:.95;font-weight:900;letter-spacing:-.03em;max-width:640px}
    h1 .dim{color:var(--muted)}
    .hero-sub{color:var(--muted);font-size:17px;line-height:1.65;max-width:560px;margin-top:20px}
    .hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}
    .btn-primary{padding:14px 24px;border-radius:999px;background:linear-gradient(135deg,var(--accent),#a0ffda);color:#031a0d;font-weight:700;font-size:15px;text-decoration:none;display:inline-flex;align-items:center;gap:8px}
    .btn-secondary{padding:14px 24px;border-radius:999px;border:1px solid var(--line);color:var(--text);font-weight:600;font-size:15px;text-decoration:none;display:inline-flex;align-items:center;gap:8px;backdrop-filter:blur(8px)}
    /* ── hero card ── */
    .hero-card{background:var(--card);border:1px solid var(--line);border-radius:28px;padding:28px;backdrop-filter:blur(20px)}
    .signal-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
    .signal-row:last-child{border-bottom:0}
    .signal-score{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(61,255,160,.15);color:var(--accent)}
    .signal-score.gold{background:rgba(255,209,102,.15);color:var(--gold)}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--line);color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}
    /* ── stats strip ── */
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:48px 0;padding:28px;background:var(--card);border:1px solid var(--line);border-radius:var(--border-radius);backdrop-filter:blur(16px)}
    .stat-num{font-size:clamp(28px,4vw,42px);font-weight:900;line-height:1;letter-spacing:-.02em}
    .stat-num .accent{color:var(--accent)}
    .stat-label{font-size:12px;color:var(--muted);margin-top:6px;text-transform:uppercase;letter-spacing:.08em}
    /* ── features ── */
    .section-title{font-size:clamp(26px,4vw,40px);font-weight:800;letter-spacing:-.02em;margin-bottom:8px}
    .section-sub{color:var(--muted);font-size:16px;line-height:1.6;max-width:600px;margin-bottom:36px}
    .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin:48px 0}
    .feature-card{background:var(--card);border:1px solid var(--line);border-radius:var(--border-radius);padding:28px;position:relative;overflow:hidden;transition:border-color .2s}
    .feature-card:hover{border-color:rgba(61,255,160,.3)}
    .feature-icon{font-size:28px;margin-bottom:14px}
    .feature-title{font-size:17px;font-weight:700;margin-bottom:8px}
    .feature-desc{color:var(--muted);font-size:14px;line-height:1.6}
    .feature-accent{position:absolute;bottom:0;right:0;width:120px;height:120px;background:radial-gradient(circle,rgba(61,255,160,.08),transparent 70%);pointer-events:none}
    /* ── comparison table ── */
    .compare-wrap{margin:48px 0;overflow-x:auto}
    .compare{width:100%;border-collapse:collapse;font-size:14px}
    .compare th,.compare td{padding:14px 16px;border-bottom:1px solid var(--line);text-align:left}
    .compare th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:rgba(255,255,255,.02)}
    .compare td:first-child{font-weight:600;color:var(--text)}
    .compare .luna-col{color:var(--accent);font-weight:600}
    .check{color:var(--accent)}
    .cross{color:var(--muted);opacity:.5}
    /* ── steps ── */
    .steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin:48px 0}
    .step{padding:24px;background:var(--card);border:1px solid var(--line);border-radius:var(--border-radius)}
    .step-num{font-size:42px;font-weight:900;color:var(--accent);line-height:1;margin-bottom:12px;opacity:.7}
    .step-title{font-size:16px;font-weight:700;margin-bottom:6px}
    .step-desc{font-size:13px;color:var(--muted);line-height:1.6}
    /* ── cta footer ── */
    .cta-footer{text-align:center;padding:72px 24px;background:linear-gradient(180deg,transparent,rgba(61,255,160,.04));border-top:1px solid var(--line);margin-top:48px}
    .cta-footer h2{font-size:clamp(28px,5vw,52px);font-weight:900;letter-spacing:-.03em;margin-bottom:16px}
    .cta-footer p{color:var(--muted);font-size:17px;margin-bottom:36px}
    .footer-note{margin-top:48px;color:var(--muted);font-size:12px;opacity:.6}
    /* ── responsive ── */
    @media(max-width:860px){
      .hero{grid-template-columns:1fr}
      .hero-card{display:none}
      .stats{grid-template-columns:repeat(2,1fr)}
    }
    @media(max-width:520px){
      .stats{grid-template-columns:1fr 1fr}
      nav .nav-cta span{display:none}
    }
  </style>
</head>
<body>
<div class=”bg-orbs”>
  <div class=”orb orb1”></div>
  <div class=”orb orb2”></div>
  <div class=”orb orb3”></div>
</div>
<div class=”shell”>
  <nav>
    <div class=”logo”>
      <div class=”logo-dot”>🌙</div>
      Luna AI
    </div>
    <a class=”nav-cta” href=”https://t.me/GetLunaAIBot”><span>Open in </span>Telegram →</a>
  </nav>

  <!-- Hero -->
  <section class=”hero”>
    <div>
      <div class=”eyebrow”>Polymarket Smart Money · Real-time · Bilingual</div>
      <h1>Bet with the wallets<br/><span class=”dim”>that actually win.</span></h1>
      <p class=”hero-sub”>
        Luna tracks the top Polymarket wallets via live WebSocket feeds, surfaces today’s best trade every morning,
        and lets you copy in one tap — gasless, with full public receipts.
      </p>
      <div class=”hero-actions”>
        <a class=”btn-primary” href=”https://t.me/GetLunaAIBot”>🤖 Open @GetLunaAIBot</a>
        <a class=”btn-secondary” href=”https://t.me/GetLunaAIBot?start=worldcup”>⚽ Sports Mode</a>
      </div>
    </div>
    <aside class=”hero-card”>
      <div class=”badge”>📡 Live signals today</div>
      <div style=”margin-top:16px;display:grid;gap:4px”>
        <div class=”signal-row”>
          <div>
            <div style=”font-weight:700;font-size:14px”>Monte Carlo Masters — Shevchenko</div>
            <div style=”font-size:12px;color:var(--muted);margin-top:3px”>🎯 Buy YES @ 55¢ · +81.8%</div>
          </div>
          <div class=”signal-score”>93</div>
        </div>
        <div class=”signal-row”>
          <div>
            <div style=”font-weight:700;font-size:14px”>BTC above $90K by June?</div>
            <div style=”font-size:12px;color:var(--muted);margin-top:3px”>🎯 Buy YES @ 72¢ · +38.9%</div>
          </div>
          <div class=”signal-score gold”>91</div>
        </div>
        <div class=”signal-row”>
          <div>
            <div style=”font-weight:700;font-size:14px”>Trump tariffs paused 90 days?</div>
            <div style=”font-size:12px;color:var(--muted);margin-top:3px”>🎯 Buy YES @ 88¢ · +13.6%</div>
          </div>
          <div class=”signal-score”>89</div>
        </div>
      </div>
      <a href=”https://t.me/GetLunaAIBot” style=”display:block;margin-top:20px;padding:12px;text-align:center;border-radius:14px;background:rgba(61,255,160,.1);color:var(--accent);text-decoration:none;font-weight:700;font-size:14px;border:1px solid rgba(61,255,160,.2)”>
        Copy these trades in one tap →
      </a>
    </aside>
  </section>

  <!-- Stats strip -->
  <div class=”stats”>
    <div>
      <div class=”stat-num”><span class=”accent”>24+</span></div>
      <div class=”stat-label”>Smart wallets tracked</div>
    </div>
    <div>
      <div class=”stat-num”><span class=”accent”>4</span></div>
      <div class=”stat-label”>Live WebSocket channels</div>
    </div>
    <div>
      <div class=”stat-num”><span class=”accent”>0</span></div>
      <div class=”stat-label”>Gas fees ever</div>
    </div>
    <div>
      <div class=”stat-num”><span class=”accent”>1%</span></div>
      <div class=”stat-label”>Platform fee, no spread</div>
    </div>
  </div>

  <!-- Features -->
  <div style=”margin-top:64px”>
    <div class=”eyebrow”>Why Luna</div>
    <div class=”section-title”>Every edge, in one bot.</div>
    <div class=”section-sub”>Luna is the only Polymarket bot with real-time WebSocket feeds, a sophisticated follow engine, and bilingual support — all on Cloudflare’s global edge.</div>
  </div>
  <div class=”features”>
    <div class=”feature-card”>
      <div class=”feature-icon”>⚡</div>
      <div class=”feature-title”>WebSocket-first real-time</div>
      <div class=”feature-desc”>4 official Polymarket WS channels — market, RTDS, sports, user. Competitors poll REST every 30s. Luna gets fills in milliseconds.</div>
      <div class=”feature-accent”></div>
    </div>
    <div class=”feature-card”>
      <div class=”feature-icon”>🤖</div>
      <div class=”feature-title”>Sophisticated follow engine</div>
      <div class=”feature-desc”>Double-out take profit, stop-loss bps, position limits, and reconcile loop. The most advanced auto-copy on Polymarket.</div>
      <div class=”feature-accent”></div>
    </div>
    <div class=”feature-card”>
      <div class=”feature-icon”>🌏</div>
      <div class=”feature-title”>Full EN / ZH bilingual</div>
      <div class=”feature-desc”>Every screen, every command, every push notification — all in both English and Chinese. The only Polymarket bot covering the CN market.</div>
      <div class=”feature-accent”></div>
    </div>
    <div class=”feature-card”>
      <div class=”feature-icon”>📰</div>
      <div class=”feature-title”>News sniper + Arb alerts</div>
      <div class=”feature-desc”>White-list based news triggers matched to live Polymarket events. Cross-exchange arb spread detection. No other bot combines both.</div>
      <div class=”feature-accent”></div>
    </div>
    <div class=”feature-card”>
      <div class=”feature-icon”>🧾</div>
      <div class=”feature-title”>Public receipts &amp; creator profiles</div>
      <div class=”feature-desc”>Every trade is public. Share your scorecard, grow a following, earn referral income. Transparent execution builds real trust.</div>
      <div class=”feature-accent”></div>
    </div>
    <div class=”feature-card”>
      <div class=”feature-icon”>⚽</div>
      <div class=”feature-title”>Sports hub &amp; live signals</div>
      <div class=”feature-desc”>Dedicated sports leaderboard with specialist wallets, live match signal cards, and sports-optimized push notifications.</div>
      <div class=”feature-accent”></div>
    </div>
  </div>

  <!-- How it works -->
  <div style=”margin-top:64px”>
    <div class=”eyebrow”>Get started</div>
    <div class=”section-title”>Three steps to your first trade.</div>
  </div>
  <div class=”steps”>
    <div class=”step”>
      <div class=”step-num”>01</div>
      <div class=”step-title”>Open @GetLunaAIBot</div>
      <div class=”step-desc”>Tap /start. Luna creates your trading identity and shows today’s best trade immediately.</div>
    </div>
    <div class=”step”>
      <div class=”step-num”>02</div>
      <div class=”step-title”>Create or connect wallet</div>
      <div class=”step-desc”>Use ✨ Create Wallet for a managed Safe, or connect your existing Polymarket account. Deposit USDC from any wallet or exchange.</div>
    </div>
    <div class=”step”>
      <div class=”step-num”>03</div>
      <div class=”step-title”>Copy in one tap</div>
      <div class=”step-desc”>Pick a signal or paste any Polymarket URL. Tap the trade amount. Done — gasless via Polymarket Relayer, receipt generated automatically.</div>
    </div>
  </div>

  <!-- Comparison table -->
  <div style=”margin-top:64px”>
    <div class=”eyebrow”>Comparison</div>
    <div class=”section-title”>Why Luna wins.</div>
    <div class=”section-sub”>Side-by-side against Alice Bot, PolyCop, and PolyGun.</div>
  </div>
  <div class=”compare-wrap”>
    <table class=”compare”>
      <thead>
        <tr>
          <th>Feature</th>
          <th class=”luna-col”>Luna AI</th>
          <th>Alice Bot</th>
          <th>PolyCop</th>
          <th>PolyGun</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Real-time WebSocket data</td><td class=”luna-col check”>✓ 4 channels</td><td class=”cross”>✗ REST</td><td class=”cross”>✗ REST</td><td class=”cross”>✗ REST</td></tr>
        <tr><td>Auto follow engine (TP/SL)</td><td class=”luna-col check”>✓ double_out + SL</td><td class=”cross”>✗</td><td class=”cross”>partial</td><td class=”cross”>partial</td></tr>
        <tr><td>Bilingual EN / ZH</td><td class=”luna-col check”>✓</td><td class=”cross”>✗</td><td class=”cross”>✗</td><td class=”cross”>✗</td></tr>
        <tr><td>News sniper</td><td class=”luna-col check”>✓ whitelisted</td><td class=”cross”>✗</td><td class=”cross”>✗</td><td class=”cross”>✗</td></tr>
        <tr><td>Arb alerts (Kalshi)</td><td class=”luna-col check”>✓</td><td class=”cross”>✗</td><td class=”cross”>✗</td><td class=”cross”>✗</td></tr>
        <tr><td>Public receipts + creator page</td><td class=”luna-col check”>✓</td><td class=”cross”>✗</td><td class=”cross”>✗</td><td class=”cross”>partial</td></tr>
        <tr><td>Limit orders</td><td class=”luna-col check”>✓</td><td class=”cross”>✗</td><td class=”check”>✓</td><td class=”check”>✓</td></tr>
        <tr><td>Gas fees</td><td class=”luna-col check”>✓ 0 via Relayer</td><td class=”check”>✓ 0</td><td class=”check”>✓ 0</td><td class=”check”>✓ 0</td></tr>
        <tr><td>Referral system</td><td class=”luna-col check”>✓ 2-tier</td><td class=”check”>✓</td><td class=”check”>✓ 2-tier</td><td class=”check”>✓ 3-tier</td></tr>
        <tr><td>Sports hub</td><td class=”luna-col check”>✓ live WS</td><td class=”cross”>✗</td><td class=”cross”>✗</td><td class=”cross”>✗</td></tr>
      </tbody>
    </table>
  </div>
</div>

<!-- CTA footer -->
<div class=”cta-footer”>
  <h2>Ready to trade smarter?</h2>
  <p>Join the traders following the wallets that actually win on Polymarket.</p>
  <a class=”btn-primary” href=”https://t.me/GetLunaAIBot” style=”font-size:17px;padding:16px 32px;display:inline-flex”>
    🤖 Open @GetLunaAIBot
  </a>
  <br/>
  <a class=”btn-secondary” href=”https://t.me/GetLunaAIBot?start=worldcup” style=”margin-top:14px;display:inline-flex”>⚽ Enter Sports Mode</a>
  <div class=”footer-note”>Luna AI — v${escapeHtml(version)} · Powered by Cloudflare Workers · Polymarket Builder</div>
</div>
</body>
</html>`;
}

export function renderConnectPortal(payload: {
  appName: string;
  token: string;
  error?: string;
  defaultFunderAddress?: string;
  defaultSignerAddress?: string;
  defaultAccountLabel?: string;
}): string {
  const action = `/connect/${encodeURIComponent(payload.token)}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.appName)} Account Connect</title>
    <style>
      :root {
        --bg: #050814;
        --panel: rgba(10,16,28,0.92);
        --line: rgba(255,255,255,0.10);
        --muted: #9db0c9;
        --text: #f4f7ff;
        --accent: #7cf2c5;
        --danger: #ff8a8a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(124,242,197,0.16), transparent 26%),
          radial-gradient(circle at 80% 10%, rgba(98,154,255,0.18), transparent 22%),
          linear-gradient(180deg, #060a14 0%, #02040a 100%);
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(760px, 100%);
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 28px;
        backdrop-filter: blur(18px);
      }
      h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 42px); }
      p, li { color: var(--muted); line-height: 1.6; }
      .error {
        margin: 18px 0 0;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(255,138,138,0.12);
        border: 1px solid rgba(255,138,138,0.28);
        color: #ffd0d0;
      }
      form { margin-top: 22px; display: grid; gap: 16px; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
      label { display: grid; gap: 8px; font-weight: 600; }
      input, textarea {
        width: 100%;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.03);
        color: var(--text);
      }
      textarea { min-height: 112px; resize: vertical; }
      button {
        border: 0;
        border-radius: 999px;
        padding: 14px 18px;
        font-size: 15px;
        font-weight: 700;
        color: #03150f;
        background: linear-gradient(135deg, var(--accent), #d7ffea);
        cursor: pointer;
      }
      .note {
        font-size: 13px;
        color: var(--muted);
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Connect Your Luna Trading Account</h1>
      <p>
        This secure page stores your account details directly in Luna's encrypted user vault.
        Do not send your credentials in Telegram chat. Funds remain on your own Polymarket / Safe-style account path.
      </p>
      <ul>
        <li>Use your Polymarket funder / proxy wallet as the main trading address.</li>
        <li>Signer address is optional if it is the same as your funder.</li>
        <li>If you provide API credentials and signer private key, Luna can mark the account tradable after validation.</li>
      </ul>
      ${payload.error ? `<div class="error">${escapeHtml(payload.error)}</div>` : ""}
      <form method="POST" action="${action}" autocomplete="off">
        <div class="grid">
          <label>Account Label
            <input name="account_label" value="${escapeHtml(payload.defaultAccountLabel ?? "")}" placeholder="e.g. My Polymarket Safe" />
          </label>
          <label>Funder / Proxy Wallet Address
            <input class="mono" name="funder_address" required value="${escapeHtml(payload.defaultFunderAddress ?? "")}" placeholder="0x..." />
          </label>
        </div>
        <div class="grid">
          <label>Signer Address
            <input class="mono" name="signer_address" value="${escapeHtml(payload.defaultSignerAddress ?? "")}" placeholder="0x... (optional)" />
          </label>
          <label>Polymarket API Key
            <input class="mono" name="polymarket_api_key" placeholder="Optional, but required for tradable mode" />
          </label>
        </div>
        <div class="grid">
          <label>Polymarket API Secret
            <input class="mono" name="polymarket_api_secret" placeholder="Optional, but required for tradable mode" />
          </label>
          <label>Polymarket API Passphrase
            <input class="mono" name="polymarket_api_passphrase" placeholder="Optional, but required for tradable mode" />
          </label>
        </div>
        <label>Signer Private Key
          <input class="mono" name="polymarket_private_key" type="password" placeholder="Optional, but required for tradable mode" />
        </label>
        <div class="note">
          Leaving the credentials blank creates a read-only linked account. Providing all four credentials attempts to verify and enable live trading.
        </div>
        <button type="submit">Connect Account</button>
      </form>
    </main>
  </body>
</html>`;
}

export function renderConnectPortalResult(payload: {
  success: boolean;
  title: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.title)}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: linear-gradient(180deg, #07111e 0%, #03050b 100%);
        color: #eef5ff;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(560px, 100%);
        border-radius: 24px;
        padding: 28px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(9, 16, 28, 0.92);
      }
      h1 { margin: 0 0 12px; color: ${payload.success ? "#7cf2c5" : "#ff9f9f"}; }
      p { margin: 0; line-height: 1.7; color: #b6c5db; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${escapeHtml(payload.title)}</h1>
      <p>${escapeHtml(payload.body)}</p>
    </main>
  </body>
</html>`;
}

export function renderExportPortal(payload: {
  title: string;
  body: string;
  downloadJson?: string;
  filename?: string;
}): string {
  const downloadButton = payload.downloadJson
    ? `<a id="download-link" download="${escapeHtml(payload.filename ?? "luna-wallet-backup.json")}" href="data:application/json;charset=utf-8,${encodeURIComponent(payload.downloadJson)}">Download Backup JSON</a>`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.title)}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: linear-gradient(180deg, #07111e 0%, #03050b 100%);
        color: #eef5ff;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(680px, 100%);
        border-radius: 24px;
        padding: 28px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(9, 16, 28, 0.92);
      }
      h1 { margin: 0 0 12px; color: #7cf2c5; }
      p, li { margin: 0 0 14px; line-height: 1.7; color: #b6c5db; white-space: pre-wrap; }
      a {
        display: inline-flex;
        padding: 14px 18px;
        border-radius: 999px;
        font-weight: 700;
        color: #03150f;
        background: linear-gradient(135deg, #7cf2c5, #d7ffea);
        text-decoration: none;
      }
      code {
        display: block;
        margin-top: 10px;
        padding: 12px;
        border-radius: 14px;
        background: rgba(255,255,255,0.04);
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${escapeHtml(payload.title)}</h1>
      <p>${escapeHtml(payload.body)}</p>
      ${downloadButton}
    </main>
  </body>
</html>`;
}

export function renderRestorePortal(payload: {
  appName: string;
  token: string;
  error?: string;
}): string {
  const action = `/restore/${encodeURIComponent(payload.token)}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.appName)} Wallet Restore</title>
    <style>
      :root {
        --bg: #050814;
        --panel: rgba(10,16,28,0.92);
        --line: rgba(255,255,255,0.10);
        --muted: #9db0c9;
        --text: #f4f7ff;
        --accent: #7cf2c5;
        --danger: #ff8a8a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(124,242,197,0.16), transparent 26%),
          radial-gradient(circle at 80% 10%, rgba(98,154,255,0.18), transparent 22%),
          linear-gradient(180deg, #060a14 0%, #02040a 100%);
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(760px, 100%);
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 28px;
        backdrop-filter: blur(18px);
      }
      h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 42px); }
      p, li { color: var(--muted); line-height: 1.6; }
      .error {
        margin: 18px 0 0;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(255,138,138,0.12);
        border: 1px solid rgba(255,138,138,0.28);
        color: #ffd0d0;
      }
      form { margin-top: 22px; display: grid; gap: 16px; }
      textarea {
        width: 100%;
        min-height: 280px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.03);
        color: var(--text);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 14px 18px;
        font-size: 15px;
        font-weight: 700;
        color: #03150f;
        background: linear-gradient(135deg, var(--accent), #d7ffea);
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Restore Your Luna Wallet</h1>
      <p>
        Paste the JSON backup you previously downloaded from Luna. This restore link is one-time and short-lived.
        No manual signer/API field entry is required.
      </p>
      ${payload.error ? `<div class="error">${escapeHtml(payload.error)}</div>` : ""}
      <form method="POST" action="${action}">
        <textarea name="backup_json" placeholder='{\n  "auth_mode": "managed_signer",\n  ...\n}' required></textarea>
        <button type="submit">Restore Wallet</button>
      </form>
    </main>
  </body>
</html>`;
}

export function renderWithdrawPortal(payload: {
  appName: string;
  actionPath: string;
  chainLabel: string;
  tokenSymbol: string;
  maxAmountUsdc?: number;
  quotePreview?: string;
  error?: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.appName)} Withdraw</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(180deg,#07111e 0%,#03050b 100%);color:#eef5ff;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .card{width:min(640px,100%);border-radius:24px;padding:28px;border:1px solid rgba(255,255,255,.10);background:rgba(9,16,28,.92)}
      label{display:grid;gap:8px;margin:16px 0;font-weight:600}
      input{width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#fff}
      button{border:0;border-radius:999px;padding:14px 18px;font-size:15px;font-weight:700;color:#03150f;background:linear-gradient(135deg,#7cf2c5,#d7ffea);cursor:pointer}
      .muted{color:#9db0c9;line-height:1.6}.error{margin:18px 0;padding:12px 14px;border-radius:14px;background:rgba(255,138,138,.12);border:1px solid rgba(255,138,138,.28);color:#ffd0d0}
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Withdraw ${escapeHtml(payload.tokenSymbol)} to ${escapeHtml(payload.chainLabel)}</h1>
      <p class="muted">Luna will create a one-time Polymarket withdrawal route, then submit the bridge transfer through the official Builder / Relayer path for supported wallets.</p>
      <p class="muted">Available balance: <b>${(payload.maxAmountUsdc ?? 0).toFixed(2)} USDC</b>${payload.quotePreview ? `<br/>${escapeHtml(payload.quotePreview)}` : ""}</p>
      ${payload.error ? `<div class="error">${escapeHtml(payload.error)}</div>` : ""}
      <form method="POST" action="${escapeHtml(payload.actionPath)}">
        <label>Recipient Address
          <input name="recipient_address" placeholder="0x..." required />
        </label>
        <label>Amount (USDC)
          <input name="amount_usdc" type="number" min="1" step="0.01" max="${Math.max(0, payload.maxAmountUsdc ?? 0).toFixed(2)}" required />
        </label>
        <button type="submit">Create Route and Withdraw</button>
      </form>
    </main>
  </body>
</html>`;
}

export function renderWithdrawalResult(payload: { success: boolean; title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(payload.title)}</title></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(180deg,#07111e 0%,#03050b 100%);color:#eef5ff;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <main style="width:min(560px,100%);border-radius:24px;padding:28px;border:1px solid rgba(255,255,255,.10);background:rgba(9,16,28,.92)">
      <h1>${payload.success ? "✅" : "❌"} ${escapeHtml(payload.title)}</h1>
      <p style="line-height:1.7;color:#c7d5ea;white-space:pre-wrap">${escapeHtml(payload.body)}</p>
    </main>
  </body>
</html>`;
}

export function dashboardText(
  user: UserRecord,
  payload?: {
    accountStatus?: string | null;
    authMode?: string | null;
    balanceUsdc?: number | null;
    positionsCount?: number | null;
    hasLinkedAccount?: boolean;
    topSignalTitle?: string | null;
    topSignalScore?: number | null;
    topSportsTitle?: string | null;
    topWalletName?: string | null;
    topWalletScore?: number | null;
  },
): string {
  const lang = user.language;
  const hasAccount = Boolean(payload?.hasLinkedAccount);
  const balance = Number(payload?.balanceUsdc ?? 0);
  const positions = Number(payload?.positionsCount ?? 0);
  const title = `🌙 <b>${t(lang, "dashboard.title")}</b>`;

  const bestTrade = payload?.topSignalTitle
    ? `\n\n🔥 <b>${t(lang, "dashboard.best_trade")}</b>\n${escapeHtml(payload.topSignalTitle)}${payload.topSignalScore ? ` · 🏆 ${payload.topSignalScore}` : ""}`
    : "";
  const sportsTrade = payload?.topSportsTitle
    ? `\n⚽ <b>${t(lang, "dashboard.sports_focus")}</b>\n${escapeHtml(payload.topSportsTitle)}`
    : "";
  const bestWallet = payload?.topWalletName
    ? `\n🏆 <b>${t(lang, "dashboard.best_wallet")}</b>\n${escapeHtml(payload.topWalletName)}${payload.topWalletScore ? ` · ${payload.topWalletScore}` : ""}`
    : "";

  if (!hasAccount) {
    return `${title}\n\n${t(lang, "dashboard.no_account")}${bestTrade}${sportsTrade}${bestWallet}`;
  }

  const statusLine = `${t(lang, "label.account_status")}：<b>${escapeHtml(payload?.accountStatus ?? "-")}</b>`;
  const modeLine = `${t(lang, "label.mode")}：<b>${escapeHtml(payload?.authMode ?? "-")}</b>`;
  const balanceLine = `${t(lang, "label.balance")}：<b>$${balance.toFixed(2)}</b>`;

  if (balance <= 0) {
    return `${title}\n\n${statusLine}\n${modeLine}\n${balanceLine}\n\n${t(lang, "dashboard.zero_balance")}${bestTrade}${sportsTrade}`;
  }

  const posLine = `${t(lang, "label.positions")}：<b>${positions}</b>`;

  // Gamification: streak badge + XP
  const streak = user.trade_streak ?? 0;
  const xp = user.total_xp ?? 0;
  const streakBadge = streak >= 7 ? "🔥🔥🔥" : streak >= 3 ? "🔥🔥" : streak >= 1 ? "🔥" : "";
  const gamificationLine = (streak > 0 || xp > 0)
    ? `\n${streakBadge} <b>${streak}-day streak</b> · <b>${xp} XP</b>`
    : "";

  return `${title}\n\n${statusLine}\n${modeLine}\n${balanceLine}\n${posLine}${gamificationLine}\n\n${t(lang, "dashboard.active")}${bestTrade}${sportsTrade}${bestWallet}`;
}

export function dashboardLoadingText(user: UserRecord, hasLinkedAccount = false): string {
  const lang = user.language;
  const title = `🌙 <b>${t(lang, "dashboard.title")}</b>`;
  if (!hasLinkedAccount) {
    return `${title}\n\nLoading today's best trades and sports window...`;
  }
  return `${title}\n\nSyncing your live account, best trade, and wallet menu...`;
}

export function renderDiscoverHub(
  user: UserRecord,
  payload: {
    topSignals: RuntimeSignal[];
    sportsSignals: RuntimeSignal[];
    wallets: RuntimeWalletProfile[];
  },
): string {
  const lang = user.language;
  const mainTrades = payload.topSignals
    .slice(0, 3)
    .map((signal, index) => `${index + 1}. ${pickLang(signal, "title", lang)}\n   ${pickLang(signal, "action", lang)} · 🏆 ${signal.score}`)
    .join("\n\n");
  const sportsTrades = payload.sportsSignals
    .slice(0, 2)
    .map((signal) => `⚽ ${pickLang(signal, "title", lang)} · ${signal.selected_outcome ?? "-"} · 🏆 ${signal.score}`)
    .join("\n");
  const bestWallets = payload.wallets
    .slice(0, 3)
    .map((wallet) => `🏆 ${wallet.name} · ${wallet.grade}${wallet.score} · ROI ${wallet.roi_30d}`)
    .join("\n");

  return `🚀 <b>${t(lang, "discover.title")}</b>\n\n${t(lang, "discover.intro")}\n\n<b>${t(lang, "discover.best_trades")}</b>\n${mainTrades || t(lang, "signals.none")}\n\n<b>${t(lang, "discover.sports_window")}</b>\n${sportsTrades || t(lang, "worldcup.no_signals")}\n\n<b>${t(lang, "discover.smart_wallets")}</b>\n${bestWallets || t(lang, "leaderboard.no_sports")}\n\n${t(lang, "discover.cta")}`;
}

export function renderCopyDesk(
  user: UserRecord,
  payload: {
    topWallet?: RuntimeWalletProfile | null;
    sportsWallet?: RuntimeWalletProfile | null;
    topSignal?: RuntimeSignal | null;
    sportsSignal?: RuntimeSignal | null;
    balanceUsdc?: number | null;
    suggestedSizes?: number[];
  },
): string {
  const lang = user.language;
  const topWallet = payload.topWallet
    ? `${escapeHtml(payload.topWallet.name)} · ${payload.topWallet.grade}${payload.topWallet.score} · ROI ${escapeHtml(payload.topWallet.roi_30d)} · ${t(lang, "copydesk.route_general")}`
    : t(lang, "copydesk.none_wallet");
  const sportsWallet = payload.sportsWallet
    ? `${escapeHtml(payload.sportsWallet.name)} · ${payload.sportsWallet.grade}${payload.sportsWallet.score} · ROI ${escapeHtml(payload.sportsWallet.roi_30d)} · ${t(lang, "copydesk.route_sports")}`
    : t(lang, "copydesk.none_wallet");
  const topSignal = payload.topSignal
    ? `#${payload.topSignal.id} ${pickLang(payload.topSignal, "title", lang)}\n${pickLang(payload.topSignal, "action", lang)} · 🏆 ${payload.topSignal.score}`
    : t(lang, "copydesk.none_signal");
  const sportsSignal = payload.sportsSignal
    ? `#${payload.sportsSignal.id} ${pickLang(payload.sportsSignal, "title", lang)}\n${pickLang(payload.sportsSignal, "action", lang)} · 🏆 ${payload.sportsSignal.score}`
    : t(lang, "copydesk.none_signal");
  const reasonLines = lang === "zh"
    ? [
        payload.topWallet ? `• ${escapeHtml(payload.topWallet.name)} 的综合 Smart Score 最高，且 ROI 更稳定。`
          : null,
        payload.sportsWallet ? `• ${escapeHtml(payload.sportsWallet.name)} 是当前更适合体育 / 世界杯题材的专家钱包。`
          : null,
        payload.topSignal ? `• #${payload.topSignal.id} 是当前全市场 Smart Score 最高、最适合先下小额真单的主推。`
          : null,
        payload.sportsSignal ? `• #${payload.sportsSignal.id} 是当前最适合赛前压球的体育单。`
          : null,
      ]
    : [
        payload.topWallet ? `• ${escapeHtml(payload.topWallet.name)} has the highest broad-market score and repeat ROI.` : null,
        payload.sportsWallet ? `• ${escapeHtml(payload.sportsWallet.name)} is the best specialist when the user wants sports / World Cup exposure.` : null,
        payload.topSignal ? `• #${payload.topSignal.id} is the strongest non-sports setup by Smart Score right now.` : null,
        payload.sportsSignal ? `• #${payload.sportsSignal.id} is the clearest sports setup if you're betting match-driven flow.` : null,
      ];
  const why = [
    ...reasonLines,
  ].filter(Boolean).join("\n");
  const sizeLine = payload.suggestedSizes?.length
    ? payload.suggestedSizes.map((amount, index) => {
        const label = index === 0
          ? (lang === "zh" ? "保守" : "Conservative")
          : index === 1
            ? (lang === "zh" ? "平衡" : "Balanced")
            : (lang === "zh" ? "激进" : "Aggressive");
        return `• ${label}：$${amount}`;
      }).join("\n")
    : t(lang, "copydesk.size_hint");
  const balanceLine = payload.balanceUsdc != null
    ? `\n\n<b>${lang === "zh" ? "可用余额" : "Available balance"}</b>\n$${Number(payload.balanceUsdc).toFixed(2)}`
    : "";

  return `🤖 <b>${t(lang, "copydesk.title")}</b>\n\n${t(lang, "copydesk.intro")}${balanceLine}\n\n<b>${t(lang, "copydesk.general_wallet")}</b>\n${topWallet}\n\n<b>${t(lang, "copydesk.sports_wallet")}</b>\n${sportsWallet}\n\n<b>${t(lang, "copydesk.best_signal")}</b>\n${topSignal}\n\n<b>${t(lang, "copydesk.sports_signal")}</b>\n${sportsSignal}\n\n<b>${t(lang, "copydesk.why")}</b>\n${why || t(lang, "copydesk.none_signal")}\n\n<b>${lang === "zh" ? "建议首笔仓位" : "Suggested first sizes"}</b>\n${sizeLine}\n\n${t(lang, "copydesk.size_hint")}`;
}

export function renderAddressBook(
  user: UserRecord,
  payload: {
    topWallets: RuntimeWalletProfile[];
    sportsWallets: RuntimeWalletProfile[];
    trackedWallets: RuntimeWalletProfile[];
    trackedAddresses: string[];
    activeTaskCount: number;
  },
): string {
  const lang = user.language;
  const fmtWallet = (wallet: RuntimeWalletProfile) =>
    `${escapeHtml(wallet.name)} · ${wallet.grade}${wallet.score} · ROI ${escapeHtml(wallet.roi_30d)} · ${escapeHtml(pickLang(wallet, "specialty", lang))}`;
  const top = payload.topWallets.slice(0, 4).map((wallet, index) => `${index + 1}. ${fmtWallet(wallet)}`).join("\n") || t(lang, "addressbook.none");
  const sports = payload.sportsWallets.slice(0, 4).map((wallet, index) => `${index + 1}. ${fmtWallet(wallet)}`).join("\n") || t(lang, "addressbook.none");
  const tracked = payload.trackedWallets.length
    ? payload.trackedWallets.slice(0, 5).map((wallet, index) => `${index + 1}. ${fmtWallet(wallet)}`).join("\n")
    : payload.trackedAddresses.length
      ? payload.trackedAddresses.slice(0, 5).map((address, index) => `${index + 1}. <code>${escapeHtml(shortAddress(address))}</code>`).join("\n")
      : t(lang, "addressbook.none_tracked");
  return `🗂 <b>${t(lang, "addressbook.title")}</b>\n\n${t(lang, "addressbook.intro")}\n\n<b>${t(lang, "addressbook.core")}</b>\n${top}\n\n<b>${t(lang, "addressbook.sports")}</b>\n${sports}\n\n<b>${t(lang, "addressbook.tracked")}</b>\n${tracked}\n\n<b>${t(lang, "addressbook.tasks")}</b>\n${payload.activeTaskCount} ${t(lang, "addressbook.active_tasks")}\n\n${t(lang, "addressbook.hint")}`;
}

export function renderAddressProfile(
  user: UserRecord,
  wallet: RuntimeWalletProfile,
  payload?: { tracked?: boolean; followTask?: FollowTaskRecord | null },
): string {
  const lang = user.language;
  const trackedLine = payload?.tracked ? `\n🎯 ${t(lang, "addressbook.tracked_flag")}` : "";
  const followLine = payload?.followTask
    ? `\n🤖 ${t(lang, "follow.task_live")} · ${escapeHtml(payload.followTask.execution_mode)} · $${payload.followTask.copy_amount_usdc.toFixed(2)}`
    : "";
  const smartMetrics = [
    wallet.settled_trade_count != null ? `🧾 Settled：<b>${wallet.settled_trade_count}</b>` : null,
    wallet.avg_holding_period_hours != null ? `⏱ Hold：<b>${wallet.avg_holding_period_hours.toFixed(1)}h</b>` : null,
    wallet.kelly_consistency_score != null ? `📐 Kelly：<b>${wallet.kelly_consistency_score.toFixed(1)}</b>` : null,
    wallet.copy_suitability_score != null ? `🎯 Suitability：<b>${wallet.copy_suitability_score.toFixed(1)}</b>` : null,
  ].filter(Boolean).join("\n");
  return `📇 <b>${t(lang, "addressbook.profile")}</b>\n\n<b>${escapeHtml(wallet.name)}</b>\n<code>${escapeHtml(wallet.address)}</code>\n\n🏆 ${wallet.grade}${wallet.score}\n📈 ROI 30d: <b>${escapeHtml(wallet.roi_30d)}</b>\n✅ Win 30d: <b>${escapeHtml(wallet.win_rate_30d)}</b>\n🔁 ${escapeHtml(wallet.activity)}\n🧠 ${escapeHtml(pickLang(wallet, "specialty", lang))}${smartMetrics ? `\n\n<b>Smart metrics</b>\n${smartMetrics}` : ""}\n\n${escapeHtml(pickLang(wallet, "note", lang))}${trackedLine}${followLine}`;
}

export function renderFollowTaskHub(
  user: UserRecord,
  payload: {
    tasks: FollowTaskRecord[];
    suggestedWallets: RuntimeWalletProfile[];
  },
): string {
  const lang = user.language;
  const tasksBody = payload.tasks.length
    ? payload.tasks.slice(0, 6).map((task, index) => {
        const wallet = task.wallet_name ?? shortAddress(task.wallet_address);
        const status = task.status === "active" ? t(lang, "follow.active") : t(lang, "follow.paused");
        return `${index + 1}. ${escapeHtml(wallet)} · ${status}\n   $${task.copy_amount_usdc.toFixed(2)} / ${t(lang, "follow.per_trade")} $${task.max_per_trade_usdc.toFixed(2)} · ${escapeHtml(task.execution_mode)}`;
      }).join("\n\n")
    : t(lang, "follow.none");
  const suggestions = payload.suggestedWallets.slice(0, 4)
    .map((wallet, index) => `${index + 1}. ${escapeHtml(wallet.name)} · ${wallet.grade}${wallet.score} · ROI ${escapeHtml(wallet.roi_30d)}`)
    .join("\n") || t(lang, "addressbook.none");
  return `🤝 <b>${t(lang, "follow.title")}</b>\n\n${t(lang, "follow.intro")}\n\n<b>${t(lang, "follow.live_tasks")}</b>\n${tasksBody}\n\n<b>${t(lang, "follow.suggestions")}</b>\n${suggestions}\n\n${t(lang, "follow.hint")}`;
}

export function renderFollowTaskPreset(
  user: UserRecord,
  payload: {
    wallet: RuntimeWalletProfile;
    tracked: boolean;
    sportsBias: boolean;
  },
): string {
  const lang = user.language;
  const metricLines = [
    payload.wallet.settled_trade_count != null ? `🧾 Settled：${payload.wallet.settled_trade_count}` : null,
    payload.wallet.avg_holding_period_hours != null ? `⏱ Hold：${payload.wallet.avg_holding_period_hours.toFixed(1)}h` : null,
    payload.wallet.kelly_consistency_score != null ? `📐 Kelly：${payload.wallet.kelly_consistency_score.toFixed(1)}` : null,
    payload.wallet.copy_suitability_score != null ? `🎯 Suitability：${payload.wallet.copy_suitability_score.toFixed(1)}` : null,
  ].filter(Boolean).join("\n");
  return `🤝 <b>${t(lang, "follow.setup")}</b>\n\n<b>${escapeHtml(payload.wallet.name)}</b>\n<code>${escapeHtml(payload.wallet.address)}</code>\n\n🏆 ${payload.wallet.grade}${payload.wallet.score} · ROI ${escapeHtml(payload.wallet.roi_30d)}\n🧠 ${escapeHtml(pickLang(payload.wallet, "specialty", lang))}${metricLines ? `\n\n<b>Smart metrics</b>\n${metricLines}` : ""}\n\n${escapeHtml(pickLang(payload.wallet, "note", lang))}\n\n${payload.tracked ? `🎯 ${t(lang, "addressbook.tracked_flag")}\n` : ""}${payload.sportsBias ? `⚽ ${t(lang, "follow.sports_bias")}` : `🌐 ${t(lang, "follow.general_bias")}`}\n\n${t(lang, "follow.preset_hint")}`;
}

export function renderNewsHub(user: UserRecord, rows: Array<Record<string, unknown>>): string {
  const lang = user.language;
  const body = rows.length
    ? rows.slice(0, 8).map((row, index) => {
        const title = String(row.title ?? "Untitled");
        const source = String(row.source ?? "unknown");
        const status = String(row.status ?? "detected");
        const slug = row.market_slug ? ` · ${escapeHtml(String(row.market_slug))}` : "";
        return `${index + 1}. ${escapeHtml(title)}\n   📰 ${escapeHtml(source)} · ${escapeHtml(status)}${slug}`;
      }).join("\n\n")
    : (lang === "zh" ? "还没有新闻触发记录。" : "No news triggers yet.");
  return `📰 <b>${lang === "zh" ? "新闻狙击" : "News Sniper"}</b>\n\n${lang === "zh" ? "这里只显示已进入 Luna 审计链的新闻事件。" : "This hub shows news events that entered Luna's execution audit trail."}\n\n${body}`;
}

export function renderArbHub(user: UserRecord, rows: Array<Record<string, unknown>>): string {
  const lang = user.language;
  const body = rows.length
    ? rows.slice(0, 8).map((row, index) => {
        const slug = String(row.polymarket_slug ?? "-");
        const kalshi = row.kalshi_ticker ? String(row.kalshi_ticker) : "-";
        const spread = Number(row.spread_bps ?? 0).toFixed(1);
        const net = Number(row.net_edge_bps ?? 0).toFixed(1);
        const status = String(row.status ?? "open");
        return `${index + 1}. ${escapeHtml(slug)}\n   ↔ ${escapeHtml(kalshi)} · spread ${spread}bps · net ${net}bps · ${escapeHtml(status)}`;
      }).join("\n\n")
    : (lang === "zh" ? "还没有跨所套利机会。" : "No cross-exchange arb opportunities yet.");
  return `⚖️ <b>${lang === "zh" ? "跨所套利预警" : "Arb Alerts"}</b>\n\n${lang === "zh" ? "这里只做预警，不做自动双边执行。" : "This hub is alert-only. No automatic two-sided execution."}\n\n${body}`;
}

export function renderReferralHub(
  user: UserRecord,
  payload: {
    inviteLink: string;
    referralBps: number;
    referralWallet?: string | null;
    platformFeeBps: number;
    referralCount: number;
    referralEarnedUsdc: number;
    publicShareUrl: string;
    recentEvents: Array<{ refereeLabel: string; amountUsdc: number; createdAt: string }>;
    totalSettledFeeUsdc?: number;
    totalGrossVolumeUsdc?: number;
    feeWallet?: string | null;
  },
): string {
  const lang = user.language;
  const referralPct = (payload.referralBps / 100).toFixed(2);
  const platformFeePct = (payload.platformFeeBps / 100).toFixed(2);
  const walletLine = payload.referralWallet ? `\n${t(lang, "refer.pool_wallet")}：<code>${escapeHtml(payload.referralWallet)}</code>` : "";
  const recent = payload.recentEvents.length
    ? payload.recentEvents
        .slice(0, 5)
        .map((event) => `• ${escapeHtml(event.refereeLabel)} · +$${event.amountUsdc.toFixed(4)}`)
        .join("\n")
    : t(lang, "refer.none_recent");
  const monetizationProof = `\n<b>Live monetization</b>\n• Settled platform fees：$${Number(payload.totalSettledFeeUsdc ?? 0).toFixed(2)}\n• Gross referred / copied volume：$${Number(payload.totalGrossVolumeUsdc ?? 0).toFixed(2)}${payload.feeWallet ? `\n• Fee wallet：<code>${escapeHtml(payload.feeWallet)}</code>` : ""}`;
  return `🎁 <b>${t(lang, "refer.title")}</b>\n\n${t(lang, "refer.intro")}\n\n<b>${t(lang, "refer.link")}</b>\n<code>${escapeHtml(payload.inviteLink)}</code>\n\n<b>Public share page</b>\n<code>${escapeHtml(payload.publicShareUrl)}</code>\n\n<b>${t(lang, "refer.economics")}</b>\n• ${t(lang, "refer.platform_fee")}：${platformFeePct}%\n• ${t(lang, "refer.pool_split")}：${referralPct}%\n• ${t(lang, "refer.share_hint")}${walletLine}${monetizationProof}\n\n<b>My referral stats</b>\n• Referrals：${payload.referralCount}\n• Earned：$${payload.referralEarnedUsdc.toFixed(4)}\n\n<b>${t(lang, "refer.recent")}</b>\n${recent}\n\n${t(lang, "refer.kol_hint")}`;
}

export function renderReferralLedger(
  user: UserRecord,
  payload: {
    referralCount: number;
    referralEarnedUsdc: number;
    events: Array<{ refereeLabel: string; amountUsdc: number; createdAt: string; detail?: string | null }>;
  },
): string {
  const lang = user.language;
  const body = payload.events.length
    ? payload.events
        .slice(0, 12)
        .map((event) => {
          const date = event.createdAt.slice(0, 10);
          const detail = event.detail ? ` · ${escapeHtml(event.detail)}` : "";
          return `• ${date} · ${escapeHtml(event.refereeLabel)} · +$${event.amountUsdc.toFixed(4)}${detail}`;
        })
        .join("\n")
    : t(lang, "refer.none_recent");
  return `📒 <b>${t(lang, "refer.ledger_title")}</b>\n\n${t(lang, "refer.total_referrals")}：<b>${payload.referralCount}</b>\n${t(lang, "refer.total_earned")}：<b>$${payload.referralEarnedUsdc.toFixed(4)}</b>\n\n${body}`;
}

export function renderCreatorProfile(payload: {
  displayName: string;
  subtitle: string;
  inviteLink: string;
  receiptsCount: number;
  grossAmountUsdc: number;
  feeAmountUsdc: number;
  referralCount: number;
  referralEarnedUsdc: number;
  liveBalanceUsdc?: number | null;
  livePositionsCount?: number | null;
  livePositionValueUsdc?: number | null;
  liveUnrealizedPnlUsdc?: number | null;
  recentTrades: Array<{ title: string; amount: number | null; eventType: string }>;
}): string {
  const pnl = Number(payload.liveUnrealizedPnlUsdc ?? 0);
  const pnlSign = pnl >= 0 ? "+" : "";
  const pnlClass = pnl >= 0 ? "green" : "red";
  const balance = Number(payload.liveBalanceUsdc ?? 0);
  const posValue = Number(payload.livePositionValueUsdc ?? 0);
  const posCount = Number(payload.livePositionsCount ?? 0);
  const recent = payload.recentTrades.length
    ? payload.recentTrades.slice(0, 6).map((trade) => {
        const icon = trade.eventType === "close" ? "🧹" : "⚡";
        const amount = trade.amount != null ? `$${trade.amount.toFixed(2)}` : "";
        return `<div class="trade-row"><div class="trade-icon">${icon}</div><div class="trade-title">${escapeHtml(trade.title)}</div><div class="trade-amount">${amount}</div></div>`;
      }).join("")
    : `<div class="trade-row"><div class="trade-title muted">No public receipts yet.</div></div>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(payload.displayName)} · Luna AI</title>
  <meta name="description" content="${escapeHtml(payload.subtitle)}"/>
  <meta property="og:title" content="${escapeHtml(payload.displayName)} on Luna AI"/>
  <meta property="og:description" content="${escapeHtml(payload.subtitle)}"/>
  <meta property="og:type" content="profile"/>
  <meta name="twitter:card" content="summary"/>
  <meta name="twitter:title" content="${escapeHtml(payload.displayName)} · Luna AI"/>
  <meta name="twitter:description" content="${escapeHtml(payload.subtitle)}"/>
  <style>
    :root{--bg:#060c16;--card:rgba(10,18,32,.9);--line:rgba(255,255,255,.07);--text:#f0f4ff;--muted:#7a90aa;--accent:#3dffa0;--green:#3dffa0;--red:#ff6b8a}
    *{box-sizing:border-box;margin:0;padding:0}
    body{color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);min-height:100vh}
    .bg{position:fixed;inset:0;pointer-events:none;overflow:hidden}
    .bg::before{content:'';position:absolute;top:-200px;left:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(61,255,160,.12),transparent 65%);border-radius:50%}
    .bg::after{content:'';position:absolute;bottom:-150px;right:-100px;width:500px;height:500px;background:radial-gradient(circle,rgba(255,107,138,.08),transparent 65%);border-radius:50%}
    .shell{position:relative;z-index:1;max-width:800px;margin:0 auto;padding:32px 20px 80px}
    /* nav */
    .nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
    .nav-logo{font-size:15px;font-weight:700;color:var(--accent);text-decoration:none}
    .nav-cta{padding:8px 16px;border-radius:999px;background:var(--accent);color:#031a0d;font-weight:700;font-size:13px;text-decoration:none}
    /* share card */
    .share-card{background:linear-gradient(135deg,rgba(12,22,40,.95),rgba(8,14,28,.98));border:1px solid var(--line);border-radius:28px;padding:32px;position:relative;overflow:hidden;margin-bottom:20px}
    .share-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),#a0ffda,var(--accent))}
    .card-header{display:flex;align-items:flex-start;gap:16px;margin-bottom:24px}
    .avatar{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#6affcc);display:grid;place-items:center;font-size:22px;flex-shrink:0;color:#031a0d;font-weight:900}
    .card-identity h1{font-size:22px;font-weight:800;letter-spacing:-.02em}
    .card-identity .badge{display:inline-flex;padding:3px 10px;border-radius:999px;border:1px solid var(--line);color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-top:4px}
    .pnl-hero{text-align:center;padding:24px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:20px 0}
    .pnl-label{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:8px}
    .pnl-num{font-size:clamp(48px,10vw,72px);font-weight:900;letter-spacing:-.03em;line-height:1}
    .pnl-num.green{color:var(--green)}
    .pnl-num.red{color:var(--red)}
    .pnl-sub{font-size:14px;color:var(--muted);margin-top:8px}
    /* metrics grid */
    .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
    .metric-item{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:16px;padding:16px;text-align:center}
    .metric-val{font-size:22px;font-weight:800;line-height:1}
    .metric-key{font-size:11px;color:var(--muted);margin-top:5px;text-transform:uppercase;letter-spacing:.06em}
    /* cta */
    .cta-block{display:flex;flex-direction:column;gap:10px;margin-top:24px}
    .btn-main{display:block;text-align:center;padding:15px;border-radius:999px;background:linear-gradient(135deg,var(--accent),#a0ffda);color:#031a0d;font-weight:700;font-size:15px;text-decoration:none}
    .btn-secondary{display:block;text-align:center;padding:13px;border-radius:999px;border:1px solid var(--line);color:var(--text);font-weight:600;font-size:14px;text-decoration:none}
    /* trades */
    .trades-card{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:24px}
    .trades-title{font-size:15px;font-weight:700;margin-bottom:16px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-size:11px}
    .trade-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
    .trade-row:last-child{border-bottom:0}
    .trade-icon{font-size:16px;flex-shrink:0}
    .trade-title{flex:1;font-size:14px;line-height:1.4}
    .trade-amount{font-size:13px;font-weight:700;color:var(--accent);white-space:nowrap}
    .muted{color:var(--muted)}
    @media(max-width:480px){.metrics{grid-template-columns:repeat(2,1fr)}.pnl-num{font-size:52px}}
  </style>
</head>
<body>
<div class="bg"></div>
<div class="shell">
  <nav class="nav">
    <a class="nav-logo" href="/">🌙 Luna AI</a>
    <a class="nav-cta" href="https://t.me/GetLunaAIBot">Open Bot →</a>
  </nav>

  <div class="share-card">
    <div class="card-header">
      <div class="avatar">${escapeHtml(payload.displayName.slice(0, 1).toUpperCase())}</div>
      <div class="card-identity">
        <h1>${escapeHtml(payload.displayName)}</h1>
        <span class="badge">Luna Trader · Public</span>
      </div>
    </div>

    <div class="pnl-hero">
      <div class="pnl-label">Unrealized P&amp;L</div>
      <div class="pnl-num ${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(2)}</div>
      <div class="pnl-sub">${posCount} open position${posCount !== 1 ? "s" : ""} · $${posValue.toFixed(2)} position value</div>
    </div>

    <div class="metrics">
      <div class="metric-item">
        <div class="metric-val">$${balance.toFixed(2)}</div>
        <div class="metric-key">Balance</div>
      </div>
      <div class="metric-item">
        <div class="metric-val">${payload.receiptsCount}</div>
        <div class="metric-key">Trades</div>
      </div>
      <div class="metric-item">
        <div class="metric-val">$${payload.grossAmountUsdc.toFixed(0)}</div>
        <div class="metric-key">Volume</div>
      </div>
      <div class="metric-item">
        <div class="metric-val">${payload.referralCount}</div>
        <div class="metric-key">Referrals</div>
      </div>
      <div class="metric-item">
        <div class="metric-val">$${payload.referralEarnedUsdc.toFixed(2)}</div>
        <div class="metric-key">Ref earned</div>
      </div>
      <div class="metric-item">
        <div class="metric-val">$${payload.feeAmountUsdc.toFixed(2)}</div>
        <div class="metric-key">Fees paid</div>
      </div>
    </div>

    <div class="cta-block">
      <a class="btn-main" href="${escapeHtml(payload.inviteLink)}">🤖 Copy this trader on Luna</a>
      <a class="btn-secondary" href="https://t.me/GetLunaAIBot">Open @GetLunaAIBot in Telegram</a>
    </div>
  </div>

  <div class="trades-card">
    <div class="trades-title">Recent public receipts</div>
    ${recent}
  </div>
</div>
</body>
</html>`;
}

export function renderCreatorDirectory(
  user: UserRecord,
  creators: Array<{
    displayName: string;
    telegramUserId: string;
    referralCount: number;
    referralEarnedUsdc: number;
    tradeCount: number;
    grossAmountUsdc: number;
  }>,
): string {
  const lang = user.language;
  const leader = creators[0];
  const body = creators.length
    ? creators
        .map(
          (creator, index) =>
            `${index + 1}. ${escapeHtml(creator.displayName)}\n   👥 ${creator.referralCount} · 💸 $${creator.referralEarnedUsdc.toFixed(4)} · 📈 ${creator.tradeCount} trades · Vol $${creator.grossAmountUsdc.toFixed(2)}`,
        )
        .join("\n\n")
    : t(lang, "creators.none");
  const spotlight = leader
    ? `🔥 <b>Leader today</b>\n${escapeHtml(leader.displayName)} · 👥 ${leader.referralCount} · 💸 $${leader.referralEarnedUsdc.toFixed(4)} · 📈 ${leader.tradeCount} trades\n\n`
    : "";
  return `📣 <b>${t(lang, "creators.title")}</b>\n\n${t(lang, "creators.intro")}\n\n${spotlight}<b>Who is actually converting?</b>\n${body}\n\nTap a creator below to inspect live balance, public receipts, referral output, and their public scorecard before you copy.`;
}

export function renderCreatorDirectoryPage(
  creators: Array<{
    displayName: string;
    telegramUserId: string;
    referralCount: number;
    referralEarnedUsdc: number;
    tradeCount: number;
    grossAmountUsdc: number;
  }>,
): string {
  const medals = ["🥇", "🥈", "🥉"];
  const rankClass = ["rank-1", "rank-2", "rank-3"];
  const cards = creators.length
    ? creators.map((creator, index) => {
        const medal = medals[index] ?? `#${index + 1}`;
        const rClass = rankClass[index] ?? "";
        return `<div class="podium-card ${rClass}">
  <div class="medal">${medal}</div>
  <div class="creator-name">${escapeHtml(creator.displayName)}</div>
  <div class="creator-stats">
    <div class="stat-box"><div class="stat-val">${creator.referralCount}</div><div class="stat-key">Referrals</div></div>
    <div class="stat-box"><div class="stat-val">$${creator.referralEarnedUsdc.toFixed(2)}</div><div class="stat-key">Earned</div></div>
    <div class="stat-box"><div class="stat-val">${creator.tradeCount}</div><div class="stat-key">Trades</div></div>
    <div class="stat-box"><div class="stat-val">$${creator.grossAmountUsdc.toFixed(0)}</div><div class="stat-key">Volume</div></div>
  </div>
  <a class="creator-cta" href="/creator/${encodeURIComponent(creator.telegramUserId)}">View profile →</a>
</div>`;
      }).join("")
    : `<div class="podium-card"><div class="medal">🌙</div><div class="creator-name">No creators yet</div><p style="color:var(--muted);font-size:14px;margin-top:8px">Creator rankings will appear here once public receipts and referral activity accumulate.</p></div>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Luna Creator Leaderboard</title>
  <meta name="description" content="Inspect who is actually converting on Luna AI — public receipts, referral earnings, and live wallet state."/>
  <meta property="og:title" content="Luna AI — Creator Leaderboard"/>
  <meta property="og:description" content="Inspect who is actually converting. Public receipts, referral earnings, live wallet state."/>
  <meta name="twitter:card" content="summary"/>
  <style>
    :root{--bg:#060c16;--card:rgba(10,18,32,.9);--line:rgba(255,255,255,.07);--text:#f0f4ff;--muted:#7a90aa;--accent:#3dffa0;--gold:#ffd166;--silver:#c0c8d8;--bronze:#cd7c3a}
    *{box-sizing:border-box;margin:0;padding:0}
    body{color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);min-height:100vh}
    .bg{position:fixed;inset:0;pointer-events:none;overflow:hidden}
    .bg::before{content:'';position:absolute;top:-100px;left:-100px;width:500px;height:500px;background:radial-gradient(circle,rgba(61,255,160,.1),transparent 65%);border-radius:50%}
    .shell{position:relative;z-index:1;max-width:1160px;margin:0 auto;padding:32px 24px 80px}
    nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px;padding-bottom:20px;border-bottom:1px solid var(--line)}
    .nav-logo{font-size:16px;font-weight:800;color:var(--accent);text-decoration:none}
    .nav-cta{padding:9px 18px;border-radius:999px;background:var(--accent);color:#031a0d;font-weight:700;font-size:13px;text-decoration:none}
    .page-header{margin-bottom:36px}
    .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:var(--accent);margin-bottom:10px}
    h1{font-size:clamp(32px,5vw,52px);font-weight:900;letter-spacing:-.03em;line-height:1.05}
    .sub{color:var(--muted);font-size:16px;line-height:1.6;margin-top:10px;max-width:600px}
    /* podium for top 3 */
    .podium{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px}
    .podium-card{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:24px;position:relative;overflow:hidden}
    .podium-card.rank-1{border-color:rgba(255,209,102,.35)}
    .podium-card.rank-2{border-color:rgba(192,200,216,.2)}
    .podium-card.rank-3{border-color:rgba(205,124,58,.2)}
    .podium-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
    .podium-card.rank-1::before{background:linear-gradient(90deg,var(--gold),rgba(255,209,102,.3))}
    .podium-card.rank-2::before{background:linear-gradient(90deg,var(--silver),rgba(192,200,216,.3))}
    .podium-card.rank-3::before{background:linear-gradient(90deg,var(--bronze),rgba(205,124,58,.3))}
    .medal{font-size:28px;margin-bottom:10px}
    .creator-name{font-size:18px;font-weight:800;margin-bottom:4px}
    .creator-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}
    .stat-box{background:rgba(255,255,255,.03);border-radius:12px;padding:12px}
    .stat-val{font-size:18px;font-weight:800}
    .stat-key{font-size:11px;color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.06em}
    .creator-cta{display:block;text-align:center;padding:11px;border-radius:999px;background:linear-gradient(135deg,var(--accent),#a0ffda);color:#031a0d;text-decoration:none;font-weight:700;font-size:14px}
    /* rest of list */
    .list-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
    .list-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;align-items:center;gap:14px}
    .list-rank{font-size:22px;font-weight:900;color:var(--muted);width:32px;flex-shrink:0}
    .list-info{flex:1;min-width:0}
    .list-name{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .list-meta{font-size:12px;color:var(--muted);margin-top:3px}
    .list-cta{padding:8px 14px;border-radius:999px;background:rgba(61,255,160,.1);color:var(--accent);text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap;border:1px solid rgba(61,255,160,.2)}
    @media(max-width:600px){.creator-stats{grid-template-columns:1fr 1fr}}
  </style>
</head>
<body>
<div class="bg"></div>
<div class="shell">
  <nav>
    <a class="nav-logo" href="/">🌙 Luna AI</a>
    <a class="nav-cta" href="https://t.me/GetLunaAIBot">Open Bot →</a>
  </nav>
  <div class="page-header">
    <div class="eyebrow">Creator Leaderboard</div>
    <h1>Who is actually converting.</h1>
    <p class="sub">Inspect public receipts, referral output, and live wallet state before you follow anyone.</p>
  </div>
  <div class="podium">${cards}</div>
</div>
</body>
</html>`;
}

export function renderCreatorSpotlightPage(payload: {
  displayName: string;
  telegramUserId: string;
  referralCount: number;
  referralEarnedUsdc: number;
  tradeCount: number;
  grossAmountUsdc: number;
  liveBalanceUsdc: number;
  livePositionsCount: number;
  recentTrades: Array<{ title: string; amount: number | null; eventType: string }>;
  snapshotLabel?: string;
}): string {
  const recent = payload.recentTrades.length
    ? payload.recentTrades
        .slice(0, 8)
        .map((trade) => `<li><strong>${escapeHtml(trade.title)}</strong> · ${escapeHtml(trade.eventType)} · ${trade.amount != null ? `$${trade.amount.toFixed(2)}` : "-"}</li>`)
        .join("")
    : "<li>No public receipts yet.</li>";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.displayName)} · Luna Creator</title>
    <style>
      :root{--bg:#08111b;--card:rgba(14,24,40,.9);--line:rgba(255,255,255,.08);--text:#f5f7fb;--muted:#9eb0c7;--accent:#7cf2c5}
      *{box-sizing:border-box} body{margin:0;color:var(--text);font-family:ui-sans-serif,system-ui,sans-serif;background:radial-gradient(circle at top left,rgba(124,242,197,.16),transparent 24%),linear-gradient(180deg,#070f19 0%,#03060c 100%)}
      main{max-width:1040px;margin:0 auto;padding:48px 20px 80px}.hero,.card{background:var(--card);border:1px solid var(--line);border-radius:24px}
      .hero{padding:28px;margin-bottom:18px}.muted{color:var(--muted);line-height:1.7}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
      .card{padding:20px}.metric{font-size:30px;font-weight:800}.cta{display:inline-flex;padding:12px 16px;border-radius:999px;background:linear-gradient(135deg,var(--accent),#d7ffea);color:#03150f;text-decoration:none;font-weight:700}
      ul{margin:0;padding-left:18px;line-height:1.7;color:var(--muted)}
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>${escapeHtml(payload.displayName)}</h1>
        <p class="muted">Inspect this creator through public receipts, referral conversion, and cached wallet state. ${payload.snapshotLabel ? escapeHtml(payload.snapshotLabel) : ""}</p>
        <a class="cta" href="/share/${encodeURIComponent(payload.telegramUserId)}">Open public scorecard</a>
      </section>
      <section class="grid">
        <article class="card"><div class="muted">Referrals</div><div class="metric">${payload.referralCount}</div></article>
        <article class="card"><div class="muted">Referral earnings</div><div class="metric">$${payload.referralEarnedUsdc.toFixed(2)}</div></article>
        <article class="card"><div class="muted">Public receipts</div><div class="metric">${payload.tradeCount}</div></article>
        <article class="card"><div class="muted">Gross traded</div><div class="metric">$${payload.grossAmountUsdc.toFixed(2)}</div></article>
        <article class="card"><div class="muted">Cached balance</div><div class="metric">$${payload.liveBalanceUsdc.toFixed(2)}</div></article>
        <article class="card"><div class="muted">Open positions</div><div class="metric">${payload.livePositionsCount}</div></article>
      </section>
      <section class="hero">
        <h2>Recent public receipts</h2>
        <ul>${recent}</ul>
      </section>
    </main>
  </body>
</html>`;
}

export function renderDiscoverPage(payload: {
  topSignals: Array<{ title: string; score: number; action?: string | null; expiry?: string | null }>;
  sportsSignals: Array<{ title: string; score: number; action?: string | null; expiry?: string | null }>;
  wallets: Array<{ name: string; score: number; specialty?: string | null }>;
}): string {
  function scoreColor(score: number): string {
    if (score >= 90) return "#3dffa0";
    if (score >= 75) return "#ffd166";
    return "#ff9f6b";
  }
  function scoreBg(score: number): string {
    if (score >= 90) return "rgba(61,255,160,.12)";
    if (score >= 75) return "rgba(255,209,102,.12)";
    return "rgba(255,159,107,.12)";
  }
  const signalCards = payload.topSignals.length
    ? payload.topSignals.map((signal) => {
        const pct = Math.min(100, signal.score);
        const col = scoreColor(signal.score);
        const bg = scoreBg(signal.score);
        return `<div class="sig-card">
  <div class="sig-score" style="color:${col};background:${bg}">${signal.score}</div>
  <div class="sig-title">${escapeHtml(signal.title)}</div>
  <div class="sig-action">${escapeHtml(signal.action ?? "—")}</div>
  <div class="score-bar"><div class="score-fill" style="width:${pct}%;background:${col}"></div></div>
  ${signal.expiry ? `<div class="sig-expiry">⏰ ${escapeHtml(signal.expiry)}</div>` : ""}
</div>`;
      }).join("")
    : `<div class="sig-card"><div class="sig-title muted">No signals yet</div><div class="sig-action">Runtime signals will appear here after the next refresh.</div></div>`;
  const sportsCards = payload.sportsSignals.length
    ? payload.sportsSignals.map((signal) => {
        const col = scoreColor(signal.score);
        const bg = scoreBg(signal.score);
        return `<div class="sig-card sports-card">
  <div class="sig-score" style="color:${col};background:${bg}">⚽ ${signal.score}</div>
  <div class="sig-title">${escapeHtml(signal.title)}</div>
  <div class="sig-action">${escapeHtml(signal.action ?? "—")}</div>
  ${signal.expiry ? `<div class="sig-expiry">⏰ ${escapeHtml(signal.expiry)}</div>` : ""}
</div>`;
      }).join("")
    : `<div class="sig-card"><div class="sig-title muted">No sports signals yet</div></div>`;
  const walletCards = payload.wallets.length
    ? payload.wallets.map((wallet, index) => `<div class="wallet-row">
  <div class="wallet-rank">${index + 1}</div>
  <div class="wallet-info">
    <div class="wallet-name">${escapeHtml(wallet.name)}</div>
    <div class="wallet-spec">${escapeHtml(wallet.specialty ?? "Mixed markets")}</div>
  </div>
  <div class="wallet-score" style="color:${scoreColor(wallet.score)}">${wallet.score}</div>
</div>`).join("")
    : `<div class="wallet-row"><div class="wallet-name muted">No wallet profiles yet</div></div>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Luna Discover — Today's Best Trades</title>
  <meta name="description" content="Today's best Polymarket trades, sports catalysts, and smart-money wallets — updated in real-time via WebSocket feeds."/>
  <meta property="og:title" content="Luna AI — Discover Today's Best Trades"/>
  <meta property="og:description" content="Top signals, sports window, and smart money wallet rankings — all real-time."/>
  <meta name="twitter:card" content="summary"/>
  <style>
    :root{--bg:#060c16;--card:rgba(10,18,32,.9);--line:rgba(255,255,255,.07);--text:#f0f4ff;--muted:#7a90aa;--accent:#3dffa0}
    *{box-sizing:border-box;margin:0;padding:0}
    body{color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);min-height:100vh}
    .bg{position:fixed;inset:0;pointer-events:none;overflow:hidden}
    .bg::before{content:'';position:absolute;top:-150px;right:-100px;width:500px;height:500px;background:radial-gradient(circle,rgba(61,255,160,.09),transparent 65%);border-radius:50%}
    .shell{position:relative;z-index:1;max-width:1160px;margin:0 auto;padding:32px 24px 80px}
    nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px;padding-bottom:20px;border-bottom:1px solid var(--line)}
    .nav-logo{font-size:16px;font-weight:800;color:var(--accent);text-decoration:none}
    .nav-cta{padding:9px 18px;border-radius:999px;background:var(--accent);color:#031a0d;font-weight:700;font-size:13px;text-decoration:none}
    .page-hero{margin-bottom:40px}
    .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:var(--accent);margin-bottom:10px}
    h1{font-size:clamp(30px,5vw,48px);font-weight:900;letter-spacing:-.03em;line-height:1.05}
    .sub{color:var(--muted);font-size:16px;margin-top:10px}
    .section-label{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin:36px 0 16px;display:flex;align-items:center;gap:8px}
    .section-label::after{content:'';flex:1;height:1px;background:var(--line)}
    .sig-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
    .sig-card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px;transition:border-color .2s}
    .sig-card:hover{border-color:rgba(61,255,160,.25)}
    .sports-card{border-color:rgba(255,209,102,.15)}
    .sports-card:hover{border-color:rgba(255,209,102,.35)}
    .sig-score{display:inline-flex;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;margin-bottom:10px}
    .sig-title{font-size:15px;font-weight:700;line-height:1.35;margin-bottom:6px}
    .sig-action{font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:10px}
    .sig-expiry{font-size:11px;color:var(--muted)}
    .score-bar{height:3px;background:rgba(255,255,255,.06);border-radius:999px;margin-bottom:8px;overflow:hidden}
    .score-fill{height:100%;border-radius:999px;transition:width .4s}
    .wallet-list{background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden}
    .wallet-row{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--line)}
    .wallet-row:last-child{border-bottom:0}
    .wallet-rank{font-size:18px;font-weight:900;color:var(--muted);width:28px;flex-shrink:0;text-align:center}
    .wallet-info{flex:1;min-width:0}
    .wallet-name{font-weight:700;font-size:14px}
    .wallet-spec{font-size:12px;color:var(--muted);margin-top:2px}
    .wallet-score{font-size:16px;font-weight:800;flex-shrink:0}
    .cta-bar{margin-top:48px;text-align:center;padding:32px;background:var(--card);border:1px solid var(--line);border-radius:24px}
    .cta-bar h2{font-size:22px;font-weight:800;margin-bottom:10px}
    .cta-bar p{color:var(--muted);font-size:14px;margin-bottom:20px}
    .btn{display:inline-flex;padding:13px 24px;border-radius:999px;background:linear-gradient(135deg,var(--accent),#a0ffda);color:#031a0d;font-weight:700;font-size:14px;text-decoration:none}
    .muted{color:var(--muted)}
  </style>
</head>
<body>
<div class="bg"></div>
<div class="shell">
  <nav>
    <a class="nav-logo" href="/">🌙 Luna AI</a>
    <a class="nav-cta" href="https://t.me/GetLunaAIBot">Open Bot →</a>
  </nav>
  <div class="page-hero">
    <div class="eyebrow">Updated via real-time WebSocket</div>
    <h1>Today's best trades.</h1>
    <p class="sub">Signals ranked by Smart Score — higher is stronger conviction. Sports signals tagged separately.</p>
  </div>

  <div class="section-label">📈 Top trades</div>
  <div class="sig-grid">${signalCards}</div>

  <div class="section-label">⚽ Sports window</div>
  <div class="sig-grid">${sportsCards}</div>

  <div class="section-label">🏆 Smart money wallets</div>
  <div class="wallet-list">${walletCards}</div>

  <div class="cta-bar">
    <h2>Copy these trades in one tap.</h2>
    <p>Open @GetLunaAIBot → /discover → tap any signal → done. Gasless via Polymarket Relayer.</p>
    <a class="btn" href="https://t.me/GetLunaAIBot">🤖 Open @GetLunaAIBot</a>
  </div>
</div>
</body>
</html>`;
}

export function renderCreatorSpotlight(
  user: UserRecord,
  payload: {
    displayName: string;
    telegramUserId: string;
    referralCount: number;
    referralEarnedUsdc: number;
    tradeCount: number;
    grossAmountUsdc: number;
    liveBalanceUsdc: number;
    livePositionsCount: number;
    livePositionValueUsdc: number;
    liveUnrealizedPnlUsdc: number;
    recentTrades: Array<{ title: string; amount: number | null; eventType: string }>;
    snapshotLabel?: string;
  },
): string {
  const lang = user.language;
  const recent = payload.recentTrades.length
    ? payload.recentTrades
        .slice(0, 5)
        .map((trade) => `• ${escapeHtml(trade.title)} · ${escapeHtml(trade.eventType)} · ${trade.amount != null ? `$${trade.amount.toFixed(2)}` : "-"}`)
        .join("\n")
    : t(lang, "receipts.no_trades");
  const pnlSign = payload.liveUnrealizedPnlUsdc >= 0 ? "+" : "";
  return `📣 <b>${t(lang, "creators.profile_title")}</b>\n\n<b>${escapeHtml(payload.displayName)}</b>\nID：<code>${escapeHtml(payload.telegramUserId)}</code>\n\n👥 Referrals：<b>${payload.referralCount}</b>\n💸 Referral earned：<b>$${payload.referralEarnedUsdc.toFixed(4)}</b>\n📈 Receipts：<b>${payload.tradeCount}</b>\n🔄 Gross traded：<b>$${payload.grossAmountUsdc.toFixed(2)}</b>\n\n${t(lang, "creators.live_balance")}：<b>$${payload.liveBalanceUsdc.toFixed(2)}</b>\n${t(lang, "creators.live_positions")}：<b>${payload.livePositionsCount}</b>\n${t(lang, "creators.position_value")}：<b>$${payload.livePositionValueUsdc.toFixed(2)}</b>\n${t(lang, "creators.unrealized")}：<b>${pnlSign}$${payload.liveUnrealizedPnlUsdc.toFixed(2)}</b>${payload.snapshotLabel ? `\n🕒 ${escapeHtml(payload.snapshotLabel)}` : ""}\n\n<b>Why follow this creator?</b>\n• Public receipts and live wallet state are both visible\n• Referral output proves real conversion, not just posting\n• Gross traded shows repeat execution, not one lucky fill\n\n<b>${t(lang, "receipts.recent_trades")}</b>\n${recent}\n\n${t(lang, "creators.share_hint")}`;
}

export function renderPnlSnapshot(
  user: UserRecord,
  payload: {
    balanceUsdc: number;
    positionsCount: number;
    positionValueUsdc: number;
    unrealizedPnlUsdc: number;
    tradeCount?: number;
    grossAmountUsdc?: number;
    platformFeeUsdc?: number;
    referralCount?: number;
    referralEarnedUsdc?: number;
    publicShareUrl: string;
    snapshotLabel?: string;
  },
): string {
  const lang = user.language;
  const sign = payload.unrealizedPnlUsdc >= 0 ? "+" : "";
  return `📈 <b>${t(lang, "pnl.title")}</b>\n\n${t(lang, "pnl.balance")}：<b>$${payload.balanceUsdc.toFixed(2)}</b>\n${t(lang, "pnl.positions")}：<b>${payload.positionsCount}</b>\n${t(lang, "pnl.position_value")}：<b>$${payload.positionValueUsdc.toFixed(2)}</b>\n${t(lang, "pnl.unrealized")}：<b>${sign}$${payload.unrealizedPnlUsdc.toFixed(2)}</b>\n📊 Public receipts：<b>${Number(payload.tradeCount ?? 0)}</b>\n🔄 Gross traded：<b>$${Number(payload.grossAmountUsdc ?? 0).toFixed(2)}</b>\n💸 Fees paid：<b>$${Number(payload.platformFeeUsdc ?? 0).toFixed(2)}</b>\n👥 Referrals：<b>${Number(payload.referralCount ?? 0)}</b>\n🎁 Referral earned：<b>$${Number(payload.referralEarnedUsdc ?? 0).toFixed(4)}</b>${payload.snapshotLabel ? `\n🕒 ${escapeHtml(payload.snapshotLabel)}` : ""}\n\nThis is your public scorecard. Share it when you want people to inspect real wallet state, receipts, and conversion.\n\n<code>${escapeHtml(payload.publicShareUrl)}</code>`;
}

export function renderSignalList(user: UserRecord, signals: RuntimeSignal[]): string {
  const lang = user.language;
  const visible = signals.filter((signal) => user.sports_enabled || signal.sports === 0);
  const body = visible
    .map((signal) => `${signal.id}. 📈 ${pickLang(signal, "title", lang)}\n   ${pickLang(signal, "action", lang)} · 🏆 ${signal.score}`)
    .join("\n");
  return `📋 <b>${t(lang, "signals.title")}</b>\n\n${t(lang, "signals.intro")}\n\n${body}\n\n${t(lang, "signals.reply_hint")}`;
}

export function renderWorldCupHub(user: UserRecord, signals: RuntimeSignal[], wallets: RuntimeWalletProfile[]): string {
  const lang = user.language;
  const sportsSignals = signals
    .filter((signal) => signal.sports === 1)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
  const specialistWallets = wallets.filter(isSportsWallet).slice(0, 5);

  const topSignals = sportsSignals.length
    ? sportsSignals.map((signal) => `#${signal.id} ${pickLang(signal, "title", lang)} · ${signal.selected_outcome ?? "-"} · 🏆 ${signal.score}`).join("\n")
    : t(lang, "worldcup.no_signals");
  const topWallets = specialistWallets.length
    ? specialistWallets.map((wallet) => `${wallet.name} · ${wallet.grade}${wallet.score} · ${pickLang(wallet, "specialty", lang)}`).join("\n")
    : t(lang, "worldcup.no_wallets");
  return `⚽ <b>${t(lang, "worldcup.title")}</b>\n\n${t(lang, "worldcup.intro")}\n\n<b>${t(lang, "worldcup.top_signals")}</b>\n${topSignals}\n\n<b>${t(lang, "worldcup.specialist_wallets")}</b>\n${topWallets}\n\n${t(lang, "worldcup.one_tap")}`;
}

export function renderSportsSignalList(user: UserRecord, signals: RuntimeSignal[]): string {
  const lang = user.language;
  const sportsSignals = signals
    .filter((signal) => signal.sports === 1)
    .sort((left, right) => right.score - left.score);
  const body = sportsSignals.length
    ? sportsSignals
        .map((signal) => `${signal.id}. ⚽ ${pickLang(signal, "title", lang)}\n   ${pickLang(signal, "action", lang)} · 🏆 ${signal.score} · ⏰ ${pickLang(signal, "expiry", lang)}`)
        .join("\n")
    : t(lang, "worldcup.no_sports_signals");
  return `⚽ <b>${t(lang, "worldcup.sports_signals_title")}</b>\n\n${t(lang, "worldcup.sports_signals_intro")}\n\n${body}`;
}

export function renderSignalDetail(user: UserRecord, signal: RuntimeSignal): string {
  const lang = user.language;
  return `🟢 <b>#${signal.id}</b> · Smart Score ${signal.score}\n\n<b>${pickLang(signal, "title", lang)}</b>\n\n<b>${t(lang, "signal.trade")}</b>\n${pickLang(signal, "action", lang)}\n${t(lang, "signal.expected")}：${signal.expected_return} · ${t(lang, "signal.daily")}：${signal.daily_return}\n\n<b>${t(lang, "signal.market")}</b>\n${t(lang, "signal.price")}：${signal.current_price} · ${t(lang, "signal.liquidity")}：${signal.liquidity}\n${t(lang, "signal.expiry")}：${pickLang(signal, "expiry", lang)}\n\n<b>${t(lang, "signal.why")}</b>\n${pickLang(signal, "analysis", lang)}\n\n<b>${t(lang, "signal.source")}</b>\n${signal.source_count}\n<b>${t(lang, "signal.outcome")}</b>\n${pickLang(signal, "status", lang) || t(lang, "signal.open")}`;
}

export function renderWallet(user: UserRecord, wallet: { address: string; balanceUsdc: number; positionsCount: number; openOrders: number; snapshotLabel?: string }): string {
  const lang = user.language;
  return `💼 <b>${t(lang, "wallet.title")}</b>\n\n${t(lang, "wallet.balance")}：<b>${wallet.balanceUsdc.toFixed(2)} USDC</b>\n${t(lang, "wallet.positions_count")}：<b>${wallet.positionsCount}</b>\n${t(lang, "wallet.open_orders")}：<b>${wallet.openOrders}</b>\n${t(lang, "wallet.trading_wallet")}：<code>${wallet.address}</code>${wallet.snapshotLabel ? `\n🕒 ${escapeHtml(wallet.snapshotLabel)}` : ""}\n\n⚡ Gas：<b>0</b> via Polymarket Relayer\n🔁 Funding：<b>External wallet only</b>\n💸 Withdrawals：<b>External wallet only</b>\n\n${t(lang, "wallet.hint")}`;
}

export function renderWalletConnectPrompt(user: UserRecord): string {
  const lang = user.language;
  return `🔐 <b>${t(lang, "connect.title")}</b>\n\n${t(lang, "connect.intro")}`;
}

export function renderConnectInstructions(user: UserRecord): string {
  const lang = user.language;
  return `🔐 <b>${t(lang, "connect.title")}</b>\n\n${t(lang, "connect.intro")}`;
}

export function renderWalletLinkedReadonly(user: UserRecord, account: UserTradingAccountRecord): string {
  const lang = user.language;
  const funder = account.funder_address ?? account.signer_address ?? "-";
  const label = account.account_label ?? (lang === "zh" ? "未命名" : lang === "ja" ? "無題" : lang === "ko" ? "미지정" : "Unlabeled");
  return `🧩 <b>${t(lang, "connect.title")} (read-only)</b>\n\n${t(lang, "wallet.trading_wallet")}：<code>${escapeHtml(funder)}</code>\n${t(lang, "label.account_status")}：<b>${escapeHtml(account.status)}</b>\n${account.deposit_address_evm ? `EVM：<code>${escapeHtml(account.deposit_address_evm)}</code>\n` : ""}\n${t(lang, "connect.readonly")}`;
}

export function renderSafeOnboardingPortal(payload: {
  token: string;
  appName: string;
  telegramUserId: string;
  remoteSignerUrl: string;
  completionUrl: string;
  configUrl: string;
  builderSettingsUrl: string;
  relayerHost: string;
  safeOnboardingUrl?: string;
}): string {
  const primaryUrl = payload.safeOnboardingUrl ?? "https://github.com/Polymarket/wagmi-safe-builder-example";
  const geoblockCallbackUrl = `/safe/${encodeURIComponent(payload.token)}/geoblock`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.appName)} Safe Onboarding</title>
    <style>
      body { margin:0; padding:32px; background:#07101d; color:#eef5ff; font-family:ui-sans-serif,system-ui,sans-serif; }
      .card { max-width:840px; margin:0 auto; background:rgba(12,18,31,.92); border:1px solid rgba(255,255,255,.1); border-radius:24px; padding:28px; }
      h1 { margin-top:0; }
      p, li { color:#b7c4d9; line-height:1.6; }
      code { display:block; padding:10px 12px; border-radius:12px; background:rgba(255,255,255,.05); color:#d9fff1; word-break:break-all; }
      a.cta { display:inline-block; margin-top:16px; padding:12px 18px; border-radius:999px; background:#7cf2c5; color:#03150f; text-decoration:none; font-weight:700; }
      .meta { display:grid; gap:10px; margin:18px 0; }
      .badge { display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:999px; font-weight:700; }
      .badge.warn { background:rgba(255,203,107,.12); color:#ffdf9b; border:1px solid rgba(255,203,107,.22); }
      .badge.good { background:rgba(124,242,197,.12); color:#b9ffe6; border:1px solid rgba(124,242,197,.22); }
      .badge.bad { background:rgba(255,138,138,.12); color:#ffd0d0; border:1px solid rgba(255,138,138,.28); }
      .panel { margin-top:18px; padding:16px 18px; border-radius:16px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); }
      .small { font-size:13px; color:#93a5c3; }
      .cta.disabled { opacity:.45; pointer-events:none; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>🛡 Safe Onboarding</h1>
      <p>This session reserves the official Builder + Safe onboarding path for Telegram user <code>${escapeHtml(payload.telegramUserId)}</code>.</p>
      <ul>
        <li>Use a browser wallet such as MetaMask or Rabby.</li>
        <li>Deploy or connect a Safe / Proxy wallet using the Polymarket Builder relayer flow.</li>
        <li>Use the remote signer endpoint below for builder attribution headers.</li>
        <li>Do not paste private keys into Telegram. This replaces the old ad-hoc path.</li>
        <li>Builder credentials come from <code>polymarket.com/settings?tab=builder</code>, not from the public builders leaderboard.</li>
      </ul>
      <div class="meta">
        <div id="geo-status" class="badge warn">Checking Polymarket geoblock status…</div>
      </div>
      <div id="geo-panel" class="panel small">
        Luna follows the official Polymarket integration reference: geoblock is checked before trading is initialized. Restricted users should stay in read-only mode.
      </div>
      <p><b>Remote signer endpoint</b></p>
      <code>${escapeHtml(payload.remoteSignerUrl)}</code>
      <p><b>Structured config JSON</b></p>
      <code>${escapeHtml(payload.configUrl)}</code>
      <p><b>Completion callback</b></p>
      <code>${escapeHtml(payload.completionUrl)}</code>
      <p><b>Builder settings</b></p>
      <code>${escapeHtml(payload.builderSettingsUrl)}</code>
      <p><b>Relayer host</b></p>
      <code>${escapeHtml(payload.relayerHost)}</code>
      <p><b>Suggested official reference</b></p>
      <code>${escapeHtml(primaryUrl)}</code>
      <a id="open-safe-flow" class="cta" href="${escapeHtml(primaryUrl)}" target="_blank" rel="noreferrer">Open Safe Builder Flow</a>
      <p style="margin-top:18px">This page is a controlled handoff into the official Safe / Builder path. Once the user completes onboarding, the frontend should POST the resulting addresses and user API credentials to the completion callback so Luna can mark the account as <code>safe_builder</code>.</p>
      <script>
        const statusNode = document.getElementById("geo-status");
        const panelNode = document.getElementById("geo-panel");
        const ctaNode = document.getElementById("open-safe-flow");

        const setState = (kind, text, body) => {
          statusNode.className = "badge " + kind;
          statusNode.textContent = text;
          if (body) panelNode.textContent = body;
          if (kind === "bad") ctaNode.classList.add("disabled");
          else ctaNode.classList.remove("disabled");
        };

        const persist = async (payload) => {
          try {
            await fetch(${JSON.stringify(geoblockCallbackUrl)}, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
          } catch (_) {}
        };

        const bodyText = (payload) => {
          const country = payload.country || "Unknown";
          const region = payload.region || "Unknown";
          return "Country: " + country + " · Region: " + region + ". If this user is blocked, Luna should remain read-only and skip trading initialization.";
        };

        fetch("https://polymarket.com/api/geoblock", { credentials: "omit" })
          .then((response) => response.json())
          .then(async (payload) => {
            await persist({
              blocked: Boolean(payload.blocked),
              country: payload.country ?? null,
              region: payload.region ?? null,
            });
            if (payload.blocked) {
              setState("bad", "Trading blocked in this region", bodyText(payload));
            } else {
              setState("good", "Region clear for trading initialization", bodyText(payload));
            }
          })
          .catch(async () => {
            await persist({ blocked: null, country: null, region: null });
            setState("warn", "Geoblock check unavailable", "Polymarket geoblock check could not be completed from this browser. Keep the account in read-only mode until the check succeeds.");
          });
      </script>
    </main>
  </body>
</html>`;
}

export function renderTradingBlocked(user: UserRecord, reason: string): string {
  return `⛔ <b>${t(user.language, "trading.blocked")}</b>\n\n${escapeHtml(reason)}`;
}

export function renderPositions(user: UserRecord, positions: LivePosition[]): string {
  const lang = user.language;
  if (!positions.length) {
    return `📊 <b>${t(lang, "positions.title")}</b>\n\n${t(lang, "positions.none")}`;
  }
  const lines = positions.slice(0, 5).map((position, index) =>
    `${index + 1}. ${position.title}\n   🎯 ${position.outcome} · ${position.size.toFixed(2)} ${t(lang, "positions.shares")}\n   💵 ${t(lang, "positions.current_value")}：$${position.currentValue.toFixed(2)} · P&L：${position.cashPnl >= 0 ? "+" : ""}${position.cashPnl.toFixed(2)}`
  );
  return `📊 <b>${t(lang, "positions.title")}</b>\n\n${lines.join("\n\n")}`;
}

export function renderPositionDetail(user: UserRecord, position: LivePosition): string {
  const lang = user.language;
  const pnl = `${position.cashPnl >= 0 ? "+" : ""}${position.cashPnl.toFixed(2)} (${position.percentPnl.toFixed(1)}%)`;
  return `📊 <b>${t(lang, "position.detail_title")}</b>\n\n${position.title}\n\n🎯 ${t(lang, "position.side")}：${position.outcome}\n📦 ${t(lang, "positions.shares")}：${position.size.toFixed(2)}\n💵 ${t(lang, "position.entry")}：${Math.round(position.avgPrice * 100)}¢\n💵 ${t(lang, "position.current")}：${Math.round(position.curPrice * 100)}¢\n💵 ${t(lang, "position.value")}：$${position.currentValue.toFixed(2)}\n📈 P&L：${pnl}`;
}

export function renderLeaderboard(user: UserRecord, wallets: RuntimeWalletProfile[], tracked: string[]): string {
  const lang = user.language;
  const top = wallets.slice(0, 12);
  const trackedSet = new Set(tracked.map((item) => item.toLowerCase()));
  const lines = top.map((wallet) => {
    const marker = trackedSet.has(wallet.address.toLowerCase()) ? "🎯 " : "";
    return `${marker}<b>${wallet.name}</b> · ${wallet.grade}${wallet.score} · ROI ${wallet.roi_30d} · ${t(lang, "leaderboard.win")} ${wallet.win_rate_30d}`;
  });
  return `🏆 <b>${t(lang, "leaderboard.title")}</b>\n\n${lines.join("\n")}\n\n${t(lang, "leaderboard.track_hint")}`;
}

export function renderSportsLeaderboard(user: UserRecord, wallets: RuntimeWalletProfile[], tracked: string[]): string {
  const lang = user.language;
  const sportsWallets = wallets.filter(isSportsWallet).slice(0, 12);
  const trackedSet = new Set(tracked.map((item) => item.toLowerCase()));
  const lines = sportsWallets.map((wallet) => {
    const marker = trackedSet.has(wallet.address.toLowerCase()) ? "🎯 " : "";
    const specialty = pickLang(wallet, "specialty", lang);
    return `${marker}<b>${wallet.name}</b> · ${wallet.grade}${wallet.score} · ROI ${wallet.roi_30d} · ${specialty}`;
  });
  return `⚽ <b>${t(lang, "leaderboard.sports_title")}</b>\n\n${lines.join("\n") || t(lang, "leaderboard.no_sports")}`;
}

export function renderTrackRecord(user: UserRecord, summary: { total: number; won: number; lost: number; open: number; settled: number; win_rate: number; recent_settled: Array<{ title_en?: string; title_zh?: string; status_en?: string; status_zh?: string }>; }): string {
  const lang = user.language;
  const recent = summary.recent_settled.map((item) => {
    const title = pickLang(item, "title", lang);
    const status = pickLang(item, "status", lang);
    const icon = status === "Won" || status === "已赢" ? "✅" : "❌";
    return `${icon} ${title}`;
  }).join("\n");
  return `📈 <b>${t(lang, "trackrecord.title")}</b>\n\n${t(lang, "trackrecord.win_rate")}：<b>${summary.win_rate.toFixed(1)}%</b>\n${t(lang, "trackrecord.tracked")}：${summary.total}\n${t(lang, "trackrecord.settled")}：${summary.settled} · ${t(lang, "trackrecord.open")}：${summary.open}\n${t(lang, "trackrecord.won")}：${summary.won} · ${t(lang, "trackrecord.lost")}：${summary.lost}\n\n<b>${t(lang, "trackrecord.recent")}</b>\n${recent || t(lang, "trackrecord.no_settled")}`;
}

export function renderCopyPrompt(user: UserRecord, signal: RuntimeSignal, balanceUsdc: number, fee: FeePreview): string {
  const lang = user.language;
  const title = pickLang(signal, "title", lang);
  // New layout: Trade amount + Fee = Total cost (fee is extra, not deducted from trade)
  return `⚡ <b>${t(lang, "copy.title")}</b>\n\n${title}\n${t(lang, "position.side")}：${signal.selected_outcome ?? "-"}\n${t(lang, "copy.available")}：<b>${balanceUsdc.toFixed(2)} USDC</b>\n\n${t(lang, "copy.trade_amount")}：<b>$${fee.netTradeAmountUsdc.toFixed(2)}</b>\n${t(lang, "copy.fee")}：<b>$${fee.platformFeeUsdc.toFixed(2)}</b> (${(fee.feeBps / 100).toFixed(2)}%)\n${t(lang, "copy.total_cost")}：<b>$${fee.grossAmountUsdc.toFixed(2)}</b>\n\n${t(lang, "copy.hint")}`;
}

export function renderTradeResult(
  user: UserRecord,
  action: "copy" | "close",
  title: string,
  outcome: string,
  amountOrShares: number,
  result: Record<string, unknown>,
  fee?: FeePreview,
): string {
  const lang = user.language;
  const orderId = String(result.orderId ?? result.orderID ?? "-");
  const txHash = String(result.txHash ?? result.transactionHash ?? "-");
  const header = action === "copy" ? t(lang, "trade.copy_success") : t(lang, "trade.close_success");
  const sizeLabel = action === "copy"
    ? `${t(lang, "copy.trade_amount")}：<b>$${amountOrShares.toFixed(2)}</b>`
    : `${t(lang, "positions.shares")}：<b>${amountOrShares.toFixed(2)}</b>`;
  // Show fee for both copy and close actions
  const feeLine = fee && fee.platformFeeUsdc > 0
    ? `${t(lang, "copy.fee")}：<b>$${fee.platformFeeUsdc.toFixed(2)}</b> (${(fee.feeBps / 100).toFixed(2)}%)\n`
    : "";
  return `✅ <b>${header}</b>\n\n${title}\n${t(lang, "position.side")}：${outcome}\n${sizeLabel}\n${feeLine}order: <code>${orderId}</code>\ntx: <code>${txHash}</code>`;
}

export function renderAccountReceipts(
  user: UserRecord,
  payload: {
    summary: {
      tradeCount: number;
      grossAmountUsdc: number;
      platformFeeUsdc: number;
      netTradeAmountUsdc: number;
      unsettledFeeUsdc: number;
      settledFeeUsdc: number;
      builderEventCount: number;
    };
    trades: Array<{
      event_type: string;
      title: string | null;
      outcome: string | null;
      amount_usdc: number | null;
      status: string;
      created_at: string;
    }>;
    fees: Array<{
      trade_event_type: string;
      platform_fee_usdc: number;
      net_trade_amount_usdc: number;
      status: string;
      settlement_tx_ref?: string | null;
      created_at: string;
    }>;
    builderEvents: Array<{
      action: string;
      builder_enabled: number;
      order_id: string | null;
      created_at: string;
    }>;
  },
): string {
  const lang = user.language;
  const tradeLines = payload.trades.length
    ? payload.trades.slice(0, 3).map((trade) => {
        const title = trade.title ?? t(lang, "receipts.untitled");
        const amount = trade.amount_usdc != null ? `$${trade.amount_usdc.toFixed(2)}` : "-";
        return `${trade.event_type === "close" ? "🧹" : "⚡"} ${escapeHtml(title)} · ${amount} · ${escapeHtml(trade.status)}`;
      }).join("\n")
    : t(lang, "receipts.no_trades");

  const feeLines = payload.fees.length
    ? payload.fees.slice(0, 3).map((fee) => {
        const ref = fee.settlement_tx_ref ? ` · ref ${escapeHtml(fee.settlement_tx_ref.slice(0, 12))}...` : "";
        const statusLabel =
          fee.status === "settled"
            ? t(lang, "receipts.settled")
            : fee.status === "accrued_unsettled"
              ? t(lang, "receipts.pending")
              : fee.status;
        return `${fee.trade_event_type === "close" ? "🧾 close" : "🧾 copy"} · fee $${fee.platform_fee_usdc.toFixed(2)} · net $${fee.net_trade_amount_usdc.toFixed(2)} · ${escapeHtml(statusLabel)}${ref}`;
      }).join("\n")
    : t(lang, "receipts.no_fees");

  const builderLines = payload.builderEvents.length
    ? payload.builderEvents.slice(0, 3).map((item) =>
        `${item.builder_enabled ? "🟢" : "⚪"} ${escapeHtml(item.action)}${item.order_id ? ` · ${escapeHtml(item.order_id)}` : ""}`,
      ).join("\n")
    : t(lang, "receipts.no_builder");

  const s = payload.summary;
  return `🧾 <b>${t(lang, "receipts.title")}</b>\n\n${t(lang, "receipts.trades")}：<b>${s.tradeCount}</b>\n${t(lang, "receipts.gross")}：<b>$${s.grossAmountUsdc.toFixed(2)}</b>\n${t(lang, "receipts.fees")}：<b>$${s.platformFeeUsdc.toFixed(2)}</b>\n${t(lang, "receipts.net")}：<b>$${s.netTradeAmountUsdc.toFixed(2)}</b>\n${t(lang, "receipts.unsettled")}：<b>$${s.unsettledFeeUsdc.toFixed(2)}</b>\n${t(lang, "receipts.settled_fees")}：<b>$${s.settledFeeUsdc.toFixed(2)}</b>\n${t(lang, "receipts.builder_events")}：<b>${s.builderEventCount}</b>\n\n<b>${t(lang, "receipts.recent_trades")}</b>\n${tradeLines}\n\n<b>${t(lang, "receipts.recent_fees")}</b>\n${feeLines}\n\n<b>${t(lang, "receipts.recent_builder")}</b>\n${builderLines}`;
}

export function renderSettlementSummary(
  user: UserRecord,
  settlements: Array<Record<string, unknown>>,
): string {
  const lang = user.language;
  if (!settlements.length) {
    return `🏁 <b>${t(lang, "settlements.title")}</b>\n\n${t(lang, "settlements.none")}`;
  }
  const lines = settlements.slice(0, 8).map((item) => {
    const status = String(item.settlement_status ?? "open");
    const icon = status === "resolved_won" ? "✅" : status === "resolved_lost" ? "❌" : "⏳";
    const title = String(item.title ?? item.market_slug ?? "Unknown market");
    const outcome = String(item.selected_outcome ?? "-");
    const winner = String(item.winning_outcome ?? "-");
    const redeemable = Number(item.redeemable_amount_usdc ?? 0);
    return `${icon} ${escapeHtml(title)}\n   ${t(lang, "settlements.my_side")}：${escapeHtml(outcome)} · ${t(lang, "settlements.winner")}：${escapeHtml(winner)} · ${t(lang, "settlements.redeemable")}：$${redeemable.toFixed(2)}`;
  }).join("\n\n");
  return `🏁 <b>${t(lang, "settlements.title")}</b>\n\n${lines}`;
}

function isSportsWallet(wallet: RuntimeWalletProfile): boolean {
  const haystack = `${wallet.specialty_zh} ${wallet.specialty_en} ${wallet.note_zh} ${wallet.note_en}`.toLowerCase();
  return ["sport", "soccer", "football", "world cup", "体育", "足球", "世界杯"].some((term) => haystack.includes(term));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
}

function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}
