export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const MASTER_PIN = process.env.MAZRION_MASTER_PIN || "999777";
    const authHeader = req.headers['x-mazrion-auth'] || req.headers['authorization'];
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

    if (token !== MASTER_PIN) {
        return res.status(401).json({
            error: "🔒 Security Alert: Unauthorized access. Valid Mazrion Master PIN required.",
            code: "AUTH_REQUIRED"
        });
    }

    const SUPABASE_URL = "https://xnuvkkqrzogzoryxzkec.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXZra3Fyem9nem9yeXh6a2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODQ2NDMsImV4cCI6MjEwNDI2MDY0M30.49K0Rkbcx2arVvKyHpOqOZUbYB30JPRcJWL0DZ84Jus";

    try {
        if (req.method === 'POST') {
            const {
                symbol = "XAUUSD",
                orderType = "BUY_LIMIT",
                entryPrice,
                stopLoss,
                takeProfit1,
                takeProfit2,
                volume = 0.01,
                timeframe = "5m",
                waveTitle = "Mazrion Confirmed Wave"
            } = req.body || {};

            if (!entryPrice || !stopLoss) {
                return res.status(400).json({ error: "Missing required fields: entryPrice, stopLoss" });
            }

            const orderPayload = {
                symbol: String(symbol).toUpperCase(),
                order_type: String(orderType).toUpperCase(),
                entry_price: parseFloat(entryPrice),
                stop_loss: parseFloat(stopLoss),
                take_profit_1: takeProfit1 ? parseFloat(takeProfit1) : null,
                take_profit_2: takeProfit2 ? parseFloat(takeProfit2) : null,
                volume: parseFloat(volume) || 0.01,
                timeframe: String(timeframe),
                wave_title: String(waveTitle),
                status: "PENDING",
                created_at: new Date().toISOString()
            };

            const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/mazrion_order_queue`, {
                method: "POST",
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify(orderPayload)
            });

            if (!dbRes.ok) {
                const errText = await dbRes.text();
                return res.status(500).json({ error: "Failed to queue order in database", details: errText });
            }

            const createdOrders = await dbRes.json();
            const order = createdOrders && createdOrders[0] ? createdOrders[0] : orderPayload;

            return res.status(200).json({
                success: true,
                message: `⚡ Order dispatched to VPS MT5 queue for execution!`,
                order: order
            });
        }

        if (req.method === 'GET') {
            // Fetch recent 10 orders from queue
            const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/mazrion_order_queue?order=created_at.desc&limit=10`, {
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
                }
            });

            if (!dbRes.ok) {
                return res.status(500).json({ error: "Failed to fetch order queue" });
            }

            const orders = await dbRes.json();
            return res.status(200).json({
                orders: orders || []
            });
        }

        return res.status(405).json({ error: "Method not allowed" });

    } catch (err) {
        console.error("Execute API Error:", err);
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}
