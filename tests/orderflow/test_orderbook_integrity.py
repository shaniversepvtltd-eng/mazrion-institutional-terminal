import urllib.request
import json
import time
import sys

def test_orderbook_integrity():
    print("=== [TEST 2] ORDER FLOW & L2 ORDER BOOK INTEGRITY ===")
    url = "https://mazrion-institutional-terminal.vercel.app/api/binance_orderflow"
    
    t0 = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": "MazrionForensicTest/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        lat = int((time.time() - t0) * 1000)
        data = json.loads(r.read().decode())
    
    assert data.get("success") is True, "API reported failure"
    assert data.get("status") == "LIVE", "API status is not LIVE"
    assert data.get("instrument") == "PAXGUSDT", "Instrument mismatch"
    assert data.get("instrumentType") == "ORDER_FLOW_PROXY", "Failed to identify instrument as ORDER_FLOW_PROXY"
    
    ob = data.get("orderBook", {})
    bids = ob.get("bidsTop10", [])
    asks = ob.get("asksTop10", [])
    topBid = bids[0].get("price", 0) if bids else 0
    topAsk = asks[0].get("price", 0) if asks else 0
    spread = topAsk - topBid if topAsk and topBid else 0
    
    print(f"Provider: {data.get('provider')} | Latency: {lat}ms")
    print(f"Top Bid: ${topBid:.2f} | Top Ask: ${topAsk:.2f} | Spread: ${spread:.2f}")
    print(f"Total Bid Vol: {ob.get('totalBidOunces')} oz (${ob.get('bidTotalUsd'):,.2f})")
    print(f"Total Ask Vol: {ob.get('totalAskOunces')} oz (${ob.get('askTotalUsd'):,.2f})")
    print(f"Imbalance Ratio: {ob.get('imbalanceRatio')}x | Dominant Pressure: {ob.get('dominantPressure')}")
    
    assert topBid > 1000 and topAsk > 1000, "Invalid top of book prices"
    assert topAsk >= topBid, "Negative spread / crossed book detected"
    assert ob.get("totalBidOunces", 0) > 0, "Zero bid depth"
    assert ob.get("totalAskOunces", 0) > 0, "Zero ask depth"
    
    # Check resting liquidity walls
    walls = ob.get("largeRestingLiquidity", {})
    bidWall = walls.get("largestBid", {})
    askWall = walls.get("largestAsk", {})
    print(f"Largest Resting Bid: {bidWall.get('qtyOunces')} oz @ ${bidWall.get('price')} (${bidWall.get('usdValue'):,})")
    print(f"Largest Resting Ask: {askWall.get('qtyOunces')} oz @ ${askWall.get('price')} (${askWall.get('usdValue'):,})")
    
    assert bidWall.get("price", 0) > 0, "Missing largest bid wall price"
    assert askWall.get("price", 0) > 0, "Missing largest ask wall price"
    
    print(">>> PASS: L2 Order Book depth & resting liquidity mathematically valid.\n")

if __name__ == "__main__":
    try:
        test_orderbook_integrity()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
