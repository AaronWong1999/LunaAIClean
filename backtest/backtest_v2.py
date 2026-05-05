"""
Polymarket Smart Money Backtest V2
===================================
Expanded: Monthly top earners + category breakdown + recent trades focus

Key improvements over V1:
1. Use MONTHLY leaderboard (current hot wallets, not historical PnL whales)
2. More trades per wallet (200)
3. Category breakdown (sports vs politics vs crypto vs other)
4. Time filter: only trades from last 90 days
5. Track "consensus signals" - when multiple smart money wallets buy same direction
"""

import urllib.request
import json
import time
import sys
from datetime import datetime, timezone, timedelta

TRADE_API = "https://data-api.polymarket.com/trades"
MARKET_API = "https://gamma-api.polymarket.com/markets"
MIN_TRADE_USD = 1000
SIM_BET = 10

market_cache = {}
NINETY_DAYS_AGO = (datetime.now(timezone.utc) - timedelta(days=90)).timestamp()

# Monthly top earners from leaderboard (March 2026)
MONTHLY_TOP_WALLETS = [
    ("placeholder", "0x0000000000000000000000000000000000000000"),
]

# Also add top ALL-TIME wallets that aren't in monthly
ALLTIME_TOP_WALLETS = [
    ("placeholder2", "0x0000000000000000000000000000000000000001"),
]


def fetch_json(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            resp = urllib.request.urlopen(req, timeout=15)
            return json.loads(resp.read())
        except Exception as e:
            if i < retries - 1:
                time.sleep(2)
            else:
                return None


def get_trades(wallet, limit=100):
    url = f"{TRADE_API}?user={wallet}&limit={limit}"
    return fetch_json(url) or []


def get_market_resolution(slug):
    if slug in market_cache:
        return market_cache[slug]
    
    url = f"{MARKET_API}?slug={slug}"
    data = fetch_json(url)
    if not data:
        market_cache[slug] = (False, None, None, None)
        return (False, None, None, None)
    
    m = data[0]
    closed = m.get('closed', False)
    outcome_prices = m.get('outcomePrices')
    end_date = m.get('endDate', '')
    
    # Try to categorize market
    tags = m.get('tags', []) or []
    question = (m.get('question') or m.get('title') or '').lower()
    category = categorize_market(question, tags)
    
    if not closed or not outcome_prices:
        market_cache[slug] = (False, None, end_date, category)
        return (False, None, end_date, category)
    
    try:
        prices = [float(p) for p in (json.loads(outcome_prices) if isinstance(outcome_prices, str) else outcome_prices)]
    except:
        market_cache[slug] = (False, None, end_date, category)
        return (False, None, end_date, category)
    
    if len(prices) >= 2:
        winning_idx = 0 if prices[0] > prices[1] else 1
    else:
        market_cache[slug] = (False, None, end_date, category)
        return (False, None, end_date, category)
    
    market_cache[slug] = (True, winning_idx, end_date, category)
    return (True, winning_idx, end_date, category)


def categorize_market(question, tags):
    sports_kw = ['nba', 'nfl', 'mlb', 'nhl', 'epl', 'premier league', 'serie a', 'la liga',
                 'champions league', 'ufc', 'boxing', 'tennis', 'vs.', 'vs ', 'win on 202',
                 'spread:', 'total:', 'over/under', 'lakers', 'celtics', 'knicks', 'warriors',
                 'arsenal', 'chelsea', 'liverpool', 'manchester', 'barcelona', 'real madrid',
                 'pistons', 'heat', 'suns', 'hornets', 'nets', 'bulls', 'bucks', 'cavaliers',
                 'thunder', 'nuggets', 'wolves', 'timberwolves', 'spurs', 'rockets', 'magic',
                 'grizzlies', 'clippers', 'pacers', 'hawks', 'raptors', 'kings', 'blazers',
                 'pelicans', 'wizards', 'jazz', 'mavericks', '76ers', 'sixers',
                 'fc ', 'afc', 'tottenham', 'fulham', 'wolverhampton', 'napoli',
                 'lyon', 'paris', 'galatasaray', 'atalanta', 'bayern',
                 'counter-strike', 'esport', 'bo3', 'astralis', 'furia']
    politics_kw = ['trump', 'biden', 'president', 'election', 'congress', 'senate', 'republican',
                   'democrat', 'iran', 'ukraine', 'russia', 'china', 'tariff', 'ceasefire',
                   'cabinet', 'nominee', 'impeach', 'fed chair', 'government', 'regime',
                   'supreme leader', 'khamenei', 'war', 'strikes', 'sanctions']
    crypto_kw = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'sol',
                 'dogecoin', 'doge', 'xrp', 'token', 'defi']
    
    q = question.lower()
    for kw in sports_kw:
        if kw in q:
            return 'sports'
    for kw in politics_kw:
        if kw in q:
            return 'politics'
    for kw in crypto_kw:
        if kw in q:
            return 'crypto'
    return 'other'


