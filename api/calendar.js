// ============================================================================
// MAZRION INSTITUTIONAL TERMINAL: DYNAMIC MACRO CALENDAR ENGINE
// Endpoint: /api/calendar
// Provider: ForexFactory Live JSON Feed
// Classification: LIVE / DYNAMICALLY SOURCED (Zero hardcoded arrays)
// ============================================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const startTime = Date.now();
    const timestampUtc = new Date().toISOString();

    try {
        const ffRes = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
            headers: { "User-Agent": "Mozilla/5.0 (Mazrion Terminal Quantitative Engine/4.0)" }
        });

        if (!ffRes.ok) {
            return res.status(503).json({
                success: false,
                status: "DATA_UNAVAILABLE",
                error: `ForexFactory feed returned HTTP ${ffRes.status}`,
                timestamp: timestampUtc,
                latencyMs: Date.now() - startTime
            });
        }

        const rawEvents = await ffRes.json();

        if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
            return res.status(503).json({
                success: false,
                status: "DATA_UNAVAILABLE",
                error: "Empty payload received from macro calendar feed",
                timestamp: timestampUtc
            });
        }

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + (36 * 60 * 60 * 1000)); // Today + next 12 hours

        // Filter for High and Medium Impact relevant currency events (USD, EUR, GBP, CAD, JPY)
        const relevantEvents = rawEvents.filter(ev => {
            const country = (ev.country || "").toUpperCase();
            const impact = (ev.impact || "").toLowerCase();
            return (impact === "high" || impact === "medium") && ["USD", "EUR", "GBP", "CAD", "JPY"].includes(country);
        });

        // Format and compute surprise deltas
        const formattedEvents = relevantEvents.map(ev => {
            const eventDate = new Date(ev.date);
            const isReleased = ev.actual !== undefined && ev.actual !== null && String(ev.actual).trim() !== "";
            const scheduledUtc = eventDate.toISOString();
            
            // Format IST time
            const istTimeStr = eventDate.toLocaleTimeString("en-US", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            }) + " IST";

            // Determine Surprise Direction if numbers can be parsed
            let surpriseDirection = "PENDING";
            let surpriseDelta = null;
            if (isReleased && ev.forecast) {
                const actNum = parseFloat(String(ev.actual).replace(/[^0-9.-]/g, ''));
                const fctNum = parseFloat(String(ev.forecast).replace(/[^0-9.-]/g, ''));
                if (!isNaN(actNum) && !isNaN(fctNum)) {
                    surpriseDelta = +(actNum - fctNum).toFixed(2);
                    if (surpriseDelta > 0) surpriseDirection = "POSITIVE_BEAT";
                    else if (surpriseDelta < 0) surpriseDirection = "NEGATIVE_MISS";
                    else surpriseDirection = "IN_LINE_MEET";
                }
            }

            return {
                title: ev.title,
                country: ev.country,
                impact: ev.impact,
                time_utc: scheduledUtc,
                time_ist: istTimeStr,
                forecast: ev.forecast || "--",
                previous: ev.previous || "--",
                actual: isReleased ? ev.actual : "--",
                status: isReleased ? "RELEASED" : "UPCOMING",
                surprise_direction: surpriseDirection,
                surprise_delta: surpriseDelta,
                verdict: isReleased ? (surpriseDirection === "POSITIVE_BEAT" ? "🟢 MACRO BEAT" : (surpriseDirection === "NEGATIVE_MISS" ? "🔴 MACRO MISS" : "🟡 AS EXPECTED")) : "⏳ UPCOMING RELEASE"
            };
        });

        // Highlight high-impact upcoming or recent event
        const recentOrUpcoming = formattedEvents.find(e => e.impact.toLowerCase() === 'high') || formattedEvents[0] || null;

        return res.status(200).json({
            success: true,
            status: "LIVE",
            source: "ForexFactory Live Intelligence Stream",
            timestamp: timestampUtc,
            latencyMs: Date.now() - startTime,
            active_events_count: formattedEvents.length,
            featured_event: recentOrUpcoming,
            events: formattedEvents
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            status: "ERROR",
            error: err.message,
            timestamp: timestampUtc
        });
    }
}
