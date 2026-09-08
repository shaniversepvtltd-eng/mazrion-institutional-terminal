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
    const isAuthorized = (token === MASTER_PIN);

    // If verifying PIN
    if (req.query && req.query.verify === '1') {
        if (isAuthorized) {
            return res.status(200).json({ success: true, verified: true, message: "PIN Verified Successfully" });
        } else {
            return res.status(401).json({ error: "Invalid Security PIN", verified: false });
        }
    }

    const SUPABASE_URL = "https://xnuvkkqrzogzoryxzkec.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXZra3Fyem9nem9yeXh6a2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODQ2NDMsImV4cCI6MjEwNDI2MDY0M30.49K0Rkbcx2arVvKyHpOqOZUbYB30JPRcJWL0DZ84Jus";

    try {
        if (req.method === 'GET') {
            // If unauthorized, return masked security view
            if (!isAuthorized) {
                return res.status(200).json({
                    success: true,
                    locked: true,
                    account: {
                        account_login: "•••••••",
                        broker_server: "XMGlobal-MT5 (LOCKED)",
                        balance: "••••••",
                        equity: "••••••",
                        margin: "••••••",
                        free_margin: "••••••",
                        floating_pnl: "••••••",
                        positions: [],
                        pending_orders: [],
                        last_synced: new Date().toISOString()
                    },
                    history: []
                });
            }

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
            if (!isAuthorized) {
                return res.status(401).json({
                    error: "🔒 Security Alert: Unauthorized access. Valid Mazrion Master PIN required to perform account actions.",
                    code: "AUTH_REQUIRED"
                });
            }

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

            const actRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mazrion_secure_enqueue_action`, {
                method: "POST",
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    auth_secret: MASTER_PIN,
                    p_action_type: actionType,
                    p_ticket_id: ticketId ? parseInt(ticketId) : null,
                    p_parameters: parameters
                })
            });

            if (!actRes.ok) {
                const errText = await actRes.text();
                return res.status(500).json({ error: "Failed to queue action securely", details: errText });
            }

            const created = await actRes.json();
            return res.status(200).json({
                success: true,
                message: `Action ${actionType} sent securely to VPS MT5 bridge!`,
                action: created || actionPayload
            });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("Account API Error:", err);
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}
