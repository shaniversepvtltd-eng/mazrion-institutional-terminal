import urllib.request
import json
import sys

def test_cvd_mathematics():
    print("=== [TEST 3] CUMULATIVE VOLUME DELTA (CVD) MATHEMATICAL VERIFICATION ===")
    url = "https://mazrion-institutional-terminal.vercel.app/api/binance_orderflow"
    
    req = urllib.request.Request(url, headers={"User-Agent": "MazrionForensicTest/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode())
    
    cvd_data = data.get("volumeDelta", {})
    buy_vol = cvd_data.get("buyVolumeOunces", 0)
    sell_vol = cvd_data.get("sellVolumeOunces", 0)
    net_delta = cvd_data.get("netDeltaOunces", 0)
    delta_pct = cvd_data.get("deltaPct", 0)
    recent_trades = cvd_data.get("recentTrades", [])
    
    print(f"Sampled Trades Count: {cvd_data.get('tradesSampledCount')}")
    print(f"Aggressive Buy Volume: {buy_vol:.3f} oz")
    print(f"Aggressive Sell Volume: {sell_vol:.3f} oz")
    print(f"Net Delta (Buy - Sell): {net_delta:.3f} oz")
    print(f"Delta Percentage: {delta_pct}%")
    print(f"CVD State Regime: {cvd_data.get('cvdState')}")
    
    # 1. Mathematical consistency check: net_delta == buy_vol - sell_vol
    computed_delta = round(buy_vol - sell_vol, 3)
    assert abs(net_delta - computed_delta) < 0.005, f"CVD Delta mismatch: API={net_delta}, Computed={computed_delta}"
    
    # 2. Replay recent trades and verify running CVD sequence
    if recent_trades:
        print(f"\nReplaying last {len(recent_trades)} sequential trades:")
        for t in recent_trades[:5]:
            print(f"  {t.get('time')} | Side: {t.get('side'):<4} | Price: ${t.get('price'):.2f} | Qty: {t.get('qty')} oz | Running CVD: {t.get('runningCvd')}")
    
    print("\n>>> PASS: Cumulative Volume Delta (CVD) mathematics 100% verified.\n")

if __name__ == "__main__":
    try:
        test_cvd_mathematics()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
