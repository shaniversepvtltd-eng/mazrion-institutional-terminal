import os
import sys
import pandas as pd
import numpy as np

def find_causal_swings(df, n_confirm=2):
    """
    Finds structural swing highs and lows causally.
    A pivot at bar i is confirmed only at bar i + n_confirm.
    """
    highs = df["high"].values
    lows = df["low"].values
    n = len(df)
    
    swing_highs = []
    swing_lows = []
    
    for i in range(n_confirm, n - n_confirm):
        # Check swing high
        if highs[i] == max(highs[i - n_confirm : i + n_confirm + 1]):
            swing_highs.append({
                "bar_idx": i,
                "confirm_bar": i + n_confirm,
                "price": highs[i],
                "time": df["datetime"].iloc[i]
            })
            
        # Check swing low
        if lows[i] == min(lows[i - n_confirm : i + n_confirm + 1]):
            swing_lows.append({
                "bar_idx": i,
                "confirm_bar": i + n_confirm,
                "price": lows[i],
                "time": df["datetime"].iloc[i]
            })
            
    return swing_highs, swing_lows

def test_nesting_distribution():
    print("=== [TEST 16] EMPIRICAL MULTI-TIMEFRAME FRACTAL NESTING DISTRIBUTION ===")
    
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../MT5_Data/XAUUSD_1m.csv"))
    if not os.path.exists(csv_path):
        csv_path = "/Volumes/King pro/Mac_Desktop_Backup/superhuman_trading_agent/MT5_Data/XAUUSD_1m.csv"
        
    df_1m = pd.read_csv(csv_path)
    df_1m["datetime"] = pd.to_datetime(df_1m["datetime"])
    df_1m = df_1m.set_index("datetime")
    
    # Resample to higher timeframes
    df_5m = df_1m.resample("5min").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum", "spread": "mean"}).dropna().reset_index()
    df_15m = df_1m.resample("15min").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum", "spread": "mean"}).dropna().reset_index()
    df_30m = df_1m.resample("30min").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum", "spread": "mean"}).dropna().reset_index()
    df_1h = df_1m.resample("1h").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum", "spread": "mean"}).dropna().reset_index()
    df_4h = df_1m.resample("4h").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum", "spread": "mean"}).dropna().reset_index()
    df_1d = df_1m.resample("1D").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum", "spread": "mean"}).dropna().reset_index()
    
    df_1m = df_1m.reset_index()
    
    # Detect causal structural cycles
    sh_1d, sl_1d = find_causal_swings(df_1d, 2)
    sh_4h, sl_4h = find_causal_swings(df_4h, 2)
    sh_1h, sl_1h = find_causal_swings(df_1h, 2)
    sh_30m, sl_30m = find_causal_swings(df_30m, 2)
    sh_15m, sl_15m = find_causal_swings(df_15m, 2)
    sh_5m, sl_5m = find_causal_swings(df_5m, 2)
    sh_1m, sl_1m = find_causal_swings(df_1m, 2)
    
    timeframe_swings = {
        "1D": len(sh_1d) + len(sl_1d),
        "4H": len(sh_4h) + len(sl_4h),
        "1H": len(sh_1h) + len(sl_1h),
        "30M": len(sh_30m) + len(sl_30m),
        "15M": len(sh_15m) + len(sl_15m),
        "5M": len(sh_5m) + len(sl_5m),
        "1M": len(sh_1m) + len(sl_1m),
    }
    
    print("Discovered Structural Swings Across 50,000 Real Market Bars:")
    for tf, count in timeframe_swings.items():
        print(f"  • {tf:>3} Timeframe: {count:>5} confirmed structural swing pivots (OBSERVED)")
        
    # Calculate empirical nesting distribution for 4H parent missions containing 1H, 15M, 5M, 1M cycles
    # Build 4H structural mission ranges
    all_4h_pivots = sorted(sh_4h + sl_4h, key=lambda x: x["time"])
    
    nesting_counts_1h = []
    nesting_counts_15m = []
    nesting_counts_5m = []
    nesting_counts_1m = []
    
    for i in range(len(all_4h_pivots) - 1):
        t_start = all_4h_pivots[i]["time"]
        t_end = all_4h_pivots[i+1]["time"]
        
        c_1h = len([p for p in (sh_1h + sl_1h) if t_start <= p["time"] < t_end])
        c_15m = len([p for p in (sh_15m + sl_15m) if t_start <= p["time"] < t_end])
        c_5m = len([p for p in (sh_5m + sl_5m) if t_start <= p["time"] < t_end])
        c_1m = len([p for p in (sh_1m + sl_1m) if t_start <= p["time"] < t_end])
        
        if c_1m > 0:
            nesting_counts_1h.append(c_1h)
            nesting_counts_15m.append(c_15m)
            nesting_counts_5m.append(c_5m)
            nesting_counts_1m.append(c_1m)
            
    def compute_percentiles(arr):
        s = pd.Series(arr)
        return {
            "min": float(s.min()),
            "p10": float(s.quantile(0.10)),
            "p25": float(s.quantile(0.25)),
            "p50": float(s.quantile(0.50)),
            "p75": float(s.quantile(0.75)),
            "p90": float(s.quantile(0.90)),
            "max": float(s.max()),
            "mean": float(s.mean()),
            "std": float(s.std())
        }
        
    dist_1h = compute_percentiles(nesting_counts_1h)
    dist_15m = compute_percentiles(nesting_counts_15m)
    dist_5m = compute_percentiles(nesting_counts_5m)
    dist_1m = compute_percentiles(nesting_counts_1m)
    
    print("\n----------------------------------------------------------------------------------------------------")
    print(f"{'NESTING RELATIONSHIP':<24} | {'MIN':<4} | {'P10':<4} | {'P25':<4} | {'P50 (MED)':<9} | {'P75':<4} | {'P90':<4} | {'MAX':<4} | {'MEAN ± STD':<14}")
    print("----------------------------------------------------------------------------------------------------")
    
    for label, d in [
        ("4H ➔ 1H Sub-Cycles", dist_1h),
        ("4H ➔ 15M Sub-Cycles", dist_15m),
        ("4H ➔ 5M Sub-Cycles", dist_5m),
        ("4H ➔ 1M Micro-Cycles", dist_1m),
    ]:
        print(f"{label:<24} | {d['min']:>4.0f} | {d['p10']:>4.0f} | {d['p25']:>4.0f} | {d['p50']:>9.0f} | {d['p75']:>4.0f} | {d['p90']:>4.0f} | {d['max']:>4.0f} | {d['mean']:>5.1f} ± {d['std']:>4.1f}")
        
    print("----------------------------------------------------------------------------------------------------\n")
    
    # Assertions on empirical reality:
    # Notice that nesting varies widely across market conditions, confirming non-fixed wave counts!
    assert dist_1m["mean"] > dist_5m["mean"] > dist_15m["mean"] > dist_1h["mean"], "Nesting density does not increase as timeframe decreases"
    assert dist_1m["max"] > dist_1m["min"], "Child cycle counts are static/fixed (violates dynamic fractal reality)"
    
    print(">>> PASS: Real empirical nesting distribution measured directly from XAUUSD historical data.\n")

if __name__ == "__main__":
    try:
        test_nesting_distribution()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
