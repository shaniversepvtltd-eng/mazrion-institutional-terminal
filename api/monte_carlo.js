// ============================================================================
// MAZRION INSTITUTIONAL TERMINAL: QUANTITATIVE MONTE CARLO REALITY SIMULATOR
// Endpoint: /api/monte_carlo
// Mathematical Model: Geometric Brownian Motion (GBM) & Empirical Return Distribution
// Paths: 10,000 Iterations Parameterized by Real Rolling Volatility (σ) & Drift (μ)
// Classification: DERIVED FROM LIVE / REPRODUCIBLE MODEL OUTPUT
// ============================================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const startTime = Date.now();
    const timestampUtc = new Date().toISOString();

    let spotPrice = null;
    let customTarget = null;
    let customStop = null;
    let timeframe = "5m";

    try {
        const body = req.method === 'POST' ? req.body : req.query;
        if (body) {
            if (body.price) spotPrice = parseFloat(body.price);
            if (body.target) customTarget = parseFloat(body.target);
            if (body.stop) customStop = parseFloat(body.stop);
            if (body.timeframe) timeframe = String(body.timeframe).toLowerCase();
        }
    } catch (e) {}

    try {
        // 1. Fetch live historical candles (30 bars) from Binance PAXG to calculate real realized volatility
        const klineRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${timeframe}&limit=50`);
        let klines = [];
        if (klineRes.ok) {
            klines = await klineRes.json();
        }

        if (!Array.isArray(klines) || klines.length < 10) {
            return res.status(503).json({
                success: false,
                status: "DATA_UNAVAILABLE",
                error: "Insufficient historical klines to calibrate realized volatility",
                timestamp: timestampUtc
            });
        }

        // Parse closes
        const closes = klines.map(k => parseFloat(k[4]));
        const currentSpot = spotPrice || closes[closes.length - 1];

        // 2. Compute Log Returns, Drift (μ), and Realized Volatility (σ)
        const logReturns = [];
        for (let i = 1; i < closes.length; i++) {
            logReturns.push(Math.log(closes[i] / closes[i - 1]));
        }

        const n = logReturns.length;
        const meanReturn = logReturns.reduce((a, b) => a + b, 0) / n;
        const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (n - 1);
        const stdDev = Math.sqrt(variance); // Bar-level volatility

        // Annualized/Standardized Volatility
        const sigma = Math.max(0.001, stdDev);
        const mu = meanReturn; // Drift

        // Calculate ATR (Average True Range)
        let trSum = 0;
        for (let i = 1; i < klines.length; i++) {
            const h = parseFloat(klines[i][2]);
            const l = parseFloat(klines[i][3]);
            const prevC = parseFloat(klines[i - 1][4]);
            const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
            trSum += tr;
        }
        const atr = +(trSum / (klines.length - 1)).toFixed(2);

        // Default TP/SL based on ATR if not provided
        const targetPrice = customTarget || +(currentSpot + (atr * 2.5)).toFixed(2);
        const stopPrice = customStop || +(currentSpot - (atr * 1.5)).toFixed(2);

        // 3. Execute 10,000 Geometric Brownian Motion (GBM) Paths
        // S(t + dt) = S(t) * exp( (mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * Z )
        const numSimulations = 10000;
        const numSteps = 40; // Forward horizon (40 bars)
        const dt = 1.0;

        let hitTargetCount = 0;
        let hitStopCount = 0;
        let finalPrices = new Float64Array(numSimulations);

        // Box-Muller standard normal generator
        function getStandardNormal() {
            let u = 0, v = 0;
            while (u === 0) u = Math.random();
            while (v === 0) v = Math.random();
            return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        }

        // Store 60 representative trajectories for high-performance canvas visualization
        const representativePaths = [];
        const sampleStep = Math.floor(numSimulations / 60);

        for (let sim = 0; sim < numSimulations; sim++) {
            let currentPrice = currentSpot;
            let hitTarget = false;
            let hitStop = false;
            const recordTrajectory = (sim % sampleStep === 0);
            const pathPoints = recordTrajectory ? [currentSpot] : null;

            for (let step = 1; step <= numSteps; step++) {
                const z = getStandardNormal();
                const returnFactor = Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
                currentPrice = currentPrice * returnFactor;

                if (recordTrajectory) pathPoints.push(+currentPrice.toFixed(2));

                if (!hitTarget && !hitStop) {
                    if (currentPrice >= targetPrice) {
                        hitTarget = true;
                    } else if (currentPrice <= stopPrice) {
                        hitStop = true;
                    }
                }
            }

            finalPrices[sim] = currentPrice;
            if (hitTarget) hitTargetCount++;
            if (hitStop) hitStopCount++;

            if (recordTrajectory && representativePaths.length < 60) {
                representativePaths.push({
                    outcome: hitTarget ? "TARGET" : (hitStop ? "STOP" : "NEUTRAL"),
                    points: pathPoints
                });
            }
        }

        // Sort final prices for percentiles & VaR
        finalPrices.sort();

        const p5 = +finalPrices[Math.floor(numSimulations * 0.05)].toFixed(2);
        const p25 = +finalPrices[Math.floor(numSimulations * 0.25)].toFixed(2);
        const p50 = +finalPrices[Math.floor(numSimulations * 0.50)].toFixed(2);
        const p75 = +finalPrices[Math.floor(numSimulations * 0.75)].toFixed(2);
        const p95 = +finalPrices[Math.floor(numSimulations * 0.95)].toFixed(2);

        const var95 = +Math.max(0, currentSpot - p5).toFixed(2); // 95% Value at Risk
        const worst5Percent = Array.from(finalPrices.slice(0, Math.floor(numSimulations * 0.05)));
        const cvar95 = +(currentSpot - (worst5Percent.reduce((a, b) => a + b, 0) / worst5Percent.length)).toFixed(2); // Conditional VaR

        const probTargetBeforeStop = +((hitTargetCount / numSimulations) * 100).toFixed(1);
        const probStopBeforeTarget = +((hitStopCount / numSimulations) * 100).toFixed(1);

        const latencyMs = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            status: "CALCULATED",
            classification: "SIMULATED_SCENARIO_DISTRIBUTION",
            algorithmVersion: "monte_carlo_gbm_v1",
            timestamp: timestampUtc,
            latencyMs,
            parameters: {
                spotPrice: currentSpot,
                targetPrice,
                stopPrice,
                horizonBars: numSteps,
                timeframe,
                simulationsCount: numSimulations,
                driftMu: +mu.toFixed(6),
                volatilitySigma: +sigma.toFixed(6),
                atr: atr
            },
            percentiles: {
                p5,
                p25,
                median_p50: p50,
                p75,
                p95,
                expectedRange: `$${p5} ➔ $${p95}`
            },
            riskMetrics: {
                valueAtRisk95: var95,
                conditionalVaR95: cvar95,
                probTargetBeforeStopPct: probTargetBeforeStop,
                probStopBeforeTargetPct: probStopBeforeTarget,
                expectedEdge: +(((probTargetBeforeStop / 100) * (targetPrice - currentSpot) - ((probStopBeforeTarget / 100) * (currentSpot - stopPrice))) / atr).toFixed(2)
            },
            representativePaths
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            status: "ERROR",
            error: err.message,
            timestamp: timestampUtc
        });
    }
}
