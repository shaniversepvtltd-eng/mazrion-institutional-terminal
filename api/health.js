// ============================================================================
// MAZRION INSTITUTIONAL TERMINAL: CENTRAL DATA INTEGRITY & SYSTEM HEALTH ENGINE
// Endpoint: /api/health
// Purpose: Continuous telemetry auditing of all connected feeds and engines
// ============================================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const startTime = Date.now();
    const timestampUtc = new Date().toISOString();

    const services = [
        {
            name: "XAUUSD Reference Feed",
            provider: "TradingView (OANDA:XAUUSD)",
            endpoint: "https://scanner.tradingview.com/cfd/scan",
            type: "REST_SCANNER"
        },
        {
            name: "PAXG Order Flow Proxy L2",
            provider: "Binance Global Depth API",
            endpoint: "https://api.binance.com/api/v3/depth?symbol=PAXGUSDT&limit=5",
            type: "REST_DEPTH"
        },
        {
            name: "PAXG Trade Stream (CVD)",
            provider: "Binance Global aggTrades API",
            endpoint: "https://api.binance.com/api/v3/aggTrades?symbol=PAXGUSDT&limit=5",
            type: "REST_TRADES"
        },
        {
            name: "Macro Calendar Feed",
            provider: "ForexFactory Live JSON",
            endpoint: "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
            type: "REST_JSON"
        },
        {
            name: "Analytical Memory (Supabase)",
            provider: "Supabase PostgreSQL RPC",
            endpoint: "https://xnuvkkqrzogzoryxzkec.supabase.co",
            type: "SUPABASE_DB"
        }
    ];

    const healthChecks = await Promise.allSettled(
        services.map(async (s) => {
            const t0 = Date.now();
            try {
                const response = await fetch(s.endpoint, {
                    headers: { "User-Agent": "Mazrion-Health-Check/4.0" },
                    signal: AbortSignal.timeout(4000)
                });
                const lat = Date.now() - t0;
                return {
                    name: s.name,
                    provider: s.provider,
                    type: s.type,
                    status: response.ok ? "LIVE" : "DEGRADED",
                    httpStatus: response.status,
                    latencyMs: lat,
                    lastChecked: new Date().toISOString()
                };
            } catch (err) {
                return {
                    name: s.name,
                    provider: s.provider,
                    type: s.type,
                    status: "OFFLINE",
                    error: err.message,
                    latencyMs: Date.now() - t0,
                    lastChecked: new Date().toISOString()
                };
            }
        })
    );

    const results = healthChecks.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        return {
            name: services[i].name,
            provider: services[i].provider,
            status: "ERROR",
            error: r.reason?.message || "Unknown error",
            lastChecked: new Date().toISOString()
        };
    });

    const isSystemHealthy = results.every(r => r.status === 'LIVE');

    return res.status(200).json({
        success: true,
        systemStatus: isSystemHealthy ? "100% OPERATIONAL" : "PARTIAL_DEGRADATION",
        timestamp: timestampUtc,
        totalAuditLatencyMs: Date.now() - startTime,
        dataFeeds: results,
        optionsModule: {
            name: "CME Level 3 Options Gamma (GEX)",
            status: "DATA_UNAVAILABLE",
            reason: "CME/CBOE Direct Options Feed not connected. Synthetic GEX is prohibited by Mazrion Data Integrity Rules."
        }
    });
}
