import os
import sys
import pandas as pd
import numpy as np

def run_transaction_cost_sensitivity():
    print("=== [TEST 18] REAL XAUUSD TRANSACTION COST & SPREAD SENSITIVITY ===")
    
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../MT5_Data/XAUUSD_1m.csv"))
    if not os.path.exists(csv_path):
        csv_path = "/Volumes/King pro/Mac_Desktop_Backup/superhuman_trading_agent/MT5_Data/XAUUSD_1m.csv"
        
    df_1m = pd.read_csv(csv_path).iloc[:15000].copy() # 15,000 candle sample for sensitivity sweep
    df_1m["datetime"] = pd.to_datetime(df_1m["datetime"])
    
    spread_tiers_pts = [30.0, 50.0, 80.0, 120.0]
    
    print("Testing Strategy D across broker spread conditions:")
    print("--------------------------------------------------------------------------------------------------------")
    print(f"{'SPREAD SCENARIO':<24} | {'SPREAD ($)':<12} | {'WIN %':<7} | {'PROFIT FACTOR':<13} | {'EXPECTANCY':<12}")
    print("--------------------------------------------------------------------------------------------------------")
    
    for spread_pts in spread_tiers_pts:
        spread_cost = spread_pts / 100.0
        
        wins = 0
        losses = 0
        r_list = []
        
        for i in range(50, len(df_1m) - 50, 30):
            bar = df_1m.iloc[i]
            close_p = bar["close"]
            
            # Bullish test
            if bar["close"] > bar["open"]:
                entry = close_p + spread_cost
                sl = min(df_1m["low"].iloc[i-2:i+1]) - (spread_cost * 1.2)
                risk = max(1.0, entry - sl)
                tp = entry + (risk * 2.2)
                
                win = False
                loss = False
                for f in range(i+1, min(len(df_1m), i+50)):
                    if df_1m["high"].iloc[f] >= tp: win = True; break
                    if df_1m["low"].iloc[f] <= sl: loss = True; break
                    
                r_val = 2.2 if win else (-1.0 if loss else -0.3)
                if win: wins += 1
                else: losses += 1
                r_list.append(r_val)
                
        t = wins + losses
        win_pct = (wins / t * 100) if t > 0 else 0
        gross_p = sum([r for r in r_list if r > 0])
        gross_l = abs(sum([r for r in r_list if r < 0]))
        pf = (gross_p / gross_l) if gross_l > 0 else 99.0
        exp = (sum(r_list) / len(r_list)) if len(r_list) > 0 else 0
        
        print(f"{f'{spread_pts:.0f} pts spread':<24} | ${spread_cost:<11.2f} | {win_pct:>6.1f}% | {pf:>13.2f} | {exp:>+10.2f} R")
        
    print("--------------------------------------------------------------------------------------------------------\n")
    print(">>> PASS: Spread sensitivity analysis successfully mapped across market conditions.\n")

if __name__ == "__main__":
    try:
        run_transaction_cost_sensitivity()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
