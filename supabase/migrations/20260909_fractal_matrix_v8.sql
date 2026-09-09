-- ============================================================================
-- MAZRION FRACTAL MATRIX v8.0 SUPABASE PERSISTENCE SCHEMA
-- Tables for recursive multi-timeframe cycles, parent-child relationships,
-- and look-ahead-free structural state transitions.
-- ============================================================================

-- 1. Fractal Cycles Table
CREATE TABLE IF NOT EXISTS public.fractal_cycles (
    cycle_id VARCHAR(64) PRIMARY KEY,
    parent_cycle_id VARCHAR(64) REFERENCES public.fractal_cycles(cycle_id) ON DELETE SET NULL,
    timeframe VARCHAR(8) NOT NULL,
    symbol VARCHAR(16) NOT NULL DEFAULT 'XAUUSD',
    direction VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'FORMING', 'IMPULSE', 'RETRACEMENT', 'EXPANSION', 'TARGET_INTERACTION', 'COMPLETED', 'INVALIDATED', 'RESET'
    origin_price NUMERIC(12, 4) NOT NULL,
    origin_timestamp TIMESTAMPTZ NOT NULL,
    current_price NUMERIC(12, 4),
    swing_high NUMERIC(12, 4),
    swing_low NUMERIC(12, 4),
    destination_price NUMERIC(12, 4),
    destination_type VARCHAR(64),
    invalidation_price NUMERIC(12, 4),
    atr_at_creation NUMERIC(10, 4),
    atr_current NUMERIC(10, 4),
    displacement_range NUMERIC(12, 4),
    completion_score NUMERIC(5, 2) DEFAULT 0.0,
    score_components JSONB DEFAULT '{}'::jsonb,
    completed_child_count INT DEFAULT 0,
    active_child_id VARCHAR(64),
    start_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_timestamp TIMESTAMPTZ,
    detection_reason TEXT,
    algorithm_version VARCHAR(32) NOT NULL DEFAULT 'fractal_engine_v8.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for fast parent-child traversal and timeframe lookups
CREATE INDEX IF NOT EXISTS idx_fractal_cycles_parent ON public.fractal_cycles(parent_cycle_id);
CREATE INDEX IF NOT EXISTS idx_fractal_cycles_tf ON public.fractal_cycles(timeframe, status);
CREATE INDEX IF NOT EXISTS idx_fractal_cycles_symbol ON public.fractal_cycles(symbol, start_timestamp DESC);

-- 2. Fractal Structural Events Table (BOS, CHoCH, Sweeps, FVG Fills)
CREATE TABLE IF NOT EXISTS public.fractal_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id VARCHAR(64) REFERENCES public.fractal_cycles(cycle_id) ON DELETE CASCADE,
    timeframe VARCHAR(8) NOT NULL,
    event_type VARCHAR(32) NOT NULL, -- 'BOS', 'CHOCH', 'SWEEP_HIGH', 'SWEEP_LOW', 'FVG_CREATION', 'FVG_FILL', 'TARGET_INTERACTION'
    price NUMERIC(12, 4) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fractal_events_cycle ON public.fractal_events(cycle_id, timestamp);

-- 3. Fractal State Transitions Audit Log
CREATE TABLE IF NOT EXISTS public.fractal_state_transitions (
    transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id VARCHAR(64) REFERENCES public.fractal_cycles(cycle_id) ON DELETE CASCADE,
    from_state VARCHAR(32) NOT NULL,
    to_state VARCHAR(32) NOT NULL,
    reason TEXT NOT NULL,
    metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fractal_transitions_cycle ON public.fractal_state_transitions(cycle_id, timestamp DESC);
