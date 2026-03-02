document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const gameBoard = document.getElementById('game-board');
    const ghostContainer = document.getElementById('ghost-container');
    const detentionContainer = document.getElementById('detention-container');

    // Status
    const elTurnCount = document.getElementById('turn-count');
    const elCurrentTurn = document.getElementById('current-turn');
    const elMonkSaveRemaining = document.getElementById('status-monk-save-remaining');
    const elMonkCd = document.getElementById('status-monk-cd');
    const elPoliceDetainRemaining = document.getElementById('status-police-detain-remaining');
    const elPoliceCd = document.getElementById('status-police-cd');
    const elStatusGameElapsed = document.getElementById('status-game-elapsed');
    const elStatusTurnRemaining = document.getElementById('status-turn-remaining');
    const elClockEnabledToggle = document.getElementById('clock-enabled-toggle');
    const elClockTurnLimitSelect = document.getElementById('clock-turn-limit-select');
    const elClockAlarmThresholdSelect = document.getElementById('clock-alarm-threshold-select');
    const elGameLog = document.getElementById('game-log');
    const elAiLogList = document.getElementById('ai-log-list');
    const btnAiLogCopy = document.getElementById('ai-log-copy');
    const elAiDebugEngine = document.getElementById('ai-debug-engine');
    const elAiDebugModel = document.getElementById('ai-debug-model');
    const elAiDebugBuild = document.getElementById('ai-debug-build');
    const elAiDebugNeural = document.getElementById('ai-debug-neural');
    const elAiDebugFallback = document.getElementById('ai-debug-fallback');
    const elAiDebugThink = document.getElementById('ai-debug-think');
    const elAiDebugSkillRate = document.getElementById('ai-debug-skill-rate');
    const elAiDebugDecisions = document.getElementById('ai-debug-decisions');
    const sandboxModeToggle = document.getElementById('sandbox-mode-toggle');
    const storyModeToggle = document.getElementById('story-mode-toggle');

    // Modals
    const modalRulesGuide = document.getElementById('modal-rules-guide');
    const modalStartGame = document.getElementById('modal-start-game');
    const btnSaveReplay = document.getElementById('btn-save-replay');
    const elReplayStatus = document.getElementById('game-over-replay-status');
    const btnStartGame = document.getElementById('btn-start-game');
    const divInitResult = document.getElementById('initiative-result');
    const elInitBlack = document.getElementById('init-roll-black');
    const elInitWhite = document.getElementById('init-roll-white');
    const elInitMsg = document.getElementById('init-winner-msg');

    // Context Menu
    const contextMenu = document.getElementById('piece-context-menu');
    const ctxBtnMove = document.getElementById('ctx-btn-move');
    const ctxBtnCapture = document.getElementById('ctx-btn-capture');
    const ctxBtnSkill = document.getElementById('ctx-btn-skill');
    const ctxBtnStack = document.getElementById('ctx-btn-stack');
    const ctxBtnInfo = document.getElementById('ctx-btn-info');

    const modalPieceInfo = document.getElementById('modal-piece-info');

    // Info Modal Content
    const infoTitle = document.getElementById('info-title');
    const infoDesc = document.getElementById('info-desc');
    const infoMoves = document.getElementById('info-moves');
    const infoSkills = document.getElementById('info-skills');
    const infoNotes = document.getElementById('info-notes');

    // Dice
    const diceContainer = document.getElementById('dice-container');
    const diceTens = document.getElementById('dice-tens');
    const diceUnits = document.getElementById('dice-units');

    // Skill Result Display
    const skillResultDisplay = document.getElementById('skill-result-display');
    const skillResultText = document.getElementById('skill-result-text');

    // --- Mobile UI Elements ---
    const elMobileToggle = document.getElementById('mobile-menu-toggle');
    const elSidebarOverlay = document.getElementById('sidebar-overlay');
    const elSidebar = document.querySelector('.sidebar');
    const elMobileWindowDock = document.getElementById('mobile-window-dock');
    const elMobileRotateOverlay = document.getElementById('mobile-rotate-overlay');
    const appContainer = document.querySelector('.app-container');
    const sidebarQuickToggles = document.getElementById('sidebar-quick-toggles');
    const sidebarCollapseToggle = document.getElementById('sidebar-collapse-toggle');
    const sidebarCollapsedHandle = document.getElementById('sidebar-collapsed-handle');
    const sidebarDragHandle = document.getElementById('sidebar-drag-handle');
    const btnRulesGuide = document.getElementById('btn-rules-guide');
    const btnReplayRecords = document.getElementById('btn-replay-records');
    const modalReplayRecords = document.getElementById('modal-replay-records');
    const replayRecordsList = document.getElementById('replay-records-list');
    const btnReplayRefresh = document.getElementById('btn-replay-refresh');
    const btnReplayClearAll = document.getElementById('btn-replay-clear-all');
    const aiConfigStore = window.MoleChessAIConfigStore || null;
    const aiTelemetryStore = window.MoleChessAITelemetryStore || null;

    function checkMobile() {
        return window.innerWidth <= 800; // Matches CSS media query
    }

    // Toggle Logic
    if (elMobileToggle) {
        elMobileToggle.addEventListener('click', () => {
            if (elSidebar) elSidebar.classList.toggle('active');
            if (elSidebarOverlay) elSidebarOverlay.classList.toggle('active');
        });
    }

    if (elSidebarOverlay) {
        elSidebarOverlay.addEventListener('click', () => {
            if (elSidebar) elSidebar.classList.remove('active');
            if (elSidebarOverlay) elSidebarOverlay.classList.remove('active');
        });
    }

    const layoutStore = window.MoleChessConfigStore || null;
    let layoutConfig = layoutStore ? layoutStore.getLayoutConfig() : null;

    const panelEls = {
        status: document.querySelector('[data-panel-id="status"]'),
        log: document.querySelector('[data-panel-id="log"]'),
        aiLog: document.querySelector('[data-panel-id="aiLog"]'),
        ghost: document.querySelector('[data-panel-id="ghost"]'),
        detention: document.querySelector('[data-panel-id="detention"]'),
        controls: document.querySelector('[data-panel-id="controls"]'),
        config: document.querySelector('[data-panel-id="config"]')
    };

    const controlGroups = {
        aiMode: document.querySelector('[data-control="aiMode"]'),
        aiVsAi: document.querySelector('[data-control="aiVsAi"]'),
        sandbox: document.querySelector('[data-control="sandbox"]'),
        storyMode: document.querySelector('[data-control="storyMode"]')
    };

    const controlButtons = {
        startGame: document.getElementById('btn-start-game'),
        undo: document.getElementById('btn-undo'),
        surrender: document.getElementById('btn-surrender'),
        reset: document.getElementById('btn-reset')
    };
    const statusWindowEl = document.getElementById('status-window');
    const boardWindowEl = document.getElementById('board-window');
    const logWindowEl = document.getElementById('log-window');
    const aiLogWindowEl = document.getElementById('ai-log-window');
    const ghostWindowEl = document.getElementById('ghost-window');
    const detentionWindowEl = document.getElementById('detention-window');
    const MOBILE_WINDOW_LABELS = {
        'board-window': '棋盘',
        'log-window': '日志',
        'status-window': '状态',
        'ai-log-window': 'AI',
        'ghost-window': '幽灵',
        'detention-window': '拘留'
    };
    const MOBILE_DEFAULT_VISIBLE_WINDOWS = new Set(['board-window', 'log-window']);
    const MOBILE_MANAGED_WINDOWS = Object.keys(MOBILE_WINDOW_LABELS);
    let mobileResponsiveActive = false;
    let previousMenuStyleBeforeMobile = null;

    const MENU_STYLE_STORAGE_KEY = 'mole_chess_menu_style';
    const PC98_PERSISTENT_SUBMENU_KEYS = new Set(['mode']);
    const menuStyleButtons = Array.from(document.querySelectorAll('[data-menu-style]'));
    const pc98MenuRoot = document.getElementById('pc98-menu-root');
    const pc98PrimaryButtons = Array.from(document.querySelectorAll('[data-pc98-open]'));
    const pc98SubmenuWindows = Array.from(document.querySelectorAll('.pc98-submenu-window'));
    const pc98CloseButtons = Array.from(document.querySelectorAll('[data-pc98-close]'));
    const proxyClickButtons = Array.from(document.querySelectorAll('[data-proxy-click]'));
    const proxyToggleButtons = Array.from(document.querySelectorAll('[data-proxy-toggle]'));
    const proxyFileButtons = Array.from(document.querySelectorAll('[data-proxy-file]'));
    const menuVolumeSliderSource = document.getElementById('volume-slider');
    const pc98VolumeSlider = document.getElementById('pc98-volume-slider');
    const sourceModeToggles = [
        document.getElementById('ai-mode-toggle'),
        document.getElementById('ai-vs-ai-toggle'),
        document.getElementById('sandbox-mode-toggle'),
        document.getElementById('story-mode-toggle')
    ].filter(Boolean);
    let pc98SubmenuZIndexSeed = 3300;

    function normalizeMenuStyle(style) {
        return style === 'pc98' ? 'pc98' : 'win98';
    }

    function readMenuStyleSetting() {
        try {
            return normalizeMenuStyle(localStorage.getItem(MENU_STYLE_STORAGE_KEY));
        } catch (_e) {
            return 'win98';
        }
    }

    function closePc98Submenu(key) {
        if (!key) return;
        const winEl = document.getElementById(`pc98-submenu-${key}`);
        if (winEl) winEl.classList.add('hidden');
        pc98PrimaryButtons
            .filter(btn => btn.getAttribute('data-pc98-open') === key)
            .forEach(btn => btn.classList.remove('active'));
    }

    function closePc98Submenus(options = {}) {
        const excludeKeys = Array.isArray(options.excludeKeys) ? options.excludeKeys : [];
        const excludeSet = new Set(excludeKeys.map(key => String(key || '')));
        pc98SubmenuWindows.forEach(win => {
            const key = String(win.getAttribute('data-pc98-window') || '');
            if (!excludeSet.has(key)) {
                win.classList.add('hidden');
            }
        });
        pc98PrimaryButtons.forEach(btn => {
            const key = String(btn.getAttribute('data-pc98-open') || '');
            if (!excludeSet.has(key)) {
                btn.classList.remove('active');
            }
        });
    }

    function bringPc98SubmenuToFront(winEl) {
        if (!winEl) return;
        pc98SubmenuZIndexSeed += 1;
        winEl.style.zIndex = String(pc98SubmenuZIndexSeed);
    }

    function placePc98Submenu(winEl, anchorEl) {
        if (!winEl) return;
        const margin = 8;
        const fallbackLeft = 154;
        const fallbackTop = 42;
        let left = fallbackLeft;
        let top = fallbackTop;

        if (pc98MenuRoot) {
            const rootRect = pc98MenuRoot.getBoundingClientRect();
            left = Math.round(rootRect.right + margin);
        }
        if (anchorEl) {
            const anchorRect = anchorEl.getBoundingClientRect();
            top = Math.round(anchorRect.top);
        }

        const maxLeft = Math.max(margin, window.innerWidth - winEl.offsetWidth - margin);
        const maxTop = Math.max(margin, window.innerHeight - winEl.offsetHeight - margin);
        winEl.style.left = `${Math.max(margin, Math.min(left, maxLeft))}px`;
        winEl.style.top = `${Math.max(margin, Math.min(top, maxTop))}px`;
    }

    function openPc98Submenu(key, anchorBtn) {
        const winEl = document.getElementById(`pc98-submenu-${key}`);
        if (!winEl) return;
        const normalizedKey = String(key || '');
        const wasOpen = !winEl.classList.contains('hidden');
        const isPersistent = PC98_PERSISTENT_SUBMENU_KEYS.has(normalizedKey);
        if (isPersistent) {
            if (wasOpen) {
                bringPc98SubmenuToFront(winEl);
                return;
            }
        } else {
            closePc98Submenus({ excludeKeys: Array.from(PC98_PERSISTENT_SUBMENU_KEYS) });
            if (wasOpen) return;
        }
        winEl.classList.remove('hidden');
        if (anchorBtn) anchorBtn.classList.add('active');
        placePc98Submenu(winEl, anchorBtn || null);
        bringPc98SubmenuToFront(winEl);
    }

    function ensureDefaultViewWindowsVisible() {
        ['board-window', 'status-window', 'log-window', 'ai-log-window', 'ghost-window', 'detention-window'].forEach(id => {
            const winEl = document.getElementById(id);
            if (winEl) winEl.classList.add('show');
        });
    }

    function placeBoardWindowDefault(force = false) {
        if (!boardWindowEl) return;
        if (!force && boardWindowEl.dataset.defaultPlaced === '1') return;
        boardWindowEl.classList.add('centered-viewport');
        boardWindowEl.style.left = '';
        boardWindowEl.style.top = '';
        boardWindowEl.style.right = 'auto';
        boardWindowEl.style.bottom = 'auto';
        boardWindowEl.style.transform = '';
        boardWindowEl.dataset.defaultPlaced = '1';
    }

    function placeStatusWindowNearPc98Menu(force = false) {
        if (!statusWindowEl || !pc98MenuRoot) return;
        if (!force && statusWindowEl.dataset.pc98DefaultPlaced === '1') return;
        const margin = 10;
        const rootRect = pc98MenuRoot.getBoundingClientRect();
        const targetTop = Math.round(rootRect.bottom + 8);
        const targetLeft = Math.round(rootRect.left + 2);
        const maxLeft = Math.max(margin, window.innerWidth - statusWindowEl.offsetWidth - margin);
        const maxTop = Math.max(margin, window.innerHeight - statusWindowEl.offsetHeight - margin);
        statusWindowEl.style.left = `${Math.max(margin, Math.min(targetLeft, maxLeft))}px`;
        statusWindowEl.style.top = `${Math.max(margin, Math.min(targetTop, maxTop))}px`;
        statusWindowEl.style.right = 'auto';
        statusWindowEl.style.bottom = 'auto';
        statusWindowEl.dataset.pc98DefaultPlaced = '1';
    }

    function placeModeWindowBelowStatus(force = false) {
        const modeWindowEl = document.getElementById('pc98-submenu-mode');
        if (!modeWindowEl) return;
        if (!force && modeWindowEl.dataset.defaultPlaced === '1') return;
        const margin = 8;
        const gap = 10;
        let left = 154;
        let top = 42;
        if (statusWindowEl) {
            const statusRect = statusWindowEl.getBoundingClientRect();
            left = Math.round(statusRect.left);
            top = Math.round(statusRect.bottom + gap);
        } else if (pc98MenuRoot) {
            const rootRect = pc98MenuRoot.getBoundingClientRect();
            left = Math.round(rootRect.right + gap);
            top = Math.round(rootRect.bottom + gap);
        }
        const maxLeft = Math.max(margin, window.innerWidth - modeWindowEl.offsetWidth - margin);
        const maxTop = Math.max(margin, window.innerHeight - modeWindowEl.offsetHeight - margin);
        modeWindowEl.style.left = `${Math.max(margin, Math.min(left, maxLeft))}px`;
        modeWindowEl.style.top = `${Math.max(margin, Math.min(top, maxTop))}px`;
        modeWindowEl.dataset.defaultPlaced = '1';
    }

    function ensureModeMenuDefaultOpen(forcePosition = false) {
        if (document.body.getAttribute('data-menu-style') !== 'pc98') return;
        const modePrimaryBtn = pc98PrimaryButtons.find(btn => btn.getAttribute('data-pc98-open') === 'mode') || null;
        const modeWindowEl = document.getElementById('pc98-submenu-mode');
        if (!modeWindowEl) return;
        modeWindowEl.classList.remove('hidden');
        if (modePrimaryBtn) modePrimaryBtn.classList.add('active');
        if (forcePosition) {
            modeWindowEl.dataset.defaultPlaced = '0';
        }
        placeModeWindowBelowStatus(forcePosition);
        bringPc98SubmenuToFront(modeWindowEl);
    }

    function syncProxyToggleButtons() {
        proxyToggleButtons.forEach(btn => {
            const targetId = btn.getAttribute('data-proxy-toggle');
            const sourceEl = targetId ? document.getElementById(targetId) : null;
            const checked = !!(sourceEl && sourceEl.checked);
            btn.classList.toggle('checked', checked);
            btn.setAttribute('aria-pressed', checked ? 'true' : 'false');
        });
    }

    function applyMenuStyle(style, persist = true) {
        const nextStyle = normalizeMenuStyle(style);
        document.body.setAttribute('data-menu-style', nextStyle);

        if (pc98MenuRoot) {
            if (nextStyle === 'pc98') {
                pc98MenuRoot.classList.remove('hidden');
                placeStatusWindowNearPc98Menu(true);
                placeBoardWindowDefault(true);
                ensureModeMenuDefaultOpen(true);
            } else {
                pc98MenuRoot.classList.add('hidden');
                closePc98Submenus();
                placeBoardWindowDefault(true);
            }
        }

        if (persist) {
            try {
                localStorage.setItem(MENU_STYLE_STORAGE_KEY, nextStyle);
            } catch (_e) { }
        }
        syncProxyToggleButtons();
        if (typeof window.updateMenuChecks === 'function') {
            window.updateMenuChecks();
        }
        applyResponsiveLayoutState();
    }

    menuStyleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextStyle = btn.getAttribute('data-menu-style');
            applyMenuStyle(nextStyle, true);
        });
    });

    pc98PrimaryButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPc98Submenu(btn.getAttribute('data-pc98-open'), btn);
        });
    });

    pc98CloseButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closePc98Submenu(btn.getAttribute('data-pc98-close'));
        });
    });

    proxyClickButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-proxy-click');
            const targetEl = targetId ? document.getElementById(targetId) : null;
            if (targetEl) targetEl.click();
            closePc98Submenus({ excludeKeys: Array.from(PC98_PERSISTENT_SUBMENU_KEYS) });
        });
    });

    proxyFileButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-proxy-file');
            const targetEl = targetId ? document.getElementById(targetId) : null;
            if (targetEl) targetEl.click();
        });
    });

    proxyToggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-proxy-toggle');
            const targetEl = targetId ? document.getElementById(targetId) : null;
            if (!targetEl) return;
            targetEl.checked = !targetEl.checked;
            targetEl.dispatchEvent(new Event('change', { bubbles: true }));
            syncProxyToggleButtons();
        });
    });

    sourceModeToggles.forEach(toggle => {
        toggle.addEventListener('change', syncProxyToggleButtons);
    });

    if (menuVolumeSliderSource && pc98VolumeSlider) {
        pc98VolumeSlider.value = menuVolumeSliderSource.value;
        pc98VolumeSlider.addEventListener('input', () => {
            menuVolumeSliderSource.value = pc98VolumeSlider.value;
            menuVolumeSliderSource.dispatchEvent(new Event('input', { bubbles: true }));
        });
        menuVolumeSliderSource.addEventListener('input', () => {
            pc98VolumeSlider.value = menuVolumeSliderSource.value;
        });
    }

    document.addEventListener('click', (e) => {
        if (document.body.getAttribute('data-menu-style') !== 'pc98') return;
        const target = e.target;
        const insideRoot = !!(pc98MenuRoot && pc98MenuRoot.contains(target));
        const insideWindow = pc98SubmenuWindows.some(win => win.contains(target));
        if (!insideRoot && !insideWindow) {
            closePc98Submenus({ excludeKeys: Array.from(PC98_PERSISTENT_SUBMENU_KEYS) });
        }
    });

    applyMenuStyle(readMenuStyleSetting(), false);
    ensureDefaultViewWindowsVisible();
    placeBoardWindowDefault(false);
    ensureModeMenuDefaultOpen(true);

    // Custom Win98 Toggles
    document.querySelectorAll('[data-win-toggle]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.getAttribute('data-win-toggle');
            const winEl = document.getElementById(targetId);
            if (winEl) {
                if (winEl.classList.contains('show')) {
                    winEl.classList.remove('show');
                    btn.classList.remove('checked');
                } else {
                    winEl.classList.add('show');
                    btn.classList.add('checked');
                    if (targetId === 'status-window' && document.body.getAttribute('data-menu-style') === 'pc98') {
                        placeStatusWindowNearPc98Menu(true);
                    }
                    if (targetId === 'board-window') {
                        placeBoardWindowDefault(true);
                    }
                }
            }
            if (typeof window.updateMenuChecks === 'function') {
                window.updateMenuChecks();
            }
        });
    });

    window.updateMenuChecks = function () {
        document.querySelectorAll('[data-win-toggle]').forEach(btn => {
            const targetId = btn.getAttribute('data-win-toggle');
            const winEl = document.getElementById(targetId);
            if (winEl) {
                if (winEl.classList.contains('show')) {
                    btn.classList.add('checked');
                } else {
                    btn.classList.remove('checked');
                }
            }
        });
        syncProxyToggleButtons();
        refreshMobileWindowDockState();
    };
    window.updateMenuChecks();

    function isMobileViewport() {
        return window.innerWidth < 768;
    }

    function isMobilePortrait() {
        return isMobileViewport() && window.matchMedia('(orientation: portrait)').matches;
    }

    function ensureWindowVisibleWithinViewport(winEl, options = {}) {
        if (!winEl || !winEl.classList.contains('show')) return;
        const margin = Number.isFinite(Number(options.margin)) ? Number(options.margin) : 8;
        const topOffset = Number.isFinite(Number(options.topOffset)) ? Number(options.topOffset) : 48;
        const rect = winEl.getBoundingClientRect();
        const maxLeft = Math.max(margin, window.innerWidth - winEl.offsetWidth - margin);
        const maxTop = Math.max(topOffset, window.innerHeight - winEl.offsetHeight - margin);
        let nextLeft = rect.left;
        let nextTop = rect.top;
        if (rect.left < margin) nextLeft = margin;
        if (rect.left > maxLeft) nextLeft = maxLeft;
        if (rect.top < topOffset) nextTop = topOffset;
        if (rect.top > maxTop) nextTop = maxTop;
        winEl.style.left = `${Math.max(margin, Math.min(nextLeft, maxLeft))}px`;
        winEl.style.top = `${Math.max(topOffset, Math.min(nextTop, maxTop))}px`;
        winEl.style.right = 'auto';
        winEl.style.bottom = 'auto';
    }

    function buildMobileWindowDockIfNeeded() {
        if (!elMobileWindowDock || elMobileWindowDock.dataset.ready === '1') return;
        MOBILE_MANAGED_WINDOWS.forEach((windowId) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mobile-window-dock__btn';
            btn.dataset.windowId = windowId;
            btn.textContent = MOBILE_WINDOW_LABELS[windowId] || windowId;
            btn.addEventListener('click', () => {
                const winEl = document.getElementById(windowId);
                if (!winEl) return;
                const willShow = !winEl.classList.contains('show');
                winEl.classList.toggle('show', willShow);
                if (willShow) {
                    ensureWindowVisibleWithinViewport(winEl, { topOffset: 52 });
                }
                if (typeof window.updateMenuChecks === 'function') {
                    window.updateMenuChecks();
                }
                refreshMobileWindowDockState();
            });
            elMobileWindowDock.appendChild(btn);
        });
        elMobileWindowDock.dataset.ready = '1';
    }

    function refreshMobileWindowDockState() {
        if (!elMobileWindowDock) return;
        Array.from(elMobileWindowDock.querySelectorAll('.mobile-window-dock__btn')).forEach((btn) => {
            const windowId = btn.dataset.windowId;
            const winEl = windowId ? document.getElementById(windowId) : null;
            const active = !!(winEl && winEl.classList.contains('show'));
            btn.classList.toggle('mobile-window-dock__btn--active', active);
            if (winEl) {
                winEl.classList.toggle('mobile-window-collapsed', !active);
            }
        });
    }

    function applyMobileDefaultWindowState() {
        const currentMenuStyle = String(document.body.getAttribute('data-menu-style') || 'win98');
        if (currentMenuStyle === 'pc98') {
            previousMenuStyleBeforeMobile = 'pc98';
            document.body.setAttribute('data-menu-style', 'win98');
        }
        MOBILE_MANAGED_WINDOWS.forEach((windowId) => {
            const winEl = document.getElementById(windowId);
            if (!winEl) return;
            const shouldShow = MOBILE_DEFAULT_VISIBLE_WINDOWS.has(windowId);
            winEl.classList.toggle('show', shouldShow);
            winEl.classList.add('mobile-window-managed');
            if (shouldShow) {
                ensureWindowVisibleWithinViewport(winEl, { topOffset: 52 });
            }
        });
        closePc98Submenus();
        if (document.body.getAttribute('data-menu-style') === 'pc98' && pc98MenuRoot) {
            pc98MenuRoot.classList.add('hidden');
        }
    }

    function applyResponsiveLayoutState() {
        const mobile = isMobileViewport();
        const portrait = mobile && isMobilePortrait();

        document.body.classList.toggle('mobile-mode', mobile);
        document.body.classList.toggle('mobile-portrait', portrait);
        document.body.classList.toggle('mobile-landscape', mobile && !portrait);

        if (elMobileRotateOverlay) {
            elMobileRotateOverlay.classList.toggle('hidden', !portrait);
            elMobileRotateOverlay.setAttribute('aria-hidden', portrait ? 'false' : 'true');
        }

        if (!mobile) {
            mobileResponsiveActive = false;
            if (elMobileWindowDock) elMobileWindowDock.classList.add('hidden');
            MOBILE_MANAGED_WINDOWS.forEach((windowId) => {
                const winEl = document.getElementById(windowId);
                if (winEl) winEl.classList.remove('mobile-window-managed');
            });
            if (previousMenuStyleBeforeMobile === 'pc98') {
                previousMenuStyleBeforeMobile = null;
                applyMenuStyle('pc98', false);
            }
            if (typeof window.updateMenuChecks === 'function') {
                window.updateMenuChecks();
            }
            return;
        }

        buildMobileWindowDockIfNeeded();
        if (elMobileWindowDock) elMobileWindowDock.classList.remove('hidden');

        if (!mobileResponsiveActive) {
            applyMobileDefaultWindowState();
            mobileResponsiveActive = true;
        }

        if (boardWindowEl && boardWindowEl.classList.contains('show')) {
            boardWindowEl.classList.add('centered-viewport');
            boardWindowEl.style.left = '';
            boardWindowEl.style.top = '';
            boardWindowEl.style.right = 'auto';
            boardWindowEl.style.bottom = 'auto';
            boardWindowEl.style.transform = '';
        }

        if (logWindowEl && logWindowEl.classList.contains('show')) {
            ensureWindowVisibleWithinViewport(logWindowEl, { topOffset: 52 });
        }
        if (statusWindowEl && statusWindowEl.classList.contains('show')) {
            ensureWindowVisibleWithinViewport(statusWindowEl, { topOffset: 52 });
        }
        if (aiLogWindowEl && aiLogWindowEl.classList.contains('show')) {
            ensureWindowVisibleWithinViewport(aiLogWindowEl, { topOffset: 52 });
        }
        if (ghostWindowEl && ghostWindowEl.classList.contains('show')) {
            ensureWindowVisibleWithinViewport(ghostWindowEl, { topOffset: 52 });
        }
        if (detentionWindowEl && detentionWindowEl.classList.contains('show')) {
            ensureWindowVisibleWithinViewport(detentionWindowEl, { topOffset: 52 });
        }
        if (typeof window.updateMenuChecks === 'function') {
            window.updateMenuChecks();
        }
        refreshMobileWindowDockState();
    }

    window.addEventListener('resize', () => {
        applyResponsiveLayoutState();
    });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => applyResponsiveLayoutState(), 60);
    });
    applyResponsiveLayoutState();

    // Win98 Dragging
    document.querySelectorAll('.win98-titlebar').forEach(bar => {
        let isDragging = false;
        let startX, startY;
        let origX, origY;
        const winEl = bar.parentElement;
        const beginDrag = (clientX, clientY, target) => {
            if (target && target.classList && (target.classList.contains('win98-close-btn') || target.classList.contains('win98-min-btn'))) return;
            if (winEl && winEl.id === 'board-window' && winEl.classList.contains('centered-viewport')) {
                const centerRect = winEl.getBoundingClientRect();
                winEl.classList.remove('centered-viewport');
                winEl.style.left = `${centerRect.left}px`;
                winEl.style.top = `${centerRect.top}px`;
                winEl.style.transform = '';
            }
            isDragging = true;
            startX = clientX;
            startY = clientY;
            const rect = winEl.getBoundingClientRect();
            origX = rect.left;
            origY = rect.top;

            document.querySelectorAll('.win98-window').forEach(w => w.style.zIndex = "2000");
            winEl.style.zIndex = "2001";
        };
        const moveDrag = (clientX, clientY) => {
            if (!isDragging) return;
            const dx = clientX - startX;
            const dy = clientY - startY;
            winEl.style.left = `${origX + dx}px`;
            winEl.style.top = `${origY + dy}px`;
            winEl.style.right = 'auto';
            winEl.style.bottom = 'auto';
            if (document.body.classList.contains('mobile-mode')) {
                ensureWindowVisibleWithinViewport(winEl, { topOffset: 52 });
            }
        };
        const endDrag = () => {
            isDragging = false;
        };

        bar.addEventListener('mousedown', e => {
            beginDrag(e.clientX, e.clientY, e.target);
        });

        document.addEventListener('mousemove', e => {
            moveDrag(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', () => {
            endDrag();
        });

        bar.addEventListener('touchstart', (e) => {
            const touch = e.touches && e.touches[0];
            if (!touch) return;
            beginDrag(touch.clientX, touch.clientY, e.target);
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            const touch = e.touches && e.touches[0];
            if (!touch || !isDragging) return;
            e.preventDefault();
            moveDrag(touch.clientX, touch.clientY);
        }, { passive: false });

        document.addEventListener('touchend', () => {
            endDrag();
        });
    });

    document.querySelectorAll('[data-win-minimize]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = btn.getAttribute('data-win-minimize');
            const targetWin = targetId ? document.getElementById(targetId) : null;
            if (!targetWin) return;
            const minimized = targetWin.classList.toggle('minimized');
            btn.setAttribute('aria-pressed', minimized ? 'true' : 'false');
            btn.textContent = minimized ? '▢' : '_';
            btn.title = minimized ? '还原' : '最小化';
        });
    });

    document.querySelectorAll('.pc98-submenu-window').forEach(winEl => {
        const titlebar = winEl.querySelector('.pc98-submenu-titlebar');
        if (!titlebar) return;
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let origX = 0;
        let origY = 0;
        const beginDrag = (clientX, clientY, target) => {
            if (target && target.classList && target.classList.contains('pc98-close-btn')) return;
            isDragging = true;
            startX = clientX;
            startY = clientY;
            const rect = winEl.getBoundingClientRect();
            origX = rect.left;
            origY = rect.top;
            bringPc98SubmenuToFront(winEl);
        };
        const moveDrag = (clientX, clientY) => {
            if (!isDragging) return;
            const dx = clientX - startX;
            const dy = clientY - startY;
            const margin = 8;
            const maxLeft = Math.max(margin, window.innerWidth - winEl.offsetWidth - margin);
            const maxTop = Math.max(margin, window.innerHeight - winEl.offsetHeight - margin);
            const topOffset = document.body.classList.contains('mobile-mode') ? 52 : margin;
            const nextLeft = Math.max(margin, Math.min(origX + dx, maxLeft));
            const nextTop = Math.max(topOffset, Math.min(origY + dy, Math.max(topOffset, maxTop)));
            winEl.style.left = `${nextLeft}px`;
            winEl.style.top = `${nextTop}px`;
        };
        const endDrag = () => {
            isDragging = false;
        };

        titlebar.addEventListener('mousedown', (e) => {
            beginDrag(e.clientX, e.clientY, e.target);
        });

        document.addEventListener('mousemove', (e) => {
            moveDrag(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', () => {
            endDrag();
        });

        titlebar.addEventListener('touchstart', (e) => {
            const touch = e.touches && e.touches[0];
            if (!touch) return;
            beginDrag(touch.clientX, touch.clientY, e.target);
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            const touch = e.touches && e.touches[0];
            if (!touch || !isDragging) return;
            e.preventDefault();
            moveDrag(touch.clientX, touch.clientY);
        }, { passive: false });

        document.addEventListener('touchend', () => {
            endDrag();
        });
    });

    // --- State ---
    let state = null;
    let selectedCell = null;      // For move mode: first click selection
    let contextMenuPiece = null;  // Piece that context menu was opened for
    let contextMenuPos = null;    // Position of piece for context menu
    let currentAction = null;     // 'selecting_move_target' | 'selecting_capture_target' | 'selecting_skill_target' | 'selecting_tunnel_target' | 'selecting_tunnel_start' | 'selecting_tunnel_end' | null
    let waitingForTurnStart = false; // Flag to prevent double modal
    let validMovePaths = [];      // 合法移动路径坐标列表
    let pendingSkillType = null;  // Used for multi-skill pieces (e.g., Nightmare, Mole)
    let pendingTunnelTarget = null; // Legacy tunnel compatibility
    let tunnelMolePos = null;
    let tunnelTargetPos = null;
    let tunnelStartPos = null;
    let selectedPieceId = null;   // For stacked pieces, identify the exact selected piece
    let pausePolling = false;     // Pause fetchState polling during animations
    let aiMoveHighlight = { from: null, to: null }; // Highlight AI's last moved piece from/to cells
    let stackPickerEl = null;
    let isSandboxMode = false;
    let runtimeSystemLogBuffer = [];
    const STORY_MODE_STORAGE_KEY = 'mole_chess_story_mode_enabled';
    const STORY_MODE_BODY_ATTR = 'data-story-mode';
    const CLOCK_CONFIG_STORAGE_KEY = 'mole_chess_clock_v1';
    const CLOCK_DEFAULT_CONFIG = {
        enabled: false,
        turnLimitSec: 60,
        alarmThresholdMin: 10,
        timeModel: 'fixed_turn',
        timeoutScope: 'human_and_ai',
        alarmRule: 'threshold_once',
        aiTimeoutPolicy: 'end_after_ai_response'
    };
    let clockConfig = null;
    const clockRuntime = {
        gameStartTs: null,
        turnStartTs: null,
        elapsedMs: 0,
        remainingMs: 0,
        activeTurnKey: '',
        alarmTriggered: false,
        turnEndInFlight: false,
        pendingAiTimeoutTurnKey: '',
        timeoutTriggeredTurnKey: ''
    };
    const replayRecorder = {
        version: '1.0',
        sessionId: '',
        active: false,
        finalized: false,
        savedCount: 0,
        startedAtWallTs: 0,
        endedAtWallTs: 0,
        frames: [],
        tracks: [],
        initialSnapshot: null,
        finalSnapshot: null,
        result: null,
        lastFrameKey: '',
        lastFrameStateDigest: ''
    };
    const REPLAY_RECORDS_STORAGE_KEY = 'mole_chess_replay_records_v1';
    const REPLAY_RECORDS_LIMIT = 20;
    // Minimal-size full-match video profile: no audio, low fps, capped bitrate.
    const REPLAY_VIDEO_PROFILE = {
        width: 960,
        height: 540,
        fps: 8,
        videoBitsPerSecond: 260000,
        chunkMs: 1000
    };
    const replayVideoRecorder = {
        active: false,
        startRequested: false,
        stopping: false,
        stream: null,
        recorder: null,
        chunks: [],
        mimeType: '',
        fileExt: 'mp4',
        startedAtWallTs: 0,
        endedAtWallTs: 0,
        blob: null,
        stopPromise: null,
        lastError: ''
    };
    const EXPO_SHARED_GAME_KEY = 'mole_chess_shared_game_v1';
    const EXPO_SHARED_HISTORY_KEY = 'mole_chess_shared_history_v1';
    const EXPO_SHARED_META_KEY = 'mole_chess_shared_meta_v1';
    const EXPO_SHARED_CUE_KEY = 'mole_chess_shared_cue_v1';
    const EXPO_SYNC_CHANNEL_NAME = 'mole_chess_sync_v1';
    const expoWindowId = String(window.__MOLE_CHESS_SYNC_WINDOW_ID || '');
    const expoModeEnabled = (() => {
        try {
            return new URLSearchParams(window.location.search).get('expo') === '1';
        } catch (_err) {
            return false;
        }
    })();
    let expoSyncChannel = null;
    let expoSyncTimer = null;
    let expoCueQueue = Promise.resolve();
    const expoSeenCueIds = new Set();
    const expoSeenCueOrder = [];
    let initiativeCueInFlight = false;

    function normalizeClockNumber(raw, fallback, options = {}) {
        const num = Number(raw);
        if (!Number.isFinite(num)) return fallback;
        const min = Number.isFinite(options.min) ? options.min : null;
        const max = Number.isFinite(options.max) ? options.max : null;
        let out = options.allowFloat ? num : Math.round(num);
        if (min !== null && out < min) out = min;
        if (max !== null && out > max) out = max;
        return out;
    }

    function normalizeClockConfig(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        return {
            enabled: !!source.enabled,
            turnLimitSec: normalizeClockNumber(source.turnLimitSec, CLOCK_DEFAULT_CONFIG.turnLimitSec, { min: 1, max: 1200 }),
            alarmThresholdMin: normalizeClockNumber(source.alarmThresholdMin, CLOCK_DEFAULT_CONFIG.alarmThresholdMin, { min: 0.01, max: 600, allowFloat: true }),
            timeModel: source.timeModel || CLOCK_DEFAULT_CONFIG.timeModel,
            timeoutScope: source.timeoutScope || CLOCK_DEFAULT_CONFIG.timeoutScope,
            alarmRule: source.alarmRule || CLOCK_DEFAULT_CONFIG.alarmRule,
            aiTimeoutPolicy: source.aiTimeoutPolicy || CLOCK_DEFAULT_CONFIG.aiTimeoutPolicy
        };
    }

    function readClockConfig() {
        try {
            const raw = localStorage.getItem(CLOCK_CONFIG_STORAGE_KEY);
            if (!raw) return Object.assign({}, CLOCK_DEFAULT_CONFIG);
            return normalizeClockConfig(JSON.parse(raw));
        } catch (err) {
            console.warn('读取时钟配置失败:', err);
            return Object.assign({}, CLOCK_DEFAULT_CONFIG);
        }
    }

    function persistClockConfig() {
        try {
            localStorage.setItem(CLOCK_CONFIG_STORAGE_KEY, JSON.stringify(clockConfig));
        } catch (err) {
            console.warn('保存时钟配置失败:', err);
        }
    }

    function updateClockControlsFromConfig() {
        if (!clockConfig) clockConfig = Object.assign({}, CLOCK_DEFAULT_CONFIG);
        if (elClockEnabledToggle) {
            elClockEnabledToggle.checked = !!clockConfig.enabled;
        }
        if (elClockTurnLimitSelect) {
            const value = String(clockConfig.turnLimitSec);
            if (!Array.from(elClockTurnLimitSelect.options).some(opt => opt.value === value)) {
                const customOpt = document.createElement('option');
                customOpt.value = value;
                customOpt.textContent = `${value}秒`;
                customOpt.dataset.dynamic = 'true';
                elClockTurnLimitSelect.appendChild(customOpt);
            }
            elClockTurnLimitSelect.value = value;
        }
        if (elClockAlarmThresholdSelect) {
            const value = String(clockConfig.alarmThresholdMin);
            if (!Array.from(elClockAlarmThresholdSelect.options).some(opt => opt.value === value)) {
                const customOpt = document.createElement('option');
                customOpt.value = value;
                customOpt.textContent = `${value}分钟`;
                customOpt.dataset.dynamic = 'true';
                elClockAlarmThresholdSelect.appendChild(customOpt);
            }
            elClockAlarmThresholdSelect.value = value;
        }
    }

    function setClockConfig(nextPatch = {}, options = {}) {
        const nextConfig = normalizeClockConfig(Object.assign({}, clockConfig || CLOCK_DEFAULT_CONFIG, nextPatch || {}));
        clockConfig = nextConfig;
        if (options.persist !== false) {
            persistClockConfig();
        }
        updateClockControlsFromConfig();
        if (options.announce) {
            showStatusMessage(clockConfig.enabled ? '时间限制模式已开启' : '时间限制模式已关闭');
        }
    }

    function resetClockRuntime() {
        clockRuntime.gameStartTs = null;
        clockRuntime.turnStartTs = null;
        clockRuntime.elapsedMs = 0;
        clockRuntime.remainingMs = 0;
        clockRuntime.activeTurnKey = '';
        clockRuntime.alarmTriggered = false;
        clockRuntime.pendingAiTimeoutTurnKey = '';
        clockRuntime.timeoutTriggeredTurnKey = '';
    }

    function buildTurnKey(gameState) {
        if (!gameState || gameState.phase !== 'PLAYING') return '';
        return `${Number(gameState.turn_count || 0)}:${String(gameState.current_turn || '')}`;
    }

    function formatClockDuration(ms) {
        const safe = Math.max(0, Math.floor(Number(ms) || 0));
        const totalSec = Math.floor(safe / 1000);
        const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    function formatTurnsLeft(turns, count = 1) {
        if (!Number.isFinite(Number(turns)) || Number(turns) <= 0) return '0回合';
        const rounded = Math.max(0, Math.floor(Number(turns)));
        if (count > 1) return `${rounded}回合(${count}个)`;
        return `${rounded}回合`;
    }

    function currentTurnIsAi(gameState) {
        if (!gameState || gameState.game_over) return false;
        if (isAiVsAiMode) return true;
        return !!(isAiMode && gameState.current_turn === 'black');
    }

    function getCurrentTurnRemainingMs(nowTs = Date.now()) {
        if (!state || state.phase !== 'PLAYING' || state.game_over || !clockConfig || !clockConfig.enabled) return null;
        if (!Number.isFinite(clockRuntime.turnStartTs)) return null;
        const turnLimitMs = Math.max(1, Number(clockConfig.turnLimitSec || CLOCK_DEFAULT_CONFIG.turnLimitSec)) * 1000;
        return Math.max(0, turnLimitMs - (nowTs - clockRuntime.turnStartTs));
    }

    function createReplaySessionId() {
        return `mc_replay_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    }

    function pickReplayVideoMimeType() {
        if (typeof window.MediaRecorder === 'undefined'
            || typeof window.MediaRecorder.isTypeSupported !== 'function') {
            return { mimeType: '', ext: '', isMp4: false };
        }
        const mp4Candidates = [
            'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
            'video/mp4;codecs="avc1.42E01E"',
            'video/mp4'
        ];
        for (const mimeType of mp4Candidates) {
            if (window.MediaRecorder.isTypeSupported(mimeType)) {
                return { mimeType, ext: 'mp4', isMp4: true };
            }
        }
        const webmCandidates = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];
        for (const mimeType of webmCandidates) {
            if (window.MediaRecorder.isTypeSupported(mimeType)) {
                return { mimeType, ext: 'webm', isMp4: false };
            }
        }
        return { mimeType: '', ext: '', isMp4: false };
    }

    function stopReplayVideoTracks() {
        const stream = replayVideoRecorder.stream;
        if (!stream || typeof stream.getTracks !== 'function') return;
        for (const track of stream.getTracks()) {
            try {
                track.stop();
            } catch (_err) {
                // Ignore track stop errors.
            }
        }
    }

    function resetReplayVideoRecorder({ keepBlob = false } = {}) {
        stopReplayVideoTracks();
        replayVideoRecorder.active = false;
        replayVideoRecorder.startRequested = false;
        replayVideoRecorder.stopping = false;
        replayVideoRecorder.stream = null;
        replayVideoRecorder.recorder = null;
        replayVideoRecorder.chunks = [];
        replayVideoRecorder.mimeType = '';
        replayVideoRecorder.fileExt = 'mp4';
        replayVideoRecorder.startedAtWallTs = 0;
        replayVideoRecorder.endedAtWallTs = 0;
        replayVideoRecorder.stopPromise = null;
        replayVideoRecorder.lastError = '';
        if (!keepBlob) {
            replayVideoRecorder.blob = null;
        }
    }

    async function startReplayVideoCaptureFromGesture() {
        if (replayVideoRecorder.active || replayVideoRecorder.startRequested) return { started: false, reason: 'already-active' };
        replayVideoRecorder.startRequested = true;
        replayVideoRecorder.lastError = '';
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
            replayVideoRecorder.lastError = 'getDisplayMedia-unavailable';
            replayVideoRecorder.startRequested = false;
            return { started: false, reason: replayVideoRecorder.lastError };
        }
        const mimeInfo = pickReplayVideoMimeType();
        if (!mimeInfo.mimeType) {
            replayVideoRecorder.lastError = 'mediarecorder-unsupported';
            replayVideoRecorder.startRequested = false;
            showStatusMessage('当前浏览器不支持录屏编码，仍可导出JSON轨迹');
            return { started: false, reason: replayVideoRecorder.lastError };
        }

        let stream = null;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: REPLAY_VIDEO_PROFILE.fps, max: REPLAY_VIDEO_PROFILE.fps },
                    width: { ideal: REPLAY_VIDEO_PROFILE.width, max: REPLAY_VIDEO_PROFILE.width },
                    height: { ideal: REPLAY_VIDEO_PROFILE.height, max: REPLAY_VIDEO_PROFILE.height },
                    cursor: 'never'
                },
                audio: false,
                preferCurrentTab: true
            });
        } catch (err) {
            replayVideoRecorder.lastError = err && err.name ? err.name : 'display-capture-denied';
            replayVideoRecorder.startRequested = false;
            showStatusMessage('未开启对局录屏（已跳过，仅保留JSON）');
            return { started: false, reason: replayVideoRecorder.lastError };
        }

        let recorder = null;
        try {
            recorder = new MediaRecorder(stream, {
                mimeType: mimeInfo.mimeType,
                videoBitsPerSecond: REPLAY_VIDEO_PROFILE.videoBitsPerSecond
            });
        } catch (err) {
            stopReplayVideoTracks();
            replayVideoRecorder.lastError = err && err.name ? err.name : 'mediarecorder-create-failed';
            replayVideoRecorder.startRequested = false;
            showStatusMessage('录屏初始化失败，仅保留JSON');
            return { started: false, reason: replayVideoRecorder.lastError };
        }

        replayVideoRecorder.active = true;
        replayVideoRecorder.stopping = false;
        replayVideoRecorder.stream = stream;
        replayVideoRecorder.recorder = recorder;
        replayVideoRecorder.chunks = [];
        replayVideoRecorder.mimeType = recorder.mimeType || mimeInfo.mimeType;
        replayVideoRecorder.fileExt = /mp4/i.test(replayVideoRecorder.mimeType) ? 'mp4' : mimeInfo.ext;
        replayVideoRecorder.startedAtWallTs = Date.now();
        replayVideoRecorder.endedAtWallTs = 0;
        replayVideoRecorder.blob = null;
        replayVideoRecorder.stopPromise = null;

        recorder.ondataavailable = (event) => {
            if (!event || !event.data || event.data.size <= 0) return;
            replayVideoRecorder.chunks.push(event.data);
        };

        stream.getVideoTracks().forEach((track) => {
            track.addEventListener('ended', () => {
                stopReplayVideoCapture('track-ended').catch((_err) => { });
            }, { once: true });
        });

        recorder.start(REPLAY_VIDEO_PROFILE.chunkMs);
        showStatusMessage('本局录屏已启动（低码率模式）');
        return { started: true, mimeType: replayVideoRecorder.mimeType, ext: replayVideoRecorder.fileExt };
    }

    async function stopReplayVideoCapture(reason = 'manual-stop') {
        if (replayVideoRecorder.stopPromise) return replayVideoRecorder.stopPromise;
        const recorder = replayVideoRecorder.recorder;
        if (!recorder) {
            stopReplayVideoTracks();
            replayVideoRecorder.active = false;
            replayVideoRecorder.startRequested = false;
            return replayVideoRecorder.blob;
        }

        replayVideoRecorder.stopping = true;
        replayVideoRecorder.stopPromise = new Promise((resolve) => {
            let finalized = false;
            const finalize = () => {
                if (finalized) return;
                finalized = true;
                const mimeType = replayVideoRecorder.mimeType || 'video/webm';
                replayVideoRecorder.active = false;
                replayVideoRecorder.startRequested = false;
                replayVideoRecorder.stopping = false;
                replayVideoRecorder.endedAtWallTs = Date.now();
                replayVideoRecorder.blob = replayVideoRecorder.chunks.length
                    ? new Blob(replayVideoRecorder.chunks, { type: mimeType })
                    : null;
                replayVideoRecorder.recorder = null;
                stopReplayVideoTracks();
                replayVideoRecorder.stream = null;
                replayVideoRecorder.stopPromise = null;
                resolve(replayVideoRecorder.blob);
            };
            recorder.addEventListener('stop', finalize, { once: true });
            try {
                if (recorder.state !== 'inactive') {
                    recorder.stop();
                } else {
                    finalize();
                }
            } catch (_err) {
                finalize();
            }
            setTimeout(finalize, 1500);
        });

        return replayVideoRecorder.stopPromise;
    }

    function resetReplayRecorder({ keepSavedCount = true } = {}) {
        const prevSavedCount = replayRecorder.savedCount || 0;
        replayRecorder.sessionId = '';
        replayRecorder.active = false;
        replayRecorder.finalized = false;
        replayRecorder.startedAtWallTs = 0;
        replayRecorder.endedAtWallTs = 0;
        replayRecorder.frames = [];
        replayRecorder.tracks = [];
        replayRecorder.initialSnapshot = null;
        replayRecorder.finalSnapshot = null;
        replayRecorder.result = null;
        replayRecorder.lastFrameKey = '';
        replayRecorder.lastFrameStateDigest = '';
        replayRecorder.savedCount = keepSavedCount ? prevSavedCount : 0;
        resetReplayVideoRecorder({ keepBlob: false });
    }

    function ensureReplayStatusText(text = '', isError = false) {
        if (!elReplayStatus) return;
        elReplayStatus.textContent = text || '';
        elReplayStatus.style.color = isError ? '#ff8d8d' : '#9bc0cc';
    }

    function readReplayRecords() {
        try {
            const raw = localStorage.getItem(REPLAY_RECORDS_STORAGE_KEY);
            if (!raw) return [];
            const list = JSON.parse(raw);
            return Array.isArray(list) ? list : [];
        } catch (err) {
            console.warn('读取录像记录失败:', err);
            return [];
        }
    }

    function writeReplayRecords(records) {
        try {
            localStorage.setItem(REPLAY_RECORDS_STORAGE_KEY, JSON.stringify(records || []));
            return true;
        } catch (err) {
            console.warn('保存录像记录失败:', err);
            return false;
        }
    }

    function trimReplayRecords(records) {
        const list = Array.isArray(records) ? records.slice() : [];
        list.sort((a, b) => Number(b.saved_at_ms || 0) - Number(a.saved_at_ms || 0));
        return list.slice(0, REPLAY_RECORDS_LIMIT);
    }

    function clearReplayRecords() {
        writeReplayRecords([]);
        renderReplayRecords();
        showStatusMessage('录像记录已清空');
    }

    function formatReplaySavedTime(ts) {
        const dt = new Date(Number(ts || Date.now()));
        if (Number.isNaN(dt.getTime())) return '--';
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        const hh = String(dt.getHours()).padStart(2, '0');
        const mi = String(dt.getMinutes()).padStart(2, '0');
        const ss = String(dt.getSeconds()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    }

    function bytesToSize(bytes) {
        const size = Number(bytes || 0);
        if (!Number.isFinite(size) || size <= 0) return '0 B';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }

    function removeReplayRecord(recordId) {
        const id = String(recordId || '');
        const next = readReplayRecords().filter(item => String(item.id || '') !== id);
        writeReplayRecords(next);
        renderReplayRecords();
        showStatusMessage('录像记录已删除');
    }

    function downloadReplayRecord(recordId) {
        const id = String(recordId || '');
        const record = readReplayRecords().find(item => String(item.id || '') === id);
        if (!record) {
            showStatusMessage('未找到该录像记录');
            return;
        }
        if (!record.payload_json) {
            showStatusMessage('该记录仅保留摘要，无法重新下载');
            return;
        }
        try {
            const blob = new Blob([record.payload_json], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = record.file_name || `mole_chess_replay_${id}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            showStatusMessage(`录像已重新下载：${a.download}`);
        } catch (err) {
            console.error('downloadReplayRecord error:', err);
            showStatusMessage(`下载失败：${err.message}`);
        }
    }

    function renderReplayRecords() {
        if (!replayRecordsList) return;
        const records = readReplayRecords();
        if (!records.length) {
            replayRecordsList.innerHTML = '<div class="replay-record-empty">暂无录像记录。请先在游戏结束后点击“保存录像”。</div>';
            return;
        }
        replayRecordsList.innerHTML = '';
        records.forEach((record) => {
            const card = document.createElement('div');
            card.className = 'replay-record-item';
            const winnerMap = { black: '黑方', white: '白方', draw: '平局' };
            const winnerText = winnerMap[record.winner] || (record.winner || '--');
            const fileName = record.file_name || `${record.id}.json`;
            const videoMeta = record.video_saved
                ? `视频：${record.video_file_name || `.${record.video_ext || 'mp4'}`}（${bytesToSize(record.video_bytes || 0)}）`
                : '视频：未保存';
            card.innerHTML = `
                <div class="replay-record-title">${fileName}</div>
                <div class="replay-record-meta">
                    保存时间：${formatReplaySavedTime(record.saved_at_ms)}<br>
                    胜负结果：${winnerText} ${record.win_reason ? `（${record.win_reason}）` : ''}<br>
                    帧数：${Number(record.total_frames || 0)}，轨迹步数：${Number(record.total_track_steps || 0)}，大小：${bytesToSize(record.payload_bytes || 0)}<br>
                    ${videoMeta}
                </div>
                <div class="replay-record-actions">
                    <button class="rules-close-btn replay-download-btn" data-replay-id="${record.id}">下载</button>
                    <button class="rules-close-btn replay-remove-btn" data-replay-id="${record.id}">删除</button>
                </div>
            `;
            replayRecordsList.appendChild(card);
        });
    }

    function registerReplayRecord(record) {
        if (!record || typeof record !== 'object') return;
        const current = readReplayRecords();
        const next = trimReplayRecords([record, ...current]);
        if (!writeReplayRecords(next)) {
            showStatusMessage('录像已保存，但记录写入失败（可能是本地存储空间不足）');
            return;
        }
        renderReplayRecords();
    }

    function buildReplayPieceMap(gameState) {
        const out = new Map();
        if (!gameState || !Array.isArray(gameState.board)) return out;
        for (let r = 0; r < gameState.board.length; r += 1) {
            const row = gameState.board[r] || [];
            for (let c = 0; c < row.length; c += 1) {
                const stack = row[c] || [];
                for (const piece of stack) {
                    if (!piece || piece.id === null || piece.id === undefined) continue;
                    out.set(String(piece.id), {
                        id: piece.id,
                        name: piece.name || '',
                        team: piece.team || '',
                        state: piece.state || '',
                        symbol: piece.symbol || '',
                        pos: [r, c]
                    });
                }
            }
        }
        return out;
    }

    function diffReplayStates(prevState, nextState) {
        const prevMap = buildReplayPieceMap(prevState);
        const nextMap = buildReplayPieceMap(nextState);
        const moved = [];
        const spawned = [];
        const removed = [];

        for (const [id, nextPiece] of nextMap.entries()) {
            const prevPiece = prevMap.get(id);
            if (!prevPiece) {
                spawned.push(nextPiece);
                continue;
            }
            if (prevPiece.pos[0] !== nextPiece.pos[0] || prevPiece.pos[1] !== nextPiece.pos[1]) {
                moved.push({
                    id: nextPiece.id,
                    name: nextPiece.name,
                    team: nextPiece.team,
                    from: prevPiece.pos,
                    to: nextPiece.pos
                });
            }
        }
        for (const [id, prevPiece] of prevMap.entries()) {
            if (!nextMap.has(id)) {
                removed.push(prevPiece);
            }
        }

        return { moved, spawned, removed };
    }

    function buildReplayStateDigest(gameState) {
        if (!gameState || !Array.isArray(gameState.board)) return 'empty';
        const digestParts = [];
        for (let r = 0; r < gameState.board.length; r += 1) {
            const row = gameState.board[r] || [];
            for (let c = 0; c < row.length; c += 1) {
                const stack = row[c] || [];
                if (!stack.length) continue;
                const top = stack[stack.length - 1];
                if (!top) continue;
                digestParts.push(`${top.id || '?'}@${r},${c}:${top.state || ''}`);
            }
        }
        return digestParts.join('|');
    }

    function beginReplayRecording(gameState) {
        resetReplayRecorder({ keepSavedCount: true });
        replayRecorder.sessionId = createReplaySessionId();
        replayRecorder.active = true;
        replayRecorder.startedAtWallTs = Date.now();
        replayRecorder.result = {
            winner: null,
            win_reason: '',
            started_turn: Number(gameState && gameState.turn_count || 0)
        };
        fetch('/api/story/export_snapshot')
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.snapshot) {
                    replayRecorder.initialSnapshot = data.snapshot;
                }
            })
            .catch(err => {
                console.warn('初始录像快照获取失败:', err);
            });
    }

    function finalizeReplayRecording(gameState) {
        if (!replayRecorder.active || replayRecorder.finalized) return;
        replayRecorder.finalized = true;
        replayRecorder.endedAtWallTs = Date.now();
        replayRecorder.result = {
            winner: gameState && gameState.winner ? gameState.winner : null,
            win_reason: gameState && gameState.win_reason ? gameState.win_reason : '',
            ended_turn: Number(gameState && gameState.turn_count || 0),
            ended_round: Number(gameState && gameState.round_count || 0)
        };
    }

    function captureReplayFrame(prevState, nextState) {
        if (!replayRecorder.active || !nextState || nextState.phase !== 'PLAYING') return;
        const now = Date.now();
        const logLen = Array.isArray(nextState.log_history) ? nextState.log_history.length : 0;
        const frameKey = `${nextState.turn_count}|${nextState.current_turn}|${logLen}|${nextState.action_status || ''}|${nextState.game_over ? 1 : 0}`;
        const stateDigest = buildReplayStateDigest(nextState);
        if (replayRecorder.lastFrameKey === frameKey && replayRecorder.lastFrameStateDigest === stateDigest) {
            return;
        }
        replayRecorder.lastFrameKey = frameKey;
        replayRecorder.lastFrameStateDigest = stateDigest;

        const diff = prevState && prevState.phase === 'PLAYING'
            ? diffReplayStates(prevState, nextState)
            : { moved: [], spawned: [], removed: [] };
        const elapsedMs = Math.max(0, now - replayRecorder.startedAtWallTs);
        const frame = {
            index: replayRecorder.frames.length + 1,
            at_ms: elapsedMs,
            turn_count: Number(nextState.turn_count || 0),
            round_count: Number(nextState.round_count || 0),
            current_turn: nextState.current_turn || '',
            game_over: !!nextState.game_over,
            action_status: nextState.action_status || '',
            log_tail: logLen > 0 ? String(nextState.log_history[logLen - 1] || '') : '',
            moved: diff.moved,
            spawned: diff.spawned,
            removed: diff.removed
        };
        replayRecorder.frames.push(frame);

        for (const move of diff.moved) {
            replayRecorder.tracks.push({
                step: replayRecorder.tracks.length + 1,
                frame_index: frame.index,
                at_ms: elapsedMs,
                turn_count: frame.turn_count,
                round_count: frame.round_count,
                current_turn: frame.current_turn,
                piece_id: move.id,
                piece_name: move.name,
                team: move.team,
                from: move.from,
                to: move.to
            });
        }
    }

    function syncReplayRecording(prevState, nextState) {
        if (!nextState) return;
        if (nextState.phase !== 'PLAYING') {
            if (replayRecorder.active && !nextState.game_over) {
                resetReplayRecorder({ keepSavedCount: true });
                ensureReplayStatusText('本局结束后可保存录像轨迹');
            }
            return;
        }
        if (nextState.phase === 'PLAYING' && !replayRecorder.active) {
            beginReplayRecording(nextState);
        }
        if (replayRecorder.active && nextState.phase === 'PLAYING') {
            captureReplayFrame(prevState, nextState);
        }
        if (nextState.game_over) {
            finalizeReplayRecording(nextState);
            stopReplayVideoCapture('game-over').catch((_err) => { });
        }
    }

    async function fetchReplayFinalSnapshot() {
        try {
            const res = await fetch('/api/story/export_snapshot');
            const data = await res.json();
            if (data && data.success && data.snapshot) {
                replayRecorder.finalSnapshot = data.snapshot;
            }
        } catch (err) {
            console.warn('终局录像快照获取失败:', err);
        }
    }

    function buildReplayRoutes(tracks) {
        const routeMap = new Map();
        for (const step of tracks || []) {
            const key = String(step.piece_id);
            if (!routeMap.has(key)) {
                routeMap.set(key, {
                    piece_id: step.piece_id,
                    piece_name: step.piece_name,
                    team: step.team,
                    points: [step.from]
                });
            }
            const route = routeMap.get(key);
            route.points.push(step.to);
        }
        return Array.from(routeMap.values());
    }

    function buildReplayFileName() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const winner = replayRecorder.result && replayRecorder.result.winner ? replayRecorder.result.winner : 'unknown';
        return `mole_chess_replay_${yyyy}${mm}${dd}_${hh}${mi}${ss}_${winner}.json`;
    }

    function buildReplayVideoFileName(ext = 'mp4') {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const winner = replayRecorder.result && replayRecorder.result.winner ? replayRecorder.result.winner : 'unknown';
        return `mole_chess_replay_${yyyy}${mm}${dd}_${hh}${mi}${ss}_${winner}.${ext}`;
    }

    async function saveBlobToDisk(blob, fileName, mimeType, ext) {
        if (!blob || blob.size <= 0) {
            return { success: false, reason: 'empty-blob' };
        }
        if (window.showSaveFilePicker && window.isSecureContext) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'Mole Chess Replay Video',
                        accept: {
                            [mimeType || 'video/mp4']: [`.${ext || 'mp4'}`]
                        }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return { success: true, via: 'file-picker', fileName };
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    return { success: false, reason: 'user-cancelled' };
                }
                console.warn('save via file picker failed:', err);
            }
        }
        try {
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            return { success: true, via: 'download', fileName };
        } catch (err) {
            return { success: false, reason: err && err.message ? err.message : 'download-failed' };
        }
    }

    async function exportReplayVideoFile() {
        await stopReplayVideoCapture('export');
        const blob = replayVideoRecorder.blob;
        if (!blob || blob.size <= 0) {
            return { success: false, reason: 'no-video-blob' };
        }
        const mimeType = replayVideoRecorder.mimeType || (replayVideoRecorder.fileExt === 'mp4' ? 'video/mp4' : 'video/webm');
        const ext = replayVideoRecorder.fileExt || (/mp4/i.test(mimeType) ? 'mp4' : 'webm');
        const fileName = buildReplayVideoFileName(ext);
        const saveResult = await saveBlobToDisk(blob, fileName, mimeType, ext);
        return Object.assign({
            success: !!saveResult.success,
            fileName,
            bytes: blob.size,
            mimeType,
            ext
        }, saveResult);
    }

    async function saveReplayRecording() {
        if (!replayRecorder.frames.length) {
            ensureReplayStatusText('暂无可导出的录像轨迹', true);
            showStatusMessage('暂无可导出的录像轨迹');
            return;
        }
        if (btnSaveReplay) {
            btnSaveReplay.disabled = true;
            btnSaveReplay.textContent = '导出中...';
        }
        try {
            ensureReplayStatusText('正在打包录像轨迹...');
            await fetchReplayFinalSnapshot();

            const payload = {
                format: 'mole_chess_replay_track',
                version: replayRecorder.version,
                exported_at: new Date().toISOString(),
                session_id: replayRecorder.sessionId || createReplaySessionId(),
                summary: {
                    total_frames: replayRecorder.frames.length,
                    total_track_steps: replayRecorder.tracks.length,
                    winner: replayRecorder.result ? replayRecorder.result.winner : null,
                    win_reason: replayRecorder.result ? replayRecorder.result.win_reason : '',
                    started_at_ms: replayRecorder.startedAtWallTs,
                    ended_at_ms: replayRecorder.endedAtWallTs || Date.now()
                },
                time_control: clockConfig ? Object.assign({}, clockConfig) : null,
                result: replayRecorder.result || null,
                trajectory: replayRecorder.tracks.slice(),
                routes: buildReplayRoutes(replayRecorder.tracks),
                frames: replayRecorder.frames.slice(),
                initial_snapshot: replayRecorder.initialSnapshot || null,
                final_snapshot: replayRecorder.finalSnapshot || null
            };

            const fileName = buildReplayFileName();
            const json = JSON.stringify(payload, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);

            replayRecorder.savedCount = Number(replayRecorder.savedCount || 0) + 1;
            ensureReplayStatusText(`录像已保存（轨迹步数 ${replayRecorder.tracks.length}，保存次数 ${replayRecorder.savedCount}）`);
            showStatusMessage(`录像已保存：${fileName}`);

            const recordBase = {
                id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                saved_at_ms: Date.now(),
                file_name: fileName,
                winner: replayRecorder.result ? replayRecorder.result.winner : null,
                win_reason: replayRecorder.result ? replayRecorder.result.win_reason : '',
                total_frames: replayRecorder.frames.length,
                total_track_steps: replayRecorder.tracks.length,
                payload_bytes: json.length
            };

            ensureReplayStatusText('正在导出对局视频文件...');
            const videoExport = await exportReplayVideoFile();
            if (videoExport.success) {
                const extText = videoExport.ext ? videoExport.ext.toUpperCase() : 'VIDEO';
                ensureReplayStatusText(`录像已保存（JSON + ${extText}，视频大小 ${bytesToSize(videoExport.bytes)}）`);
                showStatusMessage(`视频已保存：${videoExport.fileName}`);
            } else if (videoExport.reason === 'user-cancelled') {
                ensureReplayStatusText('JSON已保存，视频保存已取消');
                showStatusMessage('视频保存已取消（JSON已保留）');
            } else if (videoExport.reason === 'no-video-blob') {
                ensureReplayStatusText('JSON已保存，未检测到本局视频（可能未开启录屏）');
                showStatusMessage('未检测到本局视频，请在开局时允许屏幕捕获');
            } else {
                ensureReplayStatusText('JSON已保存，视频导出失败', true);
                showStatusMessage('视频导出失败，请重试');
            }

            const videoMeta = {
                video_file_name: videoExport && videoExport.success ? (videoExport.fileName || '') : '',
                video_bytes: videoExport && videoExport.success ? Number(videoExport.bytes || 0) : 0,
                video_mime: videoExport && videoExport.success ? (videoExport.mimeType || '') : '',
                video_ext: videoExport && videoExport.success ? (videoExport.ext || '') : '',
                video_saved: !!(videoExport && videoExport.success)
            };
            const tryWithPayload = Object.assign({}, recordBase, videoMeta, { payload_json: json });
            const existing = readReplayRecords();
            if (!writeReplayRecords(trimReplayRecords([tryWithPayload, ...existing]))) {
                const fallback = Object.assign({}, recordBase, videoMeta, { payload_json: '' });
                registerReplayRecord(fallback);
            } else {
                renderReplayRecords();
            }
        } catch (err) {
            console.error('saveReplayRecording error:', err);
            ensureReplayStatusText(`录像导出失败：${err.message}`, true);
            showStatusMessage(`录像导出失败：${err.message}`);
        } finally {
            if (btnSaveReplay) {
                btnSaveReplay.disabled = false;
                btnSaveReplay.textContent = '💾 保存录像';
            }
        }
    }

    function formatPos(r, c) {
        if (typeof r !== 'number' || typeof c !== 'number') return '--';
        if (r < 0 || r > 11 || c < 0 || c > 11) return '--';
        return `${String.fromCharCode(65 + c)}${r + 1}`;
    }
    window.formatPos = formatPos;

    function getPieceNameClass(pieceName) {
        const map = {
            '市民': 'citizen',
            '警察': 'police',
            '官员': 'officer',
            '老师': 'teacher',
            '孩子': 'child',
            '红叶儿': 'red-child',
            '叶某': 'ye',
            '夜魔': 'nightmare',
            '妻子': 'wife',
            '绿叶妻': 'green-wife',
            '医生': 'doctor',
            '律师': 'lawyer',
            '僧侣': 'monk',
            '魔笛手': 'piper',
            '死神': 'deathgod',
            '广场舞大妈': 'squaredancer',
            '鼹鼠': 'mole',
            '墓碑': 'grave'
        };
        return map[pieceName] || null;
    }

    function toPosObject(pos) {
        if (Array.isArray(pos) && pos.length >= 2) {
            const r = Number(pos[0]);
            const c = Number(pos[1]);
            if (Number.isFinite(r) && Number.isFinite(c)) return { r, c };
        }
        if (pos && typeof pos === 'object') {
            const r = Number(pos.r);
            const c = Number(pos.c);
            if (Number.isFinite(r) && Number.isFinite(c)) return { r, c };
        }
        return null;
    }

    function buildPieceMeta(piece, posOverride = null) {
        if (!piece || typeof piece !== 'object') return null;
        const pos = toPosObject(posOverride || piece.position);
        return {
            id: piece.id || null,
            name: piece.name || '',
            team: piece.team || '',
            symbol: piece.symbol || '',
            pieceType: getPieceNameClass(piece.name || '') || '',
            pos: pos ? [pos.r, pos.c] : null
        };
    }

    function getPieceFromStatePos(stateRef, pos, pieceId = null) {
        if (!stateRef || !Array.isArray(stateRef.board)) return null;
        const p = toPosObject(pos);
        if (!p) return null;
        const cell = stateRef.board[p.r] && stateRef.board[p.r][p.c];
        if (!Array.isArray(cell) || !cell.length) return null;
        if (pieceId) {
            const matched = cell.find((item) => item && item.id === pieceId);
            if (matched) return matched;
        }
        return getDisplayPiece(cell);
    }

    function buildCellMeta(stateRef, pos) {
        const top = getPieceFromStatePos(stateRef, pos);
        return {
            pos: toPosObject(pos),
            topPiece: buildPieceMeta(top, pos)
        };
    }

    function findPieceByName(stateRef, pieceName) {
        if (!stateRef || !Array.isArray(stateRef.board) || !pieceName) return null;
        for (let r = 0; r < stateRef.board.length; r += 1) {
            const row = stateRef.board[r];
            if (!Array.isArray(row)) continue;
            for (let c = 0; c < row.length; c += 1) {
                const cell = row[c];
                if (!Array.isArray(cell)) continue;
                const hit = cell.find((piece) => piece && piece.name === pieceName);
                if (hit) return buildPieceMeta(hit, { r, c });
            }
        }
        return null;
    }

    const characterQuotes = {
        '夜魔': ['决定了，就这样决定了！从今天开始，任何牛鬼蛇神，我都来者不拒！', '幸福的家庭都是相似的，不幸的家庭各有各的不幸。'],
        '妻子': ['我厌倦了贞洁又郁闷的日子，又没有勇气过堕落的生活。'],
        '广场舞大妈': ['跳舞！跳舞！继续跳舞！谈恋爱不如跳舞！'],
        '官员': ['你的罪虽大，但是老大哥的仁慈更大。', '塞涅卡和布鲁图斯之所以正义，是因为他们生活在毫无正义可言的时代。'],
        '律师': ['这门是只为你开的，现在我要去把它关上了。', '在这里，我就是法！'],
        '警察': ['给你一个牛鬼神蛇，你就是这条街最靓的仔！', '道歉有用的话，还要警察干嘛？'],
        '孩子': ['爸爸又在妈妈身上做操了！', '爸爸！爸爸！', '爸爸回家了。'],
        '魔笛手': ['花的一生，为何如此短暂？', 'My song is yours.'],
        '医生': ['啊，活着是一件多么幸福的事！', '给人看病的人不仅得是个医生，还得是个搏斗高手。'],
        '僧侣': ['善知识！如露亦如电，应作如是观！'],
        '鼹鼠': ['挖洞很危险。但是可以挖出花花——送给你。', '给你所照亮的加上印记，而非你所遮掩的。'],
        '市民': ['人类最后患上的，就是名为希望的疾病。', '无需时刻保持敏感，迟钝有时即为美德。']
    };

    const quoteStyleMapping = {
        '夜魔': 'madness', '妻子': 'madness', '广场舞大妈': 'madness',
        '官员': 'authority', '律师': 'authority', '警察': 'authority',
        '孩子': 'creepy',
        '魔笛手': 'melancholy', '医生': 'melancholy', '僧侣': 'melancholy', '鼹鼠': 'melancholy', '市民': 'melancholy'
    };

    const quoteActorAliases = {
        '红叶儿': '孩子',
        '叶某': '夜魔'
    };

    const centeredQuoteActors = new Set(['夜魔', '妻子', '官员', '律师', '警察']);

    function normalizeQuoteActorName(actorName) {
        const raw = String(actorName || '').trim();
        if (!raw) return '';
        return quoteActorAliases[raw] || raw;
    }

    function getRandomBoardEdgeQuotePosition() {
        if (!gameBoard || typeof gameBoard.getBoundingClientRect !== 'function') return null;
        const rect = gameBoard.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        const gap = 20;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) {
            return { x: rect.left + Math.random() * rect.width, y: rect.top - gap };
        }
        if (side === 1) {
            return { x: rect.right + gap, y: rect.top + Math.random() * rect.height };
        }
        if (side === 2) {
            return { x: rect.left + Math.random() * rect.width, y: rect.bottom + gap };
        }
        return { x: rect.left - gap, y: rect.top + Math.random() * rect.height };
    }

    function triggerQuote(actorName, options = {}) {
        const normalizedActorName = normalizeQuoteActorName(actorName);
        if (!normalizedActorName) return;
        const quotes = characterQuotes[normalizedActorName];
        if (!Array.isArray(quotes) || !quotes.length) return;

        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        const styleType = quoteStyleMapping[normalizedActorName] || 'melancholy';
        const overlay = document.createElement('div');
        overlay.className = `skill-quote-base quote-style-${styleType}`;
        if (styleType === 'authority' || styleType === 'melancholy') {
            overlay.classList.add('quote-opacity-65');
        }
        if (centeredQuoteActors.has(normalizedActorName)) {
            overlay.classList.add('skill-quote-center');
        }

        if (styleType === 'madness') {
            let chaoticText = '';
            for (let i = 0; i < randomQuote.length; i += 1) {
                const char = randomQuote[i];
                const rot = Math.random() * 60 - 30;
                const scale = Math.random() * 1.2 + 0.8;
                const offset = Math.random() * 30 - 15;
                const color = Math.random() > 0.85 ? '#ffffff' : '#ff0000';
                chaoticText += `<span style="display:inline-block; color:${color}; transform: translateY(${offset}px) rotate(${rot}deg) scale(${scale}); margin: 0 1px;">${char}</span>`;
            }
            overlay.innerHTML = chaoticText;
        } else if (styleType === 'authority') {
            overlay.innerHTML = `【${normalizedActorName}】: ${randomQuote}`;
        } else if (styleType === 'creepy') {
            overlay.innerHTML = `...${randomQuote}...`;
        } else {
            overlay.innerHTML = `<div>${randomQuote}</div><div style="font-size:12px; color:#888; margin-top:10px; text-align:right;">—— ${normalizedActorName}</div>`;
        }

        if (options && options.positionMode === 'board_edge') {
            const edgePos = getRandomBoardEdgeQuotePosition();
            if (edgePos) {
                overlay.classList.add('skill-quote-board-edge');
                overlay.style.left = `${Math.round(edgePos.x)}px`;
                overlay.style.top = `${Math.round(edgePos.y)}px`;
                overlay.style.right = 'auto';
                overlay.style.bottom = 'auto';
            }
        }

        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.remove();
        }, 5000);
    }

    function triggerDeathGodEat() {
        const flash = document.createElement('div');
        flash.className = 'effect-jumpscare-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 400);
    }

    function resolveFxActorName(payload) {
        if (!payload || !payload.actor) return '';
        if (typeof payload.actor === 'string') return payload.actor;
        if (typeof payload.actor.name === 'string') return payload.actor.name;
        return '';
    }

    function isRedChildPiece(piece) {
        return !!(piece && (piece.name === '红叶儿' || piece.is_red_child === true));
    }

    function triggerFx(eventId, context = {}) {
        const payload = Object.assign({
            surface: 'index',
            timestamp: new Date().toISOString()
        }, context || {});

        if (eventId === 'death_god_kill') {
            triggerDeathGodEat();
        } else if (eventId === 'skill_success' || eventId === 'skill_ultimate') {
            const actorName = resolveFxActorName(payload);
            if (actorName) triggerQuote(actorName);
        }

        window.MoleChessEffects?.triggerEvent(eventId, payload);
    }
    window.triggerFx = triggerFx;

    function runtimeEventFields() {
        return ['surface', 'eventId', 'timestamp', 'element', 'log', 'cause', 'result', 'dice', 'skillType', 'actor', 'target', 'victim', 'deathVictims'];
    }

    function buildRuntimeEventCatalog() {
        const eventIds = [
            'move_start', 'capture_execute', 'piece_captured', 'piece_to_grave', 'piece_to_ghost', 'piece_revive',
            'move_end', 'game_start', 'turn_change', 'game_over_win', 'game_over_draw',
            'skill_activate', 'skill_success', 'skill_failure', 'skill_ultimate',
            'citizen_upgrade', 'wife_possess', 'wife_depossess', 'ye_transform', 'nightmare_crush',
            'police_arrest', 'police_execute', 'mole_tunnel', 'mole_destroy_grave', 'monk_save', 'monk_restore',
            'dancer_dance', 'piper_fate', 'officer_summon', 'lawyer_swap',
            'death_god_move', 'death_god_kill', 'death_god_exit', 'day_phase', 'night_phase',
            'child_red_song', 'citizen_encircle', 'citizen_v_formation',
            'detention_arrest', 'detention_release',
            'dice_roll_start', 'dice_roll_end',
            'hover_piece_grave', 'hover_piece_ghost', 'hover_piece_black', 'hover_piece_white', 'hover_piece_neutral',
            'hover_cell_highlight', 'hover_cell_empty', 'select_piece', 'select_piece_enemy',
            'stack_picker_open', 'context_menu_open'
        ];
        const events = {};
        eventIds.forEach((eventId) => {
            events[eventId] = { fields: runtimeEventFields() };
        });
        return {
            source: 'app.js',
            generatedAt: new Date().toISOString(),
            events
        };
    }

    window.MoleChessRuntimeEventCatalog = buildRuntimeEventCatalog();

    function getDisplayPiece(pieceStack) {
        if (!Array.isArray(pieceStack) || pieceStack.length === 0) return null;
        // Green wife + host citizen stack should always display green wife as primary icon.
        const greenWife = pieceStack.find(p => p && (p.is_green_wife || p.name === '绿叶妻'));
        if (greenWife) {
            return greenWife;
        }
        return pieceStack[pieceStack.length - 1];
    }

    function cellKey(r, c) {
        return `${r}:${c}`;
    }

    function getAdjacent8EmptyCells(pos) {
        if (!state || !state.board || !pos) return [];
        const out = [];
        for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
                if (dr === 0 && dc === 0) continue;
                const nr = pos.r + dr;
                const nc = pos.c + dc;
                if (nr < 0 || nr > 11 || nc < 0 || nc > 11) continue;
                const cell = state.board[nr] && state.board[nr][nc];
                if (Array.isArray(cell) && cell.length === 0) {
                    out.push([nr, nc]);
                }
            }
        }
        return out;
    }

    function getLineEmptyCells(pos) {
        if (!state || !state.board || !pos) return [];
        const out = [];
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
            let nr = pos.r + dr;
            let nc = pos.c + dc;
            while (nr >= 0 && nr < 12 && nc >= 0 && nc < 12) {
                const cell = state.board[nr] && state.board[nr][nc];
                if (Array.isArray(cell) && cell.length === 0) {
                    out.push([nr, nc]);
                }
                nr += dr;
                nc += dc;
            }
        }
        return out;
    }

    function hasCoord(coords, r, c) {
        return Array.isArray(coords) && coords.some(p => p[0] === r && p[1] === c);
    }

    function resetTunnelFlow(clearSkillType = false) {
        tunnelMolePos = null;
        tunnelTargetPos = null;
        tunnelStartPos = null;
        pendingTunnelTarget = null;
        if (clearSkillType) pendingSkillType = null;
    }

    function collectEventsFromLogMessage(message) {
        const msg = String(message || '');
        if (!msg) return [];
        const events = [];

        if (/死神掷出|死神向/.test(msg)) events.push('death_god_move');
        if (/死神吃掉/.test(msg)) events.push('death_god_kill', 'piece_to_ghost');
        if (/死神走出棋盘|从本局消失|死神.*消失/.test(msg)) events.push('death_god_exit');

        if (/ 吃掉了 |击杀了|被击杀/.test(msg) && !/死神吃掉/.test(msg)) {
            events.push('piece_captured', 'piece_to_grave');
        }
        if (/变成幽灵|幽灵池/.test(msg)) events.push('piece_to_ghost');
        if (/复活成功|复活/.test(msg)) events.push('piece_revive');
        if (/附身成功|变为绿叶妻/.test(msg)) events.push('wife_possess');
        if (/解除附身/.test(msg)) events.push('wife_depossess');
        if (/学会唱红歌|终身复读|红歌状态/.test(msg)) events.push('child_red_song');
        if (/变身为夜魔|叶某发疯了|夜魔自动热爱黑黑判定/.test(msg)) events.push('ye_transform');
        if (/夜魔碾压/.test(msg)) events.push('nightmare_crush');
        if (/抓捕成功|成功抓捕/.test(msg)) events.push('police_arrest', 'detention_arrest');
        if (/枪决/.test(msg)) events.push('police_execute', 'piece_to_ghost');
        if (/通过地道/.test(msg)) events.push('mole_tunnel');
        if (/破坏了.*墓|爆破鼹鼠/.test(msg)) events.push('mole_destroy_grave');
        if (/开始修行/.test(msg)) events.push('monk_save');
        if (/庙宇庇护结束/.test(msg)) events.push('monk_restore');
        if (/共舞/.test(msg)) events.push('dancer_dance');
        if (/命运骰/.test(msg)) events.push('piper_fate');
        if (/召唤.*幽灵/.test(msg)) events.push('officer_summon');
        if (/互换位置|易位/.test(msg)) events.push('lawyer_swap');

        if (/游戏开始/.test(msg)) events.push('game_start');
        if (/=== 第.*回合开始/.test(msg)) events.push('turn_change');
        if (/黑夜/.test(msg)) events.push('night_phase');
        if (/白昼/.test(msg)) events.push('day_phase');
        if (/V阵型/.test(msg)) events.push('citizen_v_formation');
        if (/包围/.test(msg)) events.push('citizen_encircle');
        if (/拘留结束/.test(msg)) events.push('detention_release');

        return [...new Set(events)];
    }

    function parseDeathVictimsFromLog(message) {
        const msg = String(message || '');
        const matched = msg.match(/死神吃掉了\s*(.+)$/);
        if (!matched || !matched[1]) return [];
        return matched[1]
            .split(/[，,、]/g)
            .map((x) => x.trim())
            .filter(Boolean)
            .map((name) => ({ name }));
    }

    function parseCaptureFromLog(message) {
        const msg = String(message || '');
        let matched = msg.match(/([^，。 ]+)\s*吃掉了\s*([^，。]+)/);
        if (!matched) matched = msg.match(/([^，。 ]+)\s*击杀了\s*([^，。]+)/);
        if (!matched) return { actorName: '', victimName: '' };
        return {
            actorName: matched[1] || '',
            victimName: matched[2] || ''
        };
    }

    function diffGhostVictims(prevState, nextState) {
        const prevNames = new Set(
            (Array.isArray(prevState && prevState.ghost_pool) ? prevState.ghost_pool : [])
                .map((piece) => piece && (piece.original_name || piece.name))
                .filter(Boolean)
        );
        const nextNames = (Array.isArray(nextState && nextState.ghost_pool) ? nextState.ghost_pool : [])
            .map((piece) => piece && (piece.original_name || piece.name))
            .filter(Boolean);
        return nextNames.filter((name) => !prevNames.has(name));
    }

    function buildLogEventContext(eventId, logMsg, prevState, nextState) {
        const context = {
            log: logMsg,
            cause: 'log_sync'
        };
        if (eventId === 'death_god_kill') {
            const victims = parseDeathVictimsFromLog(logMsg);
            const diffVictims = diffGhostVictims(prevState, nextState).map((name) => ({ name }));
            const mergedVictims = victims.concat(diffVictims).filter((item, idx, arr) =>
                item && item.name && arr.findIndex((x) => x && x.name === item.name) === idx
            );
            context.deathVictims = mergedVictims;
            if (mergedVictims.length === 1) {
                context.victim = findPieceByName(prevState, mergedVictims[0].name) || mergedVictims[0];
            }
            context.actor = findPieceByName(prevState, '死神') || { name: '死神', pieceType: 'deathgod', team: 'neutral' };
            context.result = 'kill';
        } else if (eventId === 'piece_to_grave' || eventId === 'piece_captured') {
            const capture = parseCaptureFromLog(logMsg);
            if (capture.actorName) context.actor = findPieceByName(prevState, capture.actorName) || { name: capture.actorName };
            if (capture.victimName) context.victim = findPieceByName(prevState, capture.victimName) || { name: capture.victimName };
            context.result = 'captured';
        } else if (eventId === 'skill_activate' || eventId === 'skill_success' || eventId === 'skill_failure' || eventId === 'skill_ultimate') {
            context.result = eventId.replace('skill_', '');
        }
        if (eventId === 'piece_to_ghost') context.result = 'ghost';
        if (eventId === 'piece_revive') context.result = 'revive';
        if (eventId === 'day_phase') context.result = 'day';
        if (eventId === 'night_phase') context.result = 'night';
        if (eventId === 'death_god_move') context.actor = findPieceByName(nextState || prevState, '死神') || { name: '死神', pieceType: 'deathgod', team: 'neutral' };
        return context;
    }

    function bridgeLogAndStateEvents(prevState, nextState) {
        if (!nextState || !prevState) return;

        const prevDetained = Array.isArray(prevState.detained_pieces) ? prevState.detained_pieces.length : 0;
        const nextDetained = Array.isArray(nextState.detained_pieces) ? nextState.detained_pieces.length : 0;
        if (nextDetained > prevDetained) {
            triggerFx('detention_arrest', { cause: 'state_diff' });
        } else if (nextDetained < prevDetained) {
            triggerFx('detention_release', { cause: 'state_diff' });
        }

        const prevLogs = Array.isArray(prevState.log_history) ? prevState.log_history : [];
        const nextLogs = Array.isArray(nextState.log_history) ? nextState.log_history : [];
        if (prevLogs.length > nextLogs.length) return;

        const newLogs = nextLogs.slice(prevLogs.length);
        for (const logMsg of newLogs) {
            const eventIds = collectEventsFromLogMessage(logMsg);
            eventIds.forEach((eventId) => {
                triggerFx(eventId, buildLogEventContext(eventId, logMsg, prevState, nextState));
            });
        }
    }

    function readDefaultAudioSetting(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return fallback;
            return JSON.parse(raw);
        } catch (err) {
            return fallback;
        }
    }

    // --- Audio State ---
    let isMuted = !!readDefaultAudioSetting('mole_chess_default_mute', false);
    let audioVolume = Number(readDefaultAudioSetting('mole_chess_default_volume', 0.5));
    if (!Number.isFinite(audioVolume)) audioVolume = 0.5;
    const sfxMove = document.getElementById('sfx-move');
    const sfxDeath = document.getElementById('sfx-death');
    const sfxSkill = document.getElementById('sfx-skill');
    const bgmPlayer = document.getElementById('bgm-player');
    const btnMute = document.getElementById('btn-mute');
    const volumeSlider = document.getElementById('volume-slider');

    // Set initial volume for all audio elements
    [sfxMove, sfxDeath, sfxSkill, bgmPlayer].forEach(audio => {
        if (audio) audio.volume = audioVolume;
    });

    // --- Audio Functions ---
    function playSfx(type) {
        if (isMuted) return;
        let audio = null;
        switch (type) {
            case 'move': audio = sfxMove; break;
            case 'death': audio = sfxDeath; break;
            case 'skill': audio = sfxSkill; break;
        }
        if (audio && audio.src) {
            audio.currentTime = 0;
            audio.play().catch(() => { });
        }
    }
    window.playSfx = playSfx;

    function updateMuteButton() {
        if (btnMute) {
            btnMute.textContent = isMuted ? '🔇 静音' : '🔊 声音开';
            btnMute.classList.toggle('active', !isMuted);
        }
    }

    function setVolume(vol) {
        audioVolume = vol;
        [sfxMove, sfxDeath, sfxSkill, bgmPlayer].forEach(audio => {
            if (audio) audio.volume = vol;
        });
    }

    if (volumeSlider) {
        volumeSlider.value = Math.round(audioVolume * 100);
    }
    updateMuteButton();

    function getAiModeHint() {
        if (isAiVsAiMode) return 'ai_vs_ai';
        if (isAiMode) return 'pve';
        return null;
    }

    function getAiRequestConfig(modeHint = null) {
        const hint = modeHint || getAiModeHint();
        const difficultyHint = hint === 'ai_vs_ai' ? 'expert' : 'hard';
        if (!aiConfigStore || typeof aiConfigStore.resolveConfig !== 'function') {
            return {
                engineVersion: 'v2',
                difficulty: difficultyHint,
                timeBudgetMs: hint === 'ai_vs_ai' ? 5000 : 2200,
                nodeBudget: hint === 'ai_vs_ai' ? 120000 : 40000,
                deterministicSeed: 20260220,
                enableNeuralEval: true,
                enableFallback: true
            };
        }
        return aiConfigStore.resolveConfig({ difficulty: difficultyHint }, hint);
    }

    function refreshAiDebugPanel() {
        const config = getAiRequestConfig();
        const telemetry = aiTelemetryStore && typeof aiTelemetryStore.readTelemetry === 'function'
            ? aiTelemetryStore.readTelemetry()
            : null;
        const buildInfo = window.__MOLE_CHESS_BUILD_INFO__ || {};

        if (elAiDebugEngine) {
            const engineVer = telemetry && telemetry.engineVersion ? telemetry.engineVersion : config.engineVersion;
            elAiDebugEngine.textContent = engineVer || '--';
        }
        if (elAiDebugModel) {
            elAiDebugModel.textContent = buildInfo.modelHash || 'none';
        }
        if (elAiDebugBuild) {
            elAiDebugBuild.textContent = buildInfo.buildTimestamp || '--';
        }
        if (elAiDebugNeural) {
            elAiDebugNeural.textContent = buildInfo.neuralStatus || '--';
        }
        if (elAiDebugFallback) {
            elAiDebugFallback.textContent = telemetry ? String(telemetry.fallbackCount || 0) : '0';
        }
        if (elAiDebugThink) {
            const ms = telemetry ? Math.round(Number(telemetry.avgThinkMs || 0)) : 0;
            elAiDebugThink.textContent = `${ms}ms`;
        }
        if (elAiDebugSkillRate) {
            const pct = telemetry ? Math.round(Number(telemetry.skillActionRate || 0) * 100) : 0;
            elAiDebugSkillRate.textContent = `${pct}%`;
        }
        if (elAiDebugDecisions) {
            const decisions = telemetry && Array.isArray(telemetry.last50Decisions)
                ? telemetry.last50Decisions.slice(-12).reverse()
                : [];
            elAiDebugDecisions.innerHTML = decisions.map(item => {
                const scorePart = Number.isFinite(Number(item.score)) ? ` score=${Number(item.score).toFixed(1)}` : '';
                const fallbackPart = item.usedFallback ? ` fb#${item.fallbackLevel || 0}` : '';
                const thinkPart = `${Math.round(Number(item.thinkMs || 0))}ms`;
                const repeatVal = Number(item.repeatStreak || 0);
                const repeatPart = repeatVal > 1 ? ` r#${repeatVal}` : '';
                const teamPart = item.team === 'black' ? '[B] ' : item.team === 'white' ? '[W] ' : '';
                const rawSig = typeof item.actionSig === 'string' ? item.actionSig : '';
                const sigShort = rawSig ? rawSig.slice(0, 26) + (rawSig.length > 26 ? '...' : '') : '';
                const sigPart = sigShort ? ` sig=${sigShort}` : '';
                return `<div class=\"ai-debug-decision\">${teamPart}${item.actionType || 'unknown'} ${thinkPart}${fallbackPart}${repeatPart}${scorePart}${sigPart}</div>`;
            }).join('');
        }
    }

    function appendAiLog(reason, aiLog, gameState, actionType, actionContext = null) {
        if (!elAiLogList) return;
        const actingTurn = actionContext && actionContext.actingTurn
            ? actionContext.actingTurn
            : (gameState && gameState.current_turn ? gameState.current_turn : null);
        const actingRound = actionContext && Number.isFinite(actionContext.actingRound)
            ? actionContext.actingRound
            : null;
        const teamLabel = actingTurn
            ? (actingTurn === 'black' ? '黑方' : actingTurn === 'white' ? '白方' : actingTurn)
            : '--';
        const roundNum = actingRound !== null
            ? actingRound
            : (gameState
                ? (gameState.round_count ?? Math.max(1, Math.ceil((gameState.turn_count || 0) / 2)))
                : null);
        const turnLabel = roundNum !== null
            ? `第${roundNum}回合 ${teamLabel}`
            : null;
        const headerTurn = turnLabel || 'AI';
        const actionLabelMap = { move: '移动', skill: '技能', action: '动作' };
        const actionLabel = actionType ? (actionLabelMap[actionType] || actionType) : '动作';
        const header = `[${headerTurn}] ${actionLabel}`;
        const lines = [];
        if (reason) lines.push(reason);
        if (Array.isArray(aiLog)) lines.push(...aiLog);
        const content = lines.length ? `${header} :: ${lines.join(' | ')}` : header;
        const entry = document.createElement('div');
        entry.className = 'ai-log-entry';
        entry.textContent = content;
        elAiLogList.prepend(entry);
        refreshAiDebugPanel();
    }

    function clearAiLog() {
        if (elAiLogList) elAiLogList.innerHTML = '';
    }

    if (btnAiLogCopy) {
        btnAiLogCopy.addEventListener('click', () => {
            if (!elAiLogList) return;
            const lines = Array.from(elAiLogList.querySelectorAll('.ai-log-entry'))
                .map(el => el.textContent)
                .filter(Boolean)
                .reverse()
                .join('\n');
            if (!lines) return;
            navigator.clipboard.writeText(lines).then(() => {
                showStatusMessage('AI 日志已复制');
            }).catch(() => {
                showStatusMessage('复制失败');
            });
        });
    }

    window.appendAiLog = appendAiLog;
    window.clearAiLog = clearAiLog;
    window.refreshAiDebugPanel = refreshAiDebugPanel;
    window.getAiRequestConfig = getAiRequestConfig;

    // Mute button event
    if (btnMute) {
        btnMute.addEventListener('click', () => {
            isMuted = !isMuted;
            updateMuteButton();
            if (isMuted) {
                [sfxMove, sfxDeath, sfxSkill, bgmPlayer].forEach(audio => {
                    if (audio) audio.pause();
                });
            }
        });
    }

    // Volume slider event
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            setVolume(e.target.value / 100);
        });
    }

    // --- Init ---
    function initBoard() {
        gameBoard.innerHTML = '';

        // Populate Top Coordinates (A-L)
        const topCoords = document.querySelector('.board-coordinates-top');
        if (topCoords) {
            topCoords.innerHTML = '';
            const labelsH = 'ABCDEFGHIJKL';
            for (let i = 0; i < 12; i++) {
                const el = document.createElement('div');
                el.className = 'board-coordinate-h';
                el.textContent = labelsH[i];
                topCoords.appendChild(el);
            }
        }

        // Populate Left Coordinates (1-12)
        const leftCoords = document.querySelector('.board-coordinates-left');
        if (leftCoords) {
            leftCoords.innerHTML = '';
            for (let i = 0; i < 12; i++) {
                const el = document.createElement('div');
                el.className = 'board-coordinate-v';
                el.textContent = i + 1;
                leftCoords.appendChild(el);
            }
        }

        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 12; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.r = r;
                cell.dataset.c = c;
                cell.addEventListener('click', onCellClick);
                cell.addEventListener('mouseenter', onCellHover);
                gameBoard.appendChild(cell);
            }
        }
    }

    // --- Audio ---
    function setupAudioUpload(inputId, audioId) {
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        inputEl.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const audioEl = document.getElementById(audioId);
            if (!audioEl) return;
            if (audioEl.dataset.objectUrl) {
                URL.revokeObjectURL(audioEl.dataset.objectUrl);
            }
            const objectUrl = URL.createObjectURL(file);
            audioEl.dataset.objectUrl = objectUrl;
            audioEl.src = objectUrl;
            audioEl.load();
            if (audioId === 'bgm-player') {
                audioEl.play().catch(() => { });
            }
        });
    }

    function collectTurnStatusMetrics(gameState) {
        const metrics = {
            monkSavedCount: 0,
            monkSaveMaxTurns: 0,
            monkSaveInfinite: false,
            monkCooldownMaxTurns: 0,
            policeDetainedCount: 0,
            policeDetainMaxTurns: 0,
            policeCooldownMaxTurns: 0
        };
        if (!gameState || !Array.isArray(gameState.board)) return metrics;

        for (let r = 0; r < gameState.board.length; r += 1) {
            const row = gameState.board[r] || [];
            for (let c = 0; c < row.length; c += 1) {
                const cell = row[c] || [];
                for (const piece of cell) {
                    if (!piece || piece.state !== 'alive') continue;
                    if (piece.name === '僧侣') {
                        const cd = Number((piece.skill_cooldowns || {}).save || 0);
                        if (cd > metrics.monkCooldownMaxTurns) metrics.monkCooldownMaxTurns = cd;
                    }
                    if (piece.name === '警察') {
                        const cd = Number((piece.skill_cooldowns || {}).arrest || 0);
                        if (cd > metrics.policeCooldownMaxTurns) metrics.policeCooldownMaxTurns = cd;
                    }
                    if (piece.is_saved || piece.state === 'monk_forever') {
                        metrics.monkSavedCount += 1;
                        if (piece.state === 'monk_forever') {
                            metrics.monkSaveInfinite = true;
                        } else {
                            const turns = Number(piece.save_duration || 0);
                            if (turns > metrics.monkSaveMaxTurns) metrics.monkSaveMaxTurns = turns;
                        }
                    }
                }
            }
        }

        if (Array.isArray(gameState.detained_pieces)) {
            metrics.policeDetainedCount = gameState.detained_pieces.length;
            for (const detained of gameState.detained_pieces) {
                const turns = Number(detained && detained.duration || 0);
                if (turns > metrics.policeDetainMaxTurns) metrics.policeDetainMaxTurns = turns;
            }
        }
        return metrics;
    }

    function updateTurnSpotlight(gameState) {
        if (!elCurrentTurn) return;
        const label = gameState && gameState.current_turn === 'black'
            ? '黑方'
            : gameState && gameState.current_turn === 'white'
                ? '白方'
                : '--';
        elCurrentTurn.textContent = label === '--' ? '--' : `▶ ${label}`;
        elCurrentTurn.classList.remove('turn-black', 'turn-white', 'turn-ai-thinking');
        if (gameState && gameState.current_turn === 'black') {
            elCurrentTurn.classList.add('turn-black');
        } else if (gameState && gameState.current_turn === 'white') {
            elCurrentTurn.classList.add('turn-white');
        }
    }

    function updateClockDisplays(nowTs = Date.now()) {
        if (!elStatusGameElapsed || !elStatusTurnRemaining) return;
        const elapsedMs = Number(clockRuntime.elapsedMs || 0);
        elStatusGameElapsed.textContent = formatClockDuration(elapsedMs);
        elStatusGameElapsed.classList.toggle('alarm-triggered', !!clockRuntime.alarmTriggered);

        if (!state || state.phase !== 'PLAYING') {
            elStatusTurnRemaining.textContent = '未开始';
            return;
        }
        if (!clockConfig || !clockConfig.enabled || state.game_over) {
            elStatusTurnRemaining.textContent = '未启用';
            return;
        }
        const remaining = getCurrentTurnRemainingMs(nowTs);
        clockRuntime.remainingMs = Number.isFinite(remaining) ? remaining : 0;
        elStatusTurnRemaining.textContent = formatClockDuration(clockRuntime.remainingMs);
    }

    function updateStatusPanelExtras(gameState) {
        const metrics = collectTurnStatusMetrics(gameState);
        if (elMonkSaveRemaining) {
            if (metrics.monkSaveInfinite) {
                elMonkSaveRemaining.textContent = `∞(${metrics.monkSavedCount}个)`;
            } else if (metrics.monkSavedCount > 0) {
                elMonkSaveRemaining.textContent = formatTurnsLeft(metrics.monkSaveMaxTurns, metrics.monkSavedCount);
            } else {
                elMonkSaveRemaining.textContent = '0回合';
            }
        }
        if (elMonkCd) {
            elMonkCd.textContent = formatTurnsLeft(metrics.monkCooldownMaxTurns);
        }
        if (elPoliceDetainRemaining) {
            if (metrics.policeDetainedCount > 0) {
                elPoliceDetainRemaining.textContent = formatTurnsLeft(metrics.policeDetainMaxTurns, metrics.policeDetainedCount);
            } else {
                elPoliceDetainRemaining.textContent = '0回合';
            }
        }
        if (elPoliceCd) {
            elPoliceCd.textContent = formatTurnsLeft(metrics.policeCooldownMaxTurns);
        }
        updateTurnSpotlight(gameState);
        updateClockDisplays();
    }

    function syncClockState(prevState, nextState) {
        const prevPhase = prevState && prevState.phase;
        const nextPhase = nextState && nextState.phase;
        if (!nextState || nextPhase !== 'PLAYING') {
            resetClockRuntime();
            updateClockDisplays();
            return;
        }

        const hasTurnStartLog = Array.isArray(nextState.log_history)
            && nextState.log_history.some(msg => /^=== 第\d+回合开始/.test(String(msg || '')));
        if (!hasTurnStartLog) {
            clockRuntime.activeTurnKey = '';
            clockRuntime.turnStartTs = null;
            clockRuntime.remainingMs = 0;
            updateClockDisplays();
            return;
        }

        const nowTs = Date.now();
        if (prevPhase !== 'PLAYING' || !Number.isFinite(clockRuntime.gameStartTs)) {
            clockRuntime.gameStartTs = nowTs;
            clockRuntime.alarmTriggered = false;
            clockRuntime.pendingAiTimeoutTurnKey = '';
            clockRuntime.timeoutTriggeredTurnKey = '';
        }

        const turnKey = buildTurnKey(nextState);
        if (clockRuntime.activeTurnKey !== turnKey) {
            clockRuntime.activeTurnKey = turnKey;
            clockRuntime.turnStartTs = nowTs;
            clockRuntime.timeoutTriggeredTurnKey = '';
            clockRuntime.pendingAiTimeoutTurnKey = '';
        }

        if (Number.isFinite(clockRuntime.gameStartTs)) {
            clockRuntime.elapsedMs = Math.max(0, nowTs - clockRuntime.gameStartTs);
        }

        if (nextState.game_over) {
            clockRuntime.activeTurnKey = '';
            clockRuntime.turnStartTs = null;
            clockRuntime.pendingAiTimeoutTurnKey = '';
            clockRuntime.timeoutTriggeredTurnKey = '';
        }

        updateClockDisplays(nowTs);
    }

    function bindClockControls() {
        if (elClockEnabledToggle) {
            elClockEnabledToggle.addEventListener('change', (e) => {
                setClockConfig({ enabled: !!e.target.checked }, { announce: true });
                if (!e.target.checked) {
                    clockRuntime.alarmTriggered = false;
                }
                if (state && state.phase === 'PLAYING' && !state.game_over) {
                    clockRuntime.turnStartTs = Date.now();
                    clockRuntime.timeoutTriggeredTurnKey = '';
                    clockRuntime.pendingAiTimeoutTurnKey = '';
                }
                updateClockDisplays();
            });
        }
        if (elClockTurnLimitSelect) {
            elClockTurnLimitSelect.addEventListener('change', (e) => {
                const sec = normalizeClockNumber(e.target.value, clockConfig.turnLimitSec, { min: 1, max: 1200 });
                setClockConfig({ turnLimitSec: sec }, { announce: false });
                clockRuntime.turnStartTs = Date.now();
                clockRuntime.timeoutTriggeredTurnKey = '';
                clockRuntime.pendingAiTimeoutTurnKey = '';
                updateClockDisplays();
            });
        }
        if (elClockAlarmThresholdSelect) {
            elClockAlarmThresholdSelect.addEventListener('change', (e) => {
                const threshold = normalizeClockNumber(e.target.value, clockConfig.alarmThresholdMin, { min: 0.01, max: 600, allowFloat: true });
                setClockConfig({ alarmThresholdMin: threshold }, { announce: false });
                clockRuntime.alarmTriggered = false;
                updateClockDisplays();
            });
        }
    }

    async function handleTurnTimeout(turnKeyAtTrigger) {
        if (!state || state.phase !== 'PLAYING' || state.game_over) return;
        if (clockRuntime.turnEndInFlight) return;
        if (!turnKeyAtTrigger || turnKeyAtTrigger !== buildTurnKey(state)) return;
        if (aiProcessing) {
            clockRuntime.pendingAiTimeoutTurnKey = turnKeyAtTrigger;
            showStatusMessage('已到本回合时限：等待 AI 响应后自动换手');
            return;
        }
        showStatusMessage('已到本回合时限，自动结束回合');
        await endTurnAndRefresh({ cause: 'timeout' });
    }

    function tickGameClock() {
        if (!state) return;
        const nowTs = Date.now();
        if (state.phase === 'PLAYING' && Number.isFinite(clockRuntime.gameStartTs)) {
            clockRuntime.elapsedMs = Math.max(0, nowTs - clockRuntime.gameStartTs);
        }
        updateClockDisplays(nowTs);

        if (!clockConfig || !clockConfig.enabled || !state || state.phase !== 'PLAYING' || state.game_over) return;

        const thresholdMs = Math.max(0.01, Number(clockConfig.alarmThresholdMin || CLOCK_DEFAULT_CONFIG.alarmThresholdMin)) * 60 * 1000;
        if (!clockRuntime.alarmTriggered && clockRuntime.elapsedMs >= thresholdMs) {
            clockRuntime.alarmTriggered = true;
            showStatusMessage(`对局已用时达到 ${clockConfig.alarmThresholdMin} 分钟`);
            playSfx('death');
        }

        const turnKey = buildTurnKey(state);
        if (!turnKey || clockRuntime.turnEndInFlight) return;
        const remaining = getCurrentTurnRemainingMs(nowTs);
        if (!Number.isFinite(remaining)) return;
        if (remaining <= 0 && clockRuntime.timeoutTriggeredTurnKey !== turnKey) {
            clockRuntime.timeoutTriggeredTurnKey = turnKey;
            handleTurnTimeout(turnKey);
        }
    }

    function scheduleExpoSyncRefresh(_source = '') {
        if (!expoModeEnabled) return;
        if (expoSyncTimer) return;
        expoSyncTimer = setTimeout(() => {
            expoSyncTimer = null;
            if (pausePolling) {
                scheduleExpoSyncRefresh('paused_retry');
                return;
            }
            fetchState(true);
        }, 90);
    }

    function rememberExpoCueId(cueId) {
        const id = String(cueId || '');
        if (!id) return false;
        if (expoSeenCueIds.has(id)) return false;
        expoSeenCueIds.add(id);
        expoSeenCueOrder.push(id);
        if (expoSeenCueOrder.length > 220) {
            const old = expoSeenCueOrder.shift();
            if (old) expoSeenCueIds.delete(old);
        }
        return true;
    }

    function getDirectionDisplay(dice) {
        const value = Number(dice);
        const dirNames = { 0: '⏪ 弹回初始位置', 1: '↖ 左上', 2: '↑ 正上', 3: '↗ 右上', 4: '← 正左', 5: '→ 正右', 6: '↙ 左下', 7: '↓ 正下', 8: '↘ 右下', 9: '🔄 再摇' };
        const dirArrows = { 0: '⟲', 1: '↖', 2: '↑', 3: '↗', 4: '←', 5: '→', 6: '↙', 7: '↓', 8: '↘', 9: '🔄' };
        return {
            arrow: dirArrows[value] || '?',
            name: dirNames[value] || '未知'
        };
    }

    function normalizeNightmareRolls(rawRolls) {
        if (!Array.isArray(rawRolls)) return [];
        return rawRolls
            .map((item) => {
                if (!item || typeof item !== 'object') return null;
                const dice = Number(item.dice);
                if (!Number.isFinite(dice) || dice < 0 || dice > 99) return null;
                return {
                    source: String(item.source || 'auto'),
                    dice,
                    tens: Number.isFinite(Number(item.tens)) ? Number(item.tens) : Math.floor(dice / 10),
                    ones: Number.isFinite(Number(item.ones)) ? Number(item.ones) : (dice % 10),
                    state: String(item.state || ''),
                    detail: String(item.detail || ''),
                    modeText: String(item.modeText || item.mode_text || ''),
                    firstTransform: !!(item.firstTransform || item.first_transform),
                    triggerGlitch: !!(item.triggerGlitch || item.trigger_glitch)
                };
            })
            .filter(Boolean);
    }

    async function playNightmareRollSequence(rawRolls) {
        const rolls = normalizeNightmareRolls(rawRolls);
        for (const roll of rolls) {
            await showNightmareDayNightDice(roll);
        }
        return rolls.length;
    }

    async function playStartTurnFxSequence(startInfo = {}) {
        if (!startInfo || typeof startInfo !== 'object') return;
        const deathDice = Number(startInfo.death_god_dice);
        if (Number.isFinite(deathDice)) {
            if (startInfo.death_god_moved) playSfx('death');
            await showDeathGodDice(deathDice, startInfo.death_god_message || '');
        }
        const nightmareRollCount = await playNightmareRollSequence(startInfo.nightmare_rolls);
        if (!nightmareRollCount) {
            syncNightmareAtmosphereToState(state);
        }
    }

    async function playRemoteAnimationCue(cue) {
        if (!cue || typeof cue !== 'object') return;
        const cueType = String(cue.cueType || '');
        const previousPause = !!pausePolling;
        pausePolling = true;
        try {
            if (cueType === 'start_turn_fx') {
                await playStartTurnFxSequence({
                    death_god_dice: cue.deathGodDice,
                    death_god_message: cue.deathGodMessage || '',
                    death_god_moved: !!cue.deathGodMoved,
                    nightmare_rolls: cue.nightmareRolls || []
                });
            } else if (cueType === 'death_god_dice') {
                if (cue.deathGodMoved) playSfx('death');
                await showDeathGodDice(cue.deathGodDice, cue.deathGodMessage || '');
            } else if (cueType === 'initiative_roll') {
                await playRemoteInitiativeRollCue(cue);
            } else if (cueType === 'direction_dice') {
                const meta = getDirectionDisplay(cue.directionDice);
                await showDirectionDice(cue.directionDice, meta.arrow, meta.name);
                if (cue.message) showStatusMessage(cue.message);
                if (Array.isArray(cue.nightmareRolls) && cue.nightmareRolls.length) {
                    await playNightmareRollSequence(cue.nightmareRolls);
                }
            } else if (cueType === 'move_fx') {
                if (cue.randomMove) {
                    await showGreenWifeMoveDiceSequence({
                        direction_dice: cue.directionDice,
                        steps_dice: cue.stepsDice,
                        direction_rolls: cue.directionRolls,
                        released_possession: cue.releasedPossession,
                        message: cue.message || ''
                    });
                } else if (cue.message) {
                    showStatusMessage(cue.message);
                }
                if (Array.isArray(cue.nightmareRolls) && cue.nightmareRolls.length) {
                    await playNightmareRollSequence(cue.nightmareRolls);
                }
            } else if (cueType === 'green_wife_move_dice') {
                await showGreenWifeMoveDiceSequence({
                    direction_dice: cue.directionDice,
                    steps_dice: cue.stepsDice,
                    direction_rolls: cue.directionRolls,
                    released_possession: cue.releasedPossession,
                    message: cue.message || ''
                });
                if (Array.isArray(cue.nightmareRolls) && cue.nightmareRolls.length) {
                    await playNightmareRollSequence(cue.nightmareRolls);
                }
            } else if (cueType === 'skill_result_dice') {
                showSkillResult(!!cue.success, cue.dice, cue.message || '');
                await delay(2200);
                hideSkillResult();
                if (diceContainer) diceContainer.classList.add('hidden');
                if (Array.isArray(cue.nightmareRolls) && cue.nightmareRolls.length) {
                    await playNightmareRollSequence(cue.nightmareRolls);
                }
            } else if (cueType === 'nightmare_roll_sequence') {
                await playNightmareRollSequence(cue.nightmareRolls || []);
            }
        } catch (err) {
            console.warn('remote animation cue failed:', err);
        } finally {
            pausePolling = previousPause;
            await fetchState(true);
        }
    }

    async function playRemoteInitiativeRollCue(cue) {
        if (initiativeCueInFlight) return;
        initiativeCueInFlight = true;
        try {
            if (btnStartGame) {
                btnStartGame.disabled = true;
                btnStartGame.textContent = '掷骰中...';
            }
            if (modalStartGame) modalStartGame.classList.remove('hidden');
            if (divInitResult) divInitResult.classList.remove('hidden');
            await animatePc98DiceCycle((value) => {
                if (elInitBlack) elInitBlack.textContent = String(value);
                if (elInitWhite) elInitWhite.textContent = String(Math.floor(Math.random() * 10));
            }, { totalDurationMs: 1700 });
            if (elInitBlack) elInitBlack.textContent = String(cue.blackRoll ?? '-');
            if (elInitWhite) elInitWhite.textContent = String(cue.whiteRoll ?? '-');
            if (elInitMsg) {
                const winnerLabel = cue.winner === 'black' ? '黑方' : cue.winner === 'white' ? '白方' : (cue.winner || '');
                elInitMsg.textContent = winnerLabel ? `${winnerLabel}先手！` : '';
            }
            await delay(1800);
            if (modalStartGame) modalStartGame.classList.add('hidden');
            if (divInitResult) divInitResult.classList.add('hidden');
        } finally {
            initiativeCueInFlight = false;
        }
    }

    function queueRemoteAnimationCue(cue) {
        if (!cue || typeof cue !== 'object') return;
        const cueId = String(cue.cueId || '');
        if (!rememberExpoCueId(cueId)) return;
        expoCueQueue = expoCueQueue
            .then(() => playRemoteAnimationCue(cue))
            .catch(() => { });
    }

    function handleExpoSyncPayload(payload, sourceTag = '') {
        if (!payload || typeof payload !== 'object') {
            scheduleExpoSyncRefresh(`${sourceTag}_fallback`);
            return;
        }
        const writerId = String(payload.writerId || '');
        const cue = payload.animationCue && typeof payload.animationCue === 'object'
            ? payload.animationCue
            : null;
        if (cue && writerId && writerId !== expoWindowId) {
            queueRemoteAnimationCue(cue);
            return;
        }
        scheduleExpoSyncRefresh(sourceTag || 'sync_payload');
    }

    function setupExpoSyncListeners() {
        if (!expoModeEnabled) return;
        if (typeof BroadcastChannel === 'function') {
            try {
                expoSyncChannel = new BroadcastChannel(EXPO_SYNC_CHANNEL_NAME);
                expoSyncChannel.onmessage = (event) => {
                    handleExpoSyncPayload(event && event.data ? event.data : null, 'broadcast_channel');
                };
            } catch (_err) {
                expoSyncChannel = null;
            }
        }
        window.addEventListener('storage', (event) => {
            const key = String(event.key || '');
            if (!key) return;
            if (key === EXPO_SHARED_GAME_KEY || key === EXPO_SHARED_HISTORY_KEY || key === EXPO_SHARED_META_KEY) {
                scheduleExpoSyncRefresh('storage_event');
                return;
            }
            if (key === EXPO_SHARED_CUE_KEY && event.newValue) {
                try {
                    const payload = JSON.parse(event.newValue);
                    handleExpoSyncPayload(payload, 'storage_cue');
                } catch (_err) {
                    scheduleExpoSyncRefresh('storage_cue_parse_fail');
                }
            }
        });
        window.addEventListener('mole:shared-state-updated', (event) => {
            const payload = event && event.detail ? event.detail : null;
            handleExpoSyncPayload(payload, 'shared_event');
        });
    }

    // --- Core Logic ---
    function fetchState(force = false) {
        if (pausePolling && !force) return Promise.resolve(null); // Skip polling during animations unless forced
        return fetch('/api/state')
            .then(res => res.json())
            .then(data => {
                const prevState = state;
                state = data;
                if (state && state.phase === 'PRE_GAME' && Number(state.turn_count || 0) <= 1) {
                    runtimeSystemLogBuffer = [];
                }
                bridgeLogAndStateEvents(prevState, data);
                syncClockState(prevState, data);
                syncReplayRecording(prevState, data);
                isSandboxMode = !!data.sandbox_mode;
                if (sandboxModeToggle) {
                    sandboxModeToggle.checked = isSandboxMode;
                }
                if (skillResultDisplay && !skillResultDisplay.classList.contains('hidden') && diceContainer && diceContainer.classList.contains('hidden')) {
                    hideSkillResult();
                }

                render();
                syncNightmareAtmosphereToState(data);
                refreshAiDebugPanel();

                // ★★★ 新增这行：每次刷新状态时，检查是否该 AI 下棋 ★★★
                checkAiTurn(data);

                // 检查是否有市民可升变
                checkCitizenUpgrade(data);

                // Handle Phase Logic
                if (state.phase === 'PRE_GAME') {
                    btnStartGame.classList.remove('hidden');
                    return;
                } else {
                    btnStartGame.classList.add('hidden');
                    // Once game has entered PLAYING, force-close pre-game initiative modal remnants.
                    if (modalStartGame) modalStartGame.classList.add('hidden');
                    if (divInitResult) divInitResult.classList.add('hidden');
                    if (btnStartGame) {
                        btnStartGame.disabled = false;
                        btnStartGame.textContent = "开始游戏";
                    }
                }

                // Game Over check
                if (state.game_over) {
                    showGameOver();
                }
                return data;
            })
            .catch(err => {
                console.error('fetchState error:', err);
                if (elCurrentTurn) {
                    elCurrentTurn.textContent = '连接失败';
                    elCurrentTurn.classList.remove('turn-black', 'turn-white', 'turn-ai-thinking');
                }
                if (elGameLog) {
                    const msg = err && err.message ? err.message : String(err);
                    elGameLog.innerHTML = `<div class="log-entry">连接失败：${msg}</div>`;
                }
                return null;
            });
    }

    function setPollingPaused(paused) {
        pausePolling = !!paused;
    }
    window.setPollingPaused = setPollingPaused;

    function appendRuntimeSystemLog(message) {
        const text = String(message || '').trim();
        if (!text) return;
        const stateLogs = Array.isArray(state && state.log_history) ? state.log_history : [];
        if (stateLogs.length && String(stateLogs[stateLogs.length - 1] || '') === text) return;
        if (runtimeSystemLogBuffer.length && runtimeSystemLogBuffer[runtimeSystemLogBuffer.length - 1] === text) return;
        runtimeSystemLogBuffer.push(text);
        if (runtimeSystemLogBuffer.length > 100) {
            runtimeSystemLogBuffer = runtimeSystemLogBuffer.slice(runtimeSystemLogBuffer.length - 100);
        }
    }
    window.appendRuntimeSystemLog = appendRuntimeSystemLog;

    function showGameOver() {
        // 显示游戏结束弹窗
        const modal = document.getElementById('modal-game-over');
        const winnerText = document.getElementById('game-over-winner');
        const reasonText = document.getElementById('game-over-reason');

        if (modal && winnerText && reasonText) {
            const winnerName = state.winner === 'draw'
                ? '平局'
                : (state.winner === 'black' ? '黑方' : '白方');
            winnerText.textContent = `🏆 ${winnerName} 获胜！`;
            reasonText.textContent = state.win_reason || '对方已被击败';
            if (state.winner === 'draw') {
                winnerText.textContent = '🤝 本局平局';
            }
            if (btnSaveReplay) {
                btnSaveReplay.disabled = false;
                btnSaveReplay.textContent = '💾 保存录像';
            }
            ensureReplayStatusText(
                replayRecorder.frames.length
                    ? `可保存本局录像（帧 ${replayRecorder.frames.length}，轨迹步 ${replayRecorder.tracks.length}）`
                    : '本局暂无可导出的轨迹帧',
                replayRecorder.frames.length === 0
            );
            modal.classList.remove('hidden');
            // Effects Engine: Game Over
            if (state.winner === 'draw') triggerFx('game_over_draw', { result: 'draw', cause: 'game_over' });
            else triggerFx('game_over_win', { result: 'win', cause: 'game_over' });
        }

        console.log("Game Over:", state.winner, state.win_reason);
    }

    function render() {
        const roundCount = state.round_count ?? Math.max(1, Math.ceil((state.turn_count || 0) / 2));
        elTurnCount.textContent = roundCount;
        updateStatusPanelExtras(state);

        // Update Log
        const baseLogs = Array.isArray(state.log_history) ? state.log_history : [];
        const mergedLogs = runtimeSystemLogBuffer.length ? baseLogs.concat(runtimeSystemLogBuffer) : baseLogs;
        const html = mergedLogs.map(msg => `<div class="log-entry">${msg}</div>`).join('');
        if (elGameLog.innerHTML !== html) {
            const wasAtBottom = elGameLog.scrollHeight - elGameLog.scrollTop === elGameLog.clientHeight;
            elGameLog.innerHTML = html;
            if (wasAtBottom) elGameLog.scrollTop = elGameLog.scrollHeight;
        }

        // Render Board
        const cells = document.querySelectorAll('.cell');
        // If PRE_GAME, board might be empty or existing. 
        if (state.phase === 'PRE_GAME' && (!state.board || state.board.length === 0)) {
            // Keep empty
            updateClockDisplays();
            return;
        }

        cells.forEach(cell => {
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            // Default safe check
            const rowData = state.board[r];
            const pieceStack = rowData ? rowData[c] : [];

            cell.innerHTML = '';
            cell.className = 'cell';

            if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
            }

            // 显示移动路径高亮
            if (['selecting_move_target', 'selecting_capture_target', 'selecting_skill_target', 'selecting_tunnel_start', 'selecting_tunnel_end'].includes(currentAction)
                && validMovePaths.some(p => p[0] === r && p[1] === c)) {
                cell.classList.add('highlight-move');
            }

            // 显示 AI 最后落子的起始格与目标格高亮
            if (aiMoveHighlight.from && aiMoveHighlight.from[0] === r && aiMoveHighlight.from[1] === c) {
                cell.classList.add('highlight-move');
            }
            if (aiMoveHighlight.to && aiMoveHighlight.to[0] === r && aiMoveHighlight.to[1] === c) {
                cell.classList.add('highlight-move');
            }

            if (pieceStack && pieceStack.length > 0) {
                const topPiece = getDisplayPiece(pieceStack);
                const elPiece = document.createElement('div');
                elPiece.classList.add('piece');
                elPiece.classList.add(`team-${topPiece.team}`);
                const pieceNameClass = getPieceNameClass(topPiece.name);
                if (pieceNameClass) {
                    elPiece.classList.add(`piece-name-${pieceNameClass}`);
                }

                // Apply special visual effects
                const isRedChildVisual = !!(topPiece.is_red_child || topPiece.name === '红叶儿');
                const isNightmareVisual = !!(topPiece.is_nightmare || topPiece.name === '夜魔');
                const isGreenWifeVisual = !!(topPiece.is_green_wife || topPiece.name === '绿叶妻');
                if (isRedChildVisual) elPiece.classList.add('red-child');
                if (isNightmareVisual) elPiece.classList.add('nightmare');
                if (isGreenWifeVisual) elPiece.classList.add('green-wife');
                if (topPiece.is_frozen) elPiece.classList.add('frozen');
                if (topPiece.state === 'grave') elPiece.classList.add('grave');
                if (topPiece.state === 'ghost') elPiece.classList.add('ghost');
                if (topPiece.is_saved || topPiece.state === 'monk_forever') elPiece.classList.add('saved-piece');
                if (topPiece.is_arrested) elPiece.classList.add('arrested-piece');
                if (pieceNameClass) elPiece.dataset.pieceType = pieceNameClass;
                elPiece.dataset.pieceTeam = topPiece.team || '';
                if (topPiece.id) elPiece.dataset.pieceId = topPiece.id;

                elPiece.textContent = topPiece.symbol;

                cell.appendChild(elPiece);

                if (pieceStack.length > 1) {
                    cell.classList.add('has-stack');
                    const badge = document.createElement('div');
                    badge.className = 'stack-indicator';
                    badge.textContent = pieceStack.length;
                    cell.appendChild(badge);
                }

                // --- Effects Engine: Hover events ---
                elPiece.addEventListener('mouseenter', () => {
                    const hoverCtx = {
                        element: elPiece,
                        actor: buildPieceMeta(topPiece, { r, c }),
                        result: 'hover'
                    };
                    if (topPiece.state === 'grave') triggerFx('hover_piece_grave', hoverCtx);
                    else if (topPiece.state === 'ghost') triggerFx('hover_piece_ghost', hoverCtx);
                    else if (topPiece.team === 'black') triggerFx('hover_piece_black', hoverCtx);
                    else if (topPiece.team === 'white') triggerFx('hover_piece_white', hoverCtx);
                    else triggerFx('hover_piece_neutral', hoverCtx);
                });
                if (topPiece.is_saved || topPiece.state === 'monk_forever') {
                    const saveBadge = document.createElement('div');
                    saveBadge.className = 'stack-indicator';
                    saveBadge.style.top = '2px';
                    saveBadge.style.left = '2px';
                    saveBadge.style.right = 'auto';
                    saveBadge.textContent = topPiece.state === 'monk_forever' ? '⛩∞' : `⛩${topPiece.save_duration || 0}`;
                    cell.appendChild(saveBadge);
                }
            }
        });

        // Ghost Pool
        ghostContainer.innerHTML = '';
        if (state.ghost_pool) {
            state.ghost_pool.forEach(p => {
                const el = document.createElement('div');
                const ghostClass = p.state === 'ghost' ? 'ghost' : '';
                const graveClass = p.state === 'grave' ? 'grave' : '';
                el.className = `piece team-${p.team} ${ghostClass} ${graveClass}`.trim();
                el.style.width = '30px';
                el.style.height = '30px';
                el.style.fontSize = '12px';
                el.textContent = p.symbol;
                el.style.cursor = 'pointer';
                el.onclick = () => showPieceInfo(p);
                ghostContainer.appendChild(el);
            });
        }

        // Detention Panel
        if (detentionContainer) {
            if (state.detained_pieces && state.detained_pieces.length > 0) {
                detentionContainer.innerHTML = '';
                state.detained_pieces.forEach(d => {
                    const el = document.createElement('div');
                    el.className = 'detained-piece';
                    el.innerHTML = `
                        <span class="piece-symbol">${d.symbol}</span>
                        <span class="countdown">${d.duration}</span>
                    `;
                    el.title = `${d.name} - 剩余${d.duration}回合\n释放后回到 ${formatPos(d.original_pos[0], d.original_pos[1])}`;
                    detentionContainer.appendChild(el);
                });
            } else {
                detentionContainer.innerHTML = '<div class="empty-hint" style="color: #666; font-size: 11px; grid-column: 1/-1;">暂无被拘捕的棋子</div>';
            }
        }

        // Hide dice when not in use
        if (currentAction !== 'skill_rolling') {
            diceContainer.classList.add('hidden');
        }
    }

    // --- Context Menu ---
    function isSandboxSelectablePiece(piece) {
        return !!(piece && piece.state === 'alive' && !piece.is_possessed_by_green_wife);
    }

    function canUseRuleBoundActions(piece) {
        if (!piece || piece.state !== 'alive') return false;
        if (piece.is_possessed_by_green_wife) return false;
        if (piece.name === '死神') return false;
        return piece.team === state.current_turn || piece.team === 'neutral';
    }

    function canOperatePiece(piece) {
        if (!piece || piece.state !== 'alive') return false;
        if (piece.is_possessed_by_green_wife) return false;
        if (isSandboxMode) return true;
        return canUseRuleBoundActions(piece);
    }

    function getPieceFromCellById(pieceStack, pieceId) {
        if (!Array.isArray(pieceStack) || pieceStack.length === 0) return null;
        if (pieceId === null || pieceId === undefined) return pieceStack[pieceStack.length - 1];
        const target = Number(pieceId);
        if (!Number.isFinite(target)) return pieceStack[pieceStack.length - 1];
        for (let i = pieceStack.length - 1; i >= 0; i--) {
            const piece = pieceStack[i];
            if (Number(piece.id) === target) {
                return piece;
            }
        }
        return pieceStack[pieceStack.length - 1];
    }

    function showContextMenu(x, y, piece, cellPos) {
        contextMenuPiece = piece;
        contextMenuPos = cellPos;
        selectedPieceId = piece && piece.id ? piece.id : selectedPieceId;
        const padding = 8;

        // Show first so we can measure size
        contextMenu.classList.remove('hidden');
        triggerFx('context_menu_open', {
            element: contextMenu,
            actor: buildPieceMeta(piece, cellPos),
            target: buildCellMeta(state, cellPos).topPiece,
            cause: 'context_menu'
        });

        const gameArea = document.querySelector('.game-area');
        const boundsWidth = gameArea ? gameArea.clientWidth : window.innerWidth;
        const boundsHeight = gameArea ? gameArea.clientHeight : window.innerHeight;
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;

        const maxLeft = Math.max(padding, boundsWidth - menuWidth - padding);
        const maxTop = Math.max(padding, boundsHeight - menuHeight - padding);
        const left = Math.min(Math.max(x, padding), maxLeft);
        const top = Math.min(Math.max(y, padding), maxTop);

        // Position the menu near the click, clamped to screen
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;

        // Update button states based on piece capabilities
        ctxBtnMove.disabled = false;
        ctxBtnCapture.disabled = false;
        ctxBtnStack.disabled = false;
        ctxBtnSkill.disabled = false;
        ctxBtnCapture.title = '';
        ctxBtnStack.title = '';
        ctxBtnSkill.title = '';
        ctxBtnMove.title = '';
        ctxBtnSkill.classList.remove('skill-disabled-cd');

        // Remove any old police warning
        const oldWarning = contextMenu.querySelector('.police-disabled-msg');
        if (oldWarning) oldWarning.remove();

        const canUseRulesNow = canUseRuleBoundActions(piece);
        if (isSandboxMode && !canUseRulesNow) {
            ctxBtnCapture.disabled = true;
            ctxBtnSkill.disabled = true;
            ctxBtnCapture.title = '沙盒模式仅放开摆位；吃子仍遵循当前回合与阵营规则';
            ctxBtnSkill.title = '沙盒模式仅放开摆位；技能仍遵循当前回合与阵营规则';
        }

        // Disable skill for pieces without active skills
        if (piece.name === "市民") {
            ctxBtnSkill.disabled = true;
            ctxBtnSkill.title = "市民没有主动技能";
        } else if (piece.name === "绿叶妻" || piece.is_green_wife) {
            ctxBtnSkill.disabled = true;
            ctxBtnSkill.title = "绿叶妻无主动技能";
        } else if (piece.name === "叶某") {
            ctxBtnSkill.disabled = true;
            ctxBtnSkill.title = "叶某变身为被动自动触发";
        } else if (piece.name === "死神") {
            ctxBtnSkill.disabled = true;
            ctxBtnCapture.disabled = true;
            ctxBtnCapture.title = '死神不使用常规吃子菜单';
            if (!isSandboxMode) {
                ctxBtnMove.disabled = true;
            }
        } else if (piece.name === "老师") {
            ctxBtnSkill.disabled = true;
            ctxBtnSkill.title = "老师为被动技能，无需主动释放";
        }
        if (piece.is_arrested) {
            if (!isSandboxMode) {
                ctxBtnMove.disabled = true;
                ctxBtnCapture.disabled = true;
                ctxBtnSkill.disabled = true;
                ctxBtnMove.title = "被拘留棋子无法行动";
                ctxBtnCapture.title = "被拘留棋子无法行动";
                ctxBtnSkill.title = "被拘留棋子无法行动";
            } else {
                ctxBtnSkill.disabled = true;
                ctxBtnSkill.title = "被拘留棋子无法使用技能";
            }
        }
        if (piece.is_saved || piece.state === 'monk_forever') {
            if (!isSandboxMode) {
                ctxBtnMove.disabled = true;
                ctxBtnCapture.disabled = true;
            } else {
                // 沙盒模式允许摆位，但不允许规则内吃子/技能。
                ctxBtnCapture.disabled = true;
            }
            ctxBtnSkill.disabled = true;
            if (!ctxBtnMove.title) ctxBtnMove.title = '修行中的棋子无法移动';
            ctxBtnCapture.title = '修行中的棋子无法吃子';
            ctxBtnSkill.title = '修行中的棋子无法使用技能';
        }
        if (piece.can_use_skills === false && !ctxBtnSkill.disabled) {
            ctxBtnSkill.disabled = true;
            ctxBtnSkill.classList.add('skill-disabled-cd');
            const cooldownEntries = Object.entries(piece.skill_cooldowns || {})
                .filter(([, turns]) => turns > 0)
                .map(([name, turns]) => `${name}(${turns})`);
            if (cooldownEntries.length === 1) {
                ctxBtnSkill.title = `一回合技能冷却中（${cooldownEntries[0]}）`;
            } else if (cooldownEntries.length > 1) {
                ctxBtnSkill.title = `技能冷却中：${cooldownEntries.join('、')}`;
            } else {
                ctxBtnSkill.title = "一回合技能冷却中（1 CD）";
            }
        }
        if ((piece.name === '红叶儿' || piece.is_red_child) && !ctxBtnSkill.disabled) {
            ctxBtnSkill.disabled = true;
            ctxBtnSkill.title = '红叶儿当前无可主动释放技能';
        }
        if (piece.name === '孩子' && piece.red_song_suppressed && !ctxBtnSkill.disabled) {
            ctxBtnSkill.disabled = true;
            ctxBtnSkill.title = '魔笛手在阵地内，暂不可学习红歌';
        }
        if (piece.is_possessed_by_green_wife) {
            ctxBtnMove.disabled = true;
            ctxBtnCapture.disabled = true;
            ctxBtnSkill.disabled = true;
            ctxBtnMove.title = '该市民处于绿叶妻附身状态，只能操控绿叶妻';
            ctxBtnCapture.title = '该市民处于绿叶妻附身状态，只能操控绿叶妻';
            ctxBtnSkill.title = '该市民处于绿叶妻附身状态，只能操控绿叶妻';
        }
        if (piece.name === '夜魔' && !piece.permanent_night && !piece.is_night) {
            ctxBtnMove.disabled = true;
            ctxBtnCapture.disabled = true;
            ctxBtnSkill.disabled = true;
            ctxBtnMove.title = '当前为白昼，夜魔不可操作';
            ctxBtnCapture.title = '当前为白昼，夜魔不可操作';
            ctxBtnSkill.title = '热爱黑黑为自动判定；当前白昼不可操作';
        }

        // Feature 5: Police officer-dead check
        if (!isSandboxMode && piece.name === "警察") {
            const officerAlive = checkOfficerAlive(piece.team);
            if (!officerAlive) {
                ctxBtnMove.disabled = true;
                ctxBtnCapture.disabled = true;
                ctxBtnMove.title = "官员已死亡，警察无法移动";
                ctxBtnCapture.title = "官员已死亡，警察无法吃子";
                const warningEl = document.createElement('div');
                warningEl.className = 'police-disabled-msg';
                warningEl.textContent = '⚠ 官员已死亡，警察丧失移动能力';
                contextMenu.appendChild(warningEl);
            }
        }

        const noCapturePieces = ['医生', '绿叶妻', '魔笛手', '鼹鼠', '僧侣', '广场舞大妈'];
        if (noCapturePieces.includes(piece.name)) {
            ctxBtnCapture.disabled = true;
            ctxBtnCapture.title = `${piece.name}不具备常规吃子能力`;
        } else if (!ctxBtnCapture.disabled && cellPos) {
            ctxBtnCapture.disabled = true;
            ctxBtnCapture.title = '正在检查可吃目标...';
            const pid = selectedPieceId;
            const checkPos = { r: cellPos.r, c: cellPos.c };
            fetch('/api/valid_moves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ piece_pos: [checkPos.r, checkPos.c], piece_id: pid })
            })
                .then(res => res.json())
                .then(data => {
                    if (!data.success) {
                        ctxBtnCapture.disabled = true;
                        ctxBtnCapture.title = '无法获取可吃目标';
                        return;
                    }
                    const captureTargets = getCaptureTargetsFromMoves(piece, data.valid_moves || []);
                    if (captureTargets.length > 0) {
                        ctxBtnCapture.disabled = false;
                        ctxBtnCapture.title = '';
                    } else {
                        ctxBtnCapture.disabled = true;
                        ctxBtnCapture.title = '当前无可吃目标';
                    }
                })
                .catch(() => {
                    ctxBtnCapture.disabled = true;
                    ctxBtnCapture.title = '无法获取可吃目标';
                });
        }

        const pieceStack = (state && state.board && cellPos && state.board[cellPos.r])
            ? (state.board[cellPos.r][cellPos.c] || [])
            : [];
        if (!pieceStack || pieceStack.length <= 1) {
            ctxBtnStack.title = '当前格无堆叠层';
        }

        // Show probability panel for child or doctor
        if (piece.name === "孩子" && !piece.is_red_child) {
            showChildProbabilityPanel(piece);
        } else if (piece.name === "医生") {
            showDoctorProbabilityPanel();
        } else {
            hideProbabilityPanel();
        }
    }

    function hideContextMenu() {
        contextMenu.classList.add('hidden');
        contextMenuPiece = null;
        contextMenuPos = null;
    }

    function ensureStackPicker() {
        if (stackPickerEl) return stackPickerEl;
        stackPickerEl = document.createElement('div');
        stackPickerEl.id = 'stack-picker';
        stackPickerEl.className = 'context-menu hidden';
        stackPickerEl.style.maxWidth = '260px';
        stackPickerEl.style.maxHeight = 'min(72vh, 520px)';
        stackPickerEl.style.overflowY = 'auto';
        stackPickerEl.style.overflowX = 'hidden';
        stackPickerEl.style.position = 'fixed';
        stackPickerEl.style.zIndex = '3205';
        document.body.appendChild(stackPickerEl);
        return stackPickerEl;
    }

    function hideStackPicker() {
        if (stackPickerEl) {
            stackPickerEl.classList.add('hidden');
            stackPickerEl.innerHTML = '';
        }
    }

    function showStackPicker(pieceStack, cellPos, clickClientX, clickClientY, options = {}) {
        const mode = options.mode || 'normal';
        const canPickPiece = mode === 'sandbox'
            ? (piece) => isSandboxSelectablePiece(piece)
            : (piece) => canOperatePiece(piece);
        triggerFx('stack_picker_open', {
            cause: 'stack_picker',
            target: buildCellMeta(state, cellPos).topPiece
        });
        const picker = ensureStackPicker();
        const controllablePieces = pieceStack.filter(p => canPickPiece(p));

        picker.innerHTML = '';
        const title = document.createElement('div');
        title.className = 'ctx-btn';
        title.style.cursor = 'default';
        title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
        title.textContent = `堆叠 ${pieceStack.length} 层`;
        picker.appendChild(title);

        const renderOrder = pieceStack.slice().reverse();
        renderOrder.sort((a, b) => (b && b.is_green_wife ? 1 : 0) - (a && a.is_green_wife ? 1 : 0));
        renderOrder.forEach((piece, idx) => {
            const btn = document.createElement('button');
            btn.className = 'ctx-btn';
            const layerNo = renderOrder.length - idx;
            const statusTags = [];
            if (piece.is_saved || piece.state === 'monk_forever') statusTags.push(`存档${piece.save_duration || '∞'}`);
            if (piece.is_arrested) statusTags.push('拘留');
            const statusText = statusTags.length ? `（${statusTags.join('，')}）` : '';
            btn.textContent = `第${layerNo}层 ${piece.symbol} ${piece.team === 'black' ? '黑方' : piece.team === 'white' ? '白方' : '中立'}${piece.name}${statusText}`;
            btn.disabled = !canPickPiece(piece);
            btn.onclick = (ev) => {
                ev.stopPropagation();
                hideStackPicker();
                selectedPieceId = piece.id || null;
                if (typeof options.onChoose === 'function') {
                    options.onChoose(piece, !btn.disabled);
                    return;
                }
                if (!btn.disabled) {
                    const gameArea = document.querySelector('.game-area');
                    const rect = gameArea.getBoundingClientRect();
                    showContextMenu(clickClientX - rect.left, clickClientY - rect.top, piece, cellPos);
                } else {
                    showPieceInfo(piece);
                }
            };
            picker.appendChild(btn);
        });

        if (!controllablePieces.length) {
            const tip = document.createElement('div');
            tip.className = 'ctx-btn';
            tip.style.cursor = 'default';
            tip.style.opacity = '0.8';
            tip.textContent = '当前无可操作棋子';
            picker.appendChild(tip);
        }

        picker.classList.remove('hidden');
        const padding = 8;
        const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
        const viewportHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
        const x = Number.isFinite(Number(clickClientX)) ? Number(clickClientX) : padding;
        const y = Number.isFinite(Number(clickClientY)) ? Number(clickClientY) : padding;
        const menuWidth = picker.offsetWidth;
        const menuHeight = picker.offsetHeight;
        const maxLeft = Math.max(padding, viewportWidth - menuWidth - padding);
        const maxTop = Math.max(padding, viewportHeight - menuHeight - padding);
        picker.style.left = `${Math.min(Math.max(x, padding), maxLeft)}px`;
        picker.style.top = `${Math.min(Math.max(y, padding), maxTop)}px`;
    }

    // Close context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target) && (!stackPickerEl || !stackPickerEl.contains(e.target)) && !e.target.closest('.piece')) {
            // Only hide if clicking outside menu and not on a piece
            if (!contextMenu.classList.contains('hidden')) {
                hideContextMenu();
            }
            hideStackPicker();
        }
    });

    // --- Interaction ---

    // Start Game
    btnStartGame.onclick = () => {
        resetReplayRecorder({ keepSavedCount: true });
        ensureReplayStatusText('本局结束后可保存录像轨迹');
        clearAiLog();
        startReplayVideoCaptureFromGesture().catch((err) => {
            console.warn('startReplayVideoCaptureFromGesture failed:', err);
        });
        btnStartGame.disabled = true;
        btnStartGame.textContent = "掷骰中...";
        modalStartGame.classList.remove('hidden');
        divInitResult.classList.add('hidden');

        fetch('/api/roll_initiative', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Pause polling during the entire start sequence
                    pausePolling = true;
                    divInitResult.classList.remove('hidden');

                    animatePc98DiceCycle((value) => {
                        elInitBlack.textContent = value;
                        elInitWhite.textContent = Math.floor(Math.random() * 10);
                    }, { totalDurationMs: 1700 }).then(() => {
                        elInitBlack.textContent = data.black_roll;
                        elInitWhite.textContent = data.white_roll;
                        const winnerLabel = data.winner === 'black' ? '黑方' : data.winner === 'white' ? '白方' : data.winner;
                        elInitMsg.textContent = `${winnerLabel}先手！`;

                        setTimeout(() => {
                            modalStartGame.classList.add('hidden');
                            divInitResult.classList.add('hidden');
                            // Step 1: Show the board first (death god hasn't moved yet)
                            pausePolling = false;
                            fetchState();
                            pausePolling = true;

                            // Step 2: Call start_first_turn to trigger death god movement
                            setTimeout(() => {
                                fetch('/api/start_first_turn', { method: 'POST' })
                                    .then(res => res.json())
                                    .then(turnData => {
                                        triggerFx('game_start', { cause: 'start_button' });
                                        playStartTurnFxSequence(turnData.start_info || {}).then(() => {
                                            pausePolling = false;
                                            fetchState();
                                        });
                                    })
                                    .catch(err => {
                                        console.error('start_first_turn error:', err);
                                        pausePolling = false;
                                        fetchState();
                                    });
                            }, 500); // Small delay so the board renders first
                        }, 2000);
                    });
                } else {
                    alert("开始游戏失败：" + (data.message || "未知错误"));
                    modalStartGame.classList.add('hidden');
                    divInitResult.classList.add('hidden');
                    pausePolling = false;
                    btnStartGame.disabled = false;
                    btnStartGame.textContent = "开始游戏";
                }
            })
            .catch(err => {
                console.error(err);
                alert("网络错误：" + err);
                modalStartGame.classList.add('hidden');
                divInitResult.classList.add('hidden');
                pausePolling = false;
                btnStartGame.disabled = false;
                btnStartGame.textContent = "开始游戏";
            });
    };

    // Context Menu Buttons
    function getCaptureTargetsFromMoves(piece, moves) {
        if (!Array.isArray(moves) || !piece || !state || !state.board) return [];
        const targets = [];
        for (const pos of moves) {
            const [r, c] = pos;
            const cell = state.board[r] && state.board[r][c];
            if (!Array.isArray(cell) || cell.length === 0) continue;
            const target = getDisplayPiece(cell);
            if (!target) continue;
            if (target.team !== piece.team) {
                targets.push([r, c]);
            }
        }
        return targets;
    }

    function getDoctorResurrectTargets(doctorPos, doctorPiece = null) {
        if (!state || !state.board || !doctorPos) return [];
        const out = [];
        const team = (doctorPiece && doctorPiece.team) || null;
        const minRow = Math.max(0, doctorPos.r - 1);
        const maxRow = Math.min(11, doctorPos.r + 1);
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = 0; c < 12; c++) {
                const cell = state.board[r] && state.board[r][c];
                if (!Array.isArray(cell) || cell.length === 0) continue;
                const top = cell[cell.length - 1];
                if (!top || top.state !== 'grave') continue;
                if (team && top.original_team !== team) continue;
                out.push([r, c]);
            }
        }
        return out;
    }

    function hasAliveOfficerForTeam(team) {
        if (!state || !state.board || !team) return false;
        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 12; c++) {
                const cell = state.board[r] && state.board[r][c];
                if (!Array.isArray(cell) || cell.length === 0) continue;
                for (const p of cell) {
                    if (p && p.name === '官员' && p.team === team && p.state === 'alive') {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function getPoliceArrestTargets(policePos, policePiece = null) {
        if (!state || !state.board || !policePos) return [];
        const team = (policePiece && policePiece.team) || null;
        if (team && !hasAliveOfficerForTeam(team)) return [];
        const targets = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];
        for (const [dx, dy] of directions) {
            let step = 1;
            while (true) {
                const nr = policePos.r + dx * step;
                const nc = policePos.c + dy * step;
                if (nr < 0 || nr > 11 || nc < 0 || nc > 11) break;
                const cell = state.board[nr] && state.board[nr][nc];
                if (!Array.isArray(cell)) break;
                if (cell.length > 0) {
                    const top = getDisplayPiece(cell);
                    if (
                        top
                        && top.state === 'alive'
                        && (!team || top.team !== team)
                        && (top.name === '夜魔' || top.name === '魔笛手')
                    ) {
                        targets.push([nr, nc]);
                    }
                    break;
                }
                step += 1;
            }
        }
        return targets;
    }

    function getSkillCooldownKey(piece, skillId) {
        if (!piece || !skillId) return null;
        const map = {
            孩子: { learn: 'learn' },
            妻子: { possess: 'possess' },
            夜魔: { crush: 'crush' },
            警察: { arrest: 'arrest' },
            医生: { resurrect: 'resurrect' },
            官员: { summon: 'summon', swap: 'swap' },
            律师: { swap: 'swap' },
            僧侣: { save: 'save' },
            广场舞大妈: { vortex: 'vortex' },
            鼹鼠: { tunnel: 'tunnel', tunnel_roll: 'tunnel', destroy: 'destroy' },
            魔笛手: { destiny: 'destiny', destiny_success: 'destiny', destiny_fail: 'destiny' }
        };
        const cfg = map[piece.name] || {};
        return cfg[skillId] || null;
    }

    function fetchValidMovesForSelection(pos, onSuccess) {
        fetch('/api/valid_moves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ piece_pos: [pos.r, pos.c], piece_id: selectedPieceId })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    onSuccess(data.valid_moves || []);
                } else {
                    showStatusMessage(data.message || '无法获取可行动位置');
                }
            })
            .catch(err => {
                showStatusMessage(`获取可行动位置失败：${err.message}`);
            });
    }

    ctxBtnMove.onclick = (e) => {
        e.stopPropagation();
        if (!contextMenuPiece || !contextMenuPos) return;

        const pos = contextMenuPos;
        selectedPieceId = (contextMenuPiece && contextMenuPiece.id) ? contextMenuPiece.id : selectedPieceId;

        if (!isSandboxMode && contextMenuPiece.is_green_wife) {
            hideContextMenu();
            selectedCell = { r: pos.r, c: pos.c };
            currentAction = null;
            validMovePaths = [];
            showStatusMessage('绿叶妻开始随机移动判定');
            doMove(selectedCell, { r: pos.r, c: pos.c }, 'move');
            selectedCell = null;
            return;
        }

        selectedCell = { r: pos.r, c: pos.c };
        currentAction = 'selecting_move_target';
        hideContextMenu();

        if (isSandboxMode) {
            validMovePaths = [];
            render();
            showStatusMessage("沙盒模式：请选择任意目标位置摆位");
        } else {
            fetchValidMovesForSelection(pos, (moves) => {
                validMovePaths = moves;
                render();
            });
            showStatusMessage("选择目标位置进行移动");
        }
    };

    ctxBtnCapture.onclick = (e) => {
        e.stopPropagation();
        if (!contextMenuPiece || !contextMenuPos) return;
        const piece = contextMenuPiece;
        if (!canUseRuleBoundActions(piece)) {
            showStatusMessage('沙盒模式仅放开摆位；吃子仍遵循当前回合与阵营规则');
            hideContextMenu();
            return;
        }
        const pos = contextMenuPos;
        selectedPieceId = (piece && piece.id) ? piece.id : selectedPieceId;
        selectedCell = { r: pos.r, c: pos.c };
        currentAction = 'selecting_capture_target';
        hideContextMenu();

        fetchValidMovesForSelection(pos, (moves) => {
            validMovePaths = getCaptureTargetsFromMoves(piece, moves);
            if (!validMovePaths.length) {
                selectedCell = null;
                currentAction = null;
                showStatusMessage('当前无可吃目标');
                render();
                return;
            }
            render();
            showStatusMessage('请选择吃子目标');
        });
    };

    ctxBtnStack.onclick = (e) => {
        e.stopPropagation();
        if (!contextMenuPos || !state || !state.board) return;
        const cellPos = contextMenuPos;
        const pieceStack = state.board[cellPos.r] && state.board[cellPos.r][cellPos.c];
        hideContextMenu();
        if (!Array.isArray(pieceStack) || pieceStack.length <= 1) {
            showStatusMessage('当前格无堆叠层');
            return;
        }
        const gameArea = document.querySelector('.game-area');
        const rect = gameArea ? gameArea.getBoundingClientRect() : { left: 0, top: 0 };
        const cx = rect.left + parseInt(contextMenu.style.left || '0', 10) + 10;
        const cy = rect.top + parseInt(contextMenu.style.top || '0', 10) + 10;
        showStackPicker(pieceStack, { r: cellPos.r, c: cellPos.c }, cx, cy);
    };

    ctxBtnSkill.onclick = (e) => {
        e.stopPropagation();
        if (!contextMenuPiece || !contextMenuPos) return;

        const piece = contextMenuPiece;
        if (!canUseRuleBoundActions(piece)) {
            showStatusMessage('沙盒模式仅放开摆位；技能仍遵循当前回合与阵营规则');
            hideContextMenu();
            return;
        }
        const pos = contextMenuPos;
        selectedPieceId = (piece && piece.id) ? piece.id : selectedPieceId;
        hideContextMenu();
        pendingSkillType = null;

        // 双技能棋子：显示技能选择弹窗
        if (piece.name === "官员") {
            showSkillChoiceModal(piece, pos, [
                { id: 'summon', name: '热爱牧牧', desc: '召唤幽灵成为市民', needsTarget: true, targetHint: '请点击己方阵地的空位' },
                { id: 'swap', name: '热爱法法', desc: '与律师互换位置（一局一次）', needsTarget: true, targetHint: '请点击己方律师' }
            ]);
            return;
        }

        if (piece.name === "夜魔") {
            showSkillChoiceModal(piece, pos, [
                { id: 'crush', name: '热爱露露', desc: '热爱黑黑已改为自动判定（死神掷骰后触发）。当前仅可主动使用碾压移动。', needsTarget: true, targetHint: '请点击目标位置，沿途市民将被碾压' }
            ]);
            return;
        }

        if (piece.name === "孩子" && !piece.is_red_child) {
            // 翻墙跨墓是被动，不提供主动技能入口
            showSkillChoiceModal(piece, pos, [
                { id: 'learn', name: '热爱红红', desc: '学唱红歌（变身红叶儿）', needsTarget: false }
            ]);
            return;
        }

        // 鼹鼠有两个技能：热爱洞洞 + 热爱坏坏
        if (piece.name === "鼹鼠") {
            showSkillChoiceModal(piece, pos, [
                { id: 'tunnel_roll', name: '热爱洞洞', desc: '先判定（50-99成功，00爆破鼹鼠）；成功后再选目标/起点/终点', needsTarget: false, targetHint: '请选择要传送的棋子' },
                { id: 'destroy', name: '热爱坏坏', desc: '破坏指定墓碑', needsTarget: true, targetHint: '请点击要破坏的墓碑' }
            ]);
            return;
        }

        if (piece.name === "魔笛手") {
            showSkillChoiceModal(piece, pos, [
                { id: 'destiny_success', name: '热爱骰骰·必中', desc: '选择目标，下次技能判定必定成功', needsTarget: true, targetHint: '请选择命定之骰（必中）目标' },
                { id: 'destiny_fail', name: '热爱骰骰·必败', desc: '选择目标，下次技能判定必定失败', needsTarget: true, targetHint: '请选择命定之骰（必败）目标' }
            ]);
            return;
        }

        if (piece.name === "律师") {
            showSkillChoiceModal(piece, pos, [
                { id: 'swap', name: '热爱框框', desc: '与己方官员互换位置（同阵营一局一次）', needsTarget: true, targetHint: '请点击己方官员' }
            ]);
            return;
        }

        // 需要目标的技能：显示指引
        const skillTargetHints = {
            "妻子": "请点击己方市民进行附身（热爱绿绿）",
            "警察": "请点击魔笛手或夜魔进行抓捕（热爱暴暴）",
            "医生": "请点击医生前后两排内的己方墓碑（热爱生生）",
            "律师": "请点击己方官员进行易位（热爱框框）",
            "僧侣": "请点击要修行的棋子（固定3回合，僧侣同一时间仅能存1个）",
            "广场舞大妈": "请点击非中立棋子进行共舞（热爱蹦蹦）",
            "魔笛手": "请点击要施加命定骰的棋子（热爱骰骰）"
        };

        const needsTarget = ["妻子", "警察", "医生", "官员", "律师", "僧侣", "广场舞大妈"].includes(piece.name);

        if (needsTarget) {
            selectedCell = { r: pos.r, c: pos.c };
            currentAction = 'selecting_skill_target';
            if (piece.name === '警察') {
                validMovePaths = getPoliceArrestTargets(pos, piece);
                if (!validMovePaths.length) {
                    selectedCell = null;
                    currentAction = null;
                    showStatusMessage('当前没有位于警察技能范围内的抓捕目标');
                    render();
                    return;
                }
            } else if (piece.name === '医生') {
                validMovePaths = getDoctorResurrectTargets(pos, piece);
                if (!validMovePaths.length) {
                    selectedCell = null;
                    currentAction = null;
                    showStatusMessage('医生前后两排内没有可复活的己方墓碑');
                    render();
                    return;
                }
            } else {
                validMovePaths = [];
            }
            render();

            const hint = skillTargetHints[piece.name] || `选择 ${piece.name} 技能的目标`;
            showStatusMessage(hint);
        } else {
            // Self-cast skills (Child 红叶儿, Ye)
            executeSkill(pos, null);
        }
    };

    // 技能选择弹窗
    function showSkillChoiceModal(piece, pos, skills) {
        let modal = document.getElementById('skill-choice-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'skill-choice-modal';
            modal.className = 'modal skill-choice-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3 id="skill-choice-title">选择技能</h3>
                    <div id="skill-choice-buttons"></div>
                    <button class="close-btn" onclick="document.getElementById('skill-choice-modal').classList.add('hidden')">取消</button>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const title = modal.querySelector('#skill-choice-title');
        const btns = modal.querySelector('#skill-choice-buttons');

        title.textContent = `${piece.name} - 选择技能`;
        btns.innerHTML = '';

        skills.forEach(skill => {
            const btn = document.createElement('button');
            btn.className = 'skill-choice-btn';
            const cooldownKey = getSkillCooldownKey(piece, skill.id);
            const cooldownTurns = cooldownKey ? Number((piece.skill_cooldowns || {})[cooldownKey] || 0) : 0;
            const onCooldown = cooldownTurns > 0;
            if (onCooldown) {
                btn.disabled = true;
                btn.classList.add('skill-disabled-cd');
                btn.title = `一回合技能冷却中（${cooldownTurns} CD）`;
            }
            if (piece.name === '孩子' && skill.id === 'learn' && piece.red_song_suppressed) {
                btn.disabled = true;
                btn.classList.add('skill-disabled-cd');
                btn.title = '魔笛手在阵地内，暂不可学习红歌';
            }
            btn.innerHTML = `<strong>${skill.name}${onCooldown ? `（${cooldownTurns} CD）` : ''}</strong><br><small>${skill.desc}</small>`;
            btn.onclick = () => {
                if (btn.disabled) return;
                modal.classList.add('hidden');
                handleSkillChoice(piece, pos, skill);
            };
            btns.appendChild(btn);
        });
        modal.classList.remove('hidden');
    }

    function handleSkillChoice(piece, pos, skill) {
        if (piece.name === '孩子' && skill.id === 'learn' && piece.red_song_suppressed) {
            showStatusMessage('魔笛手在阵地内，暂不可学习红歌');
            return;
        }
        // Set pendingSkillType for pieces that need it
        if (piece.name === '夜魔' || piece.name === '鼹鼠' || piece.name === '魔笛手') {
            pendingSkillType = skill.id;
        } else {
            pendingSkillType = null;
        }

        if (piece.name === '鼹鼠' && skill.id === 'tunnel_roll') {
            resetTunnelFlow(false);
            selectedCell = { r: pos.r, c: pos.c };
            tunnelMolePos = { r: pos.r, c: pos.c };
            currentAction = null;
            validMovePaths = [];
            render();
            showStatusMessage('热爱洞洞判定中...');
            executeSkill(pos, null);
            return;
        }

        if (skill.needsTarget) {
            selectedCell = { r: pos.r, c: pos.c };
            currentAction = 'selecting_skill_target';
            if (piece.name === '警察') {
                validMovePaths = getPoliceArrestTargets(pos, piece);
            } else if (piece.name === '医生') {
                validMovePaths = getDoctorResurrectTargets(pos, piece);
            } else {
                validMovePaths = [];
            }
            render();
            showStatusMessage(skill.targetHint || `选择 ${skill.name} 的目标`);
        } else {
            // Direct execution (no target needed)
            executeSkill(pos, null);
        }
    }

    ctxBtnInfo.onclick = (e) => {
        e.stopPropagation();
        if (!contextMenuPiece) return;
        showPieceInfo(contextMenuPiece);
        hideContextMenu();
    };

    function showStatusMessage(msg) {
        // Create or update a status message element
        let statusEl = document.getElementById('action-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'action-status';
            statusEl.className = 'action-status';
            document.querySelector('.game-area').appendChild(statusEl);
        }
        statusEl.textContent = msg;
        statusEl.classList.remove('hidden');

        // Auto-hide after some time
        setTimeout(() => {
            statusEl.classList.add('hidden');
        }, 3000);
    }
    window.showStatusMessage = showStatusMessage;

    function readStoryModeSetting() {
        try {
            return localStorage.getItem(STORY_MODE_STORAGE_KEY) === 'true';
        } catch (err) {
            console.warn('读取故事模式状态失败:', err);
            return false;
        }
    }

    function applyStoryModeUi(enabled, announce = false) {
        const isEnabled = !!enabled;
        if (document && document.body) {
            document.body.setAttribute(STORY_MODE_BODY_ATTR, isEnabled ? 'on' : 'off');
        }
        if (storyModeToggle) {
            storyModeToggle.checked = isEnabled;
        }
        if (announce) {
            showStatusMessage(isEnabled ? '故事模式 UI 已开启（仅界面效果）' : '故事模式 UI 已关闭');
        }
    }

    function setStoryModeSetting(enabled, announce = false) {
        const isEnabled = !!enabled;
        try {
            localStorage.setItem(STORY_MODE_STORAGE_KEY, String(isEnabled));
        } catch (err) {
            console.warn('保存故事模式状态失败:', err);
        }
        applyStoryModeUi(isEnabled, announce);
    }

    function toggleSandboxMode(enabled) {
        fetch('/api/sandbox/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: !!enabled })
        })
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    showStatusMessage(data.message || '切换沙盒模式失败');
                    if (sandboxModeToggle) sandboxModeToggle.checked = isSandboxMode;
                    return;
                }
                isSandboxMode = !!data.sandbox_mode;
                if (isSandboxMode && (isAiMode || isAiVsAiMode)) {
                    showStatusMessage('沙盒模式下已暂停 AI 自动行动');
                } else {
                    showStatusMessage(data.message || '沙盒模式状态已更新');
                }
                fetchState();
            })
            .catch(err => {
                console.error('Sandbox toggle error:', err);
                showStatusMessage(`切换沙盒模式失败: ${err.message}`);
                if (sandboxModeToggle) sandboxModeToggle.checked = isSandboxMode;
            });
    }

    function showPieceInfo(pieceOrName) {
        const isObj = pieceOrName && typeof pieceOrName === 'object';
        const name = isObj ? pieceOrName.name : pieceOrName;
        const state = isObj ? pieceOrName.state : null;
        const originalName = isObj ? pieceOrName.original_name : null;
        const originalTeam = isObj ? pieceOrName.original_team : null;

        // For graves/ghosts, show original piece info if available
        const baseName = (state === 'grave' || state === 'ghost') && originalName ? originalName : name;
        const data = PIECE_DATA[baseName] || {
            description: "未知", moves: "-", skills: "-", notes: "-"
        };

        const teamLabel = originalTeam === 'black' ? '黑方' : originalTeam === 'white' ? '白方' : originalTeam === 'neutral' ? '中立' : null;
        const originSuffix = originalName ? `原棋子: ${teamLabel ? `${teamLabel}${originalName}` : originalName}` : null;

        if (state === 'grave' && originalName) {
            infoTitle.textContent = `墓（${originSuffix}）`;
        } else if (state === 'ghost' && originalName) {
            infoTitle.textContent = `幽灵（${originSuffix}）`;
        } else {
            infoTitle.textContent = name;
        }

        infoDesc.textContent = data.description;
        infoMoves.textContent = data.moves;
        infoSkills.textContent = data.skills;

        if (state === 'grave' || state === 'ghost') {
            infoNotes.textContent = `${data.notes} | 状态: ${state === 'grave' ? '墓' : '幽灵'}`;
        } else {
            infoNotes.textContent = data.notes;
        }

        modalPieceInfo.classList.remove('hidden');
    }

    function onCellHover(e) {
        if (!state || !state.board) return;
        const cell = e.target.closest('.cell');
        if (!cell) return;
        const r = parseInt(cell.dataset.r, 10);
        const c = parseInt(cell.dataset.c, 10);
        const pieceStack = state.board[r] && state.board[r][c];

        if (cell.classList.contains('highlight-move')) {
            triggerFx('hover_cell_highlight', {
                element: cell,
                target: buildCellMeta(state, { r, c }).topPiece,
                result: 'hover'
            });
        }
        if (!Array.isArray(pieceStack) || pieceStack.length === 0) {
            triggerFx('hover_cell_empty', {
                element: cell,
                target: { pos: [r, c] },
                result: 'hover'
            });
        }
    }

    function onCellClick(e) {
        if (!state || state.phase !== 'PLAYING' || state.game_over) return;

        // Close context menu if open
        hideContextMenu();
        hideStackPicker();

        const cell = e.target.closest('.cell');
        if (!cell) return;

        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);

        const pieceStack = state.board[r][c];
        const topPiece = getDisplayPiece(pieceStack);

        // === Mode: Selecting Move Target ===
        if (currentAction === 'selecting_move_target' && selectedCell) {
            if (selectedCell.r === r && selectedCell.c === c) {
                // Clicked same cell, cancel
                selectedCell = null;
                currentAction = null;
                pendingSkillType = null;
                validMovePaths = [];
                selectedPieceId = null;
                render();
                return;
            }

            if (!isSandboxMode && !hasCoord(validMovePaths, r, c)) {
                showStatusMessage('该位置不在可移动范围内');
                return;
            }

            // Execute move
            const moveActor = buildPieceMeta(getPieceFromStatePos(state, selectedCell, selectedPieceId), selectedCell);
            const moveTarget = buildCellMeta(state, { r, c }).topPiece || { pos: [r, c] };
            doMove(selectedCell, { r, c }, 'move');
            triggerFx('move_start', {
                element: cell,
                actor: moveActor,
                target: moveTarget,
                cause: 'player_click'
            });
            selectedCell = null;
            currentAction = null;
            validMovePaths = [];
            return;
        }

        // === Mode: Selecting Capture Target ===
        if (currentAction === 'selecting_capture_target' && selectedCell) {
            if (selectedCell.r === r && selectedCell.c === c) {
                selectedCell = null;
                currentAction = null;
                pendingSkillType = null;
                validMovePaths = [];
                selectedPieceId = null;
                render();
                return;
            }
            if (!hasCoord(validMovePaths, r, c)) {
                showStatusMessage('该位置不是可吃目标');
                return;
            }
            const captureActor = buildPieceMeta(getPieceFromStatePos(state, selectedCell, selectedPieceId), selectedCell);
            const captureTarget = buildCellMeta(state, { r, c }).topPiece || { pos: [r, c] };
            doMove(selectedCell, { r, c }, 'capture');
            triggerFx('capture_execute', {
                element: cell,
                actor: captureActor,
                target: captureTarget,
                cause: 'player_click'
            });
            selectedCell = null;
            currentAction = null;
            validMovePaths = [];
            return;
        }

        // === Mode: Selecting Skill Target ===
        if (currentAction === 'selecting_skill_target' && selectedCell) {
            if (selectedCell.r === r && selectedCell.c === c) {
                // Clicked same cell, cancel
                selectedCell = null;
                currentAction = null;
                pendingSkillType = null;
                pendingTunnelTarget = null;
                validMovePaths = [];
                selectedPieceId = null;
                render();
                return;
            }

            const sourceCell = state.board[selectedCell.r] && state.board[selectedCell.r][selectedCell.c];
            const sourcePiece = getPieceFromCellById(sourceCell, selectedPieceId);
            const targetCell = state.board[r] && state.board[r][c];
            const hasDeathGod = Array.isArray(targetCell) && targetCell.some(p => p && p.name === '死神');
            const targetTop = getDisplayPiece(targetCell || []);
            if (hasDeathGod) {
                showStatusMessage('技能不能以死神为目标');
                return;
            }
            if (sourcePiece && sourcePiece.name === '广场舞大妈' && targetTop && targetTop.team === 'neutral') {
                showStatusMessage('广场舞大妈不能对中立棋子使用技能');
                return;
            }
            if (sourcePiece && (sourcePiece.name === '警察' || sourcePiece.name === '医生')) {
                if (!hasCoord(validMovePaths, r, c)) {
                    if (sourcePiece.name === '警察') {
                        showStatusMessage('请选择警察技能范围内的魔笛手或夜魔');
                    } else {
                        showStatusMessage('请选择医生前后两排内的己方墓碑');
                    }
                    return;
                }
            }

            // Execute skill with target
            executeSkill(selectedCell, { r, c });
            selectedCell = null;
            currentAction = null;
            validMovePaths = [];
            return;
        }

        // === Mode: Mole Tunnel Step 1: Select Transport Target ===
        if (currentAction === 'selecting_tunnel_target') {
            if (!tunnelMolePos && selectedCell) {
                tunnelMolePos = { r: selectedCell.r, c: selectedCell.c };
            }
            if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                // Click mole source again to cancel tunnel flow
                selectedCell = null;
                currentAction = null;
                pendingSkillType = null;
                resetTunnelFlow(false);
                validMovePaths = [];
                render();
                showStatusMessage('已取消热爱洞洞');
                return;
            }
            if (!topPiece || topPiece.state !== 'alive') {
                showStatusMessage('请选择要传送的存活棋子');
                return;
            }
            if (topPiece.name === '死神') {
                showStatusMessage('技能不能以死神为目标');
                return;
            }
            if (topPiece.name === '鼹鼠') {
                showStatusMessage('不能传送鼹鼠自身');
                return;
            }
            tunnelTargetPos = { r, c };
            pendingTunnelTarget = { r, c };
            currentAction = 'selecting_tunnel_start';
            validMovePaths = getAdjacent8EmptyCells(tunnelTargetPos);
            render();
            showStatusMessage('请选择该棋子邻近空位作为地道起点');
            return;
        }

        // === Mode: Mole Tunnel Step 2: Select Start (adjacent 8-empty cell) ===
        if (currentAction === 'selecting_tunnel_start') {
            if (tunnelTargetPos && tunnelTargetPos.r === r && tunnelTargetPos.c === c) {
                // Cancel current step: return to target selection
                tunnelTargetPos = null;
                tunnelStartPos = null;
                pendingTunnelTarget = null;
                currentAction = 'selecting_tunnel_target';
                validMovePaths = [];
                render();
                showStatusMessage('已取消当前起点选择，请重新选择要传送的棋子');
                return;
            }
            if (!hasCoord(validMovePaths, r, c)) {
                showStatusMessage('地道起点必须是目标棋子周边8邻域空位');
                return;
            }
            tunnelStartPos = { r, c };
            currentAction = 'selecting_tunnel_end';
            validMovePaths = getLineEmptyCells(tunnelStartPos);
            render();
            showStatusMessage('请选择与起点呈横/竖/斜直线的空位作为地道终点');
            return;
        }

        // === Mode: Mole Tunnel Step 3: Select End (cross-line empty cell) ===
        if (currentAction === 'selecting_tunnel_end') {
            if (tunnelStartPos && tunnelStartPos.r === r && tunnelStartPos.c === c) {
                // Cancel current step: return to start selection
                tunnelStartPos = null;
                currentAction = 'selecting_tunnel_start';
                validMovePaths = getAdjacent8EmptyCells(tunnelTargetPos);
                render();
                showStatusMessage('已取消当前终点选择，请重新选择地道起点');
                return;
            }
            if (!hasCoord(validMovePaths, r, c)) {
                showStatusMessage('地道终点必须与起点同一行/列/斜线，且为目标空格');
                return;
            }
            executeMoleTunnelPath(
                tunnelMolePos || selectedCell,
                tunnelTargetPos,
                tunnelStartPos,
                { r, c }
            );
            return;
        }

        // === Normal Click: Show Context Menu ===
        if (topPiece) {
            const canControl = canOperatePiece(topPiece);
            selectedPieceId = topPiece.id || null;

            if (isRedChildPiece(topPiece)) {
                triggerQuote('孩子', { positionMode: 'board_edge' });
            }

            if (canControl) {
                const rect = document.querySelector('.game-area').getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                showContextMenu(x, y, topPiece, { r, c });
                triggerFx('select_piece', {
                    element: cell,
                    actor: buildPieceMeta(topPiece, { r, c }),
                    cause: 'board_click'
                });
            } else {
                if (topPiece.is_possessed_by_green_wife) {
                    showStatusMessage('该市民处于绿叶妻附身状态，只能操控绿叶妻移动');
                }
                showPieceInfo(topPiece);
                triggerFx('select_piece_enemy', {
                    element: cell,
                    target: buildPieceMeta(topPiece, { r, c }),
                    cause: 'board_click'
                });
            }
        } else if (currentAction) {
            // 点击空地且处于选择模式时取消
            selectedCell = null;
            currentAction = null;
            pendingSkillType = null;
            resetTunnelFlow(false);
            validMovePaths = [];
            selectedPieceId = null;
            render();
        }
    }

    function executeMoleTunnelPath(molePos, targetPos, startPos, endPos) {
        if (!molePos || !targetPos || !startPos || !endPos) {
            showStatusMessage('热爱洞洞参数缺失，请重新选择');
            resetTunnelFlow(true);
            selectedCell = null;
            currentAction = null;
            validMovePaths = [];
            render();
            return;
        }

        pendingSkillType = null;
        selectedCell = { r: molePos.r, c: molePos.c };
        currentAction = null;
        validMovePaths = [];
        fetch('/api/skill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                piece_pos: [molePos.r, molePos.c],
                piece_id: selectedPieceId,
                target_pos: ['tunnel_path', targetPos.r, targetPos.c, startPos.r, startPos.c, endPos.r, endPos.c]
            })
        })
            .then(res => res.json())
            .then(data => {
                showSkillResult(data.success, data.dice, data.message);
                playSfx('skill');

                if (data.success) {
                    resetTunnelFlow(true);
                    selectedCell = null;
                    selectedPieceId = null;
                    setTimeout(() => {
                        hideSkillResult();
                        endTurnAndRefresh();
                    }, 3000);
                    return;
                }

                const msg = String(data.message || '');
                if (/地道未准备|先执行判定|本回合已行动/.test(msg)) {
                    resetTunnelFlow(true);
                    selectedCell = null;
                    currentAction = null;
                    validMovePaths = [];
                    render();
                    showStatusMessage('地道流程已失效，请重新发动热爱洞洞');
                } else if (/地道路径无效|地道起点必须|地道终点必须|地道参数不完整/.test(msg)) {
                    currentAction = 'selecting_tunnel_end';
                    selectedCell = { r: molePos.r, c: molePos.c };
                    validMovePaths = getLineEmptyCells(tunnelStartPos);
                    render();
                    showStatusMessage('地道路径无效，请重新选择地道终点');
                } else {
                    resetTunnelFlow(true);
                    selectedCell = null;
                    currentAction = null;
                    validMovePaths = [];
                    render();
                    showStatusMessage(msg || '地道执行失败，请重新发动热爱洞洞');
                }
                setTimeout(() => {
                    hideSkillResult();
                }, 2500);
            })
            .catch(err => {
                console.error('热爱洞洞执行错误:', err);
                resetTunnelFlow(true);
                selectedCell = null;
                currentAction = null;
                validMovePaths = [];
                showStatusMessage(`热爱洞洞执行失败：${err.message}`);
                render();
            });
    }

    function executeSkill(piecePos, targetPos) {
        const skillType = pendingSkillType;
        pendingSkillType = null;
        const actorMeta = buildPieceMeta(getPieceFromStatePos(state, piecePos, selectedPieceId), piecePos);
        const targetMeta = targetPos ? buildPieceMeta(getPieceFromStatePos(state, targetPos), targetPos) : null;
        const skillContextBase = {
            piecePos: piecePos ? [piecePos.r, piecePos.c] : null,
            targetPos: targetPos ? [targetPos.r, targetPos.c] : null,
            actor: actorMeta,
            target: targetMeta,
            skillType: skillType || '',
            cause: 'skill',
            element: diceContainer
        };
        triggerFx('skill_activate', skillContextBase);

        // Show dice rolling
        diceContainer.classList.remove('hidden');
        diceTens.textContent = '-';
        diceUnits.textContent = '-';

        let targetPayload = null;
        if (skillType) {
            targetPayload = targetPos ? [skillType, targetPos.r, targetPos.c] : [skillType];
        } else if (targetPos) {
            targetPayload = [targetPos.r, targetPos.c];
        }

        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

        animateDiceRoll().then(() => {
            fetch('/api/skill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    piece_pos: [piecePos.r, piecePos.c],
                    piece_id: selectedPieceId,
                    target_pos: targetPayload
                })
            })
                .then(res => {
                    // 检查响应状态
                    if (!res.ok) {
                        console.error(`HTTP错误! 状态: ${res.status}`);
                        return res.text().then(text => {
                            console.error("错误响应内容:", text);
                            throw new Error(`服务器错误 (${res.status}): ${text.substring(0, 100)}`);
                        });
                    }

                    // 尝试解析JSON
                    return res.text().then(text => {
                        console.log("服务器响应:", text);
                        try {
                            return JSON.parse(text);
                        } catch (e) {
                            console.error("JSON解析错误:", e);
                            console.error("原始响应:", text);
                            throw new Error(`无效的JSON响应: ${e.message}\n原始内容: ${text.substring(0, 200)}`);
                        }
                    });
                })
                .then(data => {
                    console.log("解析后的数据:", data);

                    // 检查是否有错误信息
                    if (data.error_type || data.traceback) {
                        console.error("服务器返回错误:");
                        console.error("错误类型:", data.error_type);
                        console.error("错误消息:", data.message);
                        console.error("堆栈追踪:", data.traceback);

                        alert(`技能执行出错:\n${data.message}\n\n请查看浏览器控制台或监控窗口获取详细信息`);
                        diceContainer.classList.add('hidden');
                        return;
                    }

                    // Update Dice UI with real result
                    if (data.dice !== undefined && data.dice !== null) {
                        diceTens.textContent = Math.floor(data.dice / 10);
                        diceUnits.textContent = data.dice % 10;
                    } else {
                        diceTens.textContent = '-';
                        diceUnits.textContent = '-';
                    }
                    triggerFx('dice_roll_end', Object.assign({}, skillContextBase, {
                        element: diceContainer,
                        dice: data.dice,
                        result: data.success ? 'success' : 'failure',
                        log: data.message || ''
                    }));

                    const isSquareDancerDirectionPhase = actorMeta
                        && actorMeta.name === '广场舞大妈'
                        && data.success
                        && data.direction_dice !== undefined
                        && data.direction_dice !== null;
                    const displayMessage = isSquareDancerDirectionPhase
                        ? '广场舞旋涡判定成功，正在判定方向...'
                        : data.message;

                    // Show skill result prominently
                    showSkillResult(data.success, data.dice, displayMessage);

                    // Effects Engine: Skill result
                    if (data.dice === 0) {
                        triggerFx('skill_ultimate', Object.assign({}, skillContextBase, {
                            dice: data.dice,
                            result: 'ultimate',
                            log: data.message || ''
                        }));
                    } else if (data.success) {
                        triggerFx('skill_success', Object.assign({}, skillContextBase, {
                            dice: data.dice,
                            result: 'success',
                            log: data.message || ''
                        }));
                    } else {
                        triggerFx('skill_failure', Object.assign({}, skillContextBase, {
                            dice: data.dice,
                            result: 'failure',
                            log: data.message || ''
                        }));
                    }

                    // Play skill SFX
                    playSfx('skill');

                    const actionConsumed = data.action_consumed !== false;
                    const pendingNightmareRolls = Array.isArray(data.nightmare_rolls) ? data.nightmare_rolls : [];

                    if (data.need_tunnel_endpoint) {
                        if (skillType === 'tunnel_roll' && data.success) {
                            tunnelMolePos = { r: piecePos.r, c: piecePos.c };
                            tunnelTargetPos = null;
                            tunnelStartPos = null;
                            pendingTunnelTarget = null;
                            selectedCell = { r: piecePos.r, c: piecePos.c };
                            currentAction = 'selecting_tunnel_target';
                            validMovePaths = [];
                            render();
                            setTimeout(() => {
                                hideSkillResult();
                                diceContainer.classList.add('hidden');
                            }, 2200);
                            showStatusMessage('判定成功，请选择要传送的棋子');
                            return;
                        }
                        resetTunnelFlow(true);
                        selectedCell = null;
                        currentAction = null;
                        validMovePaths = [];
                        setTimeout(() => {
                            hideSkillResult();
                            diceContainer.classList.add('hidden');
                            fetchState();
                        }, 2200);
                        showStatusMessage('检测到旧版地道流程，请重新使用热爱洞洞选择目标/起点/终点');
                        return;
                    }

                    if (!actionConsumed) {
                        selectedPieceId = null;
                        selectedCell = null;
                        currentAction = null;
                        validMovePaths = [];
                        setTimeout(() => {
                            hideSkillResult();
                            diceContainer.classList.add('hidden');
                            showStatusMessage(data.message || '该技能当前不可用');
                            fetchState(true);
                        }, 1800);
                        return;
                    }

                    if (skillType === 'tunnel_roll') {
                        if (!data.need_tunnel_endpoint) {
                            resetTunnelFlow(true);
                            selectedCell = null;
                            currentAction = null;
                            validMovePaths = [];
                        }
                    }

                    // Feature 2b: Show direction dice overlay for square dancer
                    if (data.direction_dice !== undefined && data.direction_dice !== null && data.success) {
                        const dirNames = { 0: '⏪ 弹回初始位置', 1: '↖ 左上', 2: '↑ 正上', 3: '↗ 右上', 4: '← 正左', 5: '→ 正右', 6: '↙ 左下', 7: '↓ 正下', 8: '↘ 右下', 9: '🔄 再摇' };
                        const dirArrows = { 0: '⟲', 1: '↖', 2: '↑', 3: '↗', 4: '←', 5: '→', 6: '↙', 7: '↓', 8: '↘', 9: '🔄' };
                        // Bug 3: Pause polling so board doesn't update until direction dice animation finishes
                        pausePolling = true;
                        setTimeout(() => {
                            hideSkillResult();
                            diceContainer.classList.add('hidden');
                            showDirectionDice(data.direction_dice, dirArrows[data.direction_dice] || '?', dirNames[data.direction_dice] || '未知').then(async () => {
                                if (pendingNightmareRolls.length) {
                                    await playNightmareRollSequence(pendingNightmareRolls);
                                }
                                pausePolling = false;
                                const latest = await fetchState(true);
                                if (latest) {
                                    showStatusMessage(data.message || '广场舞共舞位移已生效');
                                }
                                await delay(700);
                                await endTurnAndRefresh();
                            });
                        }, 2500);
                    } else {
                        // Wait for user to see result, then end turn
                        setTimeout(async () => {
                            hideSkillResult();
                            diceContainer.classList.add('hidden');
                            if (pendingNightmareRolls.length) {
                                const previousPause = !!pausePolling;
                                pausePolling = true;
                                try {
                                    await playNightmareRollSequence(pendingNightmareRolls);
                                } finally {
                                    pausePolling = previousPause;
                                }
                            }
                            endTurnAndRefresh();
                        }, 3200);
                    }
                })
                .catch(err => {
                    console.error("技能执行完整错误:", err);
                    console.error("错误堆栈:", err.stack);

                    // 显示详细错误信息
                    const errorMsg = `技能执行失败:\n${err.message}\n\n请打开监控控制台 (http://localhost:5001) 查看详细错误信息`;
                    alert(errorMsg);
                    showStatusMessage("技能执行失败 - 请查看控制台");
                    diceContainer.classList.add('hidden');
                    selectedPieceId = null;
                });
        });
    }

    function showSkillResult(success, dice, message) {
        if (!skillResultDisplay) return;

        if (success && typeof success === 'object') {
            const payload = success;
            success = !!payload.success;
            dice = payload.dice;
            message = payload.message;
        }

        let html = '';
        if (success) {
            html = `<div class="result-success">✓ 技能成功!</div>`;
        } else {
            html = `<div class="result-failure">✗ 技能失败</div>`;
        }

        if (dice !== null && dice !== undefined) {
            html += `<div class="result-dice">骰子: ${dice}</div>`;
        }

        if (message) {
            html += `<div class="result-message">${message}</div>`;
        }

        skillResultText.innerHTML = html;
        skillResultDisplay.classList.remove('hidden');
    }
    window.showSkillResult = showSkillResult;

    function hideSkillResult() {
        if (skillResultDisplay) {
            skillResultDisplay.classList.add('hidden');
        }
    }
    window.hideSkillResult = hideSkillResult;

    function buildPc98RollTimings(totalDurationMs = 1700) {
        const base = [140, 110, 130, 95, 120, 100, 130, 110, 95, 125, 150, 170];
        const baseTotal = base.reduce((sum, ms) => sum + ms, 0);
        const scale = totalDurationMs / baseTotal;
        return base.map((ms) => Math.max(70, Math.round(ms * scale)));
    }

    function animatePc98DiceCycle(updateFn, options = {}) {
        const timings = Array.isArray(options.timings) && options.timings.length
            ? options.timings.slice()
            : buildPc98RollTimings(Number(options.totalDurationMs) || 1700);

        return new Promise((resolve) => {
            if (typeof updateFn !== 'function' || !timings.length) {
                resolve();
                return;
            }
            let idx = 0;
            const tick = () => {
                updateFn(Math.floor(Math.random() * 10), idx, timings.length);
                idx += 1;
                if (idx >= timings.length) {
                    resolve();
                    return;
                }
                setTimeout(tick, timings[idx - 1]);
            };
            tick();
        });
    }

    function animateDiceRoll() {
        return new Promise(resolve => {
            triggerFx('dice_roll_start', { element: diceContainer, cause: 'skill', result: 'rolling' });
            let rolls = 0;
            const interval = setInterval(() => {
                diceTens.textContent = Math.floor(Math.random() * 10);
                diceUnits.textContent = Math.floor(Math.random() * 10);
                rolls++;
                if (rolls > 10) {
                    clearInterval(interval);
                    const sfxDice = document.getElementById('sfx-dice');
                    if (sfxDice && sfxDice.src) sfxDice.play();
                    resolve();
                }
            }, 50);
        });
    }

    function doMove(from, to, actionType = 'move') {
        const actorBefore = buildPieceMeta(getPieceFromStatePos(state, from, selectedPieceId), from);
        const victimBefore = actionType === 'capture'
            ? buildPieceMeta(getPieceFromStatePos(state, to), to)
            : null;
        let endpoint = '/api/move';
        if (isSandboxMode) {
            endpoint = actionType === 'capture' ? '/api/sandbox/capture' : '/api/sandbox/relocate';
        }
        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from_pos: [from.r, from.c],
                to_pos: [to.r, to.c],
                piece_id: selectedPieceId
            })
        })
            .then(res => res.json())
            .then(async data => {
                if (data.success) {
                    playSfx('move');
                    if (actionType === 'capture') {
                        triggerFx('piece_captured', {
                            actor: actorBefore,
                            victim: victimBefore,
                            cause: 'capture',
                            result: 'captured',
                            log: data.message || ''
                        });
                        triggerFx('piece_to_grave', {
                            actor: actorBefore,
                            victim: victimBefore,
                            cause: 'capture',
                            result: 'grave',
                            log: data.message || ''
                        });
                    }
                    if (data.random_move) {
                        const previousPause = !!pausePolling;
                        pausePolling = true;
                        try {
                            await showGreenWifeMoveDiceSequence(data);
                        } catch (fxErr) {
                            console.warn('绿叶妻掷骰动画播放失败:', fxErr);
                            if (data.message) showStatusMessage(data.message);
                        } finally {
                            pausePolling = previousPause;
                        }
                    }
                    if (Array.isArray(data.nightmare_rolls) && data.nightmare_rolls.length) {
                        const previousPause = !!pausePolling;
                        pausePolling = true;
                        try {
                            await playNightmareRollSequence(data.nightmare_rolls);
                        } catch (fxErr) {
                            console.warn('夜魔热爱黑黑双骰动画播放失败:', fxErr);
                        } finally {
                            pausePolling = previousPause;
                        }
                    }
                    triggerFx('move_end', {
                        actor: actorBefore,
                        target: { pos: [to.r, to.c] },
                        cause: actionType,
                        result: 'success',
                        log: data.message || ''
                    });
                    const latest = await fetchState(true);
                    if (latest && latest.game_over) {
                        return;
                    }
                    if (hasPendingCitizenUpgradeForCurrentTurn(latest)) {
                        showStatusMessage('市民已到达底线，请先完成升变选择');
                        return;
                    }
                    endTurnAndRefresh();
                } else {
                    showStatusMessage(data.message || "移动失败");
                    selectedPieceId = null;
                    fetchState();
                }
            });
    }

    async function endTurnAndRefresh(options = {}) {
        if (clockRuntime.turnEndInFlight) {
            return { success: false, message: '回合切换中' };
        }
        const cause = options.cause || 'end_turn';
        const afterFetchState = typeof options.afterFetchState === 'function' ? options.afterFetchState : null;
        selectedPieceId = null;
        selectedCell = null;
        currentAction = null;
        validMovePaths = [];
        pendingSkillType = null;
        hideContextMenu();
        hideStackPicker();
        hideProbabilityPanel();
        clockRuntime.turnEndInFlight = true;
        try {
            const endRes = await fetch('/api/end_turn', { method: 'POST' });
            const data = await endRes.json();
            if (!data.success) {
                return data;
            }

            triggerFx('turn_change', { cause, result: 'next_turn' });
            pausePolling = true;
            await playStartTurnFxSequence(data.start_info || {});
            pausePolling = false;
            await fetchState(true);
            if (afterFetchState) {
                await afterFetchState(data);
            }
            return { success: true, data };
        } catch (err) {
            console.error('endTurnAndRefresh error:', err);
            return { success: false, message: err.message };
        } finally {
            pausePolling = false;
            clockRuntime.turnEndInFlight = false;
            if (typeof checkAiTurn === 'function' && state && !state.game_over) {
                setTimeout(() => {
                    checkAiTurn(state);
                }, 0);
            }
        }
    }
    window.endTurnAndRefresh = endTurnAndRefresh;
    window.getClockConfig = () => Object.assign({}, clockConfig || CLOCK_DEFAULT_CONFIG);
    window.getClockRemainingMs = () => getCurrentTurnRemainingMs(Date.now());
    window.isTurnEndInFlight = () => !!clockRuntime.turnEndInFlight;
    window.markAiTimeoutPending = (turnKey) => {
        if (typeof turnKey === 'string' && turnKey) {
            clockRuntime.pendingAiTimeoutTurnKey = turnKey;
        }
    };
    window.consumeAiTimeoutPending = (turnKey) => {
        if (clockRuntime.pendingAiTimeoutTurnKey && clockRuntime.pendingAiTimeoutTurnKey === turnKey) {
            clockRuntime.pendingAiTimeoutTurnKey = '';
            return true;
        }
        return false;
    };
    window.peekAiTimeoutPending = () => clockRuntime.pendingAiTimeoutTurnKey || '';

    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) btnUndo.onclick = () => fetch('/api/undo', { method: 'POST' }).then(() => fetchState());
    const btnSurrender = document.getElementById('btn-surrender');
    if (btnSurrender) btnSurrender.onclick = () => {
        fetch('/api/surrender', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team: state.current_turn })
        }).then(() => fetchState());
    };
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) btnReset.onclick = () => {
        if (confirm("重新开始游戏？")) fetch('/api/reset', { method: 'POST' }).then(() => {
            // Bug 4: Reset button state so it doesn't stay stuck on "ROLLING..."
            btnStartGame.disabled = false;
            btnStartGame.textContent = "开始游戏";
            modalStartGame.classList.add('hidden');
            pausePolling = false;
            resetReplayRecorder({ keepSavedCount: true });
            ensureReplayStatusText('本局结束后可保存录像轨迹');
            clearAiLog();
            fetchState();
        });
    };
    if (sandboxModeToggle) {
        sandboxModeToggle.addEventListener('change', (e) => {
            toggleSandboxMode(!!e.target.checked);
        });
    }

    // Close piece info modal
    const closePieceInfoBtn = document.querySelector('#modal-piece-info .close-btn');
    if (closePieceInfoBtn) {
        closePieceInfoBtn.onclick = () => {
            modalPieceInfo.classList.add('hidden');
        };
    }

    setupAudioUpload('bgm-upload', 'bgm-player');
    setupAudioUpload('sfx-move-upload', 'sfx-move');
    setupAudioUpload('sfx-death-upload', 'sfx-death');
    setupAudioUpload('sfx-skill-upload', 'sfx-skill');
    clockConfig = readClockConfig();
    updateClockControlsFromConfig();
    bindClockControls();
    ensureReplayStatusText('本局结束后可保存录像轨迹');
    renderReplayRecords();
    if (btnSaveReplay) {
        btnSaveReplay.addEventListener('click', () => {
            saveReplayRecording();
        });
    }
    window.saveReplayRecording = saveReplayRecording;
    window.clearReplayRecording = () => {
        resetReplayRecorder({ keepSavedCount: true });
        ensureReplayStatusText('本局结束后可保存录像轨迹');
    };

    window.__moleClockDebug = {
        getConfig: () => Object.assign({}, clockConfig),
        setConfig: (patch) => {
            setClockConfig(patch || {}, { persist: false, announce: false });
            clockRuntime.alarmTriggered = false;
            if (state && state.phase === 'PLAYING') {
                if (!Number.isFinite(clockRuntime.gameStartTs)) {
                    clockRuntime.gameStartTs = Date.now();
                }
                clockRuntime.turnStartTs = Date.now();
                clockRuntime.timeoutTriggeredTurnKey = '';
                clockRuntime.pendingAiTimeoutTurnKey = '';
            }
            updateClockDisplays();
        },
        getRuntime: () => Object.assign({}, clockRuntime),
        rewindElapsedMs: (deltaMs) => {
            const shift = Math.max(0, Number(deltaMs) || 0);
            if (!Number.isFinite(clockRuntime.gameStartTs)) {
                clockRuntime.gameStartTs = Date.now();
            }
            clockRuntime.gameStartTs -= shift;
            updateClockDisplays();
        },
        rewindTurnMs: (deltaMs) => {
            const shift = Math.max(0, Number(deltaMs) || 0);
            if (Number.isFinite(clockRuntime.turnStartTs)) {
                clockRuntime.turnStartTs -= shift;
                clockRuntime.timeoutTriggeredTurnKey = '';
                updateClockDisplays();
            }
        },
        forceTick: () => tickGameClock()
    };

    applyStoryModeUi(readStoryModeSetting(), false);
    if (layoutStore && typeof applySidebarLayout === 'function') {
        applySidebarLayout(layoutConfig, false);
    }
    if (storyModeToggle) {
        storyModeToggle.addEventListener('change', (e) => {
            setStoryModeSetting(!!e.target.checked, true);
        });
    }

    window.addEventListener('message', async (event) => {
        const data = event && event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'MC_EDITOR_APPLY_LAYOUT') {
            const payload = data.payload && data.payload.config ? data.payload.config : data.payload;
            if (layoutStore && typeof applySidebarLayout === 'function') {
                applySidebarLayout(payload || layoutConfig, false);
            }
            return;
        }

        const source = event.source;
        const reply = (type, payload) => {
            if (source && typeof source.postMessage === 'function') {
                source.postMessage({ type, payload }, '*');
            }
        };

        if (data.type === 'MC_EDITOR_REQUEST_RUNTIME_SCHEMA') {
            reply('MC_EDITOR_RUNTIME_SCHEMA', window.MoleChessRuntimeEventCatalog || buildRuntimeEventCatalog());
            return;
        }

        if (data.type === 'MC_EDITOR_REQUEST_STATE') {
            reply('MC_EDITOR_STATE', {
                surface: 'index',
                runtimeCatalog: window.MoleChessRuntimeEventCatalog || buildRuntimeEventCatalog(),
                gameState: state || null,
                schemaVersion: (window.MoleChessUISchema && window.MoleChessUISchema.SCHEMA_VERSION) || '3.0'
            });
            return;
        }

        const requestId = data && data.payload && data.payload.requestId ? data.payload.requestId : '';

        if (data.type === 'MC_STORY_FETCH_STATE') {
            try {
                const res = await fetch('/api/state');
                const statePayload = await res.json();
                reply('MC_STORY_STATE', {
                    requestId,
                    success: true,
                    state: statePayload
                });
            } catch (err) {
                reply('MC_STORY_STATE', {
                    requestId,
                    success: false,
                    message: err.message
                });
            }
            return;
        }

        if (data.type === 'MC_STORY_LOAD_SNAPSHOT') {
            try {
                const payload = data.payload || {};
                const res = await fetch('/api/story/load_snapshot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        snapshot: payload.snapshot || null,
                        preserveLog: !!payload.preserveLog
                    })
                });
                const result = await res.json();
                reply('MC_STORY_OP_RESULT', Object.assign({
                    requestId,
                    op: 'load_snapshot'
                }, result));
            } catch (err) {
                reply('MC_STORY_OP_RESULT', {
                    requestId,
                    op: 'load_snapshot',
                    success: false,
                    message: err.message
                });
            }
            return;
        }

        if (data.type === 'MC_STORY_RESET_RUNTIME') {
            try {
                const res = await fetch('/api/story/reset_runtime', { method: 'POST' });
                const result = await res.json();
                reply('MC_STORY_OP_RESULT', Object.assign({
                    requestId,
                    op: 'reset_runtime'
                }, result));
            } catch (err) {
                reply('MC_STORY_OP_RESULT', {
                    requestId,
                    op: 'reset_runtime',
                    success: false,
                    message: err.message
                });
            }
            return;
        }
    });

    initBoard();

    function showDeathGodDice(finalDice, message) {
        return new Promise((resolve) => {
            const logMsg = String(message || '');
            const deathCtx = {
                dice: finalDice,
                log: logMsg,
                cause: 'death_god_dice',
                actor: findPieceByName(state, '死神') || { name: '死神', pieceType: 'deathgod', team: 'neutral' }
            };
            if (/死神掷出|死神向/.test(logMsg)) {
                triggerFx('death_god_move', Object.assign({}, deathCtx, { result: 'move' }));
            }
            const victims = parseDeathVictimsFromLog(logMsg);
            if (victims.length) {
                triggerFx('death_god_kill', Object.assign({}, deathCtx, {
                    result: 'kill',
                    deathVictims: victims,
                    victim: victims.length === 1 ? victims[0] : null
                }));
            }
            if (/死神走出棋盘|从本局消失|死神.*消失/.test(logMsg)) {
                triggerFx('death_god_exit', Object.assign({}, deathCtx, { result: 'exit' }));
            }

            const overlay = document.createElement('div');
            overlay.className = 'death-god-overlay';
            overlay.innerHTML = `
                <div class="dg-title">💀 死神之骰</div>
                <div class="dg-dice rolling"><span class="dg-dice-value">-</span></div>
                <div class="dg-message"></div>
            `;
            document.body.appendChild(overlay);

            const diceEl = overlay.querySelector('.dg-dice');
            const diceValueEl = overlay.querySelector('.dg-dice-value');
            const msgEl = overlay.querySelector('.dg-message');
            let resolved = false;
            const doResolve = () => {
                if (resolved) return;
                resolved = true;
                if (overlay.parentNode) overlay.remove();
                resolve();
            };

            let rolls = 0;
            const rollInterval = setInterval(() => {
                if (diceValueEl) diceValueEl.textContent = Math.floor(Math.random() * 10);
                rolls++;
                if (rolls > 15) {
                    clearInterval(rollInterval);
                    diceEl.classList.remove('rolling');
                    if (diceValueEl) diceValueEl.textContent = String(finalDice);
                    msgEl.textContent = message || '';

                    // Click to dismiss early
                    overlay.addEventListener('click', doResolve, { once: true });

                    // Auto-dismiss after 2.5s
                    setTimeout(doResolve, 2500);
                }
            }, 80);
        });
    }
    window.showDeathGodDice = showDeathGodDice;

    let nightmareAtmosphereTransitionTimer = null;
    let nightmareAtmosphereCleanupTimer = null;
    let nightmareAtmosphereTransitionInFlight = false;

    function ensureNightmareAtmosphereLayer() {
        let layer = document.getElementById('atmosphere-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'atmosphere-layer';
            document.body.appendChild(layer);
        }
        return layer;
    }

    function normalizeNightmareAtmosphereState(targetState) {
        const raw = String(targetState || '').trim().toLowerCase();
        if (raw === 'day' || raw === 'night' || raw === 'perm-night') return raw;
        return 'normal';
    }

    function clearNightmareAtmosphereTimers() {
        if (nightmareAtmosphereTransitionTimer) {
            clearTimeout(nightmareAtmosphereTransitionTimer);
            nightmareAtmosphereTransitionTimer = null;
        }
        if (nightmareAtmosphereCleanupTimer) {
            clearTimeout(nightmareAtmosphereCleanupTimer);
            nightmareAtmosphereCleanupTimer = null;
        }
    }

    function applyNightmareAtmosphereState(targetState, options = {}) {
        ensureNightmareAtmosphereLayer();
        const body = document.body;
        const nextState = normalizeNightmareAtmosphereState(targetState);
        const withGlitch = !!options.withGlitch;
        const keepCurrent = body.classList.contains(`state-${nextState}`);
        if (keepCurrent && !withGlitch) return;

        const clearStates = () => {
            body.classList.remove('state-day', 'state-night', 'state-perm-night', 'state-normal');
        };

        if (!withGlitch) {
            clearNightmareAtmosphereTimers();
            nightmareAtmosphereTransitionInFlight = false;
            body.classList.remove('glitch-transition-active');
            clearStates();
            if (nextState !== 'normal') {
                body.classList.add(`state-${nextState}`);
            } else {
                body.classList.add('state-normal');
            }
            body.dataset.nightmareAtmosphere = nextState;
            return;
        }

        clearNightmareAtmosphereTimers();
        nightmareAtmosphereTransitionInFlight = true;
        body.classList.add('glitch-transition-active');
        clearStates();
        nightmareAtmosphereTransitionTimer = setTimeout(() => {
            if (nextState !== 'normal') {
                body.classList.add(`state-${nextState}`);
            } else {
                body.classList.add('state-normal');
            }
            body.dataset.nightmareAtmosphere = nextState;
        }, 300);
        nightmareAtmosphereCleanupTimer = setTimeout(() => {
            body.classList.remove('glitch-transition-active');
            nightmareAtmosphereTransitionInFlight = false;
        }, 600);
    }

    function detectNightmareAtmosphereStateFromBoard(gameState) {
        if (!gameState || !Array.isArray(gameState.board)) return 'normal';
        let hasNightmare = false;
        let hasDayNightmare = false;
        let hasNightNightmare = false;
        let hasPermanentNightmare = false;
        for (let r = 0; r < gameState.board.length; r += 1) {
            const row = gameState.board[r];
            if (!Array.isArray(row)) continue;
            for (let c = 0; c < row.length; c += 1) {
                const cell = row[c];
                if (!Array.isArray(cell) || !cell.length) continue;
                for (const piece of cell) {
                    if (!piece || piece.state !== 'alive') continue;
                    if (!(piece.name === '夜魔' || piece.is_nightmare)) continue;
                    hasNightmare = true;
                    if (piece.permanent_night) {
                        hasPermanentNightmare = true;
                    } else if (piece.is_night) {
                        hasNightNightmare = true;
                    } else {
                        hasDayNightmare = true;
                    }
                }
            }
        }
        if (!hasNightmare) return 'normal';
        if (hasPermanentNightmare) return 'perm-night';
        if (hasNightNightmare) return 'night';
        if (hasDayNightmare) return 'day';
        return 'normal';
    }

    function syncNightmareAtmosphereToState(gameState) {
        if (nightmareAtmosphereTransitionInFlight) return;
        const nextState = detectNightmareAtmosphereStateFromBoard(gameState);
        applyNightmareAtmosphereState(nextState, { withGlitch: false });
    }

    function resolveNightmareModeLabel(mode) {
        if (mode === 'perm-night') return '永久黑夜';
        if (mode === 'night') return '黑夜';
        if (mode === 'day') return '白昼';
        return '未知';
    }

    function showNightmareDayNightDice(rollMeta = {}) {
        return new Promise((resolve) => {
            const dice = Number(rollMeta.dice);
            if (!Number.isFinite(dice) || dice < 0 || dice > 99) {
                resolve();
                return;
            }
            const tens = Number.isFinite(Number(rollMeta.tens)) ? Number(rollMeta.tens) : Math.floor(dice / 10);
            const ones = Number.isFinite(Number(rollMeta.ones)) ? Number(rollMeta.ones) : (dice % 10);
            const mode = normalizeNightmareAtmosphereState(rollMeta.state);
            const modeLabel = rollMeta.modeText || resolveNightmareModeLabel(mode);
            const detail = String(rollMeta.detail || '');
            const shouldGlitch = !!rollMeta.triggerGlitch;
            const sourceLabel = rollMeta.source === 'transform' ? '变身判定' : '自动判定';

            const overlay = document.createElement('div');
            overlay.className = 'death-god-overlay nightmare-roll-overlay';
            overlay.innerHTML = `
                <div class="dg-title">🌗 夜魔·热爱黑黑（${sourceLabel}）</div>
                <div class="nightmare-roll-dice-row">
                    <div class="dg-dice rolling"><span class="dg-dice-value">-</span></div>
                    <div class="dg-dice rolling"><span class="dg-dice-value">-</span></div>
                </div>
                <div class="dg-message"></div>
            `;
            document.body.appendChild(overlay);

            const diceEls = Array.from(overlay.querySelectorAll('.dg-dice'));
            const valueEls = Array.from(overlay.querySelectorAll('.dg-dice-value'));
            const msgEl = overlay.querySelector('.dg-message');
            let resolved = false;
            const doResolve = () => {
                if (resolved) return;
                resolved = true;
                if (overlay.parentNode) overlay.remove();
                resolve();
            };

            let rolls = 0;
            const timer = setInterval(() => {
                if (valueEls[0]) valueEls[0].textContent = String(Math.floor(Math.random() * 10));
                if (valueEls[1]) valueEls[1].textContent = String(Math.floor(Math.random() * 10));
                rolls += 1;
                if (rolls > 16) {
                    clearInterval(timer);
                    diceEls.forEach((el) => el.classList.remove('rolling'));
                    if (valueEls[0]) valueEls[0].textContent = String(Math.max(0, Math.min(9, tens)));
                    if (valueEls[1]) valueEls[1].textContent = String(Math.max(0, Math.min(9, ones)));
                    if (msgEl) {
                        msgEl.textContent = `判定: ${String(dice).padStart(2, '0')} -> ${modeLabel}${detail ? `（${detail}）` : ''}`;
                    }
                    applyNightmareAtmosphereState(mode, { withGlitch: shouldGlitch });
                    overlay.addEventListener('click', doResolve, { once: true });
                    setTimeout(doResolve, 3000);
                }
            }, 80);
        });
    }

    window.showNightmareDayNightDice = showNightmareDayNightDice;
    window.syncNightmareAtmosphereToState = syncNightmareAtmosphereToState;

    function showDirectionDice(finalDice, arrow, directionName) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'death-god-overlay';
            overlay.innerHTML = `
                <div class="dg-title">💃 广场舞方向骰</div>
                <div class="dg-dice rolling"><span class="dg-dice-value">-</span></div>
                <div class="dg-arrow" style="opacity:0; font-size:48px; margin-top:10px;"></div>
                <div class="dg-message"></div>
            `;
            document.body.appendChild(overlay);

            const diceEl = overlay.querySelector('.dg-dice');
            const diceValueEl = overlay.querySelector('.dg-dice-value');
            const arrowEl = overlay.querySelector('.dg-arrow');
            const msgEl = overlay.querySelector('.dg-message');
            let resolved = false;
            const doResolve = () => {
                if (resolved) return;
                resolved = true;
                if (overlay.parentNode) overlay.remove();
                resolve();
            };

            let rolls = 0;
            const rollInterval = setInterval(() => {
                if (diceValueEl) diceValueEl.textContent = Math.floor(Math.random() * 10);
                rolls++;
                if (rolls > 15) {
                    clearInterval(rollInterval);
                    diceEl.classList.remove('rolling');
                    if (diceValueEl) diceValueEl.textContent = String(finalDice);

                    // Show direction arrow after short delay
                    setTimeout(() => {
                        if (arrowEl) {
                            arrowEl.textContent = arrow;
                            arrowEl.style.opacity = '1';
                        }
                        msgEl.textContent = `方向: ${directionName}`;
                    }, 500);

                    // Click to dismiss early
                    overlay.addEventListener('click', doResolve, { once: true });
                    // Auto-dismiss after 3.5s
                    setTimeout(doResolve, 3500);
                }
            }, 80);
        });
    }

    function hideDirectionDice() {
        const overlay = document.getElementById('direction-dice-overlay');
        if (overlay) overlay.remove();
    }
    window.showDirectionDice = showDirectionDice;

    function normalizeDiceRollSequence(rawRolls, finalDice) {
        const rolls = Array.isArray(rawRolls)
            ? rawRolls.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 9)
            : [];
        const finalValue = Number(finalDice);
        if (Number.isInteger(finalValue) && finalValue >= 0 && finalValue <= 9) {
            if (!rolls.length || rolls[rolls.length - 1] !== finalValue) {
                rolls.push(finalValue);
            }
        }
        return rolls;
    }

    function showGreenWifeDirectionDice(finalDice, directionRolls = []) {
        return new Promise((resolve) => {
            const directionMeta = getDirectionDisplay(finalDice);
            const rollSequence = normalizeDiceRollSequence(directionRolls, finalDice);
            const overlay = document.createElement('div');
            overlay.className = 'death-god-overlay';
            overlay.innerHTML = `
                <div class="dg-title">💚 绿叶妻方向骰</div>
                <div class="dg-dice rolling"><span class="dg-dice-value">-</span></div>
                <div class="dg-arrow" style="opacity:0; font-size:48px; margin-top:10px;"></div>
                <div class="dg-message"></div>
            `;
            document.body.appendChild(overlay);

            const diceEl = overlay.querySelector('.dg-dice');
            const diceValueEl = overlay.querySelector('.dg-dice-value');
            const arrowEl = overlay.querySelector('.dg-arrow');
            const msgEl = overlay.querySelector('.dg-message');
            let resolved = false;
            const doResolve = () => {
                if (resolved) return;
                resolved = true;
                if (overlay.parentNode) overlay.remove();
                resolve();
            };

            const showFinalState = () => {
                if (arrowEl) {
                    arrowEl.textContent = directionMeta.arrow;
                    arrowEl.style.opacity = '1';
                }
                if (msgEl) {
                    msgEl.textContent = `方向: ${directionMeta.name}`;
                }
                overlay.addEventListener('click', doResolve, { once: true });
                setTimeout(doResolve, 3200);
            };

            let rolls = 0;
            const rollInterval = setInterval(() => {
                if (diceValueEl) diceValueEl.textContent = Math.floor(Math.random() * 10);
                rolls += 1;
                if (rolls > 12) {
                    clearInterval(rollInterval);
                    if (diceEl) diceEl.classList.remove('rolling');
                    if (rollSequence.length > 1) {
                        let idx = 0;
                        const seqTimer = setInterval(() => {
                            const current = rollSequence[idx];
                            if (diceValueEl) diceValueEl.textContent = String(current);
                            if (msgEl && current === 9 && idx < rollSequence.length - 1) {
                                msgEl.textContent = '方向: 🔄 再摇一次';
                            }
                            idx += 1;
                            if (idx >= rollSequence.length) {
                                clearInterval(seqTimer);
                                setTimeout(showFinalState, 240);
                            }
                        }, 260);
                    } else {
                        if (diceValueEl) diceValueEl.textContent = String(finalDice);
                        setTimeout(showFinalState, 240);
                    }
                }
            }, 80);
        });
    }

    function showGreenWifeStepsDice(stepsDice) {
        return new Promise((resolve) => {
            const finalSteps = Number(stepsDice);
            if (!Number.isInteger(finalSteps) || finalSteps < 0 || finalSteps > 9) {
                resolve();
                return;
            }
            const overlay = document.createElement('div');
            overlay.className = 'death-god-overlay';
            overlay.innerHTML = `
                <div class="dg-title">💚 绿叶妻步数骰</div>
                <div class="dg-dice rolling"><span class="dg-dice-value">-</span></div>
                <div class="dg-message"></div>
            `;
            document.body.appendChild(overlay);

            const diceEl = overlay.querySelector('.dg-dice');
            const diceValueEl = overlay.querySelector('.dg-dice-value');
            const msgEl = overlay.querySelector('.dg-message');
            let resolved = false;
            const doResolve = () => {
                if (resolved) return;
                resolved = true;
                if (overlay.parentNode) overlay.remove();
                resolve();
            };

            let rolls = 0;
            const rollInterval = setInterval(() => {
                if (diceValueEl) diceValueEl.textContent = Math.floor(Math.random() * 10);
                rolls += 1;
                if (rolls > 12) {
                    clearInterval(rollInterval);
                    if (diceEl) diceEl.classList.remove('rolling');
                    if (diceValueEl) diceValueEl.textContent = String(finalSteps);
                    if (msgEl) msgEl.textContent = `步数: ${finalSteps}`;
                    overlay.addEventListener('click', doResolve, { once: true });
                    setTimeout(doResolve, 2600);
                }
            }, 80);
        });
    }

    async function showGreenWifeMoveDiceSequence(meta = {}) {
        const directionDice = Number(meta.direction_dice ?? meta.directionDice);
        if (!Number.isInteger(directionDice)) return;
        const directionRolls = Array.isArray(meta.direction_rolls)
            ? meta.direction_rolls
            : (Array.isArray(meta.directionRolls) ? meta.directionRolls : []);
        const stepsValueRaw = meta.steps_dice ?? meta.stepsDice;
        const stepsDice = Number.isInteger(Number(stepsValueRaw)) ? Number(stepsValueRaw) : null;
        await showGreenWifeDirectionDice(directionDice, directionRolls);
        if (directionDice !== 0 && stepsDice !== null) {
            await showGreenWifeStepsDice(stepsDice);
        }
        if (meta.message) {
            showStatusMessage(meta.message);
        }
    }
    window.showGreenWifeMoveDiceSequence = showGreenWifeMoveDiceSequence;

    // === Feature 3 & 4: Probability Info Panels ===
    function checkOfficerAlive(team) {
        if (!state || !state.board) return false;
        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 12; c++) {
                const cell = state.board[r] && state.board[r][c];
                if (cell) {
                    for (const p of cell) {
                        if (p.name === '官员' && p.team === team && p.state !== 'dead' && p.state !== 'grave' && p.state !== 'ghost') {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    function checkTeacherAlive(team) {
        if (!state || !state.board) return false;
        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 12; c++) {
                const cell = state.board[r] && state.board[r][c];
                if (cell) {
                    for (const p of cell) {
                        if (p.name === '老师' && p.team === team && p.state !== 'dead' && p.state !== 'grave' && p.state !== 'ghost') {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    function checkAnyOfficerAlive() {
        if (!state || !state.board) return false;
        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 12; c++) {
                const cell = state.board[r] && state.board[r][c];
                if (cell) {
                    for (const p of cell) {
                        if (p.name === '官员' && p.state !== 'dead' && p.state !== 'grave' && p.state !== 'ghost') {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    function showChildProbabilityPanel(childPiece) {
        hideProbabilityPanel();
        if (!childPiece || childPiece.name !== '孩子') return;

        const officerAlive = checkOfficerAlive(childPiece.team);
        const baseRate = officerAlive ? 50 : 25;
        const bonus = Math.max(0, Math.min(100, Number(childPiece.red_song_bonus || 0)));
        const finalRate = Math.min(100, baseRate + bonus);
        const minRoll = finalRate >= 100 ? '01' : String(100 - finalRate).padStart(2, '0');
        const currentCondition = officerAlive ? '官员在场（基础50%）' : '官员不在场（基础25%）';

        const panel = document.createElement('div');
        panel.id = 'probability-panel';
        panel.className = 'probability-info-panel';
        panel.innerHTML = `
            <h3>🎵 孩子学红歌概率</h3>
            <div class="prob-row${officerAlive ? ' active' : ''}">
                <span class="prob-label">官员在场</span>
                <span class="prob-range">50%</span>
                <span class="prob-value">基础50%</span>
            </div>
            <div class="prob-row${!officerAlive ? ' active' : ''}">
                <span class="prob-label">官员不在场</span>
                <span class="prob-range">25%</span>
                <span class="prob-value">基础25%</span>
            </div>
            <div class="prob-row active">
                <span class="prob-label">累计成功加成</span>
                <span class="prob-range">+${bonus}%</span>
                <span class="prob-value">上限100%</span>
            </div>
            <div class="prob-special">00 = 终身复读（永久红叶儿）；每成功1次，下次+10%</div>
            <div style="margin-top:10px; color:#fff; font-size:13px; border-top:1px solid var(--grid-color); padding-top:8px;">
                当前: <strong style="color:var(--text-highlight)">${currentCondition}</strong><br>
                本次成功率: <strong style="color:var(--green-special)">${finalRate}%</strong>（成功骰面：${minRoll}-99）
            </div>
            <button class="prob-close" onclick="document.getElementById('probability-panel').remove()">关闭</button>
        `;
        document.querySelector('.game-area').appendChild(panel);
    }

    function showDoctorProbabilityPanel() {
        hideProbabilityPanel();
        const anyOfficerAlive = checkAnyOfficerAlive();

        let currentCondition, prob, range;
        if (anyOfficerAlive) {
            currentCondition = '官员在场 (概率受限)';
            prob = '25%'; range = '75-99';
        } else {
            currentCondition = '官员不在场';
            prob = '50%'; range = '50-99';
        }

        const panel = document.createElement('div');
        panel.id = 'probability-panel';
        panel.className = 'probability-info-panel';
        panel.innerHTML = `
            <h3>💊 医生复活概率</h3>
            <div class="prob-row${anyOfficerAlive ? ' active' : ''}">
                <span class="prob-label">官员在场</span>
                <span class="prob-range">75-99</span>
                <span class="prob-value">25%</span>
            </div>
            <div class="prob-row${!anyOfficerAlive ? ' active' : ''}">
                <span class="prob-label">官员不在场</span>
                <span class="prob-range">50-99</span>
                <span class="prob-value">50%</span>
            </div>
            <div class="prob-special">00 = 永久冷冻（丧失行动力获得永生）</div>
            <div style="margin-top:10px; color:#fff; font-size:13px; border-top:1px solid var(--grid-color); padding-top:8px;">
                当前: <strong style="color:var(--text-highlight)">${currentCondition}</strong><br>
                成功范围: <strong style="color:var(--green-special)">${range}</strong> (${prob})
            </div>
            <button class="prob-close" onclick="document.getElementById('probability-panel').remove()">关闭</button>
        `;
        document.querySelector('.game-area').appendChild(panel);
    }

    function hideProbabilityPanel() {
        const existing = document.getElementById('probability-panel');
        if (existing) existing.remove();
    }

    // Rules Guide Button Event
    const guideModalBtn = document.getElementById('btn-rules-guide');
    const guideModalRef = document.getElementById('modal-rules-guide');
    if (guideModalBtn && guideModalRef) {
        guideModalBtn.onclick = () => {
            guideModalRef.classList.remove('hidden');
        };
    }
    if (btnReplayRecords && modalReplayRecords) {
        btnReplayRecords.onclick = () => {
            renderReplayRecords();
            modalReplayRecords.classList.remove('hidden');
        };
    }
    if (btnReplayRefresh) {
        btnReplayRefresh.addEventListener('click', () => {
            renderReplayRecords();
        });
    }
    if (btnReplayClearAll) {
        btnReplayClearAll.addEventListener('click', () => {
            if (confirm('确定清空所有本地录像记录吗？此操作不可撤销。')) {
                clearReplayRecords();
            }
        });
    }
    if (replayRecordsList) {
        replayRecordsList.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const downloadBtn = target.closest('.replay-download-btn');
            if (downloadBtn) {
                const replayId = downloadBtn.getAttribute('data-replay-id') || '';
                downloadReplayRecord(replayId);
                return;
            }
            const removeBtn = target.closest('.replay-remove-btn');
            if (removeBtn) {
                const replayId = removeBtn.getAttribute('data-replay-id') || '';
                if (confirm('确定删除该录像记录吗？')) {
                    removeReplayRecord(replayId);
                }
            }
        });
    }

    window.fetchState = fetchState;
    window.setPausePolling = (paused) => {
        pausePolling = !!paused;
    };
    window.getPausePolling = () => !!pausePolling;
    window.render = render;
    window.setAiMoveHighlight = (val) => {
        aiMoveHighlight = (val && (val.from || val.to)) ? val : { from: null, to: null };
    };
    setupExpoSyncListeners();
    fetchState();
    setInterval(fetchState, 2000);
    setInterval(tickGameClock, 200);
});

// 再来一局
function restartGame() {
    document.getElementById('modal-game-over').classList.add('hidden');
    if (window.clearReplayRecording) window.clearReplayRecording();
    fetch('/api/reset', { method: 'POST' })
        .then(() => {
            // Bug 4: Reset start button state
            const btn = document.getElementById('btn-start-game');
            if (btn) { btn.disabled = false; btn.textContent = "开始游戏"; }
            const modal = document.getElementById('modal-start-game');
            if (modal) modal.classList.add('hidden');
            if (window.clearAiLog) window.clearAiLog();
            if (window.setAiMoveHighlight) window.setAiMoveHighlight(null);
            if (window.fetchState) window.fetchState();
        });
}

// 市民升变选择 - 记录待升变市民位置
let pendingUpgradePos = null;
let pendingUpgradePieceId = null;

function hideCitizenUpgradeModal() {
    const modal = document.getElementById('modal-citizen-upgrade');
    if (modal) modal.classList.add('hidden');
    pendingUpgradePos = null;
    pendingUpgradePieceId = null;
}

function canHumanOperateCurrentTurn(gameState) {
    if (!gameState) return true;
    if (isAiVsAiMode) return false;
    if (isAiMode && gameState.current_turn === 'black') return false;
    return true;
}

function hasPendingCitizenUpgradeForCurrentTurn(gameState) {
    if (!gameState || !gameState.board) return false;
    if (!canHumanOperateCurrentTurn(gameState)) return false;
    for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 12; c++) {
            const cell = gameState.board[r][c];
            if (!Array.isArray(cell) || cell.length === 0) continue;
            for (const piece of cell) {
                if (
                    piece
                    && piece.name === '市民'
                    && piece.state === 'alive'
                    && piece.team === gameState.current_turn
                    && piece.can_upgrade
                    && !piece.is_possessed_by_green_wife
                ) {
                    return true;
                }
            }
        }
    }
    return false;
}

function selectUpgrade(upgradeType) {
    if (!pendingUpgradePos) {
        alert('错误：没有待升变的市民');
        return;
    }

    fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            piece_pos: pendingUpgradePos,
            piece_id: pendingUpgradePieceId,
            upgrade_to: upgradeType
        })
    })
        .then(res => res.json())
        .then(data => {
            hideCitizenUpgradeModal();
            if (data.success) {
                console.log('✅ 升变成功:', data.message);
                if (typeof window.triggerFx === 'function') {
                    window.triggerFx('citizen_upgrade', { cause: 'upgrade', result: 'success' });
                }
            } else {
                alert(`升变失败: ${data.message}`);
            }
            // 刷新状态
            if (window.fetchState) window.fetchState();
        })
        .catch(err => {
            console.error('Upgrade error:', err);
            alert(`网络错误: ${err.message}`);
        });
}

// 检查是否有市民可升变（在 fetchState 后调用）
function checkCitizenUpgrade(gameState) {
    if (!gameState || !gameState.board) return;
    if (!canHumanOperateCurrentTurn(gameState)) {
        hideCitizenUpgradeModal();
        return;
    }

    // 遍历棋盘查找可升变的市民
    for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 12; c++) {
            const cell = gameState.board[r][c];
            if (cell && cell.length > 0) {
                for (const piece of cell) {
                    if (
                        piece
                        && piece.name === '市民'
                        && piece.state === 'alive'
                        && piece.team === gameState.current_turn
                        && piece.can_upgrade
                        && !piece.is_possessed_by_green_wife
                    ) {
                        // 发现可升变的市民，弹出选择框
                        pendingUpgradePos = [r, c];
                        pendingUpgradePieceId = piece.id || null;
                        const modal = document.getElementById('modal-citizen-upgrade');
                        if (modal) modal.classList.remove('hidden');
                        return;
                    }
                }
            }
        }
    }
    hideCitizenUpgradeModal();
}