def backtest_wallet(wallet, name, limit=200):
    trades = get_trades(wallet, limit)
    if not trades:
        return None
    
    results = {
        'name': name, 'wallet': wallet,
        'total_trades': 0, 'qualifying': 0, 'resolved': 0,
        'wins': 0, 'losses': 0, 'pending': 0, 'pnl': 0.0,
        'by_category': {},
        'details': []
    }
    
    for t in trades:
        results['total_trades'] += 1
        if t['side'] != 'BUY':
            continue
        
        usd_val = t['size'] * t['price']
        if usd_val < MIN_TRADE_USD:
            continue
        
        # Only recent trades (last 90 days)
        if t['timestamp'] < NINETY_DAYS_AGO:
            continue
        
        results['qualifying'] += 1
        
        slug = t['slug']
        outcome_idx = t['outcomeIndex']
        buy_price = t['price']
        ts = datetime.fromtimestamp(t['timestamp'], tz=timezone.utc)
        
        resolved, winning_idx, end_date, category = get_market_resolution(slug)
        
        if not resolved:
            results['pending'] += 1
            continue
        
        results['resolved'] += 1
        won = (outcome_idx == winning_idx)
        
        if won:
            pnl_pct = (1.0 - buy_price) / buy_price * 100
            sim_pnl = SIM_BET * (1.0 - buy_price) / buy_price
            results['wins'] += 1
        else:
            pnl_pct = -100.0
            sim_pnl = -SIM_BET
            results['losses'] += 1
        
        results['pnl'] += sim_pnl
        
        # Category tracking
        cat = category or 'other'
        if cat not in results['by_category']:
            results['by_category'][cat] = {'wins': 0, 'losses': 0, 'pnl': 0.0}
        results['by_category'][cat]['wins' if won else 'losses'] += 1
        results['by_category'][cat]['pnl'] += sim_pnl
        
        results['details'].append({
            'title': t['title'][:60], 'outcome': t['outcome'],
            'buy_price': buy_price, 'won': won, 'pnl_pct': pnl_pct,
            'sim_pnl': sim_pnl, 'usd_value': usd_val,
            'date': ts.strftime('%Y-%m-%d'), 'category': cat,
            'slug': slug,
        })
    
    return results


def find_consensus_signals(all_results):
    """Find markets where multiple smart money wallets bought the same direction"""
    market_signals = {}  # slug -> {outcome_idx: [traders]}
    
    for r in all_results:
        for d in r['details']:
            slug = d['slug']
            outcome = d['outcome']
            if slug not in market_signals:
                market_signals[slug] = {}
            if outcome not in market_signals[slug]:
                market_signals[slug][outcome] = []
            market_signals[slug][outcome].append({
                'trader': r['name'],
                'price': d['buy_price'],
                'won': d['won'],
                'pnl_pct': d['pnl_pct'],
                'usd': d['usd_value'],
                'title': d['title'],
                'category': d['category'],
            })
    
    # Filter: at least 2 wallets buying same direction
    consensus = []
    for slug, outcomes in market_signals.items():
        for outcome, traders in outcomes.items():
            if len(traders) >= 2:
                won = traders[0]['won']  # all same result
                consensus.append({
                    'slug': slug,
                    'title': traders[0]['title'],
                    'outcome': outcome,
                    'num_traders': len(traders),
                    'traders': [t['trader'] for t in traders],
                    'total_usd': sum(t['usd'] for t in traders),
                    'avg_price': sum(t['price'] for t in traders) / len(traders),
                    'won': won,
                    'pnl_pct': traders[0]['pnl_pct'],
                    'category': traders[0]['category'],
                })
    
    return sorted(consensus, key=lambda x: x['num_traders'], reverse=True)


