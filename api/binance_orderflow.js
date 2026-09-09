// ============================================================================
// MAZRION INSTITUTIONAL TERMINAL: BINANCE GOLD L2 DOM & CVD ENGINE
// Endpoint: /api/binance_orderflow
// Instrument: PAXGUSDT (Binance Gold-Backed Token Order Flow Proxy)
// Classification: LIVE / DERIVED FROM LIVE (Zero fake DOM generation)
// ============================================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const startTime = Date.now();
    const timestampUtc = new Date().toISOString();

    const binanceHosts = [
        "https://data-api.binance.vision",
        "https://api.binance.com",
        "https://api1.binance.com",
        "https://api3.binance.com"
    ];

    let depthData = null;
    let tradesData = null;
    let successfulHost = null;

    for (const host of binanceHosts) {
        try {
            const depthPromise = fetch(`${host}/api/v3/depth?symbol=PAXGUSDT&limit=50`, {
                headers: { "User-Agent": "Mazrion-Terminal/4.0" },
                signal: AbortSignal.timeout(3500)
            });
            const tradesPromise = fetch(`${host}/api/v3/aggTrades?symbol=PAXGUSDT&limit=500`, {
                headers: { "User-Agent": "Mazrion-Terminal/4.0" },
                signal: AbortSignal.timeout(3500)
            });

            const [depthRes, tradesRes] = await Promise.all([depthPromise, tradesPromise]);

            if (depthRes.ok && tradesRes.ok) {
                depthData = await depthRes.json();
                tradesData = await tradesRes.json();
                successfulHost = host;
                break;
            }
        } catch (e) {
            // Try next mirror
        }
    }

    if (!depthData || !depthData.bids || !Array.isArray(tradesData)) {
        return res.status(503).json({
            success: false,
            status: "DATA_UNAVAILABLE",
            error: "Unable to reach Binance Global public data cluster. Please check connection telemetry.",
            timestamp: timestampUtc,
            latencyMs: Date.now() - startTime
        });
    }

    // 2. Parse & Structure Real L2 Order Book
    let totalBidVolume = 0;
    let totalAskVolume = 0;
    let maxBidWall = { price: 0, qty: 0, usdValue: 0, distancePct: 0 };
    let maxAskWall = { price: 0, qty: 0, usdValue: 0, distancePct: 0 };

    const topBid = parseFloat(depthData.bids[0]?.[0] || 0);
    const topAsk = parseFloat(depthData.asks[0]?.[0] || 0);
    const midPrice = +((topBid + topAsk) / 2).toFixed(2);

    const formattedBids = depthData.bids.map(([priceStr, qtyStr]) => {
        const price = parseFloat(priceStr);
        const qty = parseFloat(qtyStr);
        const usdValue = price * qty;
        totalBidVolume += qty;
        const distancePct = midPrice > 0 ? +(((midPrice - price) / midPrice) * 100).toFixed(2) : 0;
        if (usdValue > maxBidWall.usdValue) {
            maxBidWall = { price, qty, usdValue, distancePct };
        }
        return { price, qty, usdValue, distancePct };
    });

    const formattedAsks = depthData.asks.map(([priceStr, qtyStr]) => {
        const price = parseFloat(priceStr);
        const qty = parseFloat(qtyStr);
        const usdValue = price * qty;
        totalAskVolume += qty;
        const distancePct = midPrice > 0 ? +(((price - midPrice) / midPrice) * 100).toFixed(2) : 0;
        if (usdValue > maxAskWall.usdValue) {
            maxAskWall = { price, qty, usdValue, distancePct };
        }
        return { price, qty, usdValue, distancePct };
    });

    // 3. Stateful Sequential Cumulative Volume Delta (CVD) Calculation
    let buyVolume = 0;
    let sellVolume = 0;
    let runningCvd = 0;
    const cvdHistory = [];

    tradesData.forEach((t) => {
        const price = parseFloat(t.p);
        const qty = parseFloat(t.q);
        const isAggressiveSell = t.m; // isBuyerMaker = true -> seller was aggressive taker

        if (isAggressiveSell) {
            sellVolume += qty;
            runningCvd -= qty;
        } else {
            buyVolume += qty;
            runningCvd += qty;
        }

        cvdHistory.push({
            time: t.T,
            price,
            qty,
            side: isAggressiveSell ? "SELL" : "BUY",
            runningCvd: +runningCvd.toFixed(4)
        });
    });

    const netDelta = buyVolume - sellVolume;
    const totalVolume = buyVolume + sellVolume;
    const deltaPct = totalVolume > 0 ? +((netDelta / totalVolume) * 100).toFixed(1) : 0;
    const orderBookImbalanceRatio = totalAskVolume > 0 ? +(totalBidVolume / totalAskVolume).toFixed(2) : 1.0;

    const bidWallModelScore = +(Math.min(1.0, (maxBidWall.qty / (totalBidVolume * 0.3 || 1)))).toFixed(2);
    const askWallModelScore = +(Math.min(1.0, (maxAskWall.qty / (totalAskVolume * 0.3 || 1)))).toFixed(2);

    return res.status(200).json({
        success: true,
        status: "LIVE",
        instrument: "PAXGUSDT",
        instrumentType: "ORDER_FLOW_PROXY",
        provider: `Binance Global Cluster (${successfulHost})`,
        algorithmVersion: "orderflow_engine_v1",
        timestamp: timestampUtc,
        latencyMs: Date.now() - startTime,
        spotPrice: midPrice,
        topBid,
        topAsk,
        spread: +(topAsk - topBid).toFixed(2),
        orderBook: {
            totalBidOunces: +totalBidVolume.toFixed(3),
            totalAskOunces: +totalAskVolume.toFixed(3),
            bidTotalUsd: +(totalBidVolume * midPrice).toFixed(2),
            askTotalUsd: +(totalAskVolume * midPrice).toFixed(2),
            imbalanceRatio: orderBookImbalanceRatio,
            dominantPressure: orderBookImbalanceRatio > 1.2 ? "BID_DEPTH_DOMINANCE" : (orderBookImbalanceRatio < 0.8 ? "ASK_DEPTH_DOMINANCE" : "BALANCED_DEPTH"),
            bidsTop10: formattedBids.slice(0, 10),
            asksTop10: formattedAsks.slice(0, 10),
            largeRestingLiquidity: {
                largestBid: {
                    label: "Detected Large Resting Bid Liquidity",
                    price: maxBidWall.price,
                    qtyOunces: +maxBidWall.qty.toFixed(3),
                    usdValue: Math.round(maxBidWall.usdValue),
                    distancePct: maxBidWall.distancePct,
                    modelScore: bidWallModelScore
                },
                largestAsk: {
                    label: "Detected Large Resting Ask Liquidity",
                    price: maxAskWall.price,
                    qtyOunces: +maxAskWall.qty.toFixed(3),
                    usdValue: Math.round(maxAskWall.usdValue),
                    distancePct: maxAskWall.distancePct,
                    modelScore: askWallModelScore
                }
            }
        },
        volumeDelta: {
            buyVolumeOunces: +buyVolume.toFixed(3),
            sellVolumeOunces: +sellVolume.toFixed(3),
            netDeltaOunces: +netDelta.toFixed(3),
            deltaPct: deltaPct,
            cvdState: netDelta > 0.5 ? "BULLISH_AGGRESSION" : (netDelta < -0.5 ? "BEARISH_AGGRESSION" : "NEUTRAL_ABSORPTION"),
            tradesSampledCount: tradesData.length,
            recentTrades: cvdHistory.slice(-25)
        }
    });
}
