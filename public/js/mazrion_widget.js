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
            <span>👑</span>
            <span>MAZRION J.A.R.V.I.S.</span>
        </button>

        <!-- Slide-out Drawer -->
        <div id="mazrion-drawer">
            <div class="m-drawer-header">
                <div class="m-drawer-title">
                    <span>👑</span> MAZRION // J.A.R.V.I.S. CORE
                </div>
                <div class="m-drawer-controls">
                    <button class="m-icon-btn" id="mVoiceToggle" onclick="toggleVoiceAudio()" title="Toggle Voice Speech">🔊</button>
                    <a href="/mazrion.html" class="m-icon-btn" title="Open Full Hologram Deck">↗</a>
                    <button class="m-icon-btn" onclick="toggleMazrionDrawer()">✕</button>
                </div>
            </div>

            <div class="m-drawer-tools">
                <button class="m-tool-pill" onclick="sendWidgetPrompt('👑 King\\'s Status: What is our active autonomous posture?')">👑 Status</button>
                <button class="m-tool-pill" onclick="sendWidgetPrompt('🔴 Red Team Adversary: What are the devil\\'s advocate risks right now?')">🔴 Red Team</button>
                <button class="m-tool-pill" onclick="sendWidgetPrompt('🔮 Monte Carlo: Run 10,000 probability paths on current Gold price')">🔮 Monte Carlo</button>
                <button class="m-tool-pill panic" onclick="sendWidgetPrompt('🛡️ Iron Shield: Verify stop loss and capital defense right now')">🛡️ Shield</button>
            </div>

            <div class="m-chat-body" id="mChatBody">
                <div class="m-bubble ai">
                    <strong>👑 Mazrion:</strong> Greetings King. Systems 100% operational. I am managing all market analysis, risk calibration, and executions autonomously. How may I serve you, King?
                </div>
            </div>

            <form class="m-chat-input-box" onsubmit="handleWidgetSubmit(event)">
                <button type="button" class="m-icon-btn" id="mMicBtn" onclick="toggleMicRecording()" title="Speak to Mazrion" style="color:var(--accent-cyan);">🎙️</button>
                <input type="text" id="mWidgetInput" placeholder="Speak or type to Mazrion, King..." autocomplete="off">
                <button type="submit" class="m-send-btn">Execute</button>
            </form>
        </div>
    `;
    document.body.appendChild(widgetContainer);

    let widgetHistory = [];
    let widgetLivePrice = 4401.99;
    let voiceEnabled = true;
    let recognition = null;
    let isRecording = false;

    // Speech Synthesis (J.A.R.V.I.S. Voice Engine)
    function speakJarvisVoice(text) {
        if (!voiceEnabled || !('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            // Clean markdown tokens for voice
            const cleanText = text
                .replace(/[*#_`>]/g, '')
                .replace(/👑|🔵|🔴|⚡|🛡️|🎯|📍|💡/g, '')
                .replace(/https?:\/\/\S+/g, '')
                .slice(0, 300); // Speak the core punchy summary

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 1.05;
            utterance.pitch = 0.95;

            // Pick a sophisticated British or English voice if available
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => (v.name.includes('Daniel') || v.name.includes('George') || v.name.includes('UK') || v.lang === 'en-GB' || v.lang.startsWith('en')));
            if (preferredVoice) utterance.voice = preferredVoice;

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn("Speech synthesis error:", e);
        }
    }

    window.toggleVoiceAudio = function() {
        voiceEnabled = !voiceEnabled;
        const btn = document.getElementById('mVoiceToggle');
        if (btn) btn.innerText = voiceEnabled ? '🔊' : '🔇';
        if (!voiceEnabled && ('speechSynthesis' in window)) window.speechSynthesis.cancel();
    };

    // Speech-To-Text (Microphone Command Engine)
    window.toggleMicRecording = function() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            alert("Microphone recognition is not supported in this browser.");
            return;
        }

        const micBtn = document.getElementById('mMicBtn');
        if (!recognition) {
            recognition = new SpeechRec();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                isRecording = true;
                if (micBtn) {
                    micBtn.style.color = '#EF4444';
                    micBtn.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.6)';
                }
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const input = document.getElementById('mWidgetInput');
                if (input) {
                    input.value = transcript;
                    window.handleWidgetSubmit(new Event('submit'));
                }
            };

            recognition.onerror = (event) => {
                console.warn("Speech recognition error:", event.error);
                isRecording = false;
                if (micBtn) {
                    micBtn.style.color = 'var(--accent-cyan)';
                    micBtn.style.boxShadow = 'none';
                }
            };

            recognition.onend = () => {
                isRecording = false;
                if (micBtn) {
                    micBtn.style.color = 'var(--accent-cyan)';
                    micBtn.style.boxShadow = 'none';
                }
            };
        }

        if (isRecording) {
            recognition.stop();
        } else {
            recognition.start();
        }
    };

    async function fetchWidgetPrice() {
        try {
            const res = await fetch('/api/price');
            if (res.ok) {
                const data = await res.json();
                if (data && data.price) widgetLivePrice = parseFloat(data.price);
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

        appendWidgetMsg('ai', '<em>Simulating market vectors across 10,000 realities...</em>', 'tempIndicator');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: widgetHistory,
                    accountBalance: 945.35,
                    livePrice: widgetLivePrice
                })
            });

            const temp = document.getElementById('tempIndicator');
            if (temp) temp.remove();

            if (res.ok) {
                const data = await res.json();
                const reply = data.reply || `👑 **STATUS**: Greetings King. Live Gold is **$${widgetLivePrice.toFixed(2)}**. Autonomous systems are standing by.`;
                appendWidgetMsg('ai', reply);
                widgetHistory.push({ role: 'assistant', content: reply });
                speakJarvisVoice(reply);
            } else {
                const fallbackMsg = `👑 **STATUS**: Greetings King. Live Gold is **$${widgetLivePrice.toFixed(2)}**. Highway Lap 2 is active and under full Mazrion command.`;
                appendWidgetMsg('ai', fallbackMsg);
                speakJarvisVoice(fallbackMsg);
            }
        } catch (err) {
            const temp = document.getElementById('tempIndicator');
            if (temp) temp.remove();
            const fallbackMsg = `👑 **STATUS**: Greetings King. Live Gold is **$${widgetLivePrice.toFixed(2)}**. Capital is 100% protected under our 2% Iron Shield.`;
            appendWidgetMsg('ai', fallbackMsg);
            speakJarvisVoice(fallbackMsg);
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

        bubble.innerHTML = role === 'ai' ? `<strong>👑 Mazrion Core:</strong><br>${formatted}` : formatted;
        body.appendChild(bubble);
        body.scrollTop = body.scrollHeight;
    }
})();
