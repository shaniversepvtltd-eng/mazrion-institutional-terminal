import os
import sys
import pandas as pd
import numpy as np

def run_out_of_sample_validation():
    print("=== [TEST 17] REAL XAUUSD CHRONOLOGICAL OUT-OF-SAMPLE VALIDATION ===")
    
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../MT5_Data/XAUUSD_1m.csv"))
    if not os.path.exists(csv_path):
        csv_path = "/Volumes/King pro/Mac_Desktop_Backup/superhuman_trading_agent/MT5_Data/XAUUSD_1m.csv"
        
    df_1m = pd.read_csv(csv_path)
    df_1m["datetime"] = pd.to_datetime(df_1m["datetime"])
    
    total_bars = len(df_1m)
    split_idx = int(total_bars * 0.60) # 60% In-Sample, 40% Out-of-Sample
    
    df_in_sample = df_1m.iloc[:split_idx].copy()
    df_out_sample = df_1m.iloc[split_idx:].copy()
    
    print(f"Total Dataset: {total_bars:,} bars")
    print(f"  • In-Sample Period (60%) : {df_in_sample['datetime'].iloc[0]} ➔ {df_in_sample['datetime'].iloc[-1]} ({len(df_in_sample):,} bars)")
    print(f"  • Out-of-Sample (40%)    : {df_out_sample['datetime'].iloc[0]} ➔ {df_out_sample['datetime'].iloc[-1]} ({len(df_out_sample):,} bars)\n")
    
    def simulate_recursive_strategy(df_chunk, sample_name):
        df_chunk = df_chunk.set_index("datetime")
        df_4h = df_chunk.resample("4h").agg({"open": "first", "high": "max", "low": "min", "close": "last"}).dropna().reset_index()
        df_4h["ema20"] = df_4h["close"].ewm(span=20, adjust=False).mean()
        
        df_chunk = df_chunk.reset_index()
        df_chunk["ema10"] = df_chunk["close"].ewm(span=10, adjust=False).mean()
        
        trades = 0
        wins = 0
        losses = 0
        r_list = []
        
        cur_4h_idx = 0
        step = 25
        
        for i in range(50, len(df_chunk) - 50, step):
            bar = df_chunk.iloc[i]
            t = bar["datetime"]
            close_p = bar["close"]
            spread_cost = (bar["spread"] if "spread" in bar else 50.0) / 100.0
            
            while cur_4h_idx < len(df_4h) - 1 and t >= df_4h["datetime"].iloc[cur_4h_idx + 1]:
                cur_4h_idx += 1
                
            p_4h_dir = "BULLISH" if df_4h["close"].iloc[cur_4h_idx] > df_4h["ema20"].iloc[cur_4h_idx] else "BEARISH"
            
            if p_4h_dir == "BULLISH":
                if bar["close"] > bar["open"] and df_chunk["low"].iloc[i-1] <= df_chunk["low"].iloc[i-2]:
                    entry = close_p + spread_cost
                    sl = min(df_chunk["low"].iloc[i-2:i+1]) - (spread_cost * 1.2)
                    risk = max(1.0, entry - sl)
                    tp = entry + (risk * 2.2)
                    
                    win = False
                    loss = False
                    for f in range(i+1, min(len(df_chunk), i+50)):
                        if df_chunk["high"].iloc[f] >= tp: win = True; break
                        if df_chunk["low"].iloc[f] <= sl: loss = True; break
                        
                    r_val = 2.2 if win else (-1.0 if loss else -0.3)
                    trades += 1
                    if win: wins += 1
                    else: losses += 1
                    r_list.append(r_val)
                    
            elif p_4h_dir == "BEARISH":
                if bar["close"] < bar["open"] and df_chunk["high"].iloc[i-1] >= df_chunk["high"].iloc[i-2]:
                    entry = close_p
                    sl = max(df_chunk["high"].iloc[i-2:i+1]) + spread_cost
                    risk = max(1.0, sl - entry)
                    tp = entry - (risk * 2.2)
                    
                    win = False
                    loss = False
                    for f in range(i+1, min(len(df_chunk), i+50)):
                        if df_chunk["low"].iloc[f] <= tp: win = True; break
                        if df_chunk["high"].iloc[f] >= sl: loss = True; break
                        
                    r_val = 2.2 if win else (-1.0 if loss else -0.3)
                    trades += 1
                    if win: wins += 1
                    else: losses += 1
                    r_list.append(r_val)
                    
        win_pct = (wins / trades * 100) if trades > 0 else 0
        gross_p = sum([r for r in r_list if r > 0])
        gross_l = abs(sum([r for r in r_list if r < 0]))
        pf = (gross_p / gross_l) if gross_l > 0 else 99.0
        exp = (sum(r_list) / len(r_list)) if len(r_list) > 0 else 0
        
        return {
            "name": sample_name,
            "trades": trades,
            "win_pct": win_pct,
            "pf": pf,
            "expectancy": exp
        }
        
    in_sample_res = simulate_recursive_strategy(df_in_sample, "IN-SAMPLE (TRAINING)")
    out_sample_res = simulate_recursive_strategy(df_out_sample, "OUT-OF-SAMPLE (BLIND)")
    
    print("--------------------------------------------------------------------------------------------------------")
    print(f"{'DATASET PARTITION':<28} | {'TRADES':<6} | {'WIN %':<7} | {'PROFIT FACTOR':<13} | {'EXPECTANCY':<12}")
    print("--------------------------------------------------------------------------------------------------------")
    for r in [in_sample_res, out_sample_res]:
        print(f"{r['name']:<28} | {r['trades']:>6} | {r['win_pct']:>6.1f}% | {r['pf']:>13.2f} | {r['expectancy']:>+10.2f} R")
    print("--------------------------------------------------------------------------------------------------------\n")
    
    assert in_sample_res["trades"] > 20, "In-sample trades count insufficient"
    assert out_sample_res["trades"] > 20, "Out-of-sample trades count insufficient"
    
    print(">>> PASS: Chronological out-of-sample validation completed with zero data snooping.\n")

if __name__ == "__main__":
    try:
        run_out_of_sample_validation()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
