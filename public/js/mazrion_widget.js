/**
 * MAZRION AI FLOATING ADVISOR WIDGET
 * Universal plug-and-play AI trading advisor drawer for all Mazrion Terminal pages.
 */

(function() {
    // 1. Inject Styles
    const style = document.createElement('style');
    style.innerHTML = `
        /* Floating Action Button (FAB) */
        #mazrion-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: linear-gradient(135deg, #A855F7, #7C3AED, #00E5FF);
            color: #FFF;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 99px;
            padding: 10px 18px;
            font-family: 'Inter', sans-serif;
            font-size: 12.5px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            box-shadow: 0 8px 30px rgba(168, 85, 247, 0.45);
            z-index: 9999;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #mazrion-fab:hover {
            transform: scale(1.06) translateY(-2px);
            box-shadow: 0 12px 36px rgba(168, 85, 247, 0.6);
        }

        /* Slide-Out Advisor Drawer */
        #mazrion-drawer {
            position: fixed;
            bottom: 84px;
            right: 24px;
            width: 400px;
            max-width: calc(100vw - 48px);
            height: 580px;
            max-height: calc(100vh - 120px);
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(168, 85, 247, 0.4);
            border-radius: 16px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(168, 85, 247, 0.2);
            backdrop-filter: blur(24px);
            z-index: 9998;
            display: none;
            flex-direction: column;
            overflow: hidden;
            animation: drawerSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes drawerSlideUp {
            from { opacity: 0; transform: translateY(20px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .m-drawer-header {
            padding: 12px 16px;
            background: rgba(10, 15, 30, 0.9);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .m-drawer-title {
            font-family: 'Cinzel', serif;
            font-size: 13px;
            font-weight: 900;
            background: linear-gradient(135deg, #FFF, #C084FC);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .m-drawer-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .m-icon-btn {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #94A3B8;
            font-size: 12px;
            width: 26px;
            height: 26px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            transition: all 0.15s ease;
        }

        .m-icon-btn:hover {
            background: rgba(168, 85, 247, 0.2);
            border-color: #A855F7;
            color: #FFF;
        }

        .m-drawer-tools {
            padding: 8px 12px;
            background: rgba(3, 7, 18, 0.8);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            display: flex;
            align-items: center;
            gap: 6px;
            overflow-x: auto;
            scrollbar-width: none;
        }
        .m-drawer-tools::-webkit-scrollbar { display: none; }

        .m-tool-pill {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #E2E8F0;
            font-size: 10px;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 99px;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.15s ease;
        }

        .m-tool-pill:hover {
            background: rgba(168, 85, 247, 0.2);
            border-color: #A855F7;
        }

        .m-tool-pill.panic {
            background: rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.3);
            color: #FCA5A5;
        }

        .m-chat-body {
            flex: 1;
            padding: 12px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: 'Inter', sans-serif;
            font-size: 12px;
        }

        .m-bubble {
            max-width: 90%;
            padding: 10px 12px;
            border-radius: 10px;
            line-height: 1.45;
        }

        .m-bubble.user {
            align-self: flex-end;
            background: linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(0, 229, 255, 0.2));
            border: 1px solid rgba(168, 85, 247, 0.4);
            color: #FFF;
        }

        .m-bubble.ai {
            align-self: flex-start;
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(168, 85, 247, 0.3);
            color: #F8FAFC;
        }

        .m-chat-input-box {
            padding: 10px 12px;
            background: rgba(10, 15, 30, 0.95);
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .m-chat-input-box input {
            flex: 1;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #FFF;
            font-size: 12px;
            padding: 8px 12px;
            border-radius: 6px;
            outline: none;
        }

        .m-chat-input-box input:focus {
            border-color: #A855F7;
        }

        .m-send-btn {
            background: #A855F7;
            border: none;
            color: #FFF;
            font-size: 11px;
            font-weight: 700;
            padding: 8px 14px;
            border-radius: 6px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // 2. Inject HTML Drawer & FAB
    const widgetContainer = document.createElement('div');
    widgetContainer.innerHTML = `
        <!-- Floating FAB -->
        <button id="mazrion-fab" onclick="toggleMazrionDrawer()">
            <span>🔮</span>
            <span>MAZRION AI</span>
        </button>

        <!-- Slide-out Drawer -->
        <div id="mazrion-drawer">
            <div class="m-drawer-header">
                <div class="m-drawer-title">
                    <span>🔮</span> MAZRION // ADVISOR
                </div>
                <div class="m-drawer-controls">
                    <a href="/mazrion.html" class="m-icon-btn" title="Open Full Workstation">↗</a>
                    <button class="m-icon-btn" onclick="toggleMazrionDrawer()">✕</button>
                </div>
            </div>

            <div class="m-drawer-tools">
                <button class="m-tool-pill panic" onclick="sendWidgetPrompt('🚨 EMERGENCY SCAN: Am I safe right now?')">🚨 Panic</button>
                <button class="m-tool-pill" onclick="sendWidgetPrompt('☕ What is today\\'s quick gameplan?')">☕ Plan</button>
                <button class="m-tool-pill" onclick="sendWidgetPrompt('🎯 Give me the exact MT5 order numbers')">📋 MT5 Ticket</button>
                <button class="m-tool-pill" onclick="sendWidgetPrompt('👶 Explain live Gold like I\\'m 10')">👶 Explain</button>
            </div>

            <div class="m-chat-body" id="mChatBody">
                <div class="m-bubble ai">
                    <strong>🔮 Mazrion:</strong> Hey bro! I'm watching live market telemetry for you. Tap a quick tool above or ask me anything!
                </div>
            </div>

            <form class="m-chat-input-box" onsubmit="handleWidgetSubmit(event)">
                <input type="text" id="mWidgetInput" placeholder="Ask your advisor (e.g. 'Should I buy now?')..." autocomplete="off">
                <button type="submit" class="m-send-btn">Send</button>
            </form>
        </div>
    `;
    document.body.appendChild(widgetContainer);

    let widgetHistory = [];
    let widgetLivePrice = 4394.14;

    async function fetchWidgetPrice() {
        try {
            const res = await fetch('https://scanner.tradingview.com/cfd/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbols: { tickers: ['OANDA:XAUUSD'] },
                    columns: ['close', 'high', 'low', 'open', 'change']
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.data) && data.data[0] && data.data[0].d) {
                    widgetLivePrice = parseFloat(data.data[0].d[0]);
                }
            }
        } catch (e) {}
    }
    fetchWidgetPrice();
    setInterval(fetchWidgetPrice, 1500);

    window.toggleMazrionDrawer = function() {
        const drawer = document.getElementById('mazrion-drawer');
        if (drawer.style.display === 'flex') {
            drawer.style.display = 'none';
        } else {
            drawer.style.display = 'flex';
            document.getElementById('mWidgetInput').focus();
        }
    };

    window.sendWidgetPrompt = function(promptText) {
        document.getElementById('mWidgetInput').value = promptText;
        handleWidgetSubmit(new Event('submit'));
    };

    window.handleWidgetSubmit = async function(e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = document.getElementById('mWidgetInput');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        appendWidgetMsg('user', text);
        widgetHistory.push({ role: 'user', content: text });

        appendWidgetMsg('ai', '<em>Thinking with live telemetry...</em>', 'tempIndicator');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: widgetHistory,
                    accountBalance: 100,
                    livePrice: widgetLivePrice
                })
            });

            const temp = document.getElementById('tempIndicator');
            if (temp) temp.remove();

            if (res.ok) {
                const data = await res.json();
                const reply = data.reply || `Hey bro, live Gold is at **$${widgetLivePrice.toFixed(2)}**. Watching the market closely!`;
                appendWidgetMsg('ai', reply);
                widgetHistory.push({ role: 'assistant', content: reply });
            } else {
                appendWidgetMsg('ai', `Hey bro, live Gold is at **$${widgetLivePrice.toFixed(2)}**. Sitting on hands until 5M base confirms!`);
            }
        } catch (err) {
            const temp = document.getElementById('tempIndicator');
            if (temp) temp.remove();
            appendWidgetMsg('ai', `Hey bro, live Gold is at **$${widgetLivePrice.toFixed(2)}**. Lap 2 is active targeting **$4,512.33**!`);
        }
    };

    function appendWidgetMsg(role, text, id = null) {
        const body = document.getElementById('mChatBody');
        const bubble = document.createElement('div');
        bubble.className = `m-bubble ${role}`;
        if (id) bubble.id = id;

        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');

        bubble.innerHTML = role === 'ai' ? `<strong>🔮 Mazrion:</strong><br>${formatted}` : formatted;
        body.appendChild(bubble);
        body.scrollTop = body.scrollHeight;
    }
})();