// ==========================================
// MOLE CHESS AI MODULE (已升级：支持 AI vs AI)
// ==========================================

let isAiMode = false;       // PvE 开关 (AI 执黑)
let isAiVsAiMode = false;   // Eve 开关 (AI 打 AI)
let aiProcessing = false;   // 防止重复请求锁
let aiActionSpeedMultiplier = 5000;

const AI_ACTION_SPEED_STORAGE_KEY = 'mole_chess_ai_action_speed';
const AI_ACTION_SPEED_ALLOWED = [3000, 4000, 5000, 6000, 8000];

function normalizeAiActionSpeed(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 5000;
    const hit = AI_ACTION_SPEED_ALLOWED.find(v => Math.abs(v - parsed) < 0.001);
    return hit || 5000;
}

function readAiActionSpeed() {
    try {
        return normalizeAiActionSpeed(localStorage.getItem(AI_ACTION_SPEED_STORAGE_KEY));
    } catch (_e) {
        return 1;
    }
}

function persistAiActionSpeed(value) {
    try {
        localStorage.setItem(AI_ACTION_SPEED_STORAGE_KEY, String(value));
    } catch (_e) { }
}

function syncAiSpeedSelects() {
    const nextValue = String(aiActionSpeedMultiplier);
    const selectIds = ['ai-action-speed-select', 'pc98-ai-action-speed-select'];
    selectIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.value !== nextValue) {
            el.value = nextValue;
        }
    });
}

