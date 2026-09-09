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

    let bids = [];
    let asks = [];
    let trades = [];
    let activeProvider = null;

    // Provider A: Binance Global / Cluster Mirrors
    const binanceHosts = [
        "https://data-api.binance.vision",
        "https://api.binance.com",
        "https://api.binance.us",
        "https://api1.binance.com",
        "https://api3.binance.com"
    ];

    for (const host of binanceHosts) {
        try {
            const depthPromise = fetch(`${host}/api/v3/depth?symbol=PAXGUSDT&limit=50`, {
                headers: { "User-Agent": "Mazrion-Terminal/4.0" },
                signal: AbortSignal.timeout(3000)
            });
            const tradesPromise = fetch(`${host}/api/v3/aggTrades?symbol=PAXGUSDT&limit=500`, {
                headers: { "User-Agent": "Mazrion-Terminal/4.0" },
                signal: AbortSignal.timeout(3000)
            });

            const [depthRes, tradesRes] = await Promise.all([depthPromise, tradesPromise]);

            if (depthRes.ok && tradesRes.ok) {
                const depthData = await depthRes.json();
                const rawTrades = await tradesRes.json();
                if (depthData.bids && depthData.bids.length > 0 && Array.isArray(rawTrades)) {
                    bids = depthData.bids;
                    asks = depthData.asks;
                    trades = rawTrades.map(t => ({
                        price: parseFloat(t.p),
                        qty: parseFloat(t.q),
                        isBuyerMaker: t.m,
                        time: t.T
                    }));
                    activeProvider = host.includes("binance.us") ? "Binance US (PAXGUSDT)" : "Binance Global (PAXGUSDT)";
                    break;
                }
            }
        } catch (e) {
            // Try next mirror
        }
    }

    // Provider B: Kraken L2 Depth & Public Trades (Tier-1 Exchange Fallback)
    if (bids.length === 0) {
        try {
            const krakenDepthPromise = fetch("https://api.kraken.com/0/public/Depth?pair=PAXGUSD&count=50", {
                headers: { "User-Agent": "Mazrion-Terminal/4.0" },
                signal: AbortSignal.timeout(3500)
            });
            const krakenTradesPromise = fetch("https://api.kraken.com/0/public/Trades?pair=PAXGUSD", {
                headers: { "User-Agent": "Mazrion-Terminal/4.0" },
                signal: AbortSignal.timeout(3500)
            });

            const [kDepthRes, kTradesRes] = await Promise.all([krakenDepthPromise, krakenTradesPromise]);
            if (kDepthRes.ok && kTradesRes.ok) {
                const kDepthData = await kDepthRes.json();
                const kTradesData = await kTradesRes.json();
                const pairData = kDepthData?.result?.PAXGUSD;
                const tradeList = kTradesData?.result?.PAXGUSD;

                if (pairData && pairData.bids && Array.isArray(tradeList)) {
                    bids = pairData.bids.map(b => [b[0], b[1]]);
                    asks = pairData.asks.map(a => [a[0], a[1]]);
                    trades = tradeList.slice(-500).map(t => ({
                        price: parseFloat(t[0]),
                        qty: parseFloat(t[1]),
                        isBuyerMaker: t[3] === 's', // 's' = sell (taker sell = maker buy)
                        time: Math.floor(t[2] * 1000)
                    }));
                    activeProvider = "Kraken Institutional (PAXG/USD L2)";
                }
            }
        } catch (e) {
            // Kraken failed
        }
    }

    if (bids.length === 0 || trades.length === 0) {
        return res.status(503).json({
            success: false,
            status: "DATA_UNAVAILABLE",
            error: "All tier-1 order flow providers (Binance Global, Binance US, Kraken) are temporarily unreachable.",
            timestamp: timestampUtc,
            latencyMs: Date.now() - startTime
        });
    }

    // 2. Parse & Structure Real L2 Order Book
    let totalBidVolume = 0;
    let totalAskVolume = 0;
    let maxBidWall = { price: 0, qty: 0, usdValue: 0, distancePct: 0 };
    let maxAskWall = { price: 0, qty: 0, usdValue: 0, distancePct: 0 };

    const topBid = parseFloat(bids[0]?.[0] || 0);
    const topAsk = parseFloat(asks[0]?.[0] || 0);
    const midPrice = +((topBid + topAsk) / 2).toFixed(2);

    const formattedBids = bids.map(([priceStr, qtyStr]) => {
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

    const formattedAsks = asks.map(([priceStr, qtyStr]) => {
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

    trades.forEach((t) => {
        const price = t.price;
        const qty = t.qty;
        const isAggressiveSell = t.isBuyerMaker; // isBuyerMaker = true -> seller was aggressive taker

        if (isAggressiveSell) {
            sellVolume += qty;
            runningCvd -= qty;
        } else {
            buyVolume += qty;
            runningCvd += qty;
        }

        cvdHistory.push({
            time: t.time,
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
        provider: activeProvider || "Tier-1 L2 Order Flow Engine",
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
            tradesSampledCount: trades.length,
            recentTrades: cvdHistory.slice(-25)
        }
    });
}
