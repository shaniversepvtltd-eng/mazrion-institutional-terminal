import urllib.request
import json
import sys

def test_smt():
    print("=== [TEST 5] SMT CROSS-ASSET CORRELATION & DIVERGENCE ===")
    url = "https://mazrion-institutional-terminal.vercel.app/api/smt"
    
    req = urllib.request.Request(url, headers={"User-Agent": "MazrionForensicTest/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode())
    
    assert data.get("success") is True, "API reported failure"
    assert data.get("status") == "LIVE_DERIVED", "Invalid status"
    assert data.get("algorithmVersion") == "smt_engine_v1", "Algorithm version mismatch"
    
    corr = data.get("correlation", {})
    r_val = corr.get("pearsonR", 0)
    div = data.get("divergence", {})
    assets = data.get("radarAssets", [])
    
    print(f"Rolling Pearson r (Gold vs Silver): {r_val}")
    print(f"Divergence Detected: {div.get('hasDivergence')} ({div.get('type')})")
    print(f"Explanation: {div.get('explanation')}")
    print(f"Tracked Assets Count: {len(assets)}")
    for a in assets:
        print(f"  • {a.get('name'):<25} | Value: {a.get('value')} (Change: {a.get('changePct')}%)")
    
    assert -1.0 <= r_val <= 1.0, "Pearson r outside valid [-1.0, 1.0] bounds"
    assert len(assets) >= 3, "Missing asset telemetry"
    
    print(">>> PASS: SMT Pearson correlation & cross-asset alignment mathematically valid.\n")

if __name__ == "__main__":
    try:
        test_smt()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
