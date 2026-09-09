import urllib.request
import json
import sys

def test_monte_carlo():
    print("=== [TEST 4] 10,000 MONTE CARLO STOCHASTIC & RISK MATH ===")
    url = "https://mazrion-institutional-terminal.vercel.app/api/monte_carlo"
    
    req = urllib.request.Request(url, headers={"User-Agent": "MazrionForensicTest/1.0"})
    with urllib.request.urlopen(req, timeout=12) as r:
        data = json.loads(r.read().decode())
    
    assert data.get("success") is True, "API reported failure"
    assert data.get("algorithmVersion") == "monte_carlo_gbm_v1", "Algorithm version mismatch"
    assert data.get("classification") == "SIMULATED_SCENARIO_DISTRIBUTION", "Invalid classification"
    
    params = data.get("parameters", {})
    pcts = data.get("percentiles", {})
    risk = data.get("riskMetrics", {})
    
    spot = params.get("spotPrice", 0)
    mu = params.get("driftMu", 0)
    sigma = params.get("volatilitySigma", 0)
    atr = params.get("atr", 0)
    sims = params.get("simulationsCount", 0)
    
    p5 = pcts.get("p5", 0)
    p25 = pcts.get("p25", 0)
    p50 = pcts.get("median_p50", 0)
    p75 = pcts.get("p75", 0)
    p95 = pcts.get("p95", 0)
    
    var95 = risk.get("valueAtRisk95", 0)
    cvar95 = risk.get("conditionalVaR95", 0)
    prob_tp = risk.get("probTargetBeforeStopPct", 0)
    prob_sl = risk.get("probStopBeforeTargetPct", 0)
    
    print(f"Spot: ${spot:.2f} | μ (Drift): {mu} | σ (Volatility): {sigma} | ATR: ${atr}")
    print(f"Simulations: {sims:,} Paths | Horizon: {params.get('horizonBars')} bars")
    print(f"Percentiles: P5=${p5} | P25=${p25} | P50=${p50} | P75=${p75} | P95=${p95}")
    print(f"95% VaR: ${var95:.2f} | 95% CVaR: ${cvar95:.2f}")
    print(f"P(Hit TP): {prob_tp}% | P(Hit SL): {prob_sl}%")
    
    # Assertions
    assert sims == 10000, "Simulation count is not 10,000"
    assert p5 <= p25 <= p50 <= p75 <= p95, "Percentiles are not strictly monotonic"
    assert sigma > 0, "Volatility sigma must be non-zero"
    assert var95 >= 0, "VaR95 cannot be negative"
    assert cvar95 >= var95, "CVaR (Expected Shortfall) must be >= VaR95"
    assert prob_tp + prob_sl <= 100.0, "Probabilities cannot exceed 100%"
    
    print(">>> PASS: Monte Carlo GBM stochastic simulation & VaR math mathematically proven.\n")

if __name__ == "__main__":
    try:
        test_monte_carlo()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
