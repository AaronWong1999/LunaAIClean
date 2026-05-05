"""
Polymarket Smart Money Backtest
================================
Goal: Answer "Does following smart money actually make money?"

Method:
1. Take top N smart money wallets from our 1,195 address list
2. Pull their recent trades (last 90 days)
3. For each BUY trade >= $1,000 (Alice's threshold):
   - Record: market, direction, buy price, timestamp
   - Look up market resolution (did Yes or No win?)
   - Calculate P&L if we followed at same price
4. Aggregate: win rate, average return, total P&L

Assumptions:
- We follow every BUY >= $1,000 with $10
- We hold to market resolution (no early exit)
- We buy at the same price as smart money (optimistic - real would be worse due to slippage)
"""

import urllib.request
import json
import time
import sys
from datetime import datetime, timezone

TRADE_API = "https://data-api.polymarket.com/trades"
MARKET_API = "https://gamma-api.polymarket.com/markets"
MIN_TRADE_SIZE_USD = 1000  # Alice's threshold
SIM_BET = 10  # simulate $10 per trade

# Cache for market resolutions
market_cache = {}

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
    """Get trades for a wallet, newest first"""
    url = f"{TRADE_API}?user={wallet}&limit={limit}"
    return fetch_json(url) or []

def get_market_resolution(slug):
    """Get market resolution. Returns (resolved, winning_outcome_index)"""
    if slug in market_cache:
        return market_cache[slug]
    
    url = f"{MARKET_API}?slug={slug}"
    data = fetch_json(url)
    if not data:
        market_cache[slug] = (False, None, None)
        return (False, None, None)
    
    m = data[0]
    closed = m.get('closed', False)
    outcome_prices = m.get('outcomePrices')
    end_date = m.get('endDate', '')
    
    if not closed or not outcome_prices:
        market_cache[slug] = (False, None, end_date)
        return (False, None, end_date)
    
    # outcomePrices: ["1","0"] means Yes won, ["0","1"] means No won
    try:
        prices = [float(p) for p in json.loads(outcome_prices) if p]
    except:
        prices = [float(p) for p in outcome_prices]
    
    if len(prices) >= 2:
        winning_idx = 0 if prices[0] > prices[1] else 1
    else:
        market_cache[slug] = (False, None, end_date)
        return (False, None, end_date)
    
    market_cache[slug] = (True, winning_idx, end_date)
    return (True, winning_idx, end_date)


def backtest_wallet(wallet, name, limit=100):
    """Backtest a single wallet's trades"""
    trades = get_trades(wallet, limit)
    if not trades:
        return None
    
    results = {
        'name': name,
        'wallet': wallet,
        'total_trades': 0,
        'qualifying_trades': 0,  # BUY >= $1K
        'resolved_trades': 0,
        'wins': 0,
        'losses': 0,
        'pending': 0,
        'total_pnl': 0.0,
        'details': []
    }
    
    # Filter: only BUY trades with size*price >= $1000
    for t in trades:
        results['total_trades'] += 1
        
        if t['side'] != 'BUY':
            continue
        
        usd_value = t['size'] * t['price']
        if usd_value < MIN_TRADE_SIZE_USD:
            continue
        
        results['qualifying_trades'] += 1
        
        slug = t['slug']
        outcome = t['outcome']  # "Yes" or "No"
        buy_price = t['price']
        outcome_idx = t['outcomeIndex']  # 0=Yes, 1=No
        ts = datetime.fromtimestamp(t['timestamp'], tz=timezone.utc)
        
        resolved, winning_idx, end_date = get_market_resolution(slug)
        
        if not resolved:
            results['pending'] += 1
            continue
        
        results['resolved_trades'] += 1
        
        # Did we win?
        won = (outcome_idx == winning_idx)
        
        if won:
            # Bought at buy_price, resolved at $1.00
            pnl_per_share = 1.0 - buy_price
            pnl_pct = pnl_per_share / buy_price * 100
            sim_pnl = SIM_BET * pnl_per_share / buy_price
            results['wins'] += 1
        else:
            # Bought at buy_price, resolved at $0.00
            pnl_per_share = -buy_price
            pnl_pct = -100.0
            sim_pnl = -SIM_BET
            results['losses'] += 1
        
        results['total_pnl'] += sim_pnl
        
        results['details'].append({
            'title': t['title'][:50],
            'outcome': outcome,
            'buy_price': buy_price,
            'won': won,
            'pnl_pct': pnl_pct,
            'sim_pnl': sim_pnl,
            'usd_value': usd_value,
            'date': ts.strftime('%Y-%m-%d'),
        })
    
    return results


