export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const SUPABASE_URL = "https://xnuvkkqrzogzoryxzkec.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXZra3Fyem9nem9yeXh6a2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODQ2NDMsImV4cCI6MjEwNDI2MDY0M30.49K0Rkbcx2arVvKyHpOqOZUbYB30JPRcJWL0DZ84Jus";

    try {
        if (req.method === 'GET') {
            // 1. Fetch Latest Account State (Balance, Equity, Positions, Pending Orders)
            const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/mazrion_account_state?id=eq.primary`, {
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
                }
            });

            let accountState = null;
            if (stateRes.ok) {
                const rows = await stateRes.json();
                if (rows && rows.length > 0) {
                    accountState = rows[0];
                }
            }

            // Fallback if not yet populated
            if (!accountState) {
                accountState = {
                    account_login: 316126743,
                    broker_server: "XMGlobal-MT5 7",
                    balance: 945.06,
                    equity: 945.06,
                    margin: 0.00,
                    free_margin: 945.06,
                    floating_pnl: 0.00,
                    positions: [],
                    pending_orders: [],
                    last_synced: new Date().toISOString()
                };
            }

            // 2. Fetch Recent Order Queue History (Last 15 dispatches)
            const histRes = await fetch(`${SUPABASE_URL}/rest/v1/mazrion_order_queue?order=created_at.desc&limit=15`, {
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
                }
            });

            let history = [];
            if (histRes.ok) {
                history = await histRes.json();
            }

            return res.status(200).json({
                success: true,
                account: accountState,
                history: history || []
            });
        }

        if (req.method === 'POST') {
            const { actionType, ticketId, parameters = {} } = req.body || {};

            if (!actionType) {
                return res.status(400).json({ error: "Missing required field: actionType" });
            }

            // Enqueue action to mazrion_action_queue
            const actionPayload = {
                action_type: actionType,
                ticket_id: ticketId ? parseInt(ticketId) : null,
                parameters: parameters,
                status: "PENDING",
                created_at: new Date().toISOString()
            };

            const actRes = await fetch(`${SUPABASE_URL}/rest/v1/mazrion_action_queue`, {
                method: "POST",
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify(actionPayload)
            });

            if (!actRes.ok) {
                const errText = await actRes.text();
                return res.status(500).json({ error: "Failed to queue action", details: errText });
            }

            const created = await actRes.json();
            return res.status(200).json({
                success: true,
                message: `Action ${actionType} sent to VPS MT5 bridge!`,
                action: created && created[0] ? created[0] : actionPayload
            });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("Account API Error:", err);
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}
