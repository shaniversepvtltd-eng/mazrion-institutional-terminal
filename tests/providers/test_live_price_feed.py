import urllib.request
import json
import time
import sys

def test_price_feed():
    print("=== [TEST 1] PROVIDER INTEGRITY: LIVE PRICE FEED ===")
    url = "https://mazrion-institutional-terminal.vercel.app/api/price"
    
    samples = []
    for i in range(10):
        t0 = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": "MazrionForensicTest/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            lat = int((time.time() - t0) * 1000)
            data = json.loads(r.read().decode())
            samples.append((data, lat))
        time.sleep(0.3)
    
    print(f"Captured {len(samples)} consecutive production samples.")
    for idx, (d, lat) in enumerate(samples):
        ref = d.get("instruments", {}).get("reference") or d
        proxy = d.get("instruments", {}).get("proxy") or {}
        price = d.get("price") or ref.get("price")
        bid = d.get("bid") or ref.get("bid")
        ask = d.get("ask") or ref.get("ask")
        paxg_p = proxy.get("price") if proxy else None
        paxg_str = f"${paxg_p:.2f}" if paxg_p else "N/A"
        
        print(f"  Sample #{idx+1:02d} | Latency: {lat:>4}ms | XAU: ${price:>7.2f} (Bid: {bid}, Ask: {ask}) | PAXG Proxy: {paxg_str} | Status: {d.get('status')}")
        
        # Assertions
        assert d.get("success") is True, f"Sample #{idx+1} failed success check"
        assert d.get("status") in ["LIVE", "LIVE_STREAMING"], f"Sample #{idx+1} invalid status"
        assert price is not None and price > 1000, f"Sample #{idx+1} invalid XAU price"
        if bid and ask:
            assert bid <= ask, f"Sample #{idx+1} crossed market"
        assert "timestamp" in d, "Missing ISO timestamp"
    
    print(">>> PASS: Live Price Feed returns 100% valid market telemetry across 10 consecutive ticks.\n")

if __name__ == "__main__":
    try:
        test_price_feed()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
