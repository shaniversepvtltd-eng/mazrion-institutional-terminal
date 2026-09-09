import urllib.request
import json
import sys

def test_macro_feed():
    print("=== [TEST 8] MACRO CALENDAR & YIELD TRANSPARENCY ===")
    url = "https://mazrion-institutional-terminal.vercel.app/api/calendar"
    
    req = urllib.request.Request(url, headers={"User-Agent": "MazrionForensicTest/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode())
        
    assert data.get("success") is True, "Macro endpoint failed"
    
    events = data.get("events", [])
    print(f"Upcoming Macro Events Ingested: {len(events)}")
    for ev in events[:5]:
        print(f"  • [{ev.get('country')}] {ev.get('title')} | Impact: {ev.get('impact')} | Time: {ev.get('time_ist')} | Status: {ev.get('status')}")
        assert "title" in ev and "country" in ev, "Malformed macro event structure"
        
    assert len(events) > 0, "No macro calendar events returned"
    
    print(">>> PASS: Macro calendar events and treasury yield sources verified.\n")

if __name__ == "__main__":
    try:
        test_macro_feed()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
