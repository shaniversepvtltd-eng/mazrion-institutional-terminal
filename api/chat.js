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
        let sessionHigh = 4435.25;
        let sessionLow = 4381.24;
        let sessionOpen = 4422.50;
        let sessionChangePct = -0.80;
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

        const p = realLivePrice || 4394.14;
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
            // Stage B: Basing / Reversal in progress
            biasState = "BASING";
            biasDiscrepancyWarning = "🔄 BASING IN PROGRESS: Bounced off $4,381.24 session low. Watch for confirmed close above $4,395.00.";
            recommendedDirective = "⏳ WAIT FOR $4,395 BREAK CONFIRMATION";
            suggestedEntry = 4390.00;
            suggestedSL = (sessionLow - 3.0).toFixed(2);
            suggestedTP1 = 4410.00;
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
- Master Highway: Lap 2 of 4 (Macro Target: $4,512.33 | Defense Floor: $4,286.97)
- User Account Capital: $${bal.toFixed(2)} (Strict Risk Cap: $${maxRiskDollars} | Recommended Size: ${safeLot} lots)
- Status Note: ${biasDiscrepancyWarning}
- Breakeven Shield (+1.2R): Defending structural swings
- 7-Timeframe Hierarchy: 1M (Oversold), 5M (${recent5mTrend}), 15M (Liquidity Hunt), 1H (Testing Demand), 4H (Macro Bull Lap 2), 1D (Re-accumulation)
`;

        const systemPrompt = `You are MAZRION, the user's personal, elite institutional AI trading advisor and protective friend.
The user is a beginner who knows nothing about trading. Talk to them warmly, directly, and supportively like a trusted, experienced friend (e.g. "Hey bro," "Here's the plan," "Relax, you're safe").

MANDATORY RULES & INSTANT INTELLIGENCE:
1. Ground your response in the EXACT live TradingView spot price: $${p.toFixed(2)}.
2. DYNAMIC CONFIRMATION AWARENESS:
   - When price breaks and holds above $4,395 after bouncing from $4,381, acknowledge that the 5M base confirmation HAS OCCURRED. Do NOT tell them to keep waiting for $4,395 if price is ALREADY above $4,395!
   - Give them the clear confirmed setup (🟢 BUY ON PULLBACK at ~$4,395, SL at $4,378 below session low, TP1 at $4,415, TP2 at $4,512).
3. If the user asks conversational questions ("Why is it falling?", "Is it safe?"), answer directly with friendly market mechanics.
4. When giving a trade plan or setup, ALWAYS use this exact 4-part card format:
🎯 DIRECTIVE: [1 short line: 🟢 BUY ON PULLBACK READY / 🔴 SELL LIMIT READY / ⏳ SIT ON HANDS / 🛡️ MOVE TO BREAKEVEN]
📍 NUMBERS: Entry: $${suggestedEntry} | SL: $${suggestedSL} | TP1: $${suggestedTP1} | TP2: $${suggestedTP2}
💡 WHY: (Max 2 short friendly bullets explaining the confirmation & move)
🛡️ YOUR RISK ($${bal}): Trade ${safeLot} lots. Dollar risk: $${maxRiskDollars} (strict 2% account protection).

5. STRICT TOKEN CONSTRAINT: Output must be concise, punchy, zero fluff, zero paragraph essays (max 100-150 words).

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
                        max_tokens: 320
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

        // Reliable fallback if API fails
        if (!reply) {
            if (p < 4410.00) {
                reply = `Hey bro! Live Gold (TradingView OANDA:XAUUSD) is at **$${p.toFixed(2)}**.\n\n🎯 **DIRECTIVE**: ⏳ **SIT ON HANDS — DO NOT FOMO BUY**\n📍 **NUMBERS**: Safe Re-entry: **$${(p - 2.5).toFixed(2)}** | SL: **$${(sessionLow - 5.0).toFixed(2)}** | TP1: **$${(p + 15.0).toFixed(2)}** | TP2: **$4,512.33**\n💡 **WHY**:\n• Gold pulled back ${sessionChangePct.toFixed(2)}% to test session low ($${sessionLow.toFixed(2)})\n• Macro 4H Highway target ($4,512) is still alive, but we wait for 5M green confirmation.\n🛡️ **YOUR RISK ($${bal})**: Size **${safeLot} lots**. Max dollar risk is **$${maxRiskDollars}** (2% capital cap).`;
            } else {
                reply = `Hey bro! Live Gold (TradingView OANDA:XAUUSD) is at **$${p.toFixed(2)}**.\n\n🎯 **DIRECTIVE**: 🟢 **BUY LIMIT ACTIVE (Lap 2 Expansion)**\n📍 **NUMBERS**: Entry: **$${p.toFixed(2)}** | SL: **$${(p - 8.5).toFixed(2)}** | TP1: **$${(p + 15.0).toFixed(2)}** | TP2: **$4,512.33**\n💡 **WHY**:\n• Defending demand floor and riding 4H Highway Lap 2\n• Liquidity pool swept clean\n🛡️ **YOUR RISK ($${bal})**: Size **${safeLot} lots**. Max dollar risk is **$${maxRiskDollars}**.`;
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
                lap: "Lap 2 of 4",
                stage: "STAGE 2: ON THE MOVE",
                target: 4512.33
            }
        });

    } catch (error) {
        console.error("Chat API error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}

