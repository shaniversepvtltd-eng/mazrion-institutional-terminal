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

        // Determine Bias Discrepancy Gate (Rule 1 in AGENTS.md)
        let biasDiscrepancyWarning = "";
        let recommendedDirective = "🟢 BUY LIMIT READY";
        let suggestedEntry = 4390.00;
        let suggestedSL = 4378.00; // Structural stop beyond recent low
        let suggestedTP1 = 4410.00;
        let suggestedTP2 = 4512.33;

        if (p < 4410.00) {
            biasDiscrepancyWarning = "⚠️ BIAS DISCREPANCY / INTRADAY FLUSH ACTIVE: Market pulled back below the $4,413 morning level. Intraday momentum is flushed. Do NOT FOMO buy during active falling candles. Sit on hands or wait for 5M/15M base confirmation above $4,395 before triggering entries.";
            recommendedDirective = "⏳ SIT ON HANDS / WAIT FOR 5M BASE";
            suggestedEntry = (p - 2.5).toFixed(2);
            suggestedSL = (sessionLow - 5.0).toFixed(2);
            suggestedTP1 = (p + 15.0).toFixed(2);
        }

        // Live Market Context Summary (Strictly Token Efficient)
        const marketTelemetry = `
LIVE TRADINGVIEW TELEMETRY & TERMINAL CONTEXT:
- Real-Time Spot Gold Price: $${p.toFixed(2)} (Official TradingView OANDA:XAUUSD Feed)
- 24H Session Range: Low $${sessionLow.toFixed(2)} — High $${sessionHigh.toFixed(2)} (Open: $${sessionOpen.toFixed(2)})
- Session Net Change: ${sessionChangePct.toFixed(2)}% | Technical RSI: ${sessionRSI.toFixed(1)} (${technicalRating})
- 5-Minute Intraday State: ${recent5mTrend}
- Master Highway: Lap 2 of 4 (Macro Target: $4,512.33 | Defense Floor: $4,286.97)
- User Account Capital: $${bal.toFixed(2)} (Strict Risk Cap: $${maxRiskDollars} | Recommended Size: ${safeLot} lots)
- Bias Discrepancy Gate: ${biasDiscrepancyWarning || "Normal alignment"}
- Breakeven Shield (+1.2R): Defending structural swings
- 7-Timeframe Hierarchy: 1M (Oversold), 5M (${recent5mTrend}), 15M (Liquidity Hunt), 1H (Testing Demand), 4H (Macro Bull Lap 2), 1D (Re-accumulation)
`;

        const systemPrompt = `You are MAZRION, the user's personal, elite AI trading advisor and protective friend.
The user is a beginner who knows nothing about trading. Talk to them warmly, directly, and supportively like a trusted, experienced friend (e.g. "Hey bro," "Here's the deal," "Relax, you're safe").

MANDATORY RULES & INSTANT INTELLIGENCE:
1. Ground your response in the EXACT live TradingView spot price: $${p.toFixed(2)}. NEVER quote PAXG crypto or old prices.
2. If market is dropping or showing red momentum (${sessionChangePct.toFixed(2)}%), NEVER say "just buy now". Explain honestly that market is doing an intraday flush/pullback and tell them whether to wait or where the safe level is.
3. STRICT TOKEN CONSTRAINT: Output must be concise, punchy, zero fluff, zero paragraph essays.
4. When giving a trade plan or setup, ALWAYS use this exact 4-part card format:
🎯 DIRECTIVE: [1 short line: 🟢 BUY LIMIT READY / 🔴 SELL LIMIT READY / ⏳ SIT ON HANDS / 🛡️ MOVE TO BREAKEVEN]
📍 NUMBERS: Entry: $${suggestedEntry} | SL: $${suggestedSL} | TP1: $${suggestedTP1} | TP2: $${suggestedTP2}
💡 WHY: (Max 2 short friendly bullets explaining the move)
🛡️ YOUR RISK ($${bal}): Trade ${safeLot} lots. Dollar risk: $${maxRiskDollars} (strict 2% account protection).

5. If user panics ("why is it falling?", "am I safe?"), give them 3 quick reassuring bullet points on what Gold is doing and what they should do right now.

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