function updateAiSpeedControlsVisibility() {
    const show = !!(isAiMode || isAiVsAiMode);
    const win98Row = document.getElementById('win98-ai-speed-row');
    const pc98Row = document.getElementById('pc98-ai-speed-row');
    if (win98Row) {
        win98Row.style.display = show ? 'flex' : 'none';
    }
    if (pc98Row) {
        pc98Row.style.display = show ? 'block' : 'none';
    }
}

function applyAiActionSpeed(value, options = {}) {
    const persist = options.persist !== false;
    aiActionSpeedMultiplier = normalizeAiActionSpeed(value);
    syncAiSpeedSelects();
    if (persist) persistAiActionSpeed(aiActionSpeedMultiplier);
}

// 1. 监听开关变化
document.addEventListener('DOMContentLoaded', () => {
    const aiToggle = document.getElementById('ai-mode-toggle');
    const eveToggle = document.getElementById('ai-vs-ai-toggle');
    const aiSpeedSelect = document.getElementById('ai-action-speed-select');
    const pc98AiSpeedSelect = document.getElementById('pc98-ai-action-speed-select');

    isAiMode = !!(aiToggle && aiToggle.checked);
    isAiVsAiMode = !!(eveToggle && eveToggle.checked);
    applyAiActionSpeed(readAiActionSpeed(), { persist: false });
    updateAiSpeedControlsVisibility();

    if (aiSpeedSelect) {
        aiSpeedSelect.addEventListener('change', (e) => {
            applyAiActionSpeed(e && e.target ? e.target.value : 16000);
        });
    }

    if (pc98AiSpeedSelect) {
        pc98AiSpeedSelect.addEventListener('change', (e) => {
            applyAiActionSpeed(e && e.target ? e.target.value : 16000);
        });
    }

    // PvE 开关
    if (aiToggle) {
        aiToggle.addEventListener('change', (e) => {
            isAiMode = e.target.checked;
            // 如果开启 PvE，自动关闭 EvE，防止冲突
            if (isAiMode) {
                if (eveToggle) eveToggle.checked = false;
                isAiVsAiMode = false;
                hideCitizenUpgradeModal();
            }
            updateAiSpeedControlsVisibility();
            console.log("PvE Mode:", isAiMode);
            if (isAiMode || isAiVsAiMode) {
                if (window.fetchState) {
                    window.fetchState(true).then(data => {
                        if (data) checkAiTurn(data);
                    });
                }
            }
        });
    }

    // ★★★ AI vs AI 开关 ★★★
    if (eveToggle) {
        eveToggle.addEventListener('change', (e) => {
            isAiVsAiMode = e.target.checked;
            // 如果开启 EvE，自动关闭 PvE
            if (isAiVsAiMode) {
                if (aiToggle) aiToggle.checked = false;
                isAiMode = false;
                hideCitizenUpgradeModal();
            }
            updateAiSpeedControlsVisibility();
            console.log("AI vs AI Mode:", isAiVsAiMode);
            // 立即触发检查
            if (isAiMode || isAiVsAiMode) {
                if (window.fetchState) {
                    window.fetchState(true).then(data => {
                        if (data) checkAiTurn(data);
                    });
                }
            }
        });
    }
});

