import os
import sys
import unittest
import numpy as np

# Ensure VPS/src is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../VPS/src")))
from autonomous_fractal_trader import AutonomousFractalTrader

class TestOrderFlowMonteCarloIntegration(unittest.TestCase):
    def setUp(self):
        self.trader = AutonomousFractalTrader(symbol="XAUUSDm", risk_percent=1.0, confidence_threshold=65)
        self.mock_market_state = {
            "spot_price": 4398.0,
            "atr": 4.5,
            "spread": 0.35,
            "parent_mission": {
                "id": "MISSION_4H_BULL_#104",
                "direction": "BULLISH",
                "origin": 4372.0,
                "destination": 4445.0,
                "invalidation": 4364.5,
                "journey_progress_pct": 68.4
            },
            "intermediate_journey": {
                "1h": "EXPANSION",
                "15m": "RETRACEMENT",
                "5m": "DISPLACEMENT"
            },
            "1m_execution": {
                "valid": True,
                "direction": "BUY",
                "setup_id": "SETUP_1M_BULL_#1420",
                "fractal_score": 88.0,
                "triggers": ["1M SSL Swept", "Displacement candle confirmed", "Retest into 1M Bullish FVG"]
            },
            "lineage": "1MO -> 1W -> 1D -> 4H -> 1H -> 30M -> 15M -> 5M -> 1M"
        }

    def test_order_flow_confirmation_confirming(self):
        """Test that positive delta and bid dominance returns CONFIRMING and approved=True."""
        of_data = {
            "cvd_net_delta": 142.5,
            "bid_ask_dominance_ratio": 1.35,
            "passive_absorption_detected": False
        }
        state, approved, reason = self.trader.evaluate_order_flow_confirmation(self.mock_market_state, "BUY", of_data)
        self.assertEqual(state, "CONFIRMING")
        self.assertTrue(approved)

    def test_order_flow_confirmation_contradicting(self):
        """Test that heavy opposing sell aggression without absorption returns CONTRADICTING and approved=False."""
        of_data = {
            "cvd_net_delta": -180.0,
            "bid_ask_dominance_ratio": 0.45,
            "passive_absorption_detected": False
        }
        state, approved, reason = self.trader.evaluate_order_flow_confirmation(self.mock_market_state, "BUY", of_data)
        self.assertEqual(state, "CONTRADICTING")
        self.assertFalse(approved)

    def test_order_flow_confirmation_absorption(self):
        """Test that passive absorption at support approves the trade with state ABSORPTION."""
        of_data = {
            "cvd_net_delta": -90.0,
            "bid_ask_dominance_ratio": 0.85,
            "passive_absorption_detected": True
        }
        state, approved, reason = self.trader.evaluate_order_flow_confirmation(self.mock_market_state, "BUY", of_data)
        self.assertEqual(state, "ABSORPTION")
        self.assertTrue(approved)

    def test_monte_carlo_gate_approval(self):
        """Test 10,000-path Monte Carlo gate passes when favorable R:R and trend alignment exist."""
        entry = 4398.0
        sl = 4393.5  # Risk = 4.5
        tp = 4407.0  # Reward = 9.0 (2:1 RR)
        direction = "BUY"
        atr = 4.5
        
        mc = self.trader.evaluate_monte_carlo_gate(entry, sl, tp, direction, atr, num_simulations=10000, min_target_prob=0.52)
        self.assertIn("target_prob", mc)
        self.assertIn("stop_prob", mc)
        self.assertIn("expected_edge_r", mc)
        self.assertGreaterEqual(mc["num_simulations"], 10000)
        self.assertGreaterEqual(mc["target_prob"], 0.50)

    def test_monte_carlo_gate_rejection_on_terrible_rr(self):
        """Test that Monte Carlo rejects an impossible / inverted edge setup."""
        entry = 4398.0
        sl = 4397.0  # Risk = 1.0
        tp = 4450.0  # Unrealistic target under high adverse stop probability
        direction = "BUY"
        atr = 4.5
        
        # When SL is too close (0.2 ATR) vs TP (12 ATR), stop is hit almost 95% of time before TP
        mc = self.trader.evaluate_monte_carlo_gate(entry, sl, tp, direction, atr, num_simulations=10000, min_target_prob=0.52)
        self.assertFalse(mc["passed"])
        self.assertLess(mc["target_prob"], 0.52)

    def test_deterministic_guards_order_flow_and_mc(self):
        """Test full deterministic guard pipeline incorporating Guard 9 and Guard 10."""
        ai_decision = {
            "signal": "BUY",
            "confidence_score": 86,
            "stop_loss": 4393.5,
            "take_profit": 4407.0,
            "logic": "4H Bullish Expansion with 1M FVG retest."
        }
        of_data = {
            "cvd_net_delta": 120.0,
            "bid_ask_dominance_ratio": 1.25,
            "passive_absorption_detected": False
        }
        
        passed, params = self.trader.execute_deterministic_guards(self.mock_market_state, ai_decision, account_equity=1000.0, order_flow_data=of_data)
        self.assertTrue(passed, f"Guards failed: {params}")
        self.assertEqual(params["order_flow_state"], "CONFIRMING")
        self.assertTrue(params["monte_carlo"]["passed"])

if __name__ == "__main__":
    unittest.main()
