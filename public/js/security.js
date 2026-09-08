/**
 * MAZRION INSTITUTIONAL SECURITY SYSTEM (v6.2.0)
 * Zero-Trust Cyber Gate, Session Encryption, and 6-Digit Master PIN Lock Screen.
 */

(function() {
    const STORAGE_KEY = 'mazrion_session_pin';
    let failedAttempts = 0;
    const MAX_ATTEMPTS = 5;
    let isLockout = false;

    // Expose Global Security API
    window.MazrionSecurity = {
        getPin: function() {
            return sessionStorage.getItem(STORAGE_KEY) || '';
        },
        isUnlocked: function() {
            return !!sessionStorage.getItem(STORAGE_KEY);
        },
        lock: function() {
            sessionStorage.removeItem(STORAGE_KEY);
            showLockModal();
            window.dispatchEvent(new Event('mazrion_locked'));
        },
        fetchWithAuth: async function(url, options = {}) {
            options.headers = options.headers || {};
            const pin = this.getPin();
            if (pin) {
                options.headers['x-mazrion-auth'] = pin;
            }
            return fetch(url, options);
        }
    };

    // Build Cyber-Security Styles
    const style = document.createElement('style');
    style.innerHTML = `
        #mazrion-lock-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(3, 7, 18, 0.94);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: 'Inter', -apple-system, sans-serif;
        }

        #mazrion-lock-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }

        .lock-container {
            background: rgba(13, 17, 26, 0.95);
            border: 1px solid rgba(0, 229, 255, 0.35);
            box-shadow: 0 0 50px rgba(0, 229, 255, 0.18), 0 20px 60px rgba(0, 0, 0, 0.8);
            border-radius: 20px;
            padding: 36px 32px;
            width: 90%;
            max-width: 380px;
            text-align: center;
            position: relative;
            transform: scale(0.94);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #mazrion-lock-overlay.active .lock-container {
            transform: scale(1);
        }

        .lock-shield-icon {
            width: 58px;
            height: 58px;
            margin: 0 auto 16px;
            background: linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(16, 185, 129, 0.15));
            border: 1px solid rgba(0, 229, 255, 0.4);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            box-shadow: 0 0 20px rgba(0, 229, 255, 0.25);
            animation: shieldPulse 3s infinite ease-in-out;
        }

        @keyframes shieldPulse {
            0%, 100% { box-shadow: 0 0 20px rgba(0, 229, 255, 0.25); }
            50% { box-shadow: 0 0 35px rgba(16, 185, 129, 0.4); border-color: rgba(16, 185, 129, 0.6); }
        }

        .lock-title {
            font-family: 'Orbitron', monospace;
            font-size: 14px;
            font-weight: 900;
            letter-spacing: 1.5px;
            color: #00E5FF;
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        .lock-sub {
            font-size: 11px;
            color: #94A3B8;
            margin-bottom: 24px;
        }

        .pin-dots {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-bottom: 24px;
        }

        .pin-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            transition: all 0.2s ease;
        }

        .pin-dot.filled {
            background: #00E5FF;
            border-color: #00E5FF;
            box-shadow: 0 0 12px #00E5FF;
            transform: scale(1.15);
        }

        .pin-keypad {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 16px;
        }

        .key-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #F8FAFC;
            font-size: 18px;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
            padding: 14px 0;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
            user-select: none;
        }

        .key-btn:hover {
            background: rgba(0, 229, 255, 0.15);
            border-color: rgba(0, 229, 255, 0.4);
            color: #00E5FF;
            transform: translateY(-2px);
        }

        .key-btn:active {
            transform: scale(0.95);
        }

        .key-btn.action-btn {
            font-size: 13px;
            font-family: 'Inter', sans-serif;
            color: #94A3B8;
        }

        .lock-status-msg {
            font-size: 11px;
            font-weight: 700;
            color: #EF4444;
            min-height: 16px;
            font-family: 'JetBrains Mono', monospace;
        }

        .nav-lock-btn {
            background: rgba(239, 68, 68, 0.15) !important;
            border: 1px solid rgba(239, 68, 68, 0.4) !important;
            color: #F87171 !important;
            padding: 5px 12px !important;
            border-radius: 6px !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
        }

        .nav-lock-btn:hover {
            background: rgba(239, 68, 68, 0.3) !important;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.4) !important;
            color: #FFF !important;
        }

        .shake {
            animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @keyframes shake {
            10%, 90% { transform: translate3d(-2px, 0, 0); }
            20%, 80% { transform: translate3d(4px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
            40%, 60% { transform: translate3d(6px, 0, 0); }
        }
    `;
    document.head.appendChild(style);

    // Build Modal HTML
    let currentInput = '';

    function createLockModal() {
        const overlay = document.createElement('div');
        overlay.id = 'mazrion-lock-overlay';
        overlay.innerHTML = `
            <div class="lock-container" id="lock-card">
                <div class="lock-shield-icon">🛡️</div>
                <div class="lock-title">MAZRION SECURITY PROTOCOL</div>
                <div class="lock-sub">MT5 Bridge & Terminal Session Locked</div>

                <div class="pin-dots">
                    <div class="pin-dot" id="pdot-0"></div>
                    <div class="pin-dot" id="pdot-1"></div>
                    <div class="pin-dot" id="pdot-2"></div>
                    <div class="pin-dot" id="pdot-3"></div>
                    <div class="pin-dot" id="pdot-4"></div>
                    <div class="pin-dot" id="pdot-5"></div>
                </div>

                <div class="pin-keypad">
                    <button class="key-btn" onclick="window._mazrionPinInput('1')">1</button>
                    <button class="key-btn" onclick="window._mazrionPinInput('2')">2</button>
                    <button class="key-btn" onclick="window._mazrionPinInput('3')">3</button>
                    <button class="key-btn" onclick="window._mazrionPinInput('4')">4</button>
                    <button class="key-btn" onclick="window._mazrionPinInput('5')">5</button>
                    <button class="key-btn" onclick="window._mazrionPinInput('6')">6</button>
                    <button class="key-btn" onclick="window._mazrionPinInput('7')">7</button>
                    <button class="key-btn" onclick="window._mazrionPinInput('8')">8</button>
                    <button class="key-btn" onclick="window._mazrionPinInput('9')">9</button>
                    <button class="key-btn action-btn" onclick="window._mazrionPinClear()">CLEAR</button>
                    <button class="key-btn" onclick="window._mazrionPinInput('0')">0</button>
                    <button class="key-btn action-btn" onclick="window._mazrionPinBackspace()">⌫</button>
                </div>

                <div class="lock-status-msg" id="lock-status-msg"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Keyboard listener
        window.addEventListener('keydown', (e) => {
            if (!overlay.classList.contains('active')) return;
            if (e.key >= '0' && e.key <= '9') {
                window._mazrionPinInput(e.key);
            } else if (e.key === 'Backspace') {
                window._mazrionPinBackspace();
            } else if (e.key === 'Escape') {
                window._mazrionPinClear();
            }
        });
    }

    function updatePinDots() {
        for (let i = 0; i < 6; i++) {
            const dot = document.getElementById(`pdot-${i}`);
            if (dot) {
                if (i < currentInput.length) {
                    dot.classList.add('filled');
                } else {
                    dot.classList.remove('filled');
                }
            }
        }
    }

    window._mazrionPinInput = function(digit) {
        if (isLockout || currentInput.length >= 6) return;
        currentInput += digit;
        updatePinDots();
        if (currentInput.length === 6) {
            validatePin(currentInput);
        }
    };

    window._mazrionPinBackspace = function() {
        if (currentInput.length > 0) {
            currentInput = currentInput.slice(0, -1);
            updatePinDots();
        }
    };

    window._mazrionPinClear = function() {
        currentInput = '';
        updatePinDots();
        const msg = document.getElementById('lock-status-msg');
        if (msg) msg.innerText = '';
    };

    async function validatePin(pin) {
        const msg = document.getElementById('lock-status-msg');
        const card = document.getElementById('lock-card');
        if (msg) msg.innerText = 'VERIFYING SECURITY KEY...';

        try {
            const res = await fetch('/api/account?verify=1', {
                headers: { 'x-mazrion-auth': pin }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.verified) {
                    if (msg) {
                        msg.style.color = '#10B981';
                        msg.innerText = '✅ ACCESS GRANTED — UNLOCKING...';
                    }
                    sessionStorage.setItem(STORAGE_KEY, pin);
                    failedAttempts = 0;
                    setTimeout(() => {
                        hideLockModal();
                        window.dispatchEvent(new Event('mazrion_unlocked'));
                    }, 400);
                    return;
                }
            }

            // Failed
            failedAttempts++;
            if (card) {
                card.classList.add('shake');
                setTimeout(() => card.classList.remove('shake'), 500);
            }

            if (failedAttempts >= MAX_ATTEMPTS) {
                isLockout = true;
                if (msg) msg.innerText = `🚨 TOO MANY FAILED ATTEMPTS. LOCKED FOR 30s.`;
                setTimeout(() => {
                    isLockout = false;
                    failedAttempts = 0;
                    window._mazrionPinClear();
                }, 30000);
            } else {
                if (msg) msg.innerText = `❌ INVALID PIN (${MAX_ATTEMPTS - failedAttempts} attempts remaining)`;
                setTimeout(() => window._mazrionPinClear(), 800);
            }

        } catch (e) {
            if (msg) msg.innerText = '❌ CONNECTION ERROR. RETRY.';
            setTimeout(() => window._mazrionPinClear(), 1000);
        }
    }

    function showLockModal() {
        const overlay = document.getElementById('mazrion-lock-overlay');
        if (overlay) {
            window._mazrionPinClear();
            overlay.classList.add('active');
        }
    }

    function hideLockModal() {
        const overlay = document.getElementById('mazrion-lock-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    function injectLockNavigationButton() {
        const navSuites = document.querySelector('.nav-suites') || document.querySelector('nav');
        if (navSuites && !document.getElementById('btn-nav-lock')) {
            const lockBtn = document.createElement('button');
            lockBtn.id = 'btn-nav-lock';
            lockBtn.className = 'nav-lock-btn';
            lockBtn.innerHTML = '🔒 LOCK';
            lockBtn.title = 'Lock Terminal Session';
            lockBtn.onclick = () => window.MazrionSecurity.lock();
            navSuites.appendChild(lockBtn);
        }
    }

    // Auto-initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        createLockModal();
        injectLockNavigationButton();

        // Check if unlocked
        if (!window.MazrionSecurity.isUnlocked()) {
            showLockModal();
        } else {
            window.dispatchEvent(new Event('mazrion_unlocked'));
        }
    });

})();
