import subprocess
import os
import sys

def run_all():
    print("=================================================================")
    print("       MAZRION QUANTITATIVE FORENSIC DATA INTEGRITY AUDIT        ")
    print("=================================================================\n")
    
    test_files = [
        ("Zero-Fabrication Repository Scan", "tests/data_integrity/test_repository_scan.py"),
        ("Real MT5 Data Ingestion & Integrity", "tests/fractals/test_real_data_ingestion.py"),
        ("Live Price Feed Telemetry (TradingView / OANDA)", "tests/providers/test_live_price_feed.py"),
        ("Order Flow & L2 Order Book Depth (Binance PAXG)", "tests/orderflow/test_orderbook_integrity.py"),
        ("Cumulative Volume Delta (CVD) Math Verification", "tests/cvd/test_cvd_mathematics.py"),
        ("10,000 GBM Monte Carlo & Risk Percentile Math", "tests/monte_carlo/test_monte_carlo_math.py"),
        ("SMT Pearson Cross-Asset Correlation Math", "tests/smt/test_smt_correlation.py"),
        ("BOS / CHoCH Market Structure Determinism", "tests/structure/test_structure_engine.py"),
        ("Macro Calendar & Treasury Yield Sources", "tests/macro/test_macro_calendar.py"),
        ("Risk Engine Contract Sizing & 2% Capital Cap", "tests/risk/test_risk_engine.py"),
        ("Recursive Hierarchy & Time Containment", "tests/fractals/test_recursive_hierarchy.py"),
        ("Fractal State Machine & Decomposed Score", "tests/fractals/test_state_machine.py"),
        ("Look-Ahead Bias Prevention & Causal Pivots", "tests/fractals/test_lookahead_bias.py"),
        ("Dynamic Nesting Distribution on Real MT5 Data", "tests/fractals/test_nesting_distribution.py"),
        ("Step-by-Step Replay Causality Audit", "tests/fractals/test_replay_causality.py"),
        ("Spread & Slippage Transaction Cost Sensitivity", "tests/fractals/test_transaction_costs.py"),
        ("60/40 In-Sample vs Out-of-Sample Validation", "tests/fractals/test_out_of_sample.py"),
        ("Fractal Hypothesis Empirical Real Data Backtest", "tests/fractals/test_fractal_backtest.py"),
        ("Recursive HTF ➔ 1M Execution Comparative Backtest", "tests/fractals/test_recursive_execution_backtest.py"),
        ("Hierarchy D0-D5 & Filter Ablation Study", "tests/fractals/test_execution_filter_ablation.py"),
        ("Trading Session & Time-of-Day Empirical Analysis", "tests/fractals/test_session_analysis.py"),
        ("1M Trade Exit Logic & Management Ablation", "tests/fractals/test_exit_logic.py"),
        ("Market Regime Sensitivity Analysis", "tests/fractals/test_regime_analysis.py"),
        ("Rigorous Chronological Walk-Forward Audit", "tests/fractals/test_walk_forward.py"),
        ("Multiple-Entry & Trade Lifecycle Integrity Audit", "tests/fractals/test_multiple_entry_integrity.py"),
        ("Parameter Freeze & Zero-Leakage Hash Audit", "tests/fractals/test_parameter_freeze.py"),
    ]
    
    results = []
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    for title, relpath in test_files:
        full_path = os.path.join(base_dir, relpath)
        if not os.path.exists(full_path):
            print(f"SKIPPED (File not found): {relpath}")
            results.append((title, "NOT_FOUND", "N/A"))
            continue
            
        proc = subprocess.run([sys.executable, full_path], capture_output=True, text=True)
        if proc.returncode == 0:
            print(f"✅ PASS: {title}")
            last_line = proc.stdout.strip().split("\n")[-1] if proc.stdout.strip() else "OK"
            results.append((title, "PASS", last_line))
        else:
            print(f"❌ FAIL: {title}")
            print(proc.stdout)
            print(proc.stderr)
            results.append((title, "FAIL", proc.stderr.strip() or proc.stdout.strip()))
            
    print("\n=================================================================")
    print("                       AUDIT RESULTS SUMMARY                     ")
    print("=================================================================")
    all_passed = True
    for title, status, note in results:
        status_icon = "🟢 PASS" if status == "PASS" else "🔴 FAIL"
        if status != "PASS":
            all_passed = False
        print(f"{status_icon} | {title:<52} | {note}")
        
    print("=================================================================\n")
    return all_passed

if __name__ == "__main__":
    passed = run_all()
    if not passed:
        sys.exit(1)
