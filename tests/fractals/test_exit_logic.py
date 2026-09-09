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

def test_exit_logic():
    print("=== [FORENSIC TEST] 1M TRADE EXIT LOGIC & MANAGEMENT ABLATION ===")
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
    csv_path = os.path.join(base_dir, "MT5_Data", "XAUUSD_1m.csv")
    
    assert os.path.exists(csv_path), f"File not found: {csv_path}"
    candles = load_real_data(csv_path)
    
    # ATR
    atrs = [0.0] * len(candles)
    for i in range(1, len(candles)):
        hl = candles[i]['high'] - candles[i]['low']
        hc = abs(candles[i]['high'] - candles[i-1]['close'])
        lc = abs(candles[i]['low'] - candles[i-1]['close'])
        tr = max(hl, hc, lc)
        atrs[i] = (atrs[i-1] * 13 + tr) / 14 if i > 14 else tr

    tf_4h_bars = 240
    
    def run_exit_model(exit_name, exit_type, r_target=2.0):
        trades = []
        in_trade = False
        trade_dir = 0
        entry_price = 0.0
        stop_loss = 0.0
        target_price = 0.0
        htf_dest = 0.0
        active_4h_dir = 0
        cooldown = 0
        
        for i in range(500, len(candles)):
            c = candles[i]
            prev = candles[i-1]
            atr = atrs[i] if atrs[i] > 0 else 2.0
            
            if i % tf_4h_bars == 0:
                h_window = max(c_sub['high'] for c_sub in candles[i-tf_4h_bars:i])
                l_window = min(c_sub['low'] for c_sub in candles[i-tf_4h_bars:i])
                c_prev_4h = candles[i-tf_4h_bars]['close']
                if c['close'] > c_prev_4h:
                    active_4h_dir = 1
                    htf_dest = h_window + (atr * 10.0)
                else:
                    active_4h_dir = -1
                    htf_dest = l_window - (atr * 10.0)
                    
            if in_trade:
                risk = abs(entry_price - stop_loss)
                if trade_dir == 1:
                    if c['low'] <= stop_loss:
                        trades.append({"r": -1.0})
                        in_trade = False
                        cooldown = 5
                    elif exit_type == "RUNNER":
                        # 50% at 1.5R, 50% at 3.0R
                        tp_half = entry_price + (risk * 1.5)
                        tp_full = entry_price + (risk * 3.0)
                        if c['high'] >= tp_full:
                            trades.append({"r": 2.25}) # (0.5 * 1.5) + (0.5 * 3.0)
                            in_trade = False
                            cooldown = 5
                        elif c['high'] >= tp_half and stop_loss < entry_price:
                            stop_loss = entry_price # Move to BE
                    elif c['high'] >= target_price:
                        trades.append({"r": r_target})
                        in_trade = False
                        cooldown = 5
                elif trade_dir == -1:
                    if c['high'] >= stop_loss:
                        trades.append({"r": -1.0})
                        in_trade = False
                        cooldown = 5
                    elif exit_type == "RUNNER":
                        tp_half = entry_price - (risk * 1.5)
                        tp_full = entry_price - (risk * 3.0)
                        if c['low'] <= tp_full:
                            trades.append({"r": 2.25})
                            in_trade = False
                            cooldown = 5
                        elif c['low'] <= tp_half and stop_loss > entry_price:
                            stop_loss = entry_price
                    elif c['low'] <= target_price:
                        trades.append({"r": r_target})
                        in_trade = False
                        cooldown = 5
                continue
                
            if cooldown > 0:
                cooldown -= 1
                continue
                
            if active_4h_dir == 0 or c['spread'] * 100 > 70.0:
                continue
                
            # Setup
            if active_4h_dir == 1:
                lowest_15 = min(c_sub['low'] for c_sub in candles[i-15:i])
                if prev['low'] <= lowest_15 and (c['close'] - c['open'] >= atr * 0.45) and c['low'] > candles[i-2]['high']:
                    entry_price = c['close'] + c['spread']
                    stop_loss = min(c['low'], prev['low']) - (atr * 0.5)
                    risk = entry_price - stop_loss
                    if 0.5 < risk < atr * 4.0:
                        if exit_type == "FIXED_R":
                            target_price = entry_price + (risk * r_target)
                        elif exit_type == "STRUCTURAL":
                            highest_30 = max(c_sub['high'] for c_sub in candles[i-30:i])
                            target_price = max(entry_price + (risk * 1.0), highest_30)
                            r_target = (target_price - entry_price) / risk
                        elif exit_type == "4H_DEST":
                            target_price = htf_dest
                            r_target = (target_price - entry_price) / risk
                        in_trade = True
                        trade_dir = 1
            elif active_4h_dir == -1:
                highest_15 = max(c_sub['high'] for c_sub in candles[i-15:i])
                if prev['high'] >= highest_15 and (c['open'] - c['close'] >= atr * 0.45) and c['high'] < candles[i-2]['low']:
                    entry_price = c['close'] - c['spread']
                    stop_loss = max(c['high'], prev['high']) + (atr * 0.5)
                    risk = stop_loss - entry_price
                    if 0.5 < risk < atr * 4.0:
                        if exit_type == "FIXED_R":
                            target_price = entry_price - (risk * r_target)
                        elif exit_type == "STRUCTURAL":
                            lowest_30 = min(c_sub['low'] for c_sub in candles[i-30:i])
                            target_price = min(entry_price - (risk * 1.0), lowest_30)
                            r_target = (entry_price - target_price) / risk
                        elif exit_type == "4H_DEST":
                            target_price = htf_dest
                            r_target = (entry_price - target_price) / risk
                        in_trade = True
                        trade_dir = -1
                        
        n = len(trades)
        if n == 0:
            return {"name": exit_name, "trades": 0, "wr": 0, "pf": 0, "net_r": 0, "exp": 0, "max_dd": 0}
        wins = [t for t in trades if t['r'] > 0]
        losses = [t for t in trades if t['r'] <= 0]
        wr = (len(wins) / n) * 100
        gp = sum(t['r'] for t in wins)
        gl = abs(sum(t['r'] for t in losses))
        pf = (gp / gl) if gl > 0 else float('inf')
        net_r = gp - gl
        exp = net_r / n
        
        # Max drawdown in R
        equity = 0.0
        peak = 0.0
        max_dd = 0.0
        for t in trades:
            equity += t['r']
            if equity > peak:
                peak = equity
            dd = peak - equity
            if dd > max_dd:
                max_dd = dd
                
        return {
            "name": exit_name,
            "trades": n,
            "wr": round(wr, 1),
            "pf": round(pf, 2),
            "net_r": round(net_r, 1),
            "exp": round(exp, 3),
            "max_dd": round(max_dd, 1)
        }

    models = [
        run_exit_model("A. Fixed 1.0R Take Profit", exit_type="FIXED_R", r_target=1.0),
        run_exit_model("B. Fixed 1.5R Take Profit", exit_type="FIXED_R", r_target=1.5),
        run_exit_model("C. Fixed 2.0R Take Profit", exit_type="FIXED_R", r_target=2.0),
        run_exit_model("D. TP1 (1.5R) + Trailing Runner (3.0R)", exit_type="RUNNER"),
        run_exit_model("E. Tactical Structural Target (30M Swing)", exit_type="STRUCTURAL"),
        run_exit_model("F. Full 4H Destination Target", exit_type="4H_DEST")
    ]
    
    print(f"\n{'Exit Logic Model':<42} | {'Trades':<6} | {'Win Rate':<8} | {'Profit Factor':<13} | {'Net R':<8} | {'Exp':<8} | {'Max DD':<8}")
    print("-" * 105)
    for m in models:
        print(f"{m['name']:<42} | {m['trades']:<6} | {m['wr']:5.1f}%   | {m['pf']:<13.2f} | {m['net_r']:<+7.1f}R | {m['exp']:<+7.3f}R | {m['max_dd']:5.1f}R")

    print("\n>>> PASS: Exit logic comparison audit successfully executed.\n")

if __name__ == "__main__":
    test_exit_logic()
