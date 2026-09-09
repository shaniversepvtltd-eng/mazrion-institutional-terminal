-- ============================================================================
-- MAZRION INSTITUTIONAL TERMINAL: PERSISTENT MEMORY & AUDITING SCHEMA
-- Database: Supabase PostgreSQL
-- Version: 4.0.0
-- Description: Historical Candles, Structure Events, CVD Aggregates, Macro,
--              Reproducible Signals, AI Snapshots, System Health & Auditing.
-- ============================================================================

-- 1. Market Instruments Registry
CREATE TABLE IF NOT EXISTS market_instruments (
    symbol VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    instrument_type VARCHAR(32) NOT NULL, -- 'REFERENCE_SPOT', 'ORDER_FLOW_PROXY', 'CORRELATION_ASSET', 'INDEX'
    provider VARCHAR(64) NOT NULL,
    base_currency VARCHAR(16) NOT NULL,
    quote_currency VARCHAR(16) NOT NULL,
    tick_size NUMERIC(12, 5) NOT NULL,
    contract_size NUMERIC(12, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Canonical Instruments
INSERT INTO market_instruments (symbol, name, instrument_type, provider, base_currency, quote_currency, tick_size, contract_size)
VALUES 
('XAUUSD', 'Gold Spot Reference', 'REFERENCE_SPOT', 'TradingView (OANDA)', 'XAU', 'USD', 0.01, 100),
('PAXGUSDT', 'PAX Gold Token Order Flow Proxy', 'ORDER_FLOW_PROXY', 'Binance Global', 'PAXG', 'USDT', 0.01, 1),
('XAGUSDT', 'Silver Spot Proxy', 'CORRELATION_ASSET', 'Binance Global', 'XAG', 'USDT', 0.001, 1),
('DXY', 'US Dollar Index Proxy', 'INDEX', 'TradingView / Market Proxy', 'USD', 'USD', 0.01, 1),
('US10Y', 'US 10-Year Treasury Yield', 'INDEX', 'TradingView / Treasury Proxy', 'USD', 'PCT', 0.001, 1)
ON CONFLICT (symbol) DO UPDATE SET updated_at = NOW();

-- 2. Historical & Normalized Candlestick Storage
CREATE TABLE IF NOT EXISTS market_candles (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    timeframe VARCHAR(8) NOT NULL, -- '1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'
    open_time TIMESTAMPTZ NOT NULL,
    close_time TIMESTAMPTZ NOT NULL,
    open NUMERIC(16, 5) NOT NULL,
    high NUMERIC(16, 5) NOT NULL,
    low NUMERIC(16, 5) NOT NULL,
    close NUMERIC(16, 5) NOT NULL,
    volume NUMERIC(20, 5) NOT NULL,
    quote_volume NUMERIC(24, 5),
    trades_count INTEGER,
    provider VARCHAR(64) NOT NULL,
    is_closed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_candle_symbol_tf_time UNIQUE (symbol, timeframe, open_time)
);
CREATE INDEX IF NOT EXISTS idx_candles_lookup ON market_candles(symbol, timeframe, open_time DESC);

-- 3. Stateful Cumulative Volume Delta (CVD) Aggregates
CREATE TABLE IF NOT EXISTS cvd_aggregates (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    timeframe VARCHAR(8) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
    bucket_time TIMESTAMPTZ NOT NULL,
    buy_volume NUMERIC(20, 5) NOT NULL,
    sell_volume NUMERIC(20, 5) NOT NULL,
    delta NUMERIC(20, 5) NOT NULL,
    cvd_running NUMERIC(20, 5) NOT NULL,
    trades_count INTEGER NOT NULL,
    vwap NUMERIC(16, 5),
    session_id VARCHAR(32), -- 'ASIA', 'LONDON', 'NEW_YORK'
    algorithm_version VARCHAR(32) DEFAULT 'cvd_engine_v1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_cvd_bucket UNIQUE (symbol, timeframe, bucket_time)
);
CREATE INDEX IF NOT EXISTS idx_cvd_lookup ON cvd_aggregates(symbol, timeframe, bucket_time DESC);

-- 4. Market Structure Events (BOS, CHoCH, Displacement, Swing Pivots)
CREATE TABLE IF NOT EXISTS market_structure_events (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    timeframe VARCHAR(8) NOT NULL,
    event_type VARCHAR(32) NOT NULL, -- 'BOS_BULL', 'BOS_BEAR', 'CHOCH_BULL', 'CHOCH_BEAR', 'SWING_HIGH', 'SWING_LOW', 'LIQUIDITY_SWEEP'
    price NUMERIC(16, 5) NOT NULL,
    invalidation_price NUMERIC(16, 5),
    candle_time TIMESTAMPTZ NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    strength NUMERIC(5, 2), -- 0.00 to 1.00
    description TEXT,
    algorithm_version VARCHAR(32) DEFAULT 'structure_engine_v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_struct_events ON market_structure_events(symbol, timeframe, detected_at DESC);

-- 5. Fair Value Gaps (FVG) & Order Blocks
CREATE TABLE IF NOT EXISTS fair_value_gaps (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    timeframe VARCHAR(8) NOT NULL,
    direction VARCHAR(8) NOT NULL, -- 'BULLISH', 'BEARISH'
    zone_top NUMERIC(16, 5) NOT NULL,
    zone_bottom NUMERIC(16, 5) NOT NULL,
    creation_time TIMESTAMPTZ NOT NULL,
    is_mitigated BOOLEAN DEFAULT FALSE,
    mitigation_time TIMESTAMPTZ,
    fill_pct NUMERIC(5, 2) DEFAULT 0.00,
    algorithm_version VARCHAR(32) DEFAULT 'fvg_engine_v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_blocks (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    timeframe VARCHAR(8) NOT NULL,
    direction VARCHAR(8) NOT NULL, -- 'BULLISH_DEMAND', 'BEARISH_SUPPLY'
    zone_top NUMERIC(16, 5) NOT NULL,
    zone_bottom NUMERIC(16, 5) NOT NULL,
    volume_at_block NUMERIC(20, 5),
    creation_time TIMESTAMPTZ NOT NULL,
    is_mitigated BOOLEAN DEFAULT FALSE,
    mitigation_time TIMESTAMPTZ,
    algorithm_version VARCHAR(32) DEFAULT 'order_block_engine_v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Macro Economic Calendar & Event Impact Tracking
CREATE TABLE IF NOT EXISTS macro_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) UNIQUE,
    country VARCHAR(8) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    impact VARCHAR(16) NOT NULL, -- 'High', 'Medium', 'Low'
    title VARCHAR(256) NOT NULL,
    scheduled_time_utc TIMESTAMPTZ NOT NULL,
    scheduled_time_ist TIMESTAMPTZ NOT NULL,
    forecast VARCHAR(32),
    previous VARCHAR(32),
    actual VARCHAR(32),
    surprise_delta NUMERIC(12, 4),
    status VARCHAR(16) NOT NULL, -- 'UPCOMING', 'RELEASED', 'REVISED'
    source VARCHAR(64) DEFAULT 'ForexFactory Live JSON',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_macro_time ON macro_events(scheduled_time_utc DESC);

CREATE TABLE IF NOT EXISTS macro_market_reactions (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) REFERENCES macro_events(event_id),
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    window_minutes INTEGER NOT NULL, -- 1, 5, 15, 30, 60
    pre_event_price NUMERIC(16, 5) NOT NULL,
    post_event_price NUMERIC(16, 5) NOT NULL,
    price_change_abs NUMERIC(16, 5) NOT NULL,
    price_change_pct NUMERIC(8, 4) NOT NULL,
    volume_surge_ratio NUMERIC(8, 2),
    cvd_reaction NUMERIC(20, 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SMT Cross-Asset Correlation Metrics
CREATE TABLE IF NOT EXISTS smt_metrics (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    window_periods INTEGER NOT NULL DEFAULT 30,
    timeframe VARCHAR(8) NOT NULL DEFAULT '5m',
    gold_silver_corr NUMERIC(6, 4) NOT NULL, -- Pearson r (-1.0000 to 1.0000)
    gold_dxy_corr NUMERIC(6, 4),
    gold_us10y_corr NUMERIC(6, 4),
    divergence_flag VARCHAR(64), -- 'BULLISH_SMT_CONFIRMED', 'BEARISH_SMT_CONFIRMED', 'NONE'
    divergence_details JSONB,
    algorithm_version VARCHAR(32) DEFAULT 'smt_engine_v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Monte Carlo Simulation Runs (Reproducible Metadata)
CREATE TABLE IF NOT EXISTS monte_carlo_runs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    spot_price NUMERIC(16, 5) NOT NULL,
    paths_count INTEGER NOT NULL DEFAULT 10000,
    horizon_periods INTEGER NOT NULL,
    timeframe VARCHAR(8) NOT NULL,
    drift_mu NUMERIC(12, 8) NOT NULL,
    volatility_sigma NUMERIC(12, 8) NOT NULL,
    atr NUMERIC(12, 5) NOT NULL,
    model_type VARCHAR(32) NOT NULL DEFAULT 'GEOMETRIC_BROWNIAN_MOTION',
    percentile_5 NUMERIC(16, 5),
    percentile_25 NUMERIC(16, 5),
    median_path NUMERIC(16, 5),
    percentile_75 NUMERIC(16, 5),
    percentile_95 NUMERIC(16, 5),
    var_95 NUMERIC(16, 5),
    cvar_95 NUMERIC(16, 5),
    target_price NUMERIC(16, 5),
    stop_price NUMERIC(16, 5),
    prob_target_before_stop NUMERIC(6, 4),
    algorithm_version VARCHAR(32) DEFAULT 'monte_carlo_engine_v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Reproducible Quantitative Signals & State Auditing
CREATE TABLE IF NOT EXISTS quantitative_signals (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    timeframe VARCHAR(8) NOT NULL,
    signal_side VARCHAR(16) NOT NULL, -- 'BUY', 'SELL', 'NEUTRAL'
    suggested_entry NUMERIC(16, 5) NOT NULL,
    suggested_sl NUMERIC(16, 5) NOT NULL,
    suggested_tp1 NUMERIC(16, 5) NOT NULL,
    suggested_tp2 NUMERIC(16, 5),
    risk_reward_ratio NUMERIC(6, 2) NOT NULL,
    confidence_score NUMERIC(5, 2) NOT NULL, -- 0.00 to 1.00
    trend_score INTEGER NOT NULL,
    structure_score INTEGER NOT NULL,
    cvd_score INTEGER NOT NULL,
    orderbook_score INTEGER NOT NULL,
    smt_score INTEGER NOT NULL,
    macro_score INTEGER NOT NULL,
    composite_score INTEGER NOT NULL,
    invalidation_condition TEXT NOT NULL,
    market_snapshot JSONB NOT NULL, -- Complete reproducible state snapshot
    algorithm_version VARCHAR(32) DEFAULT 'signal_engine_v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signals_time ON quantitative_signals(symbol, timestamp DESC);

-- 10. AI Analytical Snapshots (Auditable & Grounded)
CREATE TABLE IF NOT EXISTS ai_analyses (
    id BIGSERIAL PRIMARY KEY,
    analysis_uuid UUID DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    provider VARCHAR(32) NOT NULL, -- 'DeepSeek v3', 'OpenRouter'
    model VARCHAR(64) NOT NULL,
    prompt_version VARCHAR(32) DEFAULT 'mazrion_telemetry_v1',
    input_market_state JSONB NOT NULL,
    output_facts TEXT NOT NULL,
    output_calculations TEXT NOT NULL,
    output_inferences TEXT NOT NULL,
    output_scenarios TEXT NOT NULL,
    output_risks TEXT NOT NULL,
    full_response TEXT NOT NULL,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. System Data Health & Telemetry Logging
CREATE TABLE IF NOT EXISTS system_data_health (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    provider VARCHAR(64) NOT NULL,
    endpoint VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL, -- 'LIVE', 'DELAYED', 'STALE', 'OFFLINE', 'ERROR'
    latency_ms INTEGER,
    data_age_ms INTEGER,
    error_message TEXT,
    quality_flag VARCHAR(16) NOT NULL DEFAULT 'RAW_FEED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_time ON system_data_health(timestamp DESC);

-- 12. Recursive Fractal Structural Cycles (1MO to 1M)
CREATE TABLE IF NOT EXISTS fractal_structural_cycles (
    cycle_id VARCHAR(64) PRIMARY KEY,
    parent_cycle_id VARCHAR(64) REFERENCES fractal_structural_cycles(cycle_id),
    timeframe VARCHAR(8) NOT NULL, -- '1mo', '1w', '1d', '4h', '1h', '30m', '15m', '5m', '1m'
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    start_timestamp TIMESTAMPTZ NOT NULL,
    end_timestamp TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL, -- 'FORMING', 'IMPULSE', 'RETRACEMENT', 'EXPANSION', 'CONSOLIDATION', 'TARGET_INTERACTION', 'COMPLETED', 'INVALIDATED', 'RESET'
    direction VARCHAR(16) NOT NULL, -- 'BULLISH', 'BEARISH', 'NEUTRAL'
    origin_price NUMERIC(16, 5) NOT NULL,
    origin_timestamp TIMESTAMPTZ NOT NULL,
    current_price NUMERIC(16, 5) NOT NULL,
    swing_high NUMERIC(16, 5) NOT NULL,
    swing_low NUMERIC(16, 5) NOT NULL,
    destination_price NUMERIC(16, 5) NOT NULL,
    destination_type VARCHAR(64) NOT NULL,
    invalidation_price NUMERIC(16, 5) NOT NULL,
    atr_at_creation NUMERIC(12, 5) NOT NULL,
    atr_current NUMERIC(12, 5) NOT NULL,
    displacement_range NUMERIC(16, 5) NOT NULL,
    completed_child_count INTEGER DEFAULT 0,
    active_child_id VARCHAR(64),
    completion_score NUMERIC(5, 2) DEFAULT 0.0,
    score_components JSONB NOT NULL,
    parent_alignment VARCHAR(32) NOT NULL DEFAULT 'ALIGNED', -- 'ALIGNED', 'COUNTERTREND', 'NEUTRAL', 'INVALIDATED'
    algorithm_version VARCHAR(32) DEFAULT 'fractal_engine_v9.1.0',
    detection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fractal_cycles ON fractal_structural_cycles(symbol, timeframe, start_timestamp DESC);

-- 13. Recursive 1M Trade Execution Ledger (CONDITIONED ON HIGHER TIMEFRAME MISSION)
CREATE TABLE IF NOT EXISTS fractal_1m_executions (
    execution_id VARCHAR(64) PRIMARY KEY,
    cycle_id_1m VARCHAR(64) NOT NULL REFERENCES fractal_structural_cycles(cycle_id),
    parent_mission_id_4h VARCHAR(64),
    parent_chain JSONB NOT NULL, -- ['1mo', '1w', '1d', '4h', '1h', '30m', '15m', '5m', '1m']
    symbol VARCHAR(32) NOT NULL REFERENCES market_instruments(symbol),
    entry_timestamp TIMESTAMPTZ NOT NULL,
    entry_price NUMERIC(16, 5) NOT NULL,
    stop_loss NUMERIC(16, 5) NOT NULL,
    take_profit_1 NUMERIC(16, 5) NOT NULL,
    take_profit_2 NUMERIC(16, 5),
    parent_destination NUMERIC(16, 5) NOT NULL,
    risk_reward_ratio NUMERIC(6, 2) NOT NULL,
    risk_percent NUMERIC(5, 2) NOT NULL DEFAULT 2.00, -- Small-cap Mazrion 2% cap
    dollar_risk NUMERIC(12, 2) NOT NULL,
    position_size_lots NUMERIC(8, 2) NOT NULL,
    setup_score NUMERIC(5, 2) NOT NULL, -- 0-100 Deterministic Structural Score
    setup_score_components JSONB NOT NULL,
    parent_alignment VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL, -- 'ACTIVE', 'TP1_HIT', 'TP2_HIT', 'STOPPED_OUT', 'INVALIDATED', 'MANUALLY_CLOSED'
    exit_timestamp TIMESTAMPTZ,
    exit_price NUMERIC(16, 5),
    realized_r_multiple NUMERIC(6, 2),
    exit_reason TEXT,
    algorithm_version VARCHAR(32) DEFAULT 'fractal_engine_v9.1.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_1m_exec ON fractal_1m_executions(symbol, entry_timestamp DESC);

