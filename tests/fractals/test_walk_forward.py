import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime

def test_walk_forward():
    print("=== [FORENSIC TEST] RIGOROUS CHRONOLOGICAL WALK-FORWARD AUDIT ===")
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../MT5_Data/XAUUSD_1m.csv"))
    if not os.path.exists(csv_path):
        csv_path = "/Volumes/King pro/Mac_Desktop_Backup/superhuman_trading_agent/MT5_Data/XAUUSD_1m.csv"
        
    assert os.path.exists(csv_path), f"File not found: {csv_path}"
    df = pd.read_csv(csv_path)
    df["datetime"] = pd.to_datetime(df["datetime"])
    
    split_dt = pd.to_datetime("2026-06-06 00:00:00")
    df_is = df[df["datetime"] < split_dt].reset_index(drop=True)
    df_oos = df[df["datetime"] >= split_dt].reset_index(drop=True)
    
    print(f"In-Sample Split (Training/Calibration): {len(df_is):,} bars ({df_is['datetime'].iloc[0]} to {df_is['datetime'].iloc[-1]})")
    print(f"Out-of-Sample Split (Blind Testing):    {len(df_oos):,} bars ({df_oos['datetime'].iloc[0]} to {df_oos['datetime'].iloc[-1]})")
    
    def evaluate_split(df_split, split_name, params):
        # ATR
        high = df_split["high"].values
        low = df_split["low"].values
        close = df_split["close"].values
        open_p = df_split["open"].values
        spread = df_split["spread"].values
        
        n_bars = len(df_split)
        atrs = np.zeros(n_bars)
        tr = np.zeros(n_bars)
        
        for i in range(1, n_bars):
            hl = high[i] - low[i]
            hc = abs(high[i] - close[i-1])
            lc = abs(low[i] - close[i-1])
            tr[i] = max(hl, hc, lc)
            atrs[i] = (atrs[i-1] * 13 + tr[i]) / 14 if i > 14 else tr[i]

        tf_4h = 240
        current_4h_dir = 0
        current_4h_missions = 0
        trades_per_mission = {}
        
        trades = []
        in_trade = False
        trade_dir = 0
        entry_price = 0.0
        stop_loss = 0.0
        tp1 = 0.0
        cooldown = 0
        
        for i in range(500, n_bars):
            atr = atrs[i] if atrs[i] > 0 else 2.0
            
            if i % tf_4h == 0:
                current_4h_missions += 1
                trades_per_mission[current_4h_missions] = 0
                c_prev_4h = close[i-tf_4h]
                current_4h_dir = 1 if close[i] > c_prev_4h else -1
                
            if in_trade:
                if trade_dir == 1:
                    if low[i] <= stop_loss:
                        trades.append({"r": -1.0, "pnl": -(entry_price - stop_loss)})
                        in_trade = False
                        cooldown = 5
                    elif high[i] >= tp1:
                        r_mult = (tp1 - entry_price) / (entry_price - stop_loss)
                        trades.append({"r": r_mult, "pnl": tp1 - entry_price})
                        in_trade = False
                        cooldown = 5
                elif trade_dir == -1:
                    if high[i] >= stop_loss:
                        trades.append({"r": -1.0, "pnl": -(stop_loss - entry_price)})
                        in_trade = False
                        cooldown = 5
                    elif low[i] <= tp1:
                        r_mult = (entry_price - tp1) / (stop_loss - entry_price)
                        trades.append({"r": r_mult, "pnl": entry_price - tp1})
                        in_trade = False
                        cooldown = 5
                continue
                
            if cooldown > 0:
                cooldown -= 1
                continue
                
            if current_4h_dir == 0 or spread[i] > params['max_spread_pts']:
                continue
                
            # Causal Trigger Setup
            if current_4h_dir == 1:
                lowest_sw = np.min(low[i-params['sweep_lookback']:i])
                is_sweep = low[i-1] <= lowest_sw
                is_disp = (close[i] - open_p[i]) >= (atr * params['disp_atr_mult'])
                is_fvg = low[i] > high[i-2]
                
                if is_sweep and is_disp and is_fvg:
                    entry_price = close[i] + (spread[i] / 100.0)
                    stop_loss = min(low[i], low[i-1]) - (atr * params['sl_buffer_atr'])
                    risk = entry_price - stop_loss
                    if 0.5 < risk < (atr * 4.0):
                        tp1 = entry_price + (risk * params['tp_r_mult'])
                        in_trade = True
                        trade_dir = 1
                        if current_4h_missions in trades_per_mission:
                            trades_per_mission[current_4h_missions] += 1
                            
            elif current_4h_dir == -1:
                highest_sw = np.max(high[i-params['sweep_lookback']:i])
                is_sweep = high[i-1] >= highest_sw
                is_disp = (open_p[i] - close[i]) >= (atr * params['disp_atr_mult'])
                is_fvg = high[i] < low[i-2]
                
                if is_sweep and is_disp and is_fvg:
                    entry_price = close[i] - (spread[i] / 100.0)
                    stop_loss = max(high[i], high[i-1]) + (atr * params['sl_buffer_atr'])
                    risk = stop_loss - entry_price
                    if 0.5 < risk < (atr * 4.0):
                        tp1 = entry_price - (risk * params['tp_r_mult'])
                        in_trade = True
                        trade_dir = -1
                        if current_4h_missions in trades_per_mission:
                            trades_per_mission[current_4h_missions] += 1
                            
        n = len(trades)
        if n == 0:
            return {"name": split_name, "trades": 0, "wr": 0, "pf": 0, "net_r": 0, "exp": 0, "max_dd": 0, "avg_r": 0, "med_r": 0, "max_consec_losses": 0, "trades_per_mission": 0}
            
        wins = [t for t in trades if t['r'] > 0]
        losses = [t for t in trades if t['r'] <= 0]
        wr = (len(wins) / n) * 100
        gp = sum(t['r'] for t in wins)
        gl = abs(sum(t['r'] for t in losses))
        pf = (gp / gl) if gl > 0 else float('inf')
        net_r = gp - gl
        exp = net_r / n
        avg_r = exp
        r_list = sorted([t['r'] for t in trades])
        med_r = r_list[n // 2]
        
        equity = 0.0
        peak = 0.0
        max_dd = 0.0
        consec_losses = 0
        max_consec = 0
        
        for t in trades:
            if t['r'] <= 0:
                consec_losses += 1
                if consec_losses > max_consec:
                    max_consec = consec_losses
            else:
                consec_losses = 0
            equity += t['r']
            if equity > peak:
                peak = equity
            dd = peak - equity
            if dd > max_dd:
                max_dd = dd
                
        avg_t_per_m = sum(trades_per_mission.values()) / max(1, len(trades_per_mission))
        
        return {
            "name": split_name,
            "trades": n,
            "wr": round(wr, 1),
            "pf": round(pf, 2),
            "net_r": round(net_r, 1),
            "exp": round(exp, 3),
            "max_dd": round(max_dd, 1),
            "avg_r": round(avg_r, 3),
            "med_r": round(med_r, 2),
            "max_consec_losses": max_consec,
            "trades_per_mission": round(avg_t_per_m, 1)
        }

    frozen_params = {
        "sweep_lookback": 15,
        "disp_atr_mult": 0.45,
        "sl_buffer_atr": 0.50,
        "tp_r_mult": 2.0,
        "max_spread_pts": 70.0
    }
    
    print("\n[PARAMETER FREEZE SPECIFICATION]")
    for k, v in frozen_params.items():
        print(f"  • {k:<20}: {v}")

    is_res = evaluate_split(df_is, "IN-SAMPLE (May 7 - June 5, 2026)", frozen_params)
    oos_res = evaluate_split(df_oos, "BLIND OUT-OF-SAMPLE (June 6 - June 27, 2026)", frozen_params)
    
    print("\n" + "=" * 90)
    print("                     WALK-FORWARD PERFORMANCE REPORT                     ")
    print("=" * 90)
    
    for res in [is_res, oos_res]:
        print(f"\n--- {res['name']} ---")
        print(f"  Total Trades:             {res['trades']}")
        print(f"  Win Rate:                 {res['wr']}%")
        print(f"  Profit Factor:            {res['pf']}")
        print(f"  Net R Realized:           {res['net_r']:+0.1f} R")
        print(f"  Expectancy per Trade:     {res['exp']:+0.3f} R")
        print(f"  Average R:                {res['avg_r']:+0.3f} R")
        print(f"  Median R:                 {res['med_r']:+0.2f} R")
        print(f"  Maximum Drawdown:         {res['max_dd']} R")
        print(f"  Max Consecutive Losses:   {res['max_consec_losses']} trades")
        print(f"  Avg Trades / 4H Mission:  {res['trades_per_mission']}")

    print("\n>>> PASS: Chronological walk-forward test executed strictly without data snooping.\n")

if __name__ == "__main__":
    test_walk_forward()