function toPosPair(pos) {
    if (!Array.isArray(pos) || pos.length < 2) return null;
    const r = Number(pos[0]);
    const c = Number(pos[1]);
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return [r, c];
}

function formatAiSystemLogPos(pos) {
    const pair = toPosPair(pos);
    if (!pair) return '--';
    if (typeof window.formatPos === 'function') {
        return window.formatPos(pair[0], pair[1]);
    }
    return `${pair[0]},${pair[1]}`;
}

function buildAiSystemLogLines(moveData, actionType, actingContext = null) {
    const lines = [];
    const actingTurn = actingContext && actingContext.actingTurn ? actingContext.actingTurn : '';
    const teamLabel = actingTurn === 'black' ? '黑方' : actingTurn === 'white' ? '白方' : (actingTurn || '--');
    const actionSummary = moveData && moveData.ai_action_summary
        ? String(moveData.ai_action_summary)
        : '';
    if (actionSummary) {
        lines.push(actionSummary);
    } else if (actionType === 'move') {
        lines.push(`AI(${teamLabel}) 移动: ${formatAiSystemLogPos(moveData && moveData.from)} -> ${formatAiSystemLogPos(moveData && moveData.to)}`);
    } else if (actionType === 'skill') {
        const skillResult = moveData && moveData.skill_result && typeof moveData.skill_result === 'object'
            ? moveData.skill_result
            : null;
        const resultText = skillResult && skillResult.message ? ` | 结果: ${skillResult.message}` : '';
        lines.push(`AI(${teamLabel}) 技能: ${formatAiSystemLogPos(moveData && moveData.from)} -> ${formatAiSystemLogPos(moveData && moveData.to)}${resultText}`);
    } else if (actionType === 'upgrade') {
        const upgradeTo = String((moveData && moveData.upgrade_to) || '');
        lines.push(`AI(${teamLabel}) 升变: ${formatAiSystemLogPos(moveData && moveData.upgrade_pos)} -> ${upgradeTo || '未知'}`);
    } else {
        lines.push(`AI(${teamLabel}) 执行动作: ${actionType || 'unknown'}`);
    }
    return lines;
}

