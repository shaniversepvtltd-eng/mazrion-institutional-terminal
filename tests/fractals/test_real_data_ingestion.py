import os
import sys
import pandas as pd
import numpy as np

def test_real_data_ingestion():
    print("=== [TEST 15] REAL MARKET DATA INGESTION & QUALITY AUDIT ===")
    
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../MT5_Data/XAUUSD_1m.csv"))
    if not os.path.exists(csv_path):
        # Fallback search
        csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../MT5_Data/XAUUSD_1m.csv"))
    if not os.path.exists(csv_path):
        csv_path = "/Volumes/King pro/Mac_Desktop_Backup/superhuman_trading_agent/MT5_Data/XAUUSD_1m.csv"
        
    assert os.path.exists(csv_path), f"Real market data file not found at: {csv_path}"
    
    df = pd.read_csv(csv_path)
    
    # 1. Inspect and calculate dynamically
    total_rows = len(df)
    start_date = df["datetime"].iloc[0]
    end_date = df["datetime"].iloc[-1]
    
    # Missing & Duplicate Checks
    null_counts = df.isnull().sum().to_dict()
    total_nulls = sum(null_counts.values())
    duplicate_timestamps = df["datetime"].duplicated().sum()
    
    # OHLC Integrity Checks: High >= Low, High >= Open, High >= Close, Low <= Open, Low <= Close
    ohlc_valid = (
        (df["high"] >= df["low"]) &
        (df["high"] >= df["open"]) &
        (df["high"] >= df["close"]) &
        (df["low"] <= df["open"]) &
        (df["low"] <= df["close"])
    ).all()
    
    # Spread Distribution
    spread_min = float(df["spread"].min())
    spread_mean = float(df["spread"].mean())
    spread_median = float(df["spread"].median())
    spread_max = float(df["spread"].max())
    spread_std = float(df["spread"].std())
    
    # Price Distribution
    price_min = float(df["low"].min())
    price_mean = float(df["close"].mean())
    price_max = float(df["high"].max())
    
    print(f"Dataset File: {os.path.basename(csv_path)}")
    print(f"  • Total Candles Ingested : {total_rows:,} bars (OBSERVED)")
    print(f"  • Chronological Range    : {start_date} ➔ {end_date} (OBSERVED)")
    print(f"  • Null Values Found      : {total_nulls} (CALCULATED)")
    print(f"  • Duplicate Timestamps   : {duplicate_timestamps} (CALCULATED)")
    print(f"  • OHLC Structure Validity: {'100% VALID' if ohlc_valid else 'CORRUPT'} (CALCULATED)")
    print(f"\nReal Market Price Action:")
    print(f"  • Min Price : ${price_min:.2f}")
    print(f"  • Mean Price: ${price_mean:.2f}")
    print(f"  • Max Price : ${price_max:.2f}")
    print(f"\nBroker Spread Telemetry (Points):")
    print(f"  • Min Spread   : {spread_min:.1f} pts (${spread_min/100:.2f})")
    print(f"  • Mean Spread  : {spread_mean:.1f} pts (${spread_mean/100:.2f})")
    print(f"  • Median Spread: {spread_median:.1f} pts (${spread_median/100:.2f})")
    print(f"  • Max Spread   : {spread_max:.1f} pts (${spread_max/100:.2f})")
    print(f"  • Spread StdDev: {spread_std:.1f} pts")
    
    assert total_rows > 1000, "Dataset contains insufficient rows"
    assert total_nulls == 0, f"Dataset contains {total_nulls} null values"
    assert duplicate_timestamps == 0, f"Dataset contains {duplicate_timestamps} duplicate timestamps"
    assert ohlc_valid, "OHLC bar relationships violate basic physical constraints"
    
    print("\n>>> PASS: Real market dataset parsed and validated with 100% data integrity.\n")

if __name__ == "__main__":
    try:
        test_real_data_ingestion()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
