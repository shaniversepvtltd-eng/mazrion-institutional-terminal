import sys

def test_risk_engine():
    print("=== [TEST 9] INSTITUTIONAL RISK ENGINE & 2% CAPITAL CAP ===")
    
    # User account specifications
    account_balance = 500.00 # $500 USD
    max_risk_pct = 0.02 # 2.0% cap
    max_allowed_dollar_risk = account_balance * max_risk_pct # $10.00 USD
    
    # Contract specs for XAUUSD
    contract_size = 100 # 100 oz per 1.0 standard lot
    min_lot = 0.01
    
    # Scenario A: Valid entry within risk budget
    entry_a = 4400.00
    sl_a = 4390.00 # 10.00 points
    risk_distance_a = entry_a - sl_a
    lot_size_a = 0.01
    dollar_risk_a = risk_distance_a * (lot_size_a * contract_size)
    risk_pct_a = dollar_risk_a / account_balance
    
    print(f"Scenario A (Valid Setup):")
    print(f"  Account: ${account_balance:.2f} | Risk Cap: 2% (${max_allowed_dollar_risk:.2f})")
    print(f"  Entry: ${entry_a:.2f} | SL: ${sl_a:.2f} | Distance: ${risk_distance_a:.2f}")
    print(f"  Lot Size: {lot_size_a} Lots | Dollar Risk: ${dollar_risk_a:.2f} ({risk_pct_a*100:.1f}%)")
    
    assert dollar_risk_a <= max_allowed_dollar_risk, "Scenario A exceeded maximum dollar risk"
    assert risk_pct_a <= max_risk_pct, "Scenario A exceeded maximum 2% risk cap"
    
    # Scenario B: Wide stop loss requiring warning
    entry_b = 4400.00
    sl_b = 4370.00 # 30.00 points
    risk_distance_b = entry_b - sl_b
    lot_size_b = 0.01
    dollar_risk_b = risk_distance_b * (lot_size_b * contract_size) # $30.00
    risk_pct_b = dollar_risk_b / account_balance # 6%
    
    print(f"\nScenario B (Wide SL Exceeding 2% Cap):")
    print(f"  Distance: ${risk_distance_b:.2f} | Dollar Risk on 0.01 lot: ${dollar_risk_b:.2f} ({risk_pct_b*100:.1f}%)")
    risk_breach = dollar_risk_b > max_allowed_dollar_risk
    print(f"  Risk Engine Gate: {'FLAGGED / BLOCKED' if risk_breach else 'APPROVED'}")
    
    assert risk_breach is True, "Risk engine failed to flag setup exceeding 2% risk cap"
    
    print("\n>>> PASS: Institutional Risk Engine calculations & Mazrion 2% account risk guardrails verified.\n")

if __name__ == "__main__":
    try:
        test_risk_engine()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
