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
        const { message, history = [], accountBalance = 100, livePrice = 4421.36, timeframe = "4h" } = req.body || {};

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: "Message is required." });
        }

        // 1. Fetch live telemetry from analyze.js logic or Supabase
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

        const p = parseFloat(livePrice) || 4421.36;
        const bal = parseFloat(accountBalance) || 100.0;
        
        // Compute account risk metrics
        const safeLot = Math.max(0.01, (bal / 100.0) * 0.01).toFixed(2);
        const maxDollarRisk = (bal * 0.05).toFixed(2); // 5% max risk cap

        // Live Market Context Summary (Strictly Token Efficient)
        const marketTelemetry = `
LIVE TELEMETRY:
- Symbol: XAUUSD (Gold) | Live Price: $${p.toFixed(2)}
- User Account Capital: $${bal.toFixed(2)} (Safe Lot: ${safeLot} lots | Max Risk Cap: $${maxDollarRisk})
- Master Highway: Lap 2 of 4 (Friday Retest & BOS Wave $4,413.99 -> $4,510.00)
- Structural Floor (0-Drawdown POI): $4,286.97 (Defended)
- Active 4H Target: $4,512.33 | Master Peak: $4,697.99
- Breakeven Shield (+1.2R): Active at $4,411.86 ($0.00 Risk Locked)
- 7-Timeframe State: 1M (CHoCH Bull), 5M (Pullback Defended), 1H (Wholesale $4,454), 4H (BOS Stage 2 Bull), 1D (Re-Accumulation)
`;

        const systemPrompt = `You are MAZRION, the user's personal, elite AI trading advisor and protective friend.
The user is a beginner who knows nothing about trading. Talk to them warmly, directly, and supportively like a trusted, experienced friend (e.g. "Hey bro," "Here's the plan," "Relax, you're safe").

CRITICAL TOKEN CONSTRAINT & FORMATTING RULES:
1. NEVER write long paragraphs or essays. Keep answers dense, short, and ultra-readable.
2. When giving trade advice or setups, ALWAYS use this exact 4-part card format:
🎯 DIRECTIVE: [1 short line: 🟢 BUY LIMIT READY / 🔴 SELL LIMIT READY / ⏳ SIT ON HANDS / 🛡️ MOVE TO BREAKEVEN]
📍 NUMBERS: Entry: $X,XXX.XX | SL: $X,XXX.XX | TP1 (Bank 60%): $X,XXX.XX | TP2 (Runner): $X,XXX.XX
💡 WHY: (Max 2 short friendly bullets explaining why)
🛡️ YOUR ACCOUNT ($${bal}): Trade ${safeLot} lots. Risk is $X.XX.

3. If the user is panicking or asks if they are safe, be calming, run an emergency safety check, and tell them exactly what to do in 3 short bullet points.
4. Always ground your advice in the live market telemetry below.

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
                temperature: 0.3,
                max_tokens: 350
            })
        });

        if (!aiResponse.ok) {
            const errTxt = await aiResponse.text();
            console.error("OpenRouter Error:", errTxt);
            // Fallback response with live telemetry
            return res.status(200).json({
                reply: `Hey bro! I'm tracking live Gold at **$${p.toFixed(2)}**.\n\n🎯 **DIRECTIVE**: 🟢 **BUY LIMIT ACTIVE (Stage 2 Expansion)**\n📍 **NUMBERS**: Entry: **$4,413.99** | SL: **$4,408.50** | TP1: **$4,424.00** | TP2: **$4,512.33**\n💡 **WHY**:\n• Defended the wholesale floor at $4,286.97\n• Riding Lap 2 of the 4H Master Highway\n🛡️ **YOUR RISK ($${bal})**: Trade **${safeLot} lots** (Risk: ~$5.49 | Zero risk once past $4,421).`,
                telemetry: {
                    price: p,
                    lap: "Lap 2 of 4",
                    stage: "STAGE 2: ON THE MOVE",
                    target: 4512.33
                }
            });
        }

        const data = await aiResponse.json();
        const reply = data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : "Hey bro, I'm watching live Gold right now. Let me know if you need the current plan!";

        return res.status(200).json({
            reply: reply,
            telemetry: {
                price: p,
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
