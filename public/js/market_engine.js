/**
 * ============================================================================
 * MAZRION INSTITUTIONAL TERMINAL: CANONICAL MARKET ENGINE & STATE PROVIDER
 * File: /js/market_engine.js
 * Version: 4.0.0
 * Description: Single Source of Truth for all Mazrion terminal interfaces.
 *              Direct WebSocket ingestion, stateful CVD, dual-pricing,
 *              Data Integrity HUD, and verifiable Data Lineage inspector.
 * ============================================================================
 */

(function(window) {
    'use strict';

    class MarketEngine {
        constructor() {
            this.subscribers = new Set();
            this.wsOrderBook = null;
            this.wsTrades = null;
            this.pollIntervalTimer = null;
            this.isWsConnected = false;
            this.lastWsTradeTime = 0;
            this.lastWsDepthTime = 0;

            // Canonical Market State
            this.state = {
                timestamp: new Date().toISOString(),
                status: 'CONNECTING',
                instruments: {
                    reference: {
                        symbol: 'XAUUSD',
                        name: 'Gold Spot Reference',
                        provider: 'TradingView (OANDA:XAUUSD)',
                        status: 'INITIALIZING',
                        price: 0,
                        bid: 0,
                        ask: 0,
                        spread: 0,
                        changePct: 0,
                        high: 0,
                        low: 0,
                        rsi: 50.0,
                        atr: 12.0,
                        updatedAt: Date.now()
                    },
                    proxy: {
                        symbol: 'PAXGUSDT',
                        name: 'PAX Gold Order Flow Proxy',
                        provider: 'Binance Global WebSocket & REST',
                        status: 'INITIALIZING',
                        price: 0,
                        bid: 0,
                        ask: 0,
                        spread: 0,
                        changePct: 0,
                        updatedAt: Date.now()
                    }
                },
                orderBook: {
                    status: 'INITIALIZING',
                    bids: [],
                    asks: [],
                    topBid: 0,
                    topAsk: 0,
                    spread: 0,
                    imbalanceRatio: 1.0,
                    totalBidOunces: 0,
                    totalAskOunces: 0,
                    largeRestingLiquidity: {
                        largestBid: { price: 0, qtyOunces: 0, usdValue: 0 },
                        largestAsk: { price: 0, qtyOunces: 0, usdValue: 0 }
                    },
                    updatedAt: Date.now()
                },
                cvd: {
                    status: 'INITIALIZING',
                    buyVolume: 0,
                    sellVolume: 0,
                    netDelta: 0,
                    deltaPct: 0,
                    runningCvd: 0,
                    cvdState: 'NEUTRAL_ABSORPTION',
                    recentTrades: [],
                    updatedAt: Date.now()
                },
                structure: {
                    status: 'INITIALIZING',
                    masterHighway: {
                        macro_low: '$0.00',
                        macro_high: '$0.00',
                        progress_pct: 0,
                        active_lap: 1,
                        lap_title: 'Lap 1: Discount Ignition',
                        laps: []
                    },
                    activeRadar: {
                        tf_label: '4H',
                        active_stage: 'CALCULATING',
                        anchor_low: 0,
                        anchor_high: 0,
                        equilibrium: 0,
                        atr: 12.0,
                        exhaustion_pct: 0,
                        levels: { execution_zone: '--', structural_sl: '--', target_1: '--', target_2: '--' }
                    },
                    fractalAnalytica: {
                        composite_score: 0,
                        confidence_score: 0.5,
                        direction_bias: 'NEUTRAL'
                    },
                    updatedAt: Date.now()
                },
                smt: {
                    status: 'INITIALIZING',
                    goldPrice: 0,
                    silverPrice: 0,
                    pearsonR: 0.88,
                    divergence: { hasDivergence: false, explanation: 'Co-movement standard.' },
                    assets: [],
                    updatedAt: Date.now()
                },
                macro: {
                    status: 'INITIALIZING',
                    featuredEvent: null,
                    events: [],
                    updatedAt: Date.now()
                },
                monteCarlo: {
                    status: 'INITIALIZING',
                    percentiles: { p5: 0, p25: 0, median_p50: 0, p75: 0, p95: 0 },
                    riskMetrics: { probTargetBeforeStopPct: 50, valueAtRisk95: 0 },
                    representativePaths: [],
                    updatedAt: Date.now()
                },
                dataHealth: {
                    xauusdStatus: 'INITIALIZING',
                    paxgStatus: 'INITIALIZING',
                    orderBookStatus: 'INITIALIZING',
                    cvdStatus: 'INITIALIZING',
                    macroStatus: 'INITIALIZING',
                    latencyMs: 0
                }
            };
        }

        // Subscribe UI component to state changes
        subscribe(callback) {
            if (typeof callback === 'function') {
                this.subscribers.add(callback);
                // Immediately push current state
                callback(this.state);
            }
            return () => this.subscribers.delete(callback);
        }

        notifySubscribers() {
            this.state.timestamp = new Date().toISOString();
            this.subscribers.forEach(cb => {
                try { cb(this.state); } catch (e) { console.error('Subscriber error:', e); }
            });
            this.updateHudDom();
        }

        // Start Canonical Market Engine
        async init() {
            console.log('⚡ [Mazrion Market Engine v4.0] Initializing Single Source of Truth...');
            this.injectHudDom();

            // 1. Initial REST Backfill
            await this.syncAllRestFeeds();

            // 2. Connect Binance Direct Browser WebSockets for sub-second order book & trades
            this.connectBinanceWebSockets();

            // 3. Periodic High-Level Rest Poll for Macro & Structure (Every 10 seconds)
            this.pollIntervalTimer = setInterval(() => {
                this.syncAllRestFeeds();
            }, 10000);
        }

        // Fetch REST feeds
        async syncAllRestFeeds() {
            const t0 = Date.now();
            try {
                const [pRes, ofRes, calRes, anaRes, smtRes] = await Promise.allSettled([
                    fetch('/api/price').then(r => r.json()),
                    fetch('/api/binance_orderflow').then(r => r.json()),
                    fetch('/api/calendar').then(r => r.json()),
                    fetch('/api/analyze?timeframe=4h').then(r => r.json()),
                    fetch('/api/smt?timeframe=5m').then(r => r.json())
                ]);

                // Update Price
                if (pRes.status === 'fulfilled' && pRes.value.success) {
                    const p = pRes.value;
                    this.state.instruments.reference = {
                        symbol: 'XAUUSD',
                        name: 'Gold Spot Reference',
                        provider: p.provider || 'TradingView (OANDA:XAUUSD)',
                        status: 'LIVE',
                        price: p.price,
                        bid: p.bid,
                        ask: p.ask,
                        spread: p.spread,
                        changePct: p.changePct,
                        high: p.high,
                        low: p.low,
                        rsi: p.rsi,
                        atr: p.atr,
                        updatedAt: Date.now()
                    };
                    this.state.dataHealth.xauusdStatus = 'LIVE';
                }

                // Update Order Flow & CVD
                if (ofRes.status === 'fulfilled' && ofRes.value.success) {
                    const of = ofRes.value;
                    this.state.instruments.proxy = {
                        symbol: 'PAXGUSDT',
                        name: 'PAX Gold Order Flow Proxy',
                        provider: 'Binance Global',
                        status: 'LIVE',
                        price: of.spotPrice,
                        bid: of.topBid,
                        ask: of.topAsk,
                        spread: of.spread,
                        changePct: this.state.instruments.proxy.changePct || 0,
                        updatedAt: Date.now()
                    };

                    this.state.orderBook = {
                        status: 'LIVE',
                        bids: of.orderBook.bidsTop10,
                        asks: of.orderBook.asksTop10,
                        topBid: of.topBid,
                        topAsk: of.topAsk,
                        spread: of.spread,
                        imbalanceRatio: of.orderBook.imbalanceRatio,
                        totalBidOunces: of.orderBook.totalBidOunces,
                        totalAskOunces: of.orderBook.totalAskOunces,
                        largeRestingLiquidity: of.orderBook.largeRestingLiquidity,
                        updatedAt: Date.now()
                    };

                    this.state.cvd = {
                        status: 'LIVE',
                        buyVolume: of.volumeDelta.buyVolumeOunces,
                        sellVolume: of.volumeDelta.sellVolumeOunces,
                        netDelta: of.volumeDelta.netDeltaOunces,
                        deltaPct: of.volumeDelta.deltaPct,
                        cvdState: of.volumeDelta.cvdState,
                        recentTrades: of.volumeDelta.recentTrades,
                        updatedAt: Date.now()
                    };

                    this.state.dataHealth.paxgStatus = 'LIVE';
                    this.state.dataHealth.orderBookStatus = 'LIVE';
                    this.state.dataHealth.cvdStatus = 'LIVE';
                }

                // Update Macro
                if (calRes.status === 'fulfilled' && calRes.value.success) {
                    const c = calRes.value;
                    this.state.macro = {
                        status: 'LIVE',
                        featuredEvent: c.featured_event,
                        events: c.events || [],
                        updatedAt: Date.now()
                    };
                    this.state.dataHealth.macroStatus = 'LIVE';
                }

                // Update Structure & Fractals
                if (anaRes.status === 'fulfilled' && anaRes.value.success) {
                    const a = anaRes.value;
                    this.state.structure = {
                        status: 'LIVE',
                        masterHighway: a.master_highway,
                        activeRadar: a.active_radar,
                        fractalAnalytica: a.fractal_analytica,
                        structureEvents: a.structure_events,
                        updatedAt: Date.now()
                    };
                }

                // Update SMT
                if (smtRes.status === 'fulfilled' && smtRes.value.success) {
                    const smt = smtRes.value;
                    this.state.smt = {
                        status: 'LIVE',
                        goldPrice: smt.correlation.goldPrice,
                        silverPrice: smt.correlation.silverPrice,
                        pearsonR: smt.correlation.pearsonR,
                        divergence: smt.divergence,
                        assets: smt.radarAssets || [],
                        updatedAt: Date.now()
                    };
                }

                this.state.status = 'LIVE_SYNCED';
                this.state.dataHealth.latencyMs = Date.now() - t0;
                this.notifySubscribers();

            } catch (err) {
                console.warn('REST sync partial failure:', err);
            }
        }

        // Direct Browser WebSockets for Sub-Second Binance Order Book & Trades
        connectBinanceWebSockets() {
            try {
                // 1. Direct Binance Depth20 WebSocket Stream
                const wsDepthUrl = 'wss://stream.binance.com:9443/ws/paxgusdt@depth20@100ms';
                this.wsOrderBook = new WebSocket(wsDepthUrl);

                this.wsOrderBook.onopen = () => {
                    this.isWsConnected = true;
                };

                this.wsOrderBook.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.bids && msg.asks) {
                            this.lastWsDepthTime = Date.now();
                            const topBid = parseFloat(msg.bids[0][0]);
                            const topAsk = parseFloat(msg.asks[0][0]);
                            let totalBids = 0, totalAsks = 0;

                            const formattedBids = msg.bids.slice(0, 10).map(([p, q]) => {
                                const price = parseFloat(p);
                                const qty = parseFloat(q);
                                totalBids += qty;
                                return { price, qty, usdValue: price * qty };
                            });

                            const formattedAsks = msg.asks.slice(0, 10).map(([p, q]) => {
                                const price = parseFloat(p);
                                const qty = parseFloat(q);
                                totalAsks += qty;
                                return { price, qty, usdValue: price * qty };
                            });

                            this.state.orderBook.bids = formattedBids;
                            this.state.orderBook.asks = formattedAsks;
                            this.state.orderBook.topBid = topBid;
                            this.state.orderBook.topAsk = topAsk;
                            this.state.orderBook.spread = +(topAsk - topBid).toFixed(2);
                            this.state.orderBook.imbalanceRatio = totalAsks > 0 ? +(totalBids / totalAsks).toFixed(2) : 1.0;
                            this.state.orderBook.updatedAt = Date.now();
                            
                            // Update proxy price if valid
                            if (topBid > 0 && topAsk > 0) {
                                this.state.instruments.proxy.price = +((topBid + topAsk) / 2).toFixed(2);
                                this.state.instruments.proxy.bid = topBid;
                                this.state.instruments.proxy.ask = topAsk;
                                this.state.instruments.proxy.spread = +(topAsk - topBid).toFixed(2);
                                this.state.instruments.proxy.updatedAt = Date.now();
                            }

                            this.notifySubscribers();
                        }
                    } catch (e) {}
                };

                this.wsOrderBook.onerror = () => { this.isWsConnected = false; };
                this.wsOrderBook.onclose = () => {
                    this.isWsConnected = false;
                    setTimeout(() => this.connectBinanceWebSockets(), 5000);
                };

                // 2. Direct Binance aggTrade WebSocket Stream for Real-Time Tick Delta & CVD
                const wsTradeUrl = 'wss://stream.binance.com:9443/ws/paxgusdt@aggTrade';
                this.wsTrades = new WebSocket(wsTradeUrl);

                this.wsTrades.onmessage = (event) => {
                    try {
                        const t = JSON.parse(event.data);
                        if (t && t.p && t.q) {
                            this.lastWsTradeTime = Date.now();
                            const price = parseFloat(t.p);
                            const qty = parseFloat(t.q);
                            const isSell = t.m; // buyer is maker -> seller was aggressive taker

                            if (isSell) {
                                this.state.cvd.sellVolume += qty;
                                this.state.cvd.netDelta -= qty;
                                this.state.cvd.runningCvd -= qty;
                            } else {
                                this.state.cvd.buyVolume += qty;
                                this.state.cvd.netDelta += qty;
                                this.state.cvd.runningCvd += qty;
                            }

                            const totalVol = this.state.cvd.buyVolume + this.state.cvd.sellVolume;
                            this.state.cvd.deltaPct = totalVol > 0 ? +((this.state.cvd.netDelta / totalVol) * 100).toFixed(1) : 0;
                            this.state.cvd.cvdState = this.state.cvd.netDelta > 0 ? 'BULLISH_AGGRESSION' : 'BEARISH_AGGRESSION';
                            this.state.cvd.updatedAt = Date.now();

                            this.state.cvd.recentTrades.unshift({
                                time: t.T,
                                price,
                                qty,
                                side: isSell ? 'SELL' : 'BUY',
                                runningCvd: +this.state.cvd.runningCvd.toFixed(4)
                            });

                            if (this.state.cvd.recentTrades.length > 30) {
                                this.state.cvd.recentTrades.pop();
                            }

                            this.notifySubscribers();
                        }
                    } catch (e) {}
                };

                this.wsTrades.onclose = () => {
                    setTimeout(() => this.connectBinanceWebSockets(), 5000);
                };

            } catch (e) {
                console.warn('WebSocket init exception:', e);
            }
        }

        // Global Data Integrity HUD Injection
        injectHudDom() {
            if (document.getElementById('mazrion-global-hud')) return;

            const hud = document.createElement('div');
            hud.id = 'mazrion-global-hud';
            hud.style.cssText = `
                position: fixed;
                bottom: 12px;
                right: 16px;
                z-index: 99999;
                background: rgba(3, 7, 18, 0.94);
                border: 1px solid rgba(0, 229, 255, 0.35);
                box-shadow: 0 4px 24px rgba(0, 0, 0, 0.7), 0 0 14px rgba(0, 229, 255, 0.2);
                border-radius: 99px;
                padding: 6px 14px;
                display: flex;
                align-items: center;
                gap: 12px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 10px;
                backdrop-filter: blur(12px);
                cursor: pointer;
                transition: all 0.2s ease;
            `;

            hud.title = "Click to inspect full Data Lineage & System Health";
            hud.onclick = () => this.showDataLineageModal();

            hud.innerHTML = `
                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="width:7px; height:7px; border-radius:50%; background:#10B981; box-shadow:0 0 8px #10B981;" id="hud-pulse-dot"></span>
                    <span style="color:#FFF; font-weight:800;" id="hud-status-txt">MAZRION LIVE</span>
                </div>
                <div style="color:var(--text-muted, #94A3B8); display:flex; gap:10px;">
                    <span>XAU: <strong style="color:#00E5FF;" id="hud-xau-price">--</strong></span>
                    <span>PAXG: <strong style="color:#A855F7;" id="hud-paxg-price">--</strong></span>
                    <span>CVD: <strong style="color:#10B981;" id="hud-cvd-val">--</strong></span>
                    <span style="color:#F59E0B;" id="hud-latency-val">-- ms</span>
                </div>
            `;

            document.body.appendChild(hud);
        }

        updateHudDom() {
            const xauEl = document.getElementById('hud-xau-price');
            const paxgEl = document.getElementById('hud-paxg-price');
            const cvdEl = document.getElementById('hud-cvd-val');
            const latEl = document.getElementById('hud-latency-val');

            if (xauEl && this.state.instruments.reference.price) {
                xauEl.innerText = `$${this.state.instruments.reference.price.toFixed(2)}`;
            }
            if (paxgEl && this.state.instruments.proxy.price) {
                paxgEl.innerText = `$${this.state.instruments.proxy.price.toFixed(2)}`;
            }
            if (cvdEl) {
                const delta = this.state.cvd.netDelta;
                cvdEl.innerText = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} oz`;
                cvdEl.style.color = delta >= 0 ? '#10B981' : '#EF4444';
            }
            if (latEl && this.state.dataHealth.latencyMs) {
                latEl.innerText = `${this.state.dataHealth.latencyMs}ms`;
            }
        }

        // Inspectable Data Lineage Modal
        showDataLineageModal() {
            let modal = document.getElementById('mazrion-lineage-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'mazrion-lineage-modal';
                modal.style.cssText = `
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(2, 4, 10, 0.85);
                    backdrop-filter: blur(16px);
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Inter', sans-serif;
                `;
                document.body.appendChild(modal);
            }

            const xau = this.state.instruments.reference;
            const paxg = this.state.instruments.proxy;
            const cvd = this.state.cvd;

            modal.innerHTML = `
                <div style="background:#080E1C; border:1px solid rgba(0,229,255,0.4); border-radius:14px; width:90%; max-width:680px; max-height:85vh; overflow-y:auto; padding:24px; box-shadow:0 0 40px rgba(0,229,255,0.25);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:14px; margin-bottom:18px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:18px;">🛡️</span>
                            <h3 style="color:#FFF; font-family:'Cinzel', serif; font-size:16px; margin:0;">MAZRION DATA INTEGRITY & AUDIT HUD</h3>
                        </div>
                        <button onclick="document.getElementById('mazrion-lineage-modal').remove()" style="background:transparent; border:none; color:#94A3B8; font-size:20px; cursor:pointer;">✕</button>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:14px; font-family:'JetBrains Mono', monospace; font-size:11px;">
                        
                        <!-- Reference Spot -->
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px;">
                            <div style="display:flex; justify-content:space-between; color:#00E5FF; font-weight:800; margin-bottom:6px;">
                                <span>1. XAUUSD REFERENCE SPOT</span>
                                <span>● LIVE (${xau.provider})</span>
                            </div>
                            <div style="color:#94A3B8; line-height:1.6;">
                                • Raw Value: <strong>$${xau.price ? xau.price.toFixed(2) : '--'}</strong> (Bid: $${xau.bid.toFixed(2)} | Ask: $${xau.ask.toFixed(2)})<br>
                                • Spread: <strong>$${xau.spread.toFixed(2)}</strong> | 24h Change: <strong>${xau.changePct}%</strong><br>
                                • Source Lineage: TradingView CFD Real-Time Data Stream
                            </div>
                        </div>

                        <!-- Order Flow Proxy -->
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px;">
                            <div style="display:flex; justify-content:space-between; color:#A855F7; font-weight:800; margin-bottom:6px;">
                                <span>2. PAXGUSDT ORDER FLOW PROXY</span>
                                <span>● LIVE (Binance Global)</span>
                            </div>
                            <div style="color:#94A3B8; line-height:1.6;">
                                • Token Price: <strong>$${paxg.price ? paxg.price.toFixed(2) : '--'}</strong><br>
                                • Order Book Imbalance: <strong>${this.state.orderBook.imbalanceRatio}x Ratio</strong><br>
                                • Classification: <strong>ORDER_FLOW_PROXY</strong> (Explicitly distinguished from physical spot)
                            </div>
                        </div>

                        <!-- CVD Engine -->
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px;">
                            <div style="display:flex; justify-content:space-between; color:#10B981; font-weight:800; margin-bottom:6px;">
                                <span>3. CUMULATIVE VOLUME DELTA (CVD)</span>
                                <span>ALGO: cvd_engine_v1</span>
                            </div>
                            <div style="color:#94A3B8; line-height:1.6;">
                                • Raw Trade Stream: Binance aggTrade WebSocket<br>
                                • Calculation: Sequential Accumulation (Taker Buy Vol - Taker Sell Vol)<br>
                                • Net Delta: <strong style="color:${cvd.netDelta >= 0 ? '#10B981' : '#EF4444'};">${cvd.netDelta >= 0 ? '+' : ''}${cvd.netDelta.toFixed(3)} oz</strong> (${cvd.deltaPct}%)<br>
                                • State: <strong>${cvd.cvdState}</strong>
                            </div>
                        </div>

                        <!-- Options Gamma Notice -->
                        <div style="background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.3); border-radius:8px; padding:12px;">
                            <div style="display:flex; justify-content:space-between; color:#F59E0B; font-weight:800; margin-bottom:6px;">
                                <span>4. CME LEVEL 3 OPTIONS GAMMA (GEX)</span>
                                <span>○ DATA UNAVAILABLE</span>
                            </div>
                            <div style="color:#94A3B8; line-height:1.5;">
                                • Notice: CME/CBOE direct options open interest feed not connected.<br>
                                • Policy: Synthetic GEX values are strictly prohibited by Mazrion Data Integrity Rules.
                            </div>
                        </div>

                    </div>
                </div>
            `;
        }
    }

    // Export Singleton on window
    window.MazrionMarketEngine = new MarketEngine();

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.MazrionMarketEngine.init());
    } else {
        window.MazrionMarketEngine.init();
    }

})(window);
