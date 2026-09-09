import os
import csv
import sys
from datetime import datetime

def load_real_data(csv_path):
    candles = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter='\t')
        header = next(reader)
        for row in reader:
            if len(row) < 8:
                continue
            dt_str = f"{row[0]} {row[1]}"
            dt = datetime.strptime(dt_str, "%Y.%m.%d %H:%M:%S")
            candles.append({
                "datetime": dt,
                "open": float(row[2]),
                "high": float(row[3]),
                "low": float(row[4]),
                "close": float(row[5]),
                "tick_vol": float(row[6]),
                "spread": float(row[7]) / 100.0
            })
    return candles

def test_regime_analysis():
    print("=== [FORENSIC TEST] MARKET REGIME SENSITIVITY ANALYSIS ===")
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
    csv_path = os.path.join(base_dir, "MT5_Data", "XAUUSD_1m.csv")
    
    assert os.path.exists(csv_path), f"File not found: {csv_path}"
    candles = load_real_data(csv_path)
    
    # Calculate rolling ATR (14) and Long-term ATR (240)
    atrs = [0.0] * len(candles)
    atrs_long = [0.0] * len(candles)
    for i in range(1, len(candles)):
        hl = candles[i]['high'] - candles[i]['low']
        hc = abs(candles[i]['high'] - candles[i-1]['close'])
        lc = abs(candles[i]['low'] - candles[i-1]['close'])
        tr = max(hl, hc, lc)
        atrs[i] = (atrs[i-1] * 13 + tr) / 14 if i > 14 else tr
        atrs_long[i] = (atrs_long[i-1] * 239 + tr) / 240 if i > 240 else tr

    tf_4h_bars = 240
    current_4h_dir = 0
    
    regime_buckets = {
        "High Volatility (ATR14 > 1.2 * ATR240)": [],
        "Low Volatility (ATR14 <= 0.8 * ATR240)": [],
        "Normal Volatility (0.8 < ATR14 <= 1.2)": [],
        "Trending 4H (ADX / Slope > 1.5 ATR)": [],
        "Ranging / Choppy 4H": []
    }
    
    in_trade = False
    trade_dir = 0
    entry_price = 0.0
    stop_loss = 0.0
    tp1 = 0.0
    trade_regimes = []
    cooldown = 0
    
    for i in range(500, len(candles)):
        c = candles[i]
        prev = candles[i-1]
        atr = atrs[i] if atrs[i] > 0 else 2.0
        atr_lt = atrs_long[i] if atrs_long[i] > 0 else 2.0
        
        # 4H structure
        if i % tf_4h_bars == 0:
            c_prev_4h = candles[i-tf_4h_bars]['close']
            c_curr = c['close']
            move_4h = abs(c_curr - c_prev_4h)
            is_trending = move_4h >= (atr * 6.0)
            current_4h_dir = (1 if c_curr > c_prev_4h else -1) if is_trending else 0
            
        # Determine regime at bar
        regimes_at_bar = []
        if atr > 1.2 * atr_lt:
            regimes_at_bar.append("High Volatility (ATR14 > 1.2 * ATR240)")
        elif atr <= 0.8 * atr_lt:
            regimes_at_bar.append("Low Volatility (ATR14 <= 0.8 * ATR240)")
        else:
            regimes_at_bar.append("Normal Volatility (0.8 < ATR14 <= 1.2)")
            
        if current_4h_dir != 0:
            regimes_at_bar.append("Trending 4H (ADX / Slope > 1.5 ATR)")
        else:
            regimes_at_bar.append("Ranging / Choppy 4H")
            
        if in_trade:
            if trade_dir == 1:
                if c['low'] <= stop_loss:
                    for reg in trade_regimes:
                        regime_buckets[reg].append({"r": -1.0})
                    in_trade = False
                    cooldown = 5
                elif c['high'] >= tp1:
                    r_mult = (tp1 - entry_price) / (entry_price - stop_loss)
                    for reg in trade_regimes:
                        regime_buckets[reg].append({"r": r_mult})
                    in_trade = False
                    cooldown = 5
            elif trade_dir == -1:
                if c['high'] >= stop_loss:
                    for reg in trade_regimes:
                        regime_buckets[reg].append({"r": -1.0})
                    in_trade = False
                    cooldown = 5
                elif c['low'] <= tp1:
                    r_mult = (entry_price - tp1) / (stop_loss - entry_price)
                    for reg in trade_regimes:
                        regime_buckets[reg].append({"r": r_mult})
                    in_trade = False
                    cooldown = 5
            continue
            
        if cooldown > 0:
            cooldown -= 1
            continue
            
        if current_4h_dir == 0 or c['spread'] * 100 > 70.0:
            continue
            
        if current_4h_dir == 1:
            lowest_15 = min(c_sub['low'] for c_sub in candles[i-15:i])
            if prev['low'] <= lowest_15 and (c['close'] - c['open'] >= atr * 0.45) and c['low'] > candles[i-2]['high']:
                entry_price = c['close'] + c['spread']
                stop_loss = min(c['low'], prev['low']) - (atr * 0.5)
                risk = entry_price - stop_loss
                if 0.5 < risk < atr * 4.0:
                    tp1 = entry_price + (risk * 2.0)
                    in_trade = True
                    trade_dir = 1
                    trade_regimes = regimes_at_bar
        elif current_4h_dir == -1:
            highest_15 = max(c_sub['high'] for c_sub in candles[i-15:i])
            if prev['high'] >= highest_15 and (c['open'] - c['close'] >= atr * 0.45) and c['high'] < candles[i-2]['low']:
                entry_price = c['close'] - c['spread']
                stop_loss = max(c['high'], prev['high']) + (atr * 0.5)
                risk = stop_loss - entry_price
                if 0.5 < risk < atr * 4.0:
                    tp1 = entry_price - (risk * 2.0)
                    in_trade = True
                    trade_dir = -1
                    trade_regimes = regimes_at_bar
                    
    print(f"\n{'Market Regime':<42} | {'Trades':<6} | {'Win Rate':<8} | {'Profit Factor':<13} | {'Net R':<8} | {'Expectancy':<10}")
    print("-" * 98)
    
    for reg, tr_list in regime_buckets.items():
        n = len(tr_list)
        if n == 0:
            print(f"{reg:<42} | {0:<6} | {'N/A':<8} | {'N/A':<13} | {'0.0 R':<8} | {'0.000 R':<10}")
            continue
        wins = [t for t in tr_list if t['r'] > 0]
        losses = [t for t in tr_list if t['r'] <= 0]
        wr = (len(wins) / n) * 100
        gp = sum(t['r'] for t in wins)
        gl = abs(sum(t['r'] for t in losses))
        pf = (gp / gl) if gl > 0 else float('inf')
        net_r = gp - gl
        exp = net_r / n
        print(f"{reg:<42} | {n:<6} | {wr:5.1f}%   | {pf:<13.2f} | {net_r:<+7.1f}R | {exp:<+7.3f}R")

    print("\n>>> PASS: Market regime sensitivity analysis completed.\n")

if __name__ == "__main__":
    test_regime_analysis()
