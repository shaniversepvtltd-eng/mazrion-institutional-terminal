import urllib.request
import json
import sys
from datetime import datetime

def test_recursive_hierarchy():
    print("=== [TEST 10] RECURSIVE MULTI-TIMEFRAME FRACTAL HIERARCHY & TIME CONTAINMENT ===")
    url = "https://mazrion-institutional-terminal.vercel.app/api/fractal_matrix"
    
    req = urllib.request.Request(url, headers={"User-Agent": "MazrionForensicTest/8.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode())
        
    assert data.get("success") is True, "API reported failure"
    assert data.get("algorithmVersion") == "fractal_engine_v8.0.0", "Algorithm version mismatch"
    
    parent_mission = data.get("parentMission", {})
    tree = data.get("hierarchyTree", [])
    
    print(f"Active Parent Mission: [{parent_mission.get('timeframe').upper()}] {parent_mission.get('cycleId')}")
    print(f"  Origin: ${parent_mission.get('originPrice')} ➔ Destination ({parent_mission.get('destinationType')}): ${parent_mission.get('destinationPrice')}")
    print(f"  Status: {parent_mission.get('status')} | Direction: {parent_mission.get('direction')}")
    print(f"  Decomposed Score: {parent_mission.get('completionScore')} / 100")
    
    child_summary = parent_mission.get("completedChildrenSummary", {})
    for tf, sum_data in child_summary.items():
        print(f"    • Nested {tf.upper()} Execution: {sum_data.get('completed')} Completed | Active: {sum_data.get('active')}")
        
    # Check tree nesting: 1W -> 1D -> 4H -> 1H -> 15M -> 5M -> 1M
    expected_order = ['1w', '1d', '4h', '1h', '15m', '5m', '1m']
    tree_tfs = [node.get("timeframe") for node in tree]
    assert tree_tfs == expected_order, f"Tree order mismatch: {tree_tfs}"
    
    # Assert parent-child linkage
    for i in range(1, len(tree)):
        child = tree[i]
        parent = tree[i-1]
        assert child.get("parentCycleId") == parent.get("cycleId"), f"Broken linkage between {parent.get('timeframe')} and {child.get('timeframe')}"
        print(f"  ✓ Verified Linkage: [{child.get('timeframe').upper()}] {child.get('cycleId')} ⊂ [{parent.get('timeframe').upper()}] {parent.get('cycleId')}")
        
    # Verify Highway derivation
    hw = data.get("highway", {})
    print(f"\nDynamic Highway HUD ({hw.get('parentTimeframe').upper()} Base):")
    print(f"  Ceiling:     ${hw.get('ceiling')} ({hw.get('lineage', {}).get('ceilingFormula')})")
    print(f"  Equilibrium: ${hw.get('equilibrium')} ({hw.get('lineage', {}).get('equilibriumFormula')})")
    print(f"  Floor:       ${hw.get('floor')} ({hw.get('lineage', {}).get('floorFormula')})")
    
    assert hw.get("ceiling") > hw.get("equilibrium") > hw.get("floor"), "Invalid highway boundary ordering"
    
    print("\n>>> PASS: Multi-timeframe recursive hierarchy and independent parent-mission tracking verified.\n")

if __name__ == "__main__":
    try:
        test_recursive_hierarchy()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