def main():
    # Combine monthly + all-time, deduplicate by wallet
    seen = set()
    wallets = []
    for name, addr in MONTHLY_TOP_WALLETS + ALLTIME_TOP_WALLETS:
        if addr.lower() not in seen:
            seen.add(addr.lower())
            wallets.append((name, addr))
    
    print("=" * 80)
    print("POLYMARKET SMART MONEY BACKTEST V2")
    print(f"{len(wallets)} wallets (Monthly Top 20 + All-Time Top 13)")
    print(f"Filter: BUY >= ${MIN_TRADE_USD:,} | Last 90 days only | Sim: ${SIM_BET}/trade")
    print("=" * 80)
    print()
    
    all_results = []
    totals = {'wins': 0, 'losses': 0, 'pending': 0, 'pnl': 0.0, 'qualifying': 0}
    cat_totals = {}
    
    for i, (name, wallet) in enumerate(wallets):
        sys.stdout.write(f"\r[{i+1}/{len(wallets)}] Fetching {name:25s}...")
        sys.stdout.flush()
        
        r = backtest_wallet(wallet, name, 100)
        time.sleep(0.3)
        
        if not r or r['qualifying'] == 0:
            print(f"\r[{i+1}/{len(wallets)}] {name:25s} | No qualifying trades in last 90 days")
            continue
        
        wr = r['wins'] / r['resolved'] * 100 if r['resolved'] > 0 else 0
        cats = ', '.join(f"{c}:{d['wins']}/{d['wins']+d['losses']}" for c, d in r['by_category'].items())
        
        print(f"\r[{i+1}/{len(wallets)}] {name:25s} | Q:{r['qualifying']:3d} R:{r['resolved']:3d} "
              f"W:{r['wins']:3d} L:{r['losses']:3d} WR:{wr:5.1f}% PnL:${r['pnl']:+8.2f} | {cats}")
        
        all_results.append(r)
        totals['wins'] += r['wins']
        totals['losses'] += r['losses']
        totals['pending'] += r['pending']
        totals['pnl'] += r['pnl']
        totals['qualifying'] += r['qualifying']
        
        for cat, cd in r['by_category'].items():
            if cat not in cat_totals:
                cat_totals[cat] = {'wins': 0, 'losses': 0, 'pnl': 0.0}
            cat_totals[cat]['wins'] += cd['wins']
            cat_totals[cat]['losses'] += cd['losses']
            cat_totals[cat]['pnl'] += cd['pnl']
    
    total_resolved = totals['wins'] + totals['losses']
    overall_wr = totals['wins'] / total_resolved * 100 if total_resolved > 0 else 0
    
    print()
    print("=" * 80)
    print("OVERALL RESULTS (Last 90 Days)")
    print("=" * 80)
    print(f"Wallets with data:   {len(all_results)}")
    print(f"Qualifying trades:   {totals['qualifying']}")
    print(f"Resolved:            {total_resolved}")
    print(f"Pending:             {totals['pending']}")
    print(f"WINS:                {totals['wins']}")
    print(f"LOSSES:              {totals['losses']}")
    print(f"WIN RATE:            {overall_wr:.1f}%")
    print(f"Simulated PnL:       ${totals['pnl']:+.2f} (${SIM_BET}/trade)")
    if total_resolved > 0:
        print(f"Avg PnL/trade:       ${totals['pnl']/total_resolved:+.2f}")
        print(f"ROI:                 {totals['pnl']/(total_resolved*SIM_BET)*100:+.1f}%")
    
    print()
    print("=" * 80)
    print("BY CATEGORY")
    print("=" * 80)
    for cat in sorted(cat_totals.keys()):
        cd = cat_totals[cat]
        t = cd['wins'] + cd['losses']
        wr = cd['wins'] / t * 100 if t > 0 else 0
        roi = cd['pnl'] / (t * SIM_BET) * 100 if t > 0 else 0
        print(f"  {cat:12s} | Trades: {t:4d} | Win: {cd['wins']:4d} | Loss: {cd['losses']:4d} | "
              f"WR: {wr:5.1f}% | PnL: ${cd['pnl']:+9.2f} | ROI: {roi:+6.1f}%")
    
    # Consensus signals analysis
    print()
    print("=" * 80)
    print("CONSENSUS SIGNALS (2+ wallets same direction)")
    print("=" * 80)
    consensus = find_consensus_signals(all_results)
    
    if consensus:
        cons_wins = sum(1 for c in consensus if c['won'])
        cons_losses = sum(1 for c in consensus if not c['won'])
        cons_total = cons_wins + cons_losses
        cons_wr = cons_wins / cons_total * 100 if cons_total > 0 else 0
        
        print(f"Total consensus signals: {len(consensus)}")
        print(f"Win rate: {cons_wr:.1f}% ({cons_wins}W / {cons_losses}L)")
        print()
        
        for c in consensus[:15]:
            icon = "✅" if c['won'] else "❌"
            print(f"  {icon} [{c['num_traders']} wallets] {c['title']:50s} | {c['outcome']} @ {c['avg_price']:.3f} "
                  f"| ${c['total_usd']:>10,.0f} | {c['category']}")
            print(f"     Traders: {', '.join(c['traders'])}")
    
    # Top/bottom performers
    print()
    print("=" * 80)
    print("WALLET PERFORMANCE RANKING (by win rate, min 10 resolved trades)")
    print("=" * 80)
    ranked = sorted([r for r in all_results if r['resolved'] >= 10],
                    key=lambda x: x['wins']/x['resolved'] if x['resolved']>0 else 0, reverse=True)
    for r in ranked:
        wr = r['wins'] / r['resolved'] * 100 if r['resolved'] > 0 else 0
        print(f"  {r['name']:25s} | WR: {wr:5.1f}% | {r['wins']}W/{r['losses']}L | PnL: ${r['pnl']:+8.2f}")
    
    # Save
    save_data = {
        'summary': {
            'wallets': len(all_results),
            'qualifying': totals['qualifying'],
            'resolved': total_resolved,
            'pending': totals['pending'],
            'wins': totals['wins'], 'losses': totals['losses'],
            'win_rate': overall_wr,
            'pnl': totals['pnl'],
            'roi': totals['pnl']/(total_resolved*SIM_BET)*100 if total_resolved > 0 else 0,
        },
        'by_category': {cat: {
            'trades': cd['wins']+cd['losses'],
            'wins': cd['wins'], 'losses': cd['losses'],
            'win_rate': cd['wins']/(cd['wins']+cd['losses'])*100 if (cd['wins']+cd['losses'])>0 else 0,
            'pnl': cd['pnl'],
        } for cat, cd in cat_totals.items()},
        'consensus': consensus,
        'per_wallet': [{
            'name': r['name'], 'qualifying': r['qualifying'],
            'resolved': r['resolved'], 'wins': r['wins'], 'losses': r['losses'],
            'win_rate': r['wins']/r['resolved']*100 if r['resolved']>0 else 0,
            'pnl': r['pnl'], 'by_category': r['by_category'],
        } for r in all_results],
        'all_trades': [d for r in all_results for d in [dict(**dd, trader=r['name']) for dd in r['details']]],
    }
    
    with open('./backtest_v2_results.json', 'w') as f:
        json.dump(save_data, f, indent=2)
    print(f"\nResults saved to ./backtest_v2_results.json")


if __name__ == '__main__':
    main()
