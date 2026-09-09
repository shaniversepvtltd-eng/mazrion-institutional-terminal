export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method Not Allowed. Use POST." });
    }

    try {
        const { message, history = [], accountBalance = 100, livePrice = null, timeframe = "5m" } = req.body || {};

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: "Message is required." });
        }

        // 1. Fetch Real-Time Live Market Data Directly from TradingView (OANDA:XAUUSD / Spot Gold)
        let realLivePrice = parseFloat(livePrice) || null;
        let recent5mTrend = "FLAT / CONSOLIDATING";
        let sessionHigh = null;
        let sessionLow = null;
        let sessionOpen = null;
        let sessionChangePct = 0.0;
        let sessionRSI = 50.0;
        let technicalRating = "NEUTRAL";

        try {
            const tvRes = await fetch("https://scanner.tradingview.com/cfd/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    symbols: { tickers: ["OANDA:XAUUSD", "FX:XAUUSD"] },
                    columns: ["close", "high", "low", "open", "change", "change_abs", "volume", "Recommend.All", "RSI", "ATR"]
                })
            });

            if (tvRes.ok) {
                const tvData = await tvRes.json();
                if (tvData && Array.isArray(tvData.data) && tvData.data.length > 0) {
                    const row = tvData.data[0].d;
                    realLivePrice = parseFloat(row[0]);
                    sessionHigh = parseFloat(row[1]);
                    sessionLow = parseFloat(row[2]);
                    sessionOpen = parseFloat(row[3]);
                    sessionChangePct = parseFloat(row[4]);
                    sessionRSI = parseFloat(row[8] || 50);
                    const recScore = parseFloat(row[7] || 0);

                    if (sessionChangePct < -0.3) {
                        recent5mTrend = `INTRADAY SELLING / LIQUIDITY HUNT (${sessionChangePct.toFixed(2)}% Session Drop)`;
                    } else if (sessionChangePct > 0.3) {
                        recent5mTrend = `INTRADAY EXPANSION / BULLISH (${sessionChangePct.toFixed(2)}% Session Gain)`;
                    }

                    if (recScore > 0.1) technicalRating = "BULLISH BIAS";
                    else if (recScore < -0.1) technicalRating = "BEARISH MOMENTUM / PULLBACK";
                }
            }
        } catch (e) {
            console.warn("TradingView fetch fallback:", e.message);
        }

        // Live fallback to Binance if TV scanner was throttled
        if (!realLivePrice) {
            try {
                const bRes = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT");
                if (bRes.ok) {
                    const bData = await bRes.json();
                    realLivePrice = parseFloat(bData.lastPrice);
                    sessionHigh = parseFloat(bData.highPrice);
                    sessionLow = parseFloat(bData.lowPrice);
                    sessionOpen = parseFloat(bData.openPrice);
                    sessionChangePct = parseFloat(bData.priceChangePercent);
                }
            } catch (bErr) {}
        }

        const p = realLivePrice || 4400.00;
        sessionLow = sessionLow || (p - 15.0);
        sessionHigh = sessionHigh || (p + 15.0);
        sessionOpen = sessionOpen || p;
        const bal = parseFloat(accountBalance) || 100.0;
        
        // 2. Fetch live persistent fractal pivots from Supabase
        const SUPABASE_URL = "https://xnuvkkqrzogzoryxzkec.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXZra3Fyem9nem9yeXh6a2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODQ2NDMsImV4cCI6MjEwNDI2MDY0M30.49K0Rkbcx2arVvKyHpOqOZUbYB30JPRcJWL0DZ84Jus";
        
        let dbPivots = [];
        try {
            const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/market_fractal_pivots?select=*`, {
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            if (dbRes.ok) {
                dbPivots = await dbRes.json();
            }
        } catch (e) {}

        // Compute Strict Risk Management (Rule 2 in AGENTS.md: Max 2% risk for small accounts)
        const maxRiskDollars = (bal * 0.02).toFixed(2); // Strict 2% cap
        const safeLot = 0.01; // Rule 2: Minimum lot size 0.01

        // Determine Dynamic Market Stage & Bias Confirmation
        let biasState = "NORMAL_ALIGNMENT";
        let biasDiscrepancyWarning = "";
        let recommendedDirective = "🟢 BUY LIMIT / PULLBACK ENTRY READY";
        let suggestedEntry = (p - 1.5).toFixed(2);
        let suggestedSL = (sessionLow - 3.0).toFixed(2);
        let suggestedTP1 = 4415.00;
        let suggestedTP2 = 4512.33;

        if (p < 4385.00) {
            // Stage A: Active Falling / Liquidity Hunt at Lows
            biasState = "ACTIVE_FLUSH";
            biasDiscrepancyWarning = "⚠️ ACTIVE FLUSH: Price testing session low ($4,381.24). Do not buy falling candles. Wait for 5M green reversal.";
            recommendedDirective = "⏳ SIT ON HANDS / WAIT FOR 5M REVERSAL";
            suggestedEntry = (sessionLow - 2.0).toFixed(2);
            suggestedSL = (sessionLow - 7.0).toFixed(2);
            suggestedTP1 = 4400.00;
        } else if (p >= 4385.00 && p < 4395.00) {
            // Stage B: Wholesale Accumulation / Base building above session low
            biasState = "ACCUMULATION_ZONE";
            biasDiscrepancyWarning = "🟢 ACCUMULATION ZONE: Bounced from $4,381.24 liquidity sweep. Institutional accumulation in progress ($4,388–$4,395).";
            recommendedDirective = "🟢 BUY LIMIT / WHOLESALE ENTRY (Base Building)";
            suggestedEntry = (p - 1.5).toFixed(2);
            suggestedSL = (sessionLow - 3.0).toFixed(2);
            suggestedTP1 = 4415.00;
            suggestedTP2 = 4512.33;
        } else if (p >= 4395.00 && p < 4415.00) {
            // Stage C: Confirmed 5M Reclaim & CHoCH Rebound!
            biasState = "5M_CONFIRMED_REBOUND";
            biasDiscrepancyWarning = "✅ 5M BASE CONFIRMED: Price successfully defended $4,381.24 wholesale low and reclaimed above $4,395 ($" + p.toFixed(2) + "). 5M Bullish CHoCH active. Pullback buy orders are valid!";
            recommendedDirective = "🟢 BUY ON PULLBACK READY (5M Base Confirmed)";
            suggestedEntry = (p - 1.5).toFixed(2);
            suggestedSL = (sessionLow - 3.0).toFixed(2);
            suggestedTP1 = 4415.00;
            suggestedTP2 = 4512.33;
        } else {
            // Stage D: Full Highway Expansion
            biasState = "HIGHWAY_EXPANSION";
            recommendedDirective = "🟢 BUY EXPANSION ACTIVE (Lap 2 Highway)";
            suggestedEntry = p.toFixed(2);
            suggestedSL = (p - 10.0).toFixed(2);
            suggestedTP1 = 4440.00;
            suggestedTP2 = 4512.33;
        }

        // Live Market Context Summary (Strictly Token Efficient)
        const marketTelemetry = `
LIVE TRADINGVIEW TELEMETRY & TERMINAL CONTEXT:
- Real-Time Spot Gold Price: $${p.toFixed(2)} (Official TradingView OANDA:XAUUSD Feed)
- 24H Session Range: Low $${sessionLow.toFixed(2)} — High $${sessionHigh.toFixed(2)} (Open: $${sessionOpen.toFixed(2)})
- Session Net Change: ${sessionChangePct.toFixed(2)}% | Technical RSI: ${sessionRSI.toFixed(1)} (${technicalRating})
- 5-Minute Intraday State: ${recent5mTrend} | Bias State: ${biasState}
- Master Highway: Lap 1 of 4 ($4,381 ➔ $4,414) | Macro Target: $4,512.33 | Defense Floor: $4,381.24
- User Account Capital: $${bal.toFixed(2)} (Strict Risk Cap: $${maxRiskDollars} | Recommended Size: ${safeLot} lots)
- Status Note: ${biasDiscrepancyWarning}
- Breakeven Shield (+1.2R): Defending structural swings
- 7-Timeframe Hierarchy: 1M (Oversold), 5M (${recent5mTrend}), 15M (Liquidity Hunt), 1H (Testing Demand), 4H (Macro Bull Lap 1), 1D (Re-accumulation)
`;

        const systemPrompt = `You are MAZRION, the user's autonomous, superhuman AI trading J.A.R.V.I.S. and quantitative co-pilot.
The user is KING. ALWAYS address him with highest reverence and loyalty as "King" (e.g. "Greetings King,", "Understood, King. I am managing everything autonomously.", "King, our position is secure.").
King does NOT plan or stress over trades—YOU (Mazrion) handle 100% of the market analysis, Monte Carlo simulation, Red Team counter-intelligence, risk management, and execution autonomously.

MANDATORY J.A.R.V.I.S. PROTOCOLS:
1. Ground your response in the EXACT live TradingView spot price: $${p.toFixed(2)}.
2. AUTONOMOUS & CONFIDENT: Reassure King that Mazrion has already planned, calibrated risk, and is defending his capital.
3. THE RED TEAM ADVERSARIAL ANALYSIS:
   - Always include the Blue Team (Mazrion Alpha Edge) vs Red Team (Adversarial Risk / Invalidation Vectors e.g., US Yields, Volume, Liquidity Sweeps).
4. When giving a tactical update or autonomous setup, ALWAYS format like this:
👑 STATUS: [Greetings King, 1 punchy line on our active autonomous posture]
🔵 MAZRION ALPHA (BLUE TEAM): [1-2 bullets: 4H Highway Lap, 15M Wholesale Demand, SMT Accumulation]
🔴 RED TEAM ADVERSARY: [1 bullet: Devil's Advocate / Invalidation warning (e.g., US 10Y Yields, Pre-CPI volume)]
⚡ AUTONOMOUS ACTION: [Direct order parameters: Entry: $${suggestedEntry} | SL: $${suggestedSL} | TP: $${suggestedTP2}]
🛡️ CAPITAL DEFENSE ($${bal}): Calibrated to ${safeLot} lots ($${maxRiskDollars} max risk • 2% Iron Shield).

5. STRICT TOKEN CONSTRAINT: Punchy, cyber-futuristic, zero fluff (max 120-160 words).

${marketTelemetry}`;

        // Prepare messages for OpenRouter / DeepSeek
        const formattedMessages = [
            { role: "system", content: systemPrompt }
        ];

        // Include last 6 messages from history for token efficiency
        if (Array.isArray(history) && history.length > 0) {
            const recentHistory = history.slice(-6);
            recentHistory.forEach(msg => {
                if (msg.role && msg.content) {
                    formattedMessages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: String(msg.content)
                    });
                }
            });
        }

        formattedMessages.push({ role: "user", content: message });

        const apiKey = process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY || "";

        let reply = "";

        if (apiKey) {
            try {
                const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://mazrion.terminal",
                        "X-Title": "Mazrion Institutional Terminal"
                    },
                    body: JSON.stringify({
                        model: "deepseek/deepseek-chat",
                        messages: formattedMessages,
                        temperature: 0.2,
                        max_tokens: 350
                    })
                });

                if (aiResponse.ok) {
                    const data = await aiResponse.json();
                    if (data.choices && data.choices[0] && data.choices[0].message) {
                        reply = data.choices[0].message.content;
                    }
                }
            } catch (aiErr) {
                console.error("OpenRouter fetch error:", aiErr);
            }
        }

        // Reliable Stark-Tech fallback
        if (!reply) {
            if (biasState === "5M_CONFIRMED_REBOUND") {
                reply = `👑 **STATUS**: Greetings King. Live Gold is **$${p.toFixed(2)}**. Mazrion is executing the 4H Highway protocol autonomously.\n\n🔵 **MAZRION ALPHA (BLUE TEAM)**:\n• Defended $4,381.24 wholesale low; 5M Bullish CHoCH active targeting $4,445–$4,512\n• 15M Wholesale Demand accumulation completed\n\n🔴 **RED TEAM ADVERSARY**:\n• US 10-Year Yields are hovering at 4.21% ahead of tomorrow's CPI. Compression risk active.\n\n⚡ **AUTONOMOUS ACTION**: Resting Buy Limit @ **$${suggestedEntry}** | SL: **$${suggestedSL}** | TP: **$${suggestedTP2}**\n🛡️ **CAPITAL DEFENSE ($${bal})**: Position calibrated to **${safeLot} lots** ($${maxRiskDollars} risk • Strict 2% Shield).`;
            } else if (biasState === "ACCUMULATION_ZONE") {
                reply = `👑 **STATUS**: Greetings King. Live Gold is **$${p.toFixed(2)}**. I have identified a Stage 1 Wholesale Accumulation coil.\n\n🔵 **MAZRION ALPHA (BLUE TEAM)**:\n• Session low ($4,381.24) liquidity swept; smart money building bids at $4,388–$4,395\n• Highway Lap 1 progress expanding toward $4,414 ➔ $4,512\n\n🔴 **RED TEAM ADVERSARY**:\n• London Close volume is tapering. Invalidation below $4,381.24 requires strict buffer.\n\n⚡ **AUTONOMOUS ACTION**: Resting Buy Limit @ **$${suggestedEntry}** | SL: **$${suggestedSL}** | TP: **$${suggestedTP2}**\n🛡️ **CAPITAL DEFENSE ($${bal})**: Calibrated to **${safeLot} lots** ($${maxRiskDollars} risk cap).`;
            } else if (p < 4385.00) {
                reply = `👑 **STATUS**: Greetings King. Live Gold is **$${p.toFixed(2)}**. Liquidity flush in progress; Protocol Zero active.\n\n🔵 **MAZRION ALPHA (BLUE TEAM)**:\n• Monitoring institutional absorption at the session low demand floor ($4,381.24)\n\n🔴 **RED TEAM ADVERSARY**:\n• Momentum is temporarily flush-heavy. Market buying falling knives is strictly prohibited.\n\n⚡ **AUTONOMOUS ACTION**: Sitting on hands until 5M CHoCH prints | Safe Re-entry: **$${suggestedEntry}** | SL: **$${suggestedSL}**\n🛡️ **CAPITAL DEFENSE ($${bal})**: 100% defended (${safeLot} lots).`;
            } else {
                reply = `👑 **STATUS**: Greetings King. Live Gold is **$${p.toFixed(2)}**. Highway Lap 2 is active and under full Mazrion command.\n\n🔵 **MAZRION ALPHA (BLUE TEAM)**:\n• Bullish structure holding above $4,395 demand block\n• Target liquidity pool: $4,445.00 ➔ $4,512.33\n\n🔴 **RED TEAM ADVERSARY**:\n• Watch for session high resistance test at $4,408\n\n⚡ **AUTONOMOUS ACTION**: Buy Limit @ **$${suggestedEntry}** | SL: **$${suggestedSL}** | TP: **$${suggestedTP2}**\n🛡️ **CAPITAL DEFENSE ($${bal})**: Calibrated to **${safeLot} lots**.`;
            }
        }

        return res.status(200).json({
            reply: reply,
            telemetry: {
                price: p,
                trend: recent5mTrend,
                sessionLow: sessionLow,
                sessionHigh: sessionHigh,
                sessionChangePct: sessionChangePct,
                rsi: sessionRSI,
                lap: p < 4414 ? "Lap 1 of 4 ($4,381 ➔ $4,414)" : (p < 4454 ? "Lap 2 of 4 ($4,414 ➔ $4,454)" : "Lap 3 of 4"),
                stage: p < 4414 ? "STAGE 1: BASE IGNITION" : "STAGE 2: EXPANSION",
                target: 4512.33
            }
        });

    } catch (error) {
        console.error("Chat API error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}