def main():
    # Load smart money addresses
    with open('./polymarket_smart_money_addresses.json') as f:
        all_wallets = json.load(f)
    
    # Sort by PnL, take top N
    sorted_wallets = sorted(all_wallets, key=lambda x: x.get('best_pnl') or 0, reverse=True)
    
    TOP_N = 20  # Start with top 20
    TRADES_PER_WALLET = 50  # Last 50 trades each
    
    print(f"=" * 70)
    print(f"POLYMARKET SMART MONEY BACKTEST")
    print(f"Top {TOP_N} wallets by PnL · Last {TRADES_PER_WALLET} trades each")
    print(f"Filter: BUY trades >= ${MIN_TRADE_SIZE_USD:,} · Sim bet: ${SIM_BET}")
    print(f"=" * 70)
    print()
    
    all_results = []
    total_wins = 0
    total_losses = 0
    total_pending = 0
    total_pnl = 0.0
    total_qualifying = 0
    
    for i, w in enumerate(sorted_wallets[:TOP_N]):
        name = w.get('userName') or w['wallet'][:14]
        wallet = w['wallet']
        pnl = w.get('best_pnl') or 0
        
        sys.stdout.write(f"\r[{i+1}/{TOP_N}] Fetching {name}...")
        sys.stdout.flush()
        
        result = backtest_wallet(wallet, name, TRADES_PER_WALLET)
        time.sleep(0.5)  # rate limit
        
        if not result:
            print(f"\r[{i+1}/{TOP_N}] {name}: NO DATA")
            continue
        
        r = result
        win_rate = r['wins'] / r['resolved_trades'] * 100 if r['resolved_trades'] > 0 else 0
        
        print(f"\r[{i+1}/{TOP_N}] {name:20s} | Trades: {r['qualifying_trades']:3d} | Resolved: {r['resolved_trades']:3d} | "
              f"Win: {r['wins']:3d} | Loss: {r['losses']:3d} | Rate: {win_rate:5.1f}% | "
              f"Sim PnL: ${r['total_pnl']:+8.2f} | Leaderboard PnL: ${pnl:>12,.0f}")
        
        all_results.append(result)
        total_wins += r['wins']
        total_losses += r['losses']
        total_pending += r['pending']
        total_pnl += r['total_pnl']
        total_qualifying += r['qualifying_trades']
    
    # Summary
    total_resolved = total_wins + total_losses
    overall_win_rate = total_wins / total_resolved * 100 if total_resolved > 0 else 0
    
    print()
    print(f"=" * 70)
    print(f"OVERALL RESULTS")
    print(f"=" * 70)
    print(f"Wallets analyzed:    {len(all_results)}")
    print(f"Qualifying trades:   {total_qualifying} (BUY >= ${MIN_TRADE_SIZE_USD:,})")
    print(f"Resolved trades:     {total_resolved}")
    print(f"Pending:             {total_pending}")
    print(f"")
    print(f"WINS:                {total_wins}")
    print(f"LOSSES:              {total_losses}")
    print(f"WIN RATE:            {overall_win_rate:.1f}%")
    print(f"")
    print(f"Simulated PnL:       ${total_pnl:+.2f}")
    print(f"  (betting ${SIM_BET} on each qualifying trade)")
    print(f"Avg PnL per trade:   ${total_pnl/total_resolved:+.2f}" if total_resolved > 0 else "")
    print(f"ROI:                 {total_pnl / (total_resolved * SIM_BET) * 100:+.1f}%" if total_resolved > 0 else "")
    print(f"=" * 70)
    
    # Show best and worst individual trades
    all_details = []
    for r in all_results:
        for d in r['details']:
            d['trader'] = r['name']
            all_details.append(d)
    
    if all_details:
        print(f"\nTOP 5 BEST TRADES:")
        best = sorted([d for d in all_details if d['won']], key=lambda x: x['pnl_pct'], reverse=True)[:5]
        for d in best:
            print(f"  ✅ {d['trader']:15s} | {d['title']:40s} | {d['outcome']} @ {d['buy_price']:.3f} | +{d['pnl_pct']:.0f}% | ${d['usd_value']:,.0f}")
        
        print(f"\nTOP 5 WORST TRADES:")
        worst = sorted([d for d in all_details if not d['won']], key=lambda x: x['usd_value'], reverse=True)[:5]
        for d in worst:
            print(f"  ❌ {d['trader']:15s} | {d['title']:40s} | {d['outcome']} @ {d['buy_price']:.3f} | -100% | ${d['usd_value']:,.0f}")
    
    # Save full results
    with open('./backtest_results.json', 'w') as f:
        json.dump({
            'summary': {
                'wallets': len(all_results),
                'qualifying_trades': total_qualifying,
                'resolved_trades': total_resolved,
                'pending': total_pending,
                'wins': total_wins,
                'losses': total_losses,
                'win_rate': overall_win_rate,
                'total_pnl': total_pnl,
                'avg_pnl_per_trade': total_pnl / total_resolved if total_resolved > 0 else 0,
                'roi_pct': total_pnl / (total_resolved * SIM_BET) * 100 if total_resolved > 0 else 0,
            },
            'per_wallet': [{
                'name': r['name'],
                'qualifying': r['qualifying_trades'],
                'resolved': r['resolved_trades'],
                'wins': r['wins'],
                'losses': r['losses'],
                'win_rate': r['wins']/r['resolved_trades']*100 if r['resolved_trades']>0 else 0,
                'pnl': r['total_pnl'],
            } for r in all_results],
            'all_trades': all_details,
        }, f, indent=2)
    print(f"\nFull results saved to ./backtest_results.json")


if __name__ == '__main__':
    main()