function resolveTopPieceForAi(cell) {
    if (!Array.isArray(cell) || !cell.length) return null;
    const greenWife = cell.find((piece) => piece && (piece.is_green_wife || piece.name === '绿叶妻'));
    return greenWife || cell[cell.length - 1] || null;
}

function buildAiActorMeta(gameState, fromPos) {
    if (!gameState || !Array.isArray(gameState.board)) return null;
    const pos = toPosPair(fromPos);
    if (!pos) return null;
    const [r, c] = pos;
    const row = gameState.board[r];
    if (!Array.isArray(row)) return null;
    const piece = resolveTopPieceForAi(row[c]);
    if (!piece) return null;
    return {
        id: piece.id || null,
        name: piece.name || '',
        team: piece.team || '',
        symbol: piece.symbol || '',
        pieceType: '',
        pos
    };
}

// 2. 核心 AI 思考与行动逻辑
async function checkAiTurn(gameState) {
    // 基础检查：AI正在思考 或 游戏结束 -> 不执行
    if (aiProcessing || !gameState || gameState.game_over) return;
    if (typeof window.isTurnEndInFlight === 'function' && window.isTurnEndInFlight()) return;
    if (gameState.sandbox_mode) return;
    if (gameState.phase !== 'PLAYING') return;

    // ★★★ 关键判断：什么时候轮到 AI 走？ ★★★
    let isAiTurn = false;

    if (isAiVsAiMode) {
        // 模式 B: AI vs AI -> 任何人回合都是 AI 走
        isAiTurn = true;
    } else if (isAiMode) {
        // 模式 A: PvE -> 只有黑方回合是 AI 走
        if (gameState.current_turn === 'black') {
            isAiTurn = true;
        }
    }

    // 如果不是 AI 的回合，直接退出
    if (!isAiTurn) return;

    console.log(`🤖 AI (${gameState.current_turn}) 正在思考...`);
    aiProcessing = true;
    const turnKey = `${Number(gameState.turn_count || 0)}:${String(gameState.current_turn || '')}`;

    // 界面提示
    const turnEl = document.getElementById('current-turn');
    if (turnEl) {
        const aiTurnLabel = gameState.current_turn === 'black' ? '黑方' : gameState.current_turn === 'white' ? '白方' : gameState.current_turn;
        turnEl.textContent = `▶ ${aiTurnLabel}（AI思考中）`;
        turnEl.classList.add('turn-ai-thinking');
    }

    const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    let skillPopupPaused = false; // Track whether we paused polling for the AI skill popup

    try {
        const pendingTimeoutBeforeRequest = typeof window.peekAiTimeoutPending === 'function'
            ? window.peekAiTimeoutPending() === turnKey
            : false;
        const selectedThinkDelayMs = normalizeAiActionSpeed(aiActionSpeedMultiplier);
        const thinkDelayMs = pendingTimeoutBeforeRequest ? 0 : selectedThinkDelayMs;
        if (thinkDelayMs > 0) {
            if (turnEl) {
                const aiTurnLabel = gameState.current_turn === 'black' ? '黑方' : gameState.current_turn === 'white' ? '白方' : gameState.current_turn;
                turnEl.textContent = `▶ ${aiTurnLabel}（AI思考中 ${Math.round(thinkDelayMs / 1000)}s）`;
            }
            await sleepMs(thinkDelayMs);
        }
        if (!(isAiVsAiMode || (isAiMode && gameState.current_turn === 'black'))) {
            aiProcessing = false;
            if (turnEl) turnEl.classList.remove('turn-ai-thinking');
            return;
        }

        // 第一步：请求 AI 计算移动
        const modeHint = isAiVsAiMode ? 'ai_vs_ai' : 'pve';
        const aiConfigBase = typeof window.getAiRequestConfig === 'function'
            ? window.getAiRequestConfig(modeHint)
            : null;
        const aiConfig = Object.assign({}, aiConfigBase || {});
        const clockCfg = typeof window.getClockConfig === 'function' ? window.getClockConfig() : null;
        const remainingMs = typeof window.getClockRemainingMs === 'function' ? Number(window.getClockRemainingMs()) : NaN;
        if (clockCfg && clockCfg.enabled && Number.isFinite(remainingMs) && remainingMs > 0) {
            const configBudget = Number(aiConfig.timeBudgetMs || 2200);
            const cappedBudget = Math.max(120, Math.floor(Math.min(configBudget, remainingMs - 80)));
            aiConfig.timeBudgetMs = Number.isFinite(cappedBudget) && cappedBudget > 0 ? cappedBudget : 120;
        }

        const moveRes = await fetch('/api/ai_move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modeHint,
                config: aiConfig
            })
        });
        const moveData = await moveRes.json();
        const pendingTimeout = typeof window.peekAiTimeoutPending === 'function'
            ? window.peekAiTimeoutPending() === turnKey
            : false;

        if (moveData.success) {
            console.log("✅ AI 移动成功:", moveData.message);
            if (window.refreshAiDebugPanel) window.refreshAiDebugPanel();

            const actionType = moveData.action_type || 'move';
            const actingContext = {
                actingTurn: gameState.current_turn,
                actingRound: gameState.round_count ?? Math.max(1, Math.ceil((gameState.turn_count || 0) / 2))
            };
            const pendingAiLogPayload = {
                reason: moveData.reason,
                aiLog: moveData.ai_log,
                actionType,
                actingContext
            };
            if (actionType === 'skill') {
                if (window.playSfx) window.playSfx('skill');
                const skillResult = moveData.skill_result && typeof moveData.skill_result === 'object'
                    ? moveData.skill_result
                    : null;
                if (skillResult && skillResult.success === true) {
                    const actorMeta = buildAiActorMeta(gameState, moveData.from);
                    const diceValue = Number.isFinite(Number(skillResult.dice)) ? Number(skillResult.dice) : null;
                    const skillEventId = diceValue === 0 ? 'skill_ultimate' : 'skill_success';
                    const aiSkillContext = {
                        piecePos: toPosPair(moveData.from),
                        targetPos: toPosPair(moveData.to),
                        actor: actorMeta,
                        target: null,
                        skillType: '',
                        cause: 'ai_skill',
                        result: diceValue === 0 ? 'ultimate' : 'success',
                        dice: diceValue,
                        log: skillResult.message || moveData.message || ''
                    };
                    triggerFx(skillEventId, aiSkillContext);
                }
                if (skillResult && Array.isArray(skillResult.nightmare_rolls) && skillResult.nightmare_rolls.length) {
                    const previousPause = typeof window.getPausePolling === 'function'
                        ? !!window.getPausePolling()
                        : false;
                    if (typeof window.setPausePolling === 'function') {
                        window.setPausePolling(true);
                    }
                    try {
                        await playNightmareRollSequence(skillResult.nightmare_rolls);
                    } catch (fxErr) {
                        console.warn('AI 夜魔热爱黑黑双骰动画播放失败:', fxErr);
                    } finally {
                        if (typeof window.setPausePolling === 'function') {
                            window.setPausePolling(previousPause);
                        }
                    }
                }
            } else if (actionType === 'upgrade') {
                triggerFx('citizen_upgrade', { cause: 'ai_upgrade', result: 'success' });
                const pos = Array.isArray(moveData.upgrade_pos) ? moveData.upgrade_pos : null;
                const upgradeTo = String(moveData.upgrade_to || '');
                const upgradeNameMap = {
                    police: '警察',
                    officer: '官员',
                    lawyer: '律师',
                    teacher: '老师',
                    doctor: '医生'
                };
                const posText = pos && Number.isInteger(pos[0]) && Number.isInteger(pos[1])
                    ? (typeof window.formatPos === 'function' ? window.formatPos(pos[0], pos[1]) : '--')
                    : '--';
                const roleText = upgradeNameMap[upgradeTo] || upgradeTo || '未知';
                if (typeof window.showStatusMessage === 'function') {
                    window.showStatusMessage(moveData.message || `AI 自动升变：${posText} -> ${roleText}`);
                }
            } else {
                if (window.playSfx) window.playSfx('move');
                if (actionType === 'move'
                    && moveData.random_move === true
                    && typeof window.showGreenWifeMoveDiceSequence === 'function') {
                    const previousPause = typeof window.getPausePolling === 'function'
                        ? !!window.getPausePolling()
                        : false;
                    if (typeof window.setPausePolling === 'function') {
                        window.setPausePolling(true);
                    }
                    try {
                        await window.showGreenWifeMoveDiceSequence(moveData);
                    } catch (fxErr) {
                        console.warn('AI 绿叶妻掷骰动画播放失败:', fxErr);
                        if (typeof window.showStatusMessage === 'function' && moveData.message) {
                            window.showStatusMessage(moveData.message);
                        }
                    } finally {
                        if (typeof window.setPausePolling === 'function') {
                            window.setPausePolling(previousPause);
                        }
                    }
                }
                if (Array.isArray(moveData.nightmare_rolls) && moveData.nightmare_rolls.length) {
                    const previousPause = typeof window.getPausePolling === 'function'
                        ? !!window.getPausePolling()
                        : false;
                    if (typeof window.setPausePolling === 'function') {
                        window.setPausePolling(true);
                    }
                    try {
                        await playNightmareRollSequence(moveData.nightmare_rolls);
                    } catch (fxErr) {
                        console.warn('AI 夜魔热爱黑黑双骰动画播放失败:', fxErr);
                    } finally {
                        if (typeof window.setPausePolling === 'function') {
                            window.setPausePolling(previousPause);
                        }
                    }
                }
            }

            // 先刷新一次，确保 AI 的实际落子/技能结果先展示在棋盘与日志中。
            if (window.fetchState) {
                try {
                    await window.fetchState(true);
                } catch (_refreshErr) { }
            }
            const aiSystemLines = buildAiSystemLogLines(moveData, actionType, pendingAiLogPayload.actingContext);
            aiSystemLines.forEach((line) => {
                if (typeof window.appendRuntimeSystemLog === 'function') {
                    window.appendRuntimeSystemLog(line);
                }
            });
            if (actionType === 'move' && Array.isArray(moveData.from) && Array.isArray(moveData.to)) {
                if (typeof window.setAiMoveHighlight === 'function') {
                    window.setAiMoveHighlight({ from: moveData.from, to: moveData.to });
                }
            }
            if (typeof window.render === 'function') {
                window.render();
            }
            // 技能结果弹窗在 fetchState→render() 之后再展示，避免被 render 内的 hideSkillResult 清除
            // 同时暂停轮询，防止 setInterval 触发 render() 在弹窗显示期间将其清除
            if (actionType === 'skill') {
                const skillResultForDisplay = moveData.skill_result && typeof moveData.skill_result === 'object'
                    ? moveData.skill_result : null;
                if (skillResultForDisplay && window.showSkillResult) {
                    window.showSkillResult(skillResultForDisplay);
                    if (typeof window.setPausePolling === 'function') {
                        skillPopupPaused = true;
                        window.setPausePolling(true);
                    }
                }
            }

            // 第二步：保留动作可视化后摇，确保能看清 AI 行为
            const settleDelay = (clockCfg && clockCfg.enabled)
                ? 700
                : (pendingTimeout ? 0 : (actionType === 'skill' ? 2200 : 1600));
            const delay = Math.max(0, settleDelay);

            setTimeout(async () => {
                try {
                    if (typeof window.setAiMoveHighlight === 'function') {
                        window.setAiMoveHighlight(null);
                    }
                    if (skillPopupPaused && typeof window.setPausePolling === 'function') {
                        skillPopupPaused = false;
                        window.setPausePolling(false);
                    }
                    if (actionType === 'skill' && window.hideSkillResult) {
                        window.hideSkillResult();
                    }
                    if (typeof window.consumeAiTimeoutPending === 'function') {
                        window.consumeAiTimeoutPending(turnKey);
                    }
                    if (typeof window.endTurnAndRefresh === 'function') {
                        const endResult = await window.endTurnAndRefresh({
                            cause: pendingTimeout ? 'ai_timeout_end_turn' : 'ai_end_turn',
                            afterFetchState: async () => {
                                if (window.appendAiLog) {
                                    window.appendAiLog(
                                        pendingAiLogPayload.reason,
                                        pendingAiLogPayload.aiLog,
                                        gameState,
                                        pendingAiLogPayload.actionType,
                                        pendingAiLogPayload.actingContext
                                    );
                                }
                            }
                        });
                        if (!endResult || !endResult.success) {
                            console.warn('⚠️ AI 结束回合失败:', endResult && endResult.message ? endResult.message : 'unknown');
                            if (window.fetchState) await window.fetchState(true);
                        }
                    }
                } catch (endErr) {
                    console.error('❌ AI 结束回合流程错误:', endErr);
                    if (window.fetchState) await window.fetchState(true);
                } finally {
                    aiProcessing = false;
                    if (turnEl) turnEl.classList.remove('turn-ai-thinking');
                }
            }, delay);

        } else {
            console.warn("⚠️ AI 无法移动 (无路可走或报错):", moveData.message);
            if (pendingTimeout && typeof window.endTurnAndRefresh === 'function') {
                try {
                    if (typeof window.consumeAiTimeoutPending === 'function') {
                        window.consumeAiTimeoutPending(turnKey);
                    }
                    await window.endTurnAndRefresh({ cause: 'ai_timeout_fallback_end_turn' });
                } catch (err) {
                    console.warn('AI 超时后换手失败:', err);
                }
            }
            aiProcessing = false;
            // 如果在观战模式下卡住，可能需要手动干预一下
            if (turnEl) turnEl.textContent = "AI 卡住";
        }

    } catch (error) {
        console.error("❌ AI API 通信错误:", error);
        if (skillPopupPaused && typeof window.setPausePolling === 'function') {
            window.setPausePolling(false);
        }
        try {
            if (typeof window.peekAiTimeoutPending === 'function'
                && window.peekAiTimeoutPending() === turnKey
                && typeof window.endTurnAndRefresh === 'function') {
                if (typeof window.consumeAiTimeoutPending === 'function') {
                    window.consumeAiTimeoutPending(turnKey);
                }
                await window.endTurnAndRefresh({ cause: 'ai_timeout_error_end_turn' });
            }
        } catch (endErr) {
            console.warn('AI 通信错误后的超时换手失败:', endErr);
        }
        aiProcessing = false;
    } finally {
        if (turnEl && !aiProcessing) {
            turnEl.classList.remove('turn-ai-thinking');
        }
    }
}

// Initial check query params for guide mode
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('guide') === '1') {
    const guideModalElement = document.getElementById('modal-rules-guide');
    if (guideModalElement) {
        guideModalElement.classList.remove('hidden');
    }
}
