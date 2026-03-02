(function (global) {
    'use strict';

    const core = global.MoleChessCore;
    if (!core) {
        console.error('MoleChessCore not found. Ensure game_core.js is loaded before local_api.js.');
        return;
    }

    const {
        Game,
        create_piece,
        CitizenManager,
        ensureUid,
        serializeGame,
        deserializeGame,
        MoleChessAI,
        n2a
    } = core;

    let game = new Game();
    let gameHistory = [];
    const SHARED_GAME_KEY = 'mole_chess_shared_game_v1';
    const SHARED_HISTORY_KEY = 'mole_chess_shared_history_v1';
    const SHARED_META_KEY = 'mole_chess_shared_meta_v1';
    const SHARED_CUE_KEY = 'mole_chess_shared_cue_v1';
    const SHARED_LOCK_KEY = 'mole_chess_shared_lock_v1';
    const SHARED_SYNC_CHANNEL = 'mole_chess_sync_v1';
    const SHARED_VERSION = 1;
    const SHARED_LOCK_TTL_MS = 1500;
    const SHARED_LOCK_WAIT_MS = 3000;
    const sharedWindowId = `win_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expoModeEnabled = (() => {
        try {
            const search = global.location && typeof global.location.search === 'string'
                ? global.location.search
                : '';
            return new URLSearchParams(search).get('expo') === '1';
        } catch (_err) {
            return false;
        }
    })();
    let sharedSyncChannel = null;
    if (expoModeEnabled && typeof global.BroadcastChannel === 'function') {
        try {
            sharedSyncChannel = new global.BroadcastChannel(SHARED_SYNC_CHANNEL);
        } catch (_err) {
            sharedSyncChannel = null;
        }
    }
    global.__MOLE_CHESS_SYNC_WINDOW_ID = sharedWindowId;
    const aiAgent = new MoleChessAI();
    const aiConfigStore = global.MoleChessAIConfigStore || null;
    const aiTelemetryStore = global.MoleChessAITelemetryStore || null;

    const AI_BUILD_INFO = Object.assign({
        engineVersion: 'v2',
        buildTimestamp: new Date().toISOString(),
        modelHash: 'sha256:placeholder-not-loaded',
        modelVersion: 'unknown',
        neuralStatus: 'unknown'
    }, global.__MOLE_CHESS_BUILD_INFO__ || {});
    global.__MOLE_CHESS_BUILD_INFO__ = AI_BUILD_INFO;

    let aiRequestSeq = 0;

    class AIWorkerClient {
        constructor() {
            this.worker = null;
            this.pending = new Map();
            this.initTried = false;
            this.ready = false;
        }

        _nextId() {
            aiRequestSeq += 1;
            return `ai_req_${Date.now()}_${aiRequestSeq}`;
        }

        _createWorker() {
            if (this.worker) return this.worker;
            if (this.initTried && !this.ready) return null;
            this.initTried = true;

            let worker = null;
            try {
                if (typeof global.__MOLE_CHESS_PORTABLE_WORKER_SOURCE__ === 'string' && global.__MOLE_CHESS_PORTABLE_WORKER_SOURCE__.length > 0) {
                    const blob = new Blob([global.__MOLE_CHESS_PORTABLE_WORKER_SOURCE__], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);
                    worker = new Worker(url);
                } else {
                    worker = new Worker('ai/worker/ai_worker.js');
                }
            } catch (err) {
                console.warn('[AIWorkerClient] Worker init failed:', err);
                this.ready = false;
                return null;
            }

            worker.onmessage = (event) => {
                const data = event && event.data ? event.data : {};
                if (data.type === 'AI_WORKER_READY') {
                    this.ready = !!(data.payload && data.payload.ok);
                    return;
                }
                if (data.type !== 'AI_DECIDE_RESULT') return;

                const payload = data.payload || {};
                const requestId = payload.requestId;
                if (!requestId || !this.pending.has(requestId)) return;

                const task = this.pending.get(requestId);
                this.pending.delete(requestId);
                task.resolve(payload);
            };

            worker.onerror = (err) => {
                console.warn('[AIWorkerClient] Worker runtime error:', err);
                this.ready = false;
            };

            this.worker = worker;
            this.ready = true;
            return worker;
        }

        decide(currentGame, config, externalRequestId = null) {
            const worker = this._createWorker();
            if (!worker) {
                return Promise.reject(new Error('AI worker unavailable'));
            }

            const requestId = externalRequestId || this._nextId();
            const serializedGame = serializeGame(currentGame);
            const timeoutMs = Math.max(800, Number(config && config.timeBudgetMs ? config.timeBudgetMs : 2200) + 1200);

            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    if (this.pending.has(requestId)) {
                        this.pending.delete(requestId);
                        reject(new Error('AI worker timeout'));
                    }
                }, timeoutMs);

                this.pending.set(requestId, {
                    resolve: (payload) => {
                        clearTimeout(timer);
                        resolve(payload);
                    },
                    reject: (err) => {
                        clearTimeout(timer);
                        reject(err);
                    }
                });

                worker.postMessage({
                    type: 'AI_DECIDE',
                    payload: { serializedGame, config, requestId }
                });
            });
        }
    }

    const aiWorkerClient = new AIWorkerClient();

    function readAiConfig(overrides = null, modeHint = null) {
        if (!aiConfigStore || typeof aiConfigStore.resolveConfig !== 'function') {
            return {
                engineVersion: 'v2',
                difficulty: modeHint === 'ai_vs_ai' ? 'expert' : 'hard',
                timeBudgetMs: modeHint === 'ai_vs_ai' ? 5000 : 2200,
                nodeBudget: modeHint === 'ai_vs_ai' ? 120000 : 40000,
                deterministicSeed: 20260220,
                enableNeuralEval: true,
                enableFallback: true
            };
        }
        return aiConfigStore.resolveConfig(overrides || {}, modeHint || null);
    }

    function detectPlatformTag() {
        if (!aiTelemetryStore || typeof aiTelemetryStore.detectPlatformTag !== 'function') {
            return 'web_unknown';
        }
        return aiTelemetryStore.detectPlatformTag();
    }

    function digestTrace(trace) {
        if (aiTelemetryStore && typeof aiTelemetryStore.digestTrace === 'function') {
            return aiTelemetryStore.digestTrace(trace);
        }
        return '';
    }

    function recordAiDecisionTelemetry(input) {
        if (!aiTelemetryStore || typeof aiTelemetryStore.recordDecision !== 'function') return null;
        return aiTelemetryStore.recordDecision(input);
    }

    function normalizeAiDiagnostics(payload, config) {
        const src = (payload && typeof payload === 'object') ? payload : {};
        const diag = (src.diagnostics && typeof src.diagnostics === 'object') ? src.diagnostics : {};
        const ttProbeCount = Number(src.ttProbeCount ?? diag.ttProbeCount ?? 0);
        const ttHitCount = Number(src.ttHitCount ?? diag.ttHitCount ?? 0);
        const fallbackRate = ttProbeCount > 0 ? ttHitCount / ttProbeCount : 0;
        const rootPv = Array.isArray(diag.pv) ? diag.pv.slice(0, 8) : [];
        return {
            searched_nodes: Number(src.nodeCount ?? diag.searchedNodes ?? 0),
            quiescence_nodes: Number(src.qNodeCount ?? diag.quiescenceNodes ?? 0),
            chance_nodes: Number(src.chanceNodeCount ?? diag.chanceNodes ?? 0),
            max_depth_reached: Number(src.maxDepthReached ?? diag.maxDepthReached ?? 0),
            root_action_count: Number(diag.rootActionCount ?? 0),
            root_branch_factor: Number(diag.rootBranchFactor ?? 0),
            tt_probe_count: ttProbeCount,
            tt_hit_count: ttHitCount,
            tt_hit_rate: Number(src.ttHitRate ?? diag.ttHitRate ?? fallbackRate),
            pv: rootPv,
            precompute_opening_hits: Number((diag.precompute && diag.precompute.openingHits) || 0),
            precompute_endgame_hits: Number((diag.precompute && diag.precompute.endgameHits) || 0),
            model_hash: src.modelHash || (diag.model && diag.model.hash) || AI_BUILD_INFO.modelHash || 'none',
            model_version: src.modelVersion || (diag.model && diag.model.version) || 'unknown',
            neural_status: src.neuralStatus || (diag.model && diag.model.status) || (config && config.enableNeuralEval ? 'heuristic' : 'disabled')
        };
    }

    function normalizeAiMovePayload(data) {
        const payload = (data && typeof data === 'object') ? data : {};
        const modeHint = payload.modeHint === 'ai_vs_ai'
            ? 'ai_vs_ai'
            : (payload.modeHint === 'pve' ? 'pve' : null);
        const configOverrides = (payload.config && typeof payload.config === 'object') ? payload.config : {};
        return {
            modeHint,
            config: readAiConfig(configOverrides, modeHint)
        };
    }

    function getGame() {
        return game;
    }

    function saveState() {
        if (game) {
            gameHistory.push(serializeGame(game));
        }
    }

    function restoreState(payload) {
        game = deserializeGame(payload);
    }

    function sleep(ms) {
        const waitMs = Math.max(0, Number(ms) || 0);
        return new Promise(resolve => setTimeout(resolve, waitMs));
    }

    function safeJsonParse(raw, fallback) {
        if (typeof raw !== 'string' || !raw.length) return fallback;
        try {
            return JSON.parse(raw);
        } catch (_err) {
            return fallback;
        }
    }

    function readSharedItem(key, fallback = null) {
        if (!expoModeEnabled || !global.localStorage) return fallback;
        try {
            const raw = global.localStorage.getItem(key);
            return safeJsonParse(raw, fallback);
        } catch (_err) {
            return fallback;
        }
    }

    function writeSharedItem(key, value) {
        if (!expoModeEnabled || !global.localStorage) return;
        try {
            global.localStorage.setItem(key, JSON.stringify(value));
        } catch (_err) {
            // Ignore persistence failure in non-persistent environments.
        }
    }

    function writeSharedMeta(extra = {}) {
        writeSharedItem(SHARED_META_KEY, Object.assign({
            version: SHARED_VERSION,
            updatedAt: Date.now(),
            writerId: sharedWindowId
        }, extra || {}));
    }

    function persistSharedState(reason = '') {
        if (!expoModeEnabled) return;
        writeSharedItem(SHARED_GAME_KEY, serializeGame(game));
        writeSharedItem(SHARED_HISTORY_KEY, Array.isArray(gameHistory) ? gameHistory : []);
        writeSharedMeta({ reason: reason || '' });
    }

    function hydrateSharedState() {
        if (!expoModeEnabled) return;
        const serializedGame = readSharedItem(SHARED_GAME_KEY, null);
        const serializedHistory = readSharedItem(SHARED_HISTORY_KEY, null);
        if (serializedGame) {
            try {
                game = deserializeGame(serializedGame);
            } catch (_err) {
                game = new Game();
                gameHistory = [];
                persistSharedState('recover_invalid_snapshot');
                return;
            }
            gameHistory = Array.isArray(serializedHistory) ? serializedHistory : [];
            return;
        }
        game = new Game();
        gameHistory = [];
        persistSharedState('seed_new_snapshot');
    }

    function buildTurnKeySnapshot(currentGame) {
        const gameRef = currentGame || getGame();
        return `${Number(gameRef && gameRef.turn_count || 0)}:${String(gameRef && gameRef.current_turn || '')}`;
    }

    function buildAnimationCue(pathname, output) {
        if (!output || output.success === false) return null;
        const cueBase = {
            cueId: `${sharedWindowId}:${Date.now()}:${Math.floor(Math.random() * 100000)}`,
            pathname: String(pathname || ''),
            turnKey: buildTurnKeySnapshot(getGame())
        };

        if ((pathname === '/api/start_first_turn' || pathname === '/api/end_turn') && output.start_info) {
            const hasDeathGodDice = output.start_info.death_god_dice !== undefined
                && output.start_info.death_god_dice !== null;
            const nightmareRolls = Array.isArray(output.start_info.nightmare_rolls)
                ? output.start_info.nightmare_rolls
                    .map((item) => {
                        if (!item || typeof item !== 'object') return null;
                        const dice = Number(item.dice);
                        return {
                            source: String(item.source || 'auto'),
                            dice: Number.isFinite(dice) ? dice : null,
                            tens: Number.isFinite(Number(item.tens)) ? Number(item.tens) : null,
                            ones: Number.isFinite(Number(item.ones)) ? Number(item.ones) : null,
                            state: String(item.state || ''),
                            detail: String(item.detail || ''),
                            modeText: String(item.mode_text || ''),
                            firstTransform: !!item.first_transform,
                            triggerGlitch: !!item.trigger_glitch
                        };
                    })
                    .filter(Boolean)
                : [];
            if (hasDeathGodDice || nightmareRolls.length) {
                return Object.assign({}, cueBase, {
                    cueType: 'start_turn_fx',
                    deathGodDice: hasDeathGodDice ? output.start_info.death_god_dice : null,
                    deathGodMessage: output.start_info.death_god_message || '',
                    deathGodMoved: !!output.start_info.death_god_moved,
                    nightmareRolls
                });
            }
        }

        if (pathname === '/api/skill') {
            const nightmareRolls = Array.isArray(output.nightmare_rolls)
                ? output.nightmare_rolls
                    .map((item) => {
                        if (!item || typeof item !== 'object') return null;
                        const dice = Number(item.dice);
                        return {
                            source: String(item.source || 'auto'),
                            dice: Number.isFinite(dice) ? dice : null,
                            tens: Number.isFinite(Number(item.tens)) ? Number(item.tens) : null,
                            ones: Number.isFinite(Number(item.ones)) ? Number(item.ones) : null,
                            state: String(item.state || ''),
                            detail: String(item.detail || ''),
                            modeText: String(item.mode_text || ''),
                            firstTransform: !!item.first_transform,
                            triggerGlitch: !!item.trigger_glitch
                        };
                    })
                    .filter(Boolean)
                : [];
            if (output.direction_dice !== undefined && output.direction_dice !== null && output.success) {
                return Object.assign({}, cueBase, {
                    cueType: 'direction_dice',
                    directionDice: output.direction_dice,
                    message: output.message || '',
                    nightmareRolls
                });
            }
            if (output.dice !== undefined && output.dice !== null) {
                return Object.assign({}, cueBase, {
                    cueType: 'skill_result_dice',
                    success: !!output.success,
                    dice: output.dice,
                    message: output.message || '',
                    nightmareRolls
                });
            }
            if (nightmareRolls.length) {
                return Object.assign({}, cueBase, {
                    cueType: 'nightmare_roll_sequence',
                    nightmareRolls
                });
            }
        }

        if (pathname === '/api/move') {
            const nightmareRolls = Array.isArray(output.nightmare_rolls)
                ? output.nightmare_rolls
                    .map((item) => {
                        if (!item || typeof item !== 'object') return null;
                        const dice = Number(item.dice);
                        return {
                            source: String(item.source || 'auto'),
                            dice: Number.isFinite(dice) ? dice : null,
                            tens: Number.isFinite(Number(item.tens)) ? Number(item.tens) : null,
                            ones: Number.isFinite(Number(item.ones)) ? Number(item.ones) : null,
                            state: String(item.state || ''),
                            detail: String(item.detail || ''),
                            modeText: String(item.mode_text || ''),
                            firstTransform: !!item.first_transform,
                            triggerGlitch: !!item.trigger_glitch
                        };
                    })
                    .filter(Boolean)
                : [];
            if (output.random_move === true || nightmareRolls.length) {
                return Object.assign({}, cueBase, {
                    cueType: 'move_fx',
                    randomMove: !!output.random_move,
                    directionDice: output.direction_dice,
                    stepsDice: output.steps_dice,
                    directionRolls: Array.isArray(output.direction_rolls) ? output.direction_rolls.slice() : [],
                    releasedPossession: !!output.released_possession,
                    message: output.message || '',
                    nightmareRolls
                });
            }
        }

        if (pathname === '/api/ai_move' && output.action_type === 'move') {
            const nightmareRolls = Array.isArray(output.nightmare_rolls)
                ? output.nightmare_rolls
                    .map((item) => {
                        if (!item || typeof item !== 'object') return null;
                        const dice = Number(item.dice);
                        return {
                            source: String(item.source || 'auto'),
                            dice: Number.isFinite(dice) ? dice : null,
                            tens: Number.isFinite(Number(item.tens)) ? Number(item.tens) : null,
                            ones: Number.isFinite(Number(item.ones)) ? Number(item.ones) : null,
                            state: String(item.state || ''),
                            detail: String(item.detail || ''),
                            modeText: String(item.mode_text || ''),
                            firstTransform: !!item.first_transform,
                            triggerGlitch: !!item.trigger_glitch
                        };
                    })
                    .filter(Boolean)
                : [];
            if (output.random_move === true || nightmareRolls.length) {
                return Object.assign({}, cueBase, {
                    cueType: 'move_fx',
                    randomMove: !!output.random_move,
                    directionDice: output.direction_dice,
                    stepsDice: output.steps_dice,
                    directionRolls: Array.isArray(output.direction_rolls) ? output.direction_rolls.slice() : [],
                    releasedPossession: !!output.released_possession,
                    message: output.message || '',
                    nightmareRolls
                });
            }
        }

        if (pathname === '/api/ai_move' && output.action_type === 'skill') {
            const skillResult = output.skill_result && typeof output.skill_result === 'object'
                ? output.skill_result
                : null;
            if (skillResult) {
                const nightmareRolls = Array.isArray(skillResult.nightmare_rolls)
                    ? skillResult.nightmare_rolls
                        .map((item) => {
                            if (!item || typeof item !== 'object') return null;
                            const dice = Number(item.dice);
                            return {
                                source: String(item.source || 'auto'),
                                dice: Number.isFinite(dice) ? dice : null,
                                tens: Number.isFinite(Number(item.tens)) ? Number(item.tens) : null,
                                ones: Number.isFinite(Number(item.ones)) ? Number(item.ones) : null,
                                state: String(item.state || ''),
                                detail: String(item.detail || ''),
                                modeText: String(item.mode_text || ''),
                                firstTransform: !!item.first_transform,
                                triggerGlitch: !!item.trigger_glitch
                            };
                        })
                        .filter(Boolean)
                    : [];
                if (skillResult.direction_dice !== undefined && skillResult.direction_dice !== null && skillResult.success) {
                    return Object.assign({}, cueBase, {
                        cueType: 'direction_dice',
                        directionDice: skillResult.direction_dice,
                        message: skillResult.message || output.message || '',
                        nightmareRolls
                    });
                }
                if (skillResult.dice !== undefined && skillResult.dice !== null) {
                    return Object.assign({}, cueBase, {
                        cueType: 'skill_result_dice',
                        success: !!skillResult.success,
                        dice: skillResult.dice,
                        message: skillResult.message || output.message || '',
                        nightmareRolls
                    });
                }
                if (nightmareRolls.length) {
                    return Object.assign({}, cueBase, {
                        cueType: 'nightmare_roll_sequence',
                        nightmareRolls
                    });
                }
            }
        }

        if (pathname === '/api/roll_initiative'
            && output.black_roll !== undefined
            && output.white_roll !== undefined) {
            return Object.assign({}, cueBase, {
                cueType: 'initiative_roll',
                blackRoll: output.black_roll,
                whiteRoll: output.white_roll,
                winner: output.winner || ''
            });
        }
        return null;
    }

    function emitSharedStateUpdated(reason, pathname, animationCue = null) {
        if (!expoModeEnabled) return;
        const payload = {
            version: SHARED_VERSION,
            reason: reason || '',
            pathname: pathname || '',
            writerId: sharedWindowId,
            updatedAt: Date.now(),
            animationCue: animationCue || null
        };
        if (animationCue) {
            writeSharedItem(SHARED_CUE_KEY, payload);
        }
        if (sharedSyncChannel && typeof sharedSyncChannel.postMessage === 'function') {
            try {
                sharedSyncChannel.postMessage(payload);
            } catch (_err) {
                // Ignore channel errors.
            }
        }
        if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
            try {
                global.dispatchEvent(new global.CustomEvent('mole:shared-state-updated', { detail: payload }));
            } catch (_err) {
                // Ignore dispatch errors.
            }
        }
    }

    function tryAcquireFallbackLock(nowTs) {
        if (!expoModeEnabled || !global.localStorage) return true;
        const now = Number(nowTs) || Date.now();
        const current = readSharedItem(SHARED_LOCK_KEY, null);
        const currentOwner = current && typeof current.owner === 'string' ? current.owner : '';
        const expiresAt = current && Number(current.expiresAt);
        if (currentOwner && Number.isFinite(expiresAt) && expiresAt > now && currentOwner !== sharedWindowId) {
            return false;
        }
        const lockData = {
            owner: sharedWindowId,
            createdAt: now,
            expiresAt: now + SHARED_LOCK_TTL_MS
        };
        writeSharedItem(SHARED_LOCK_KEY, lockData);
        const verify = readSharedItem(SHARED_LOCK_KEY, null);
        return !!(verify && verify.owner === sharedWindowId);
    }

    function releaseFallbackLock() {
        if (!expoModeEnabled || !global.localStorage) return;
        const current = readSharedItem(SHARED_LOCK_KEY, null);
        if (!current || current.owner !== sharedWindowId) return;
        try {
            global.localStorage.removeItem(SHARED_LOCK_KEY);
        } catch (_err) {
            // Ignore lock release failure.
        }
    }

    async function withFallbackStorageLock(task) {
        const startedAt = Date.now();
        while (!tryAcquireFallbackLock(Date.now())) {
            if (Date.now() - startedAt > SHARED_LOCK_WAIT_MS) {
                break;
            }
            await sleep(40);
        }
        try {
            return await task();
        } finally {
            releaseFallbackLock();
        }
    }

    async function withSharedMutationLock(task) {
        if (!expoModeEnabled) {
            return task();
        }
        if (global.navigator && global.navigator.locks && typeof global.navigator.locks.request === 'function') {
            return global.navigator.locks.request('mole_chess_shared_lock', async () => task());
        }
        return withFallbackStorageLock(task);
    }

    if (expoModeEnabled) {
        hydrateSharedState();
    }

    function isTeamSuppressedByPiper(board, team) {
        if (!board || (team !== 'black' && team !== 'white')) return false;
        const rows = team === 'black' ? [0, 1] : [10, 11];
        for (const r of rows) {
            for (let c = 0; c < board.size; c += 1) {
                const cell = board.get_cell(r, c) || [];
                if (cell.some(piece => piece && piece.name === '魔笛手' && piece.state === 'alive')) {
                    return true;
                }
            }
        }
        return false;
    }

    function pieceToDict(piece, gameInstance = null) {
        if (!piece) return null;
        const pDict = {
            name: piece.name,
            symbol: piece.symbol,
            team: piece.team,
            position: Array.isArray(piece.position) ? piece.position.slice() : piece.position,
            state: piece.state,
            id: ensureUid(piece)
        };

        if ('is_nightmare' in piece) {
            pDict.is_nightmare = !!piece.is_nightmare;
            pDict.is_night = !!piece.is_night;
            if ('nightmare_duration' in piece) {
                pDict.nightmare_duration = piece.nightmare_duration;
            } else if ('night_duration' in piece) {
                pDict.nightmare_duration = piece.night_duration;
            }
        }

        if ('is_possessed' in piece) {
            pDict.is_possessed = !!piece.is_possessed;
            pDict.is_green_wife = !!piece.is_green_wife;
        }

        if ('learned_red_song' in piece) {
            pDict.learned_red_song = !!piece.learned_red_song;
            pDict.is_red_child = !!piece.is_red_child;
            pDict.red_song_bonus = piece.red_song_bonus || 0;
            pDict.red_song_success_count = piece.red_song_success_count || 0;
            pDict.red_song_suppressed = !!(gameInstance && isTeamSuppressedByPiper(gameInstance.board, piece.team));
        }

        if ('can_upgrade' in piece) {
            pDict.can_upgrade = !!piece.can_upgrade;
        }

        if (gameInstance && piece.name === '市民' && Array.isArray(piece.position)) {
            const [x, y] = piece.position;
            const cell = gameInstance.board.get_cell(x, y) || [];
            const hasWife = cell.some(p => p && p.is_green_wife && p.host_citizen === piece);
            pDict.is_possessed_by_green_wife = hasWife;
            if (hasWife) {
                pDict.stack_role = 'green_wife_host';
            }
        }

        if (piece.is_green_wife) {
            pDict.stack_role = 'green_wife_top';
        }

        if ('original_name' in piece) {
            pDict.original_name = piece.original_name;
            pDict.original_team = piece.original_team || null;
            const originalPiece = piece.original_piece;
            if (originalPiece && originalPiece.symbol) {
                pDict.original_symbol = originalPiece.symbol;
            }
        } else if (piece.state === 'ghost') {
            pDict.original_name = piece.name;
            pDict.original_team = piece.team;
            pDict.original_symbol = piece.symbol;
        }

        if ('is_frozen' in piece) {
            pDict.is_frozen = !!piece.is_frozen;
        }

        pDict.is_saved = !!piece.is_saved;
        pDict.save_duration = piece.save_duration || 0;
        pDict.just_saved = !!piece.just_saved;
        pDict.is_arrested = !!piece.is_arrested;
        pDict.arrest_duration = piece.arrest_duration || 0;

        if (gameInstance && typeof gameInstance.get_piece_skill_cooldowns === 'function') {
            const skillCooldowns = gameInstance.get_piece_skill_cooldowns(piece);
            pDict.skill_cooldowns = skillCooldowns;
            const skillMap = {
                孩子: ['learn'],
                妻子: ['possess'],
                夜魔: ['crush'],
                警察: ['arrest'],
                医生: ['resurrect'],
                官员: ['swap', 'summon'],
                律师: ['swap'],
                僧侣: ['save'],
                广场舞大妈: ['vortex'],
                鼹鼠: ['tunnel', 'destroy'],
                魔笛手: ['destiny']
            };
            const skills = skillMap[piece.name] || [];
            const passiveOnlyPieces = new Set(['市民', '老师', '死神', '叶某', '绿叶妻', '红叶儿']);
            if (!skills.length) {
                pDict.can_use_skills = !passiveOnlyPieces.has(piece.name);
            } else {
                pDict.can_use_skills = skills.some(skill => !(skillCooldowns[skill] > 0));
            }
            if (piece.is_saved || piece.state === 'monk_forever') {
                pDict.can_use_skills = false;
            }
            if (piece.name === '夜魔' && !piece.permanent_night && !piece.is_night) {
                pDict.can_use_skills = false;
            }
            if (piece.name === '孩子' && gameInstance && isTeamSuppressedByPiper(gameInstance.board, piece.team)) {
                pDict.can_use_skills = false;
            }
        }

        return pDict;
    }

    function boardToList(board, gameInstance = null) {
        const gridData = [];
        for (let r = 0; r < board.size; r++) {
            const rowData = [];
            for (let c = 0; c < board.size; c++) {
                const cell = board.get_cell(r, c);
                const cellData = cell.map(piece => pieceToDict(piece, gameInstance));
                rowData.push(cellData);
            }
            gridData.push(rowData);
        }
        return gridData;
    }

    function gameToDict(gameInstance) {
        const detainedPieces = [];
        for (let r = 0; r < gameInstance.board.size; r++) {
            for (let c = 0; c < gameInstance.board.size; c++) {
                const cell = gameInstance.board.get_cell(r, c);
                for (const piece of cell) {
                    if (piece.name === '警察' && piece.arrested_piece) {
                        const arrested = piece.arrested_piece;
                        detainedPieces.push({
                            name: arrested.name,
                            symbol: arrested.symbol,
                            team: arrested.team,
                            duration: arrested.arrest_duration || 0,
                            original_pos: Array.isArray(arrested.arrest_release_pos)
                                ? arrested.arrest_release_pos.slice()
                                : Array.isArray(arrested.initial_position)
                                    ? arrested.initial_position.slice()
                                : (arrested.position || [0, 0]),
                            police_pos: [r, c]
                        });
                    }
                }
            }
        }

        return {
            turn_count: gameInstance.turn_count,
            round_count: gameInstance.get_round_count ? gameInstance.get_round_count() : Math.max(1, Math.ceil((gameInstance.turn_count || 0) / 2)),
            current_turn: gameInstance.current_turn,
            phase: gameInstance.phase,
            death_god_zero_count: gameInstance.death_god_zero_count,
            game_over: gameInstance.game_over,
            winner: gameInstance.winner,
            win_reason: gameInstance.win_reason,
            action_status: gameInstance.get_action_status ? gameInstance.get_action_status() : '',
            sandbox_mode: !!gameInstance.sandbox_mode,
            board: boardToList(gameInstance.board, gameInstance),
            ghost_pool: (gameInstance.board.ghost_pool || []).map(piece => pieceToDict(piece, gameInstance)),
            detained_pieces: detainedPieces,
            log_history: Array.isArray(gameInstance.log_history) ? gameInstance.log_history : []
        };
    }

    function respond(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    function parseBody(body, contentType) {
        if (!body) return null;
        if (typeof body === 'string') {
            try {
                return JSON.parse(body);
            } catch (err) {
                return body;
            }
        }
        if (body instanceof FormData) {
            return body;
        }
        if (contentType && contentType.includes('application/json')) {
            try {
                return JSON.parse(body);
            } catch (err) {
                return null;
            }
        }
        return body;
    }

    function apiState() {
        const current = getGame();
        if (current && typeof current.reconcileGreenWifeComposite === 'function') {
            current.reconcileGreenWifeComposite();
        }
        return gameToDict(current);
    }

    function apiReset() {
        game = new Game();
        gameHistory = [];
        return { success: true, message: '游戏已重置' };
    }

    function apiRollInitiative() {
        const current = getGame();
        const result = current.roll_initiative();
        return {
            success: true,
            black_roll: result[0],
            white_roll: result[1],
            winner: result[2]
        };
    }

    // 新API：在先手确定、棋盘渲染完毕后，触发第一回合（死神移动等）
    function apiStartFirstTurn() {
        const current = getGame();
        const startInfo = current.start_turn();
        return {
            success: true,
            start_info: startInfo
        };
    }

    function apiValidMoves(data) {
        const current = getGame();
        const piecePos = data && data.piece_pos;
        const pieceId = data && data.piece_id;
        if (!piecePos) return { success: false, message: '缺少棋子位置' };
        const [x, y] = piecePos;
        const cell = current.board.get_cell(x, y);
        if (!cell || cell.length === 0) {
            return { success: false, message: '起点没有棋子' };
        }
        const piece = current._getPieceFromCell(cell, pieceId);
        if (!piece) {
            return { success: false, message: '未找到指定棋子' };
        }
        if (piece.name === '市民' && typeof current._findAttachedGreenWife === 'function' && current._findAttachedGreenWife(piece)) {
            return { success: true, valid_moves: [] };
        }
        if (piece.is_saved || piece.state === 'monk_forever') {
            return { success: true, valid_moves: [] };
        }
        const validMoves = piece.get_valid_moves(current.board);
        return { success: true, valid_moves: validMoves };
    }

    function apiMove(data) {
        const current = getGame();
        if (current.game_over) return { success: false, message: '游戏已结束' };

        const fromPos = data && data.from_pos;
        const toPos = data && data.to_pos;
        const pieceId = data && data.piece_id;
        if (!fromPos || !toPos) return { success: false, message: '缺少移动位置' };

        saveState();
        const result = current.applyMove(fromPos, toPos, pieceId);
        if (!result.success) {
            gameHistory.pop();
        }
        return result;
    }

    function apiEndTurn() {
        const current = getGame();
        if (current.game_over) return { success: false, message: '游戏已结束' };
        saveState();
        const endInfo = current.end_turn();
        const startInfo = endInfo.game_over ? null : current.start_turn();
        return { success: true, end_info: endInfo, start_info: startInfo };
    }

    function apiSurrender(data) {
        const current = getGame();
        const team = data && data.team;
        if (team !== 'black' && team !== 'white') {
            return { success: false, message: '无效阵营' };
        }
        saveState();
        return current.surrender(team);
    }

    function apiUndo() {
        if (!gameHistory.length) {
            return { success: false, message: '没有可撤销的历史' };
        }
        const prev = gameHistory.pop();
        restoreState(prev);
        return { success: true, message: '已撤销上一步' };
    }

    function apiUpgrade(data) {
        const current = getGame();
        const piecePos = data && data.piece_pos;
        const pieceId = data && data.piece_id;
        const upgradeTo = data && data.upgrade_to;
        const validUpgrades = ['police', 'officer', 'lawyer', 'teacher', 'doctor'];
        if (!validUpgrades.includes(upgradeTo)) {
            return { success: false, message: `无效的升变目标: ${upgradeTo}` };
        }
        if (!piecePos) return { success: false, message: '缺少升变位置' };

        const [x, y] = piecePos;
        const cell = current.board.get_cell(x, y);
        if (!cell || cell.length === 0) return { success: false, message: '该位置没有棋子' };

        const piece = current._getPieceFromCell(cell, pieceId);
        if (!piece) return { success: false, message: '未找到指定棋子' };
        if (piece.name !== '市民') return { success: false, message: '只有市民可以升变' };
        if (typeof piece.check_upgrade_condition === 'function') {
            piece.check_upgrade_condition(current.board);
        }
        if (!piece.can_upgrade) return { success: false, message: '该市民不满足升变条件' };

        saveState();
        const team = piece.team;
        const newPiece = create_piece(upgradeTo, team, [x, y]);
        current.board.remove_piece(piece, x, y);
        current.board.add_piece(newPiece, x, y);

        const upgradeNames = {
            police: '警察',
            officer: '官员',
            lawyer: '律师',
            teacher: '老师',
            doctor: '医生'
        };
        const msg = `市民升变为${upgradeNames[upgradeTo] || upgradeTo}!`;
        current.log_event(msg);
        return { success: true, message: msg };
    }

    function apiSkill(data) {
        const current = getGame();
        if (current.game_over) return { success: false, message: '游戏已结束', action_consumed: false };

        const piecePos = data && data.piece_pos;
        const pieceId = data && data.piece_id;
        if (!piecePos) return { success: false, message: '缺少棋子位置', action_consumed: false };

        const [x, y] = piecePos;
        const cell = current.board.get_cell(x, y);
        if (!cell || cell.length === 0) return { success: false, message: '起点没有棋子', action_consumed: false };

        const piece = current._getPieceFromCell(cell, pieceId);
        if (!piece) return { success: false, message: '未找到指定棋子', action_consumed: false };
        const targetPos = data ? data.target_pos : null;
        const targetType = (Array.isArray(targetPos) && typeof targetPos[0] === 'string') ? targetPos[0] : null;
        const allowTunnelPathFollowup = piece.name === '鼹鼠'
            && targetType === 'tunnel_path'
            && !!piece.pending_tunnel_roll;
        const allowTunnelCommitFollowup = piece.name === '鼹鼠'
            && targetType === 'tunnel_commit'
            && !!piece.pending_tunnel;
        if (!current.can_move_piece() && !allowTunnelPathFollowup && !allowTunnelCommitFollowup) {
            return { success: false, message: '本回合已行动', action_consumed: false };
        }

        saveState();
        const beforeAction = current.action_taken;
        const result = current.use_skill(piece, targetPos);
        const afterAction = current.action_taken;
        const actionConsumed = beforeAction === null && afterAction !== null;
        const isTunnelCommit = targetPos && Array.isArray(targetPos) && targetPos[0] === 'tunnel_commit';
        const shouldRollbackHistory = ((result && result.need_tunnel_endpoint) && !actionConsumed)
            || (isTunnelCommit && !result.success)
            || (result && result.success === false && !actionConsumed);
        if (shouldRollbackHistory) {
            gameHistory.pop();
        }
        if (result && typeof result === 'object') {
            return Object.assign({}, result, { action_consumed: actionConsumed });
        }
        return { success: false, message: '技能执行结果异常', action_consumed: actionConsumed };
    }

    function apiSandboxToggle(data) {
        const current = getGame();
        const enabled = !!(data && data.enabled);
        if (!!current.sandbox_mode === enabled) {
            return {
                success: true,
                message: enabled ? '沙盒模式已开启' : '沙盒模式已关闭',
                sandbox_mode: !!current.sandbox_mode
            };
        }

        saveState();
        current.toggle_sandbox(enabled);
        return {
            success: true,
            message: enabled ? '沙盒模式已开启' : '沙盒模式已关闭',
            sandbox_mode: !!current.sandbox_mode
        };
    }

    function apiSandboxRelocate(data) {
        const current = getGame();
        if (current.game_over) return { success: false, message: '游戏已结束' };

        const fromPos = data && data.from_pos;
        const toPos = data && data.to_pos;
        const pieceId = data && data.piece_id;
        if (!fromPos || !toPos) return { success: false, message: '缺少移动位置' };

        saveState();
        const result = current.sandbox_relocate(fromPos, toPos, pieceId);
        if (!result.success) {
            gameHistory.pop();
        }
        return result;
    }

    function apiSandboxCapture(data) {
        const current = getGame();
        if (current.game_over) return { success: false, message: '游戏已结束' };

        const fromPos = data && data.from_pos;
        const toPos = data && data.to_pos;
        const pieceId = data && data.piece_id;
        if (!fromPos || !toPos) return { success: false, message: '缺少吃子位置' };

        saveState();
        const result = current.sandbox_capture(fromPos, toPos, pieceId);
        if (!result.success) {
            gameHistory.pop();
        }
        return result;
    }

    function apiStoryLoadSnapshot(data) {
        const snapshot = data && data.snapshot;
        const preserveLog = !!(data && data.preserveLog);
        if (!snapshot || typeof snapshot !== 'object') {
            return { success: false, message: '缺少有效 snapshot' };
        }
        const prev = getGame();
        const prevLogs = preserveLog && prev && Array.isArray(prev.log_history) ? prev.log_history.slice() : [];
        saveState();
        try {
            const loaded = deserializeGame(snapshot);
            if (preserveLog && prevLogs.length) {
                const nextLogs = Array.isArray(loaded.log_history) ? loaded.log_history : [];
                loaded.log_history = prevLogs.concat(nextLogs).slice(-600);
            }
            game = loaded;
            if (game && typeof game.reconcileGreenWifeComposite === 'function') {
                game.reconcileGreenWifeComposite();
            }
            return {
                success: true,
                message: '故事快照已加载',
                state: gameToDict(game)
            };
        } catch (err) {
            gameHistory.pop();
            return { success: false, message: `快照加载失败: ${err.message}` };
        }
    }

    function apiStoryExportSnapshot() {
        const current = getGame();
        return {
            success: true,
            snapshot: serializeGame(current)
        };
    }

    function apiStoryResetRuntime() {
        saveState();
        game = new Game();
        return {
            success: true,
            message: '故事运行时已重置',
            state: gameToDict(game)
        };
    }

    function listUpgradeableCitizens(current) {
        const out = [];
        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 12; c++) {
                const cell = current.board.get_cell(r, c);
                if (!cell || cell.length === 0) continue;
                for (const piece of cell) {
                    if (!piece || piece.state !== 'alive') continue;
                    if (piece.team !== current.current_turn) continue;
                    if (piece.name === '市民' && typeof piece.check_upgrade_condition === 'function') {
                        piece.check_upgrade_condition(current.board);
                    }
                    if (piece.name === '市民' && piece.can_upgrade) {
                        out.push({ piece, pos: [r, c] });
                    }
                }
            }
        }
        return out;
    }

    function chooseBestForcedUpgrade(current) {
        const upgradeable = listUpgradeableCitizens(current);
        if (!upgradeable.length) return null;

        const upgradeOrder = ['police', 'officer', 'lawyer', 'teacher', 'doctor'];
        let best = null;

        for (const item of upgradeable) {
            const [r, c] = item.pos;
            const uid = ensureUid(item.piece);
            for (const upgradeTo of upgradeOrder) {
                const sim = current.clone();
                const simPiece = typeof sim._findPieceByUid === 'function'
                    ? sim._findPieceByUid(uid)
                    : null;
                if (!simPiece || simPiece.name !== '市民' || !simPiece.can_upgrade) continue;
                const simRes = CitizenManager.citizen_upgrade(sim.board, simPiece, upgradeTo);
                if (!simRes[0]) continue;
                const score = sim.evaluateBoard(current.current_turn);
                const candidate = {
                    uid,
                    pos: [r, c],
                    upgradeTo,
                    score,
                    order: upgradeOrder.indexOf(upgradeTo)
                };
                if (!best || candidate.score > best.score) {
                    best = candidate;
                    continue;
                }
                if (candidate.score !== best.score) continue;
                if (candidate.pos[0] < best.pos[0]) {
                    best = candidate;
                    continue;
                }
                if (candidate.pos[0] > best.pos[0]) continue;
                if (candidate.pos[1] < best.pos[1]) {
                    best = candidate;
                    continue;
                }
                if (candidate.pos[1] > best.pos[1]) continue;
                if (candidate.order < best.order) {
                    best = candidate;
                }
            }
        }
        return best;
    }

    function runForcedAiUpgrade(current) {
        const best = chooseBestForcedUpgrade(current);
        if (!best) return null;

        const targetPiece = typeof current._findPieceByUid === 'function'
            ? current._findPieceByUid(best.uid)
            : null;
        if (!targetPiece || targetPiece.name !== '市民' || !targetPiece.can_upgrade) {
            return null;
        }

        saveState();
        const upgradeRes = CitizenManager.citizen_upgrade(current.board, targetPiece, best.upgradeTo);
        if (!upgradeRes[0]) {
            gameHistory.pop();
            return null;
        }
        const teamLabel = current.current_turn === 'black' ? '黑方' : '白方';
        const posText = n2a(best.pos[0], best.pos[1]);
        const upgradeNameMap = {
            police: '警察',
            officer: '官员',
            lawyer: '律师',
            teacher: '老师',
            doctor: '医生'
        };
        const targetName = upgradeNameMap[best.upgradeTo] || best.upgradeTo;
        const detailMsg = `${teamLabel}AI自动升变：${posText} 市民 -> ${targetName}`;
        current.log_event(`${upgradeRes[1]} | ${detailMsg}`);
        return {
            success: true,
            message: detailMsg,
            action_type: 'upgrade',
            from: null,
            to: null,
            upgrade_pos: best.pos,
            upgrade_to: best.upgradeTo,
            expected_score: best.score,
            reason: '存在可升变市民，后端自动选择最优升变并直接执行',
            ai_log: [
                `forced_upgrade team=${current.current_turn} pos=${posText} -> ${best.upgradeTo} score=${best.score.toFixed(1)}`,
                detailMsg
            ],
            skill_result: null
        };
    }

    function hashString(value) {
        const text = String(value || '');
        let h = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function buildDeterministicRequestId(current, config) {
        const snapshot = serializeGame(current);
        const gameStateText = JSON.stringify({
            turn: snapshot && snapshot.game ? snapshot.game.turn_count : 0,
            current_turn: snapshot && snapshot.game ? snapshot.game.current_turn : 'none',
            action_taken: snapshot && snapshot.game ? snapshot.game.action_taken : null,
            death_zero: snapshot && snapshot.game ? snapshot.game.death_god_zero_count : 0,
            board_grid: snapshot && snapshot.board ? snapshot.board.grid : []
        });
        const seed = config && Number.isFinite(Number(config.deterministicSeed))
            ? Number(config.deterministicSeed)
            : 20260220;
        const hash = hashString(`${seed}|${gameStateText}`);
        return `api_ai_${current.turn_count || 0}_${current.current_turn || 'none'}_${hash.toString(16)}`;
    }

    function actionSignature(action) {
        if (!action) return '';
        const parts = [action.type || 'unknown'];
        if (action.pieceName) parts.push(action.pieceName);
        if (Array.isArray(action.from)) parts.push(`f${action.from.join('_')}`);
        if (Array.isArray(action.to)) parts.push(`t${action.to.join('_')}`);
        if (Array.isArray(action.pos)) parts.push(`p${action.pos.join('_')}`);
        if (Array.isArray(action.targetPos)) parts.push(`x${action.targetPos.join('_')}`);
        if (action.upgradeTo) parts.push(`u${action.upgradeTo}`);
        if (action.skill) parts.push(`s${action.skill}`);
        if (action.formation) parts.push('v');
        return parts.join('|');
    }

    const aiRepeatTracker = {
        lastTurnCount: null,
        black: { lastSig: '', streak: 0 },
        white: { lastSig: '', streak: 0 }
    };

    function resetRepeatTracker() {
        aiRepeatTracker.black.lastSig = '';
        aiRepeatTracker.black.streak = 0;
        aiRepeatTracker.white.lastSig = '';
        aiRepeatTracker.white.streak = 0;
    }

    function syncRepeatTracker(current) {
        if (!current) return;
        const nowTurn = Number(current.turn_count || 0);
        const prevTurn = aiRepeatTracker.lastTurnCount;
        if (Number.isFinite(prevTurn)) {
            if (nowTurn < prevTurn || (nowTurn <= 1 && prevTurn > 1)) {
                resetRepeatTracker();
            }
        }
        aiRepeatTracker.lastTurnCount = nowTurn;
    }

    function toValidTeam(team) {
        return (team === 'black' || team === 'white') ? team : '';
    }

    function applyRepeatTelemetry(team, actionSig, repeatHint = null) {
        const validTeam = toValidTeam(team);
        if (!validTeam || !actionSig) {
            return {
                team: validTeam,
                actionSig: actionSig || '',
                repeatStreak: 0
            };
        }

        const slot = aiRepeatTracker[validTeam];
        const hinted = Number(repeatHint);
        if (Number.isFinite(hinted) && hinted > 0) {
            slot.lastSig = actionSig;
            slot.streak = Math.floor(hinted);
        } else if (slot.lastSig === actionSig) {
            slot.streak += 1;
        } else {
            slot.lastSig = actionSig;
            slot.streak = 1;
        }

        return {
            team: validTeam,
            actionSig,
            repeatStreak: slot.streak
        };
    }

    function pickDeterministicIndex(length, seed) {
        if (!length) return 0;
        const mixed = hashString(seed);
        return mixed % length;
    }

    function executeAiAction(current, action) {
        if (!action) return { ok: false, reason: 'missing_action' };

        let result = null;
        const actionType = action.type;

        if (action.type === 'move') {
            saveState();
            result = current.applyMove(action.from, action.to);
            if (!result.success) {
                gameHistory.pop();
                return { ok: false, reason: 'move_failed', result };
            }
        } else if (action.type === 'skill') {
            if (!current.can_use_skill_action()) return { ok: false, reason: 'skill_not_allowed' };
            const cell = current.board.get_cell(action.from[0], action.from[1]);
            const piece = cell && cell.length ? cell[cell.length - 1] : null;
            if (!piece) return { ok: false, reason: 'skill_piece_missing' };
            saveState();
            result = current.use_skill(piece, action.targetPos || null);
        } else if (action.type === 'upgrade') {
            const [x, y] = action.pos;
            const cell = current.board.get_cell(x, y);
            const piece = cell && cell.length ? cell[cell.length - 1] : null;
            if (!piece || piece.name !== '市民' || !piece.can_upgrade) return { ok: false, reason: 'upgrade_invalid' };
            saveState();
            const upgradeRes = CitizenManager.citizen_upgrade(current.board, piece, action.upgradeTo);
            result = { success: upgradeRes[0], message: upgradeRes[1] };
            if (result.success) {
                current.log_event(result.message);
            } else {
                gameHistory.pop();
                return { ok: false, reason: 'upgrade_failed', result };
            }
        } else {
            return { ok: false, reason: 'unknown_action' };
        }

        if (!result) return { ok: false, reason: 'no_result' };
        if (actionType !== 'skill' && !result.success) return { ok: false, reason: 'non_skill_failed', result };

        return { ok: true, actionType, result };
    }

    function chooseDeterministicFallbackAction(current) {
        const actions = aiAgent._generateActions(current) || [];
        if (!actions.length) return null;

        const team = current.current_turn;
        const scored = [];
        for (const action of actions) {
            const outcomes = aiAgent._getOutcomeSpecs(action) || [];
            if (!outcomes.length) continue;

            let score = 0;
            let valid = false;
            let probSum = 0;
            for (const outcome of outcomes) {
                const sim = aiAgent._simulateAction(current, action, outcome.rolls);
                if (!sim || !sim.simGame) continue;
                valid = true;
                probSum += outcome.prob;
                score += sim.simGame.evaluateBoard(team) * outcome.prob;
            }
            if (!valid || probSum <= 0) continue;
            scored.push({
                action,
                score: score / probSum,
                sig: actionSignature(action)
            });
        }

        if (!scored.length) return null;
        scored.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.sig < b.sig) return -1;
            if (a.sig > b.sig) return 1;
            return 0;
        });

        const best = scored[0];
        return {
            action: best.action,
            expectedScore: best.score,
            reason: '规则备选动作池兜底（确定性）',
            aiLog: [`fallback_pool ${best.sig} => ${best.score.toFixed(2)}`],
            trace: [`fallback_level2:${best.sig}`]
        };
    }

    function getAiTeamLabel(team) {
        if (team === 'black') return '黑方';
        if (team === 'white') return '白方';
        return team || '--';
    }

    function formatAiPos(pos) {
        if (!Array.isArray(pos) || pos.length < 2) return '--';
        const r = Number(pos[0]);
        const c = Number(pos[1]);
        if (!Number.isInteger(r) || !Number.isInteger(c)) return '--';
        return n2a(r, c);
    }

    function resolveAiActorName(current, action) {
        if (!action || !Array.isArray(action.from) || action.from.length < 2) return '';
        const r = Number(action.from[0]);
        const c = Number(action.from[1]);
        if (!Number.isInteger(r) || !Number.isInteger(c)) return '';
        const cell = current.board.get_cell(r, c);
        if (!Array.isArray(cell) || !cell.length) return '';
        const top = cell[cell.length - 1];
        return top && top.name ? String(top.name) : '';
    }

    function summarizeAiActionForSystemLog(current, actingTeam, actionType, action, result, actorNameHint = '') {
        const teamText = getAiTeamLabel(actingTeam);
        const actorName = actorNameHint || ((action && action.pieceName) ? String(action.pieceName) : resolveAiActorName(current, action));
        if (actionType === 'move') {
            return `AI(${teamText}) 移动: ${actorName || '棋子'} ${formatAiPos(action && action.from)} -> ${formatAiPos(action && action.to)}`;
        }
        if (actionType === 'skill') {
            const targetText = Array.isArray(action && action.targetPos) ? ` -> ${formatAiPos(action.targetPos)}` : '';
            const resultText = result && result.message ? ` | 结果: ${result.message}` : '';
            return `AI(${teamText}) 技能: ${actorName || '棋子'}${targetText}${resultText}`;
        }
        if (actionType === 'upgrade') {
            const upgradeMap = { police: '警察', officer: '官员', lawyer: '律师', teacher: '老师', doctor: '医生' };
            const role = upgradeMap[action && action.upgradeTo] || (action && action.upgradeTo) || '未知';
            return `AI(${teamText}) 升变: ${formatAiPos(action && action.pos)} -> ${role}`;
        }
        return `AI(${teamText}) 执行动作: ${actionType || 'unknown'}`;
    }

    function summarizeAiReasonForSystemLog(reason, aiLog) {
        const chunks = [];
        if (reason) chunks.push(String(reason));
        if (Array.isArray(aiLog) && aiLog.length) {
            chunks.push(...aiLog.filter(Boolean).slice(0, 2).map((item) => String(item)));
        }
        if (!chunks.length) return '';
        const summary = chunks.join(' | ');
        return summary.length > 220 ? `${summary.slice(0, 220)}...` : summary;
    }

    function appendAiSystemLogs(current, payload) {
        if (!current || typeof current.log_event !== 'function') return;
        const actionLine = summarizeAiActionForSystemLog(
            current,
            payload && payload.actingTeam,
            payload && payload.actionType,
            payload && payload.action,
            payload && payload.result,
            payload && payload.actorName
        );
        if (actionLine) current.log_event(actionLine);
    }

    async function apiAiMove(data) {
        const current = getGame();
        if (current.game_over) return { success: false, message: '游戏已结束' };
        syncRepeatTracker(current);

        const startedAt = (global.performance && typeof global.performance.now === 'function')
            ? global.performance.now()
            : Date.now();
        const actingTeam = toValidTeam(current.current_turn);

        const aiReq = normalizeAiMovePayload(data);
        const config = aiReq.config;
        const requestId = buildDeterministicRequestId(current, config);
        const platformTag = detectPlatformTag();

        const forcedUpgradeResult = runForcedAiUpgrade(current);
        if (forcedUpgradeResult) {
            const thinkMs = ((global.performance && typeof global.performance.now === 'function') ? global.performance.now() : Date.now()) - startedAt;
            const forcedAction = {
                type: 'upgrade',
                pos: forcedUpgradeResult.upgrade_pos || null,
                upgradeTo: forcedUpgradeResult.upgrade_to || null,
                pieceName: '市民'
            };
            const forcedSig = actionSignature(forcedAction);
            const forcedRepeatMeta = applyRepeatTelemetry(actingTeam, forcedSig, null);
            const forcedActionSummary = summarizeAiActionForSystemLog(
                current,
                forcedRepeatMeta.team || actingTeam,
                'upgrade',
                forcedAction,
                null,
                '市民'
            );
            const forcedReasonSummary = summarizeAiReasonForSystemLog(
                forcedUpgradeResult.reason,
                forcedUpgradeResult.ai_log || []
            );
            appendAiSystemLogs(current, {
                actingTeam: forcedRepeatMeta.team || actingTeam,
                actionType: 'upgrade',
                action: forcedAction,
                actorName: '市民',
                result: null,
                reason: forcedUpgradeResult.reason,
                aiLog: forcedUpgradeResult.ai_log || []
            });
            recordAiDecisionTelemetry({
                requestId,
                actionType: 'upgrade',
                thinkMs,
                usedFallback: false,
                fallbackLevel: 0,
                score: forcedUpgradeResult.expected_score,
                trace: forcedUpgradeResult.ai_log || [],
                traceDigest: digestTrace(forcedUpgradeResult.ai_log || []),
                engineVersion: config.engineVersion,
                platformTag,
                team: forcedRepeatMeta.team,
                actionSig: forcedRepeatMeta.actionSig,
                repeatStreak: forcedRepeatMeta.repeatStreak
            });
            return Object.assign({}, forcedUpgradeResult, {
                engine_version: config.engineVersion,
                think_ms: thinkMs,
                used_fallback: false,
                fallback_level: 0,
                trace: forcedUpgradeResult.ai_log || [],
                build_timestamp: AI_BUILD_INFO.buildTimestamp,
                model_hash: AI_BUILD_INFO.modelHash,
                model_version: AI_BUILD_INFO.modelVersion || 'unknown',
                team: forcedRepeatMeta.team,
                action_sig: forcedRepeatMeta.actionSig,
                repeat_streak: forcedRepeatMeta.repeatStreak,
                ai_action_summary: forcedActionSummary,
                ai_reason_summary: forcedReasonSummary
            });
        }

        let decision = null;
        let fallbackLevel = 0;
        let workerError = null;

        if (config.engineVersion === 'v2') {
            try {
                const workerPayload = await aiWorkerClient.decide(current, config, requestId);
                if (workerPayload && workerPayload.action) {
                    const diagnostics = normalizeAiDiagnostics(workerPayload, config);
                    decision = {
                        action: workerPayload.action,
                        expectedScore: workerPayload.score,
                        reason: 'AIEngineV2(Worker)决策',
                        aiLog: Array.isArray(workerPayload.trace) ? workerPayload.trace : [],
                        trace: Array.isArray(workerPayload.trace) ? workerPayload.trace : [],
                        actionSig: typeof workerPayload.actionSig === 'string' ? workerPayload.actionSig : actionSignature(workerPayload.action),
                        repeatStreak: Number.isFinite(Number(workerPayload.repeatStreak)) ? Number(workerPayload.repeatStreak) : null,
                        team: toValidTeam(workerPayload.team) || actingTeam,
                        diagnostics
                    };
                    if (workerPayload.modelHash) {
                        AI_BUILD_INFO.modelHash = workerPayload.modelHash;
                    }
                    if (workerPayload.modelVersion) {
                        AI_BUILD_INFO.modelVersion = workerPayload.modelVersion;
                    }
                    if (workerPayload.neuralStatus) {
                        AI_BUILD_INFO.neuralStatus = workerPayload.neuralStatus;
                        decision.neuralStatus = workerPayload.neuralStatus;
                        decision.trace = (decision.trace || []).concat([`neural:${workerPayload.neuralStatus}`]);
                    }
                }
            } catch (err) {
                workerError = err;
            }
        }

        if (!decision && config.enableFallback) {
            const level2 = chooseDeterministicFallbackAction(current);
            if (level2 && level2.action) {
                fallbackLevel = 2;
                decision = Object.assign({}, level2, {
                    actionSig: actionSignature(level2.action),
                    repeatStreak: null,
                    team: actingTeam
                });
            }
        }

        if (!decision && config.enableFallback) {
            const legacy = aiAgent.getBestAction(current);
            if (legacy && legacy.action) {
                fallbackLevel = 3;
                decision = {
                    action: legacy.action,
                    expectedScore: legacy.expectedScore,
                    reason: legacy.reason || 'MoleChessAI 兼容兜底',
                    aiLog: legacy.aiLog || [],
                    trace: ['fallback_level3:legacy_ai'],
                    actionSig: actionSignature(legacy.action),
                    repeatStreak: null,
                    team: actingTeam
                };
            }
        }

        if (!decision || !decision.action) {
            const thinkMs = ((global.performance && typeof global.performance.now === 'function') ? global.performance.now() : Date.now()) - startedAt;
            if (!config.enableFallback) {
                const trace = workerError ? [`worker_error:${workerError.message || String(workerError)}`] : ['no_decision_no_fallback'];
                recordAiDecisionTelemetry({
                    requestId,
                    actionType: 'none',
                    thinkMs,
                    usedFallback: false,
                    fallbackLevel: 0,
                    score: null,
                    trace,
                    traceDigest: digestTrace(trace),
                    engineVersion: config.engineVersion,
                    platformTag,
                    team: actingTeam,
                    actionSig: '',
                    repeatStreak: 0
                });
                return {
                    success: false,
                    message: 'AI 未生成可执行动作',
                    engine_version: config.engineVersion,
                    think_ms: thinkMs,
                    used_fallback: false,
                    fallback_level: 0,
                    trace,
                    request_id: requestId,
                    build_timestamp: AI_BUILD_INFO.buildTimestamp,
                    model_hash: AI_BUILD_INFO.modelHash,
                    model_version: AI_BUILD_INFO.modelVersion || 'unknown',
                    ai_debug: normalizeAiDiagnostics({}, config)
                };
            }
            return fallbackRandomMove(current, {
                config,
                requestId,
                thinkMs,
                trace: workerError ? [`worker_error:${workerError.message || String(workerError)}`] : ['fallback_level4:random'],
                fallbackLevel: 4,
                team: actingTeam
            });
        }

        const actorNameHint = resolveAiActorName(current, decision.action);
        const applied = executeAiAction(current, decision.action);
        if (!applied.ok) {
            const trace = (decision.trace || []).concat([`apply_failed:${applied.reason}`]);
            const thinkMs = ((global.performance && typeof global.performance.now === 'function') ? global.performance.now() : Date.now()) - startedAt;
            const attemptedSig = decision.actionSig || actionSignature(decision.action);
            if (!config.enableFallback) {
                recordAiDecisionTelemetry({
                    requestId,
                    actionType: decision.action && decision.action.type ? decision.action.type : 'unknown',
                    thinkMs,
                    usedFallback: false,
                    fallbackLevel: 0,
                    score: decision.expectedScore,
                    trace,
                    traceDigest: digestTrace(trace),
                    engineVersion: config.engineVersion,
                    platformTag,
                    team: actingTeam,
                    actionSig: attemptedSig,
                    repeatStreak: 0
                });
                return {
                    success: false,
                    message: 'AI 动作执行失败',
                    action_type: decision.action && decision.action.type ? decision.action.type : null,
                    expected_score: decision.expectedScore,
                    reason: decision.reason,
                    ai_log: decision.aiLog || [],
                    engine_version: config.engineVersion,
                    think_ms: thinkMs,
                    used_fallback: false,
                    fallback_level: 0,
                    trace,
                    request_id: requestId,
                    build_timestamp: AI_BUILD_INFO.buildTimestamp,
                    model_hash: AI_BUILD_INFO.modelHash,
                    model_version: AI_BUILD_INFO.modelVersion || 'unknown',
                    team: actingTeam,
                    action_sig: attemptedSig,
                    repeat_streak: 0,
                    ai_debug: decision.diagnostics || normalizeAiDiagnostics({}, config)
                };
            }
            return fallbackRandomMove(current, {
                config,
                requestId,
                thinkMs,
                trace,
                fallbackLevel: 4,
                team: actingTeam
            });
        }

        const actionType = applied.actionType;
        const actionMessage = (actionType === 'skill' && applied.result && applied.result.success === false)
            ? 'AI 技能执行失败'
            : `AI 执行${actionType}成功`;
        const thinkMs = ((global.performance && typeof global.performance.now === 'function') ? global.performance.now() : Date.now()) - startedAt;
        const trace = decision.trace || [];
        const usedFallback = fallbackLevel > 0;
        const decisionSig = decision.actionSig || actionSignature(decision.action);
        const diagnostics = decision.diagnostics || normalizeAiDiagnostics({}, config);
        const repeatMeta = applyRepeatTelemetry(
            toValidTeam(decision.team) || actingTeam,
            decisionSig,
            decision.repeatStreak
        );
        appendAiSystemLogs(current, {
            actingTeam: repeatMeta.team || actingTeam,
            actionType,
            action: decision.action || null,
            actorName: actorNameHint,
            result: applied.result || null,
            reason: decision.reason,
            aiLog: decision.aiLog || []
        });

        recordAiDecisionTelemetry({
            requestId,
            actionType,
            thinkMs,
            usedFallback,
            fallbackLevel,
            score: decision.expectedScore,
            trace,
            traceDigest: digestTrace(trace),
            engineVersion: config.engineVersion,
            platformTag,
            team: repeatMeta.team,
            actionSig: repeatMeta.actionSig,
            repeatStreak: repeatMeta.repeatStreak
        });

        return {
            success: true,
            message: actionMessage,
            action_type: actionType,
            from: decision.action.from || null,
            to: decision.action.to || null,
            upgrade_pos: decision.action.pos || null,
            upgrade_to: decision.action.upgradeTo || null,
            expected_score: decision.expectedScore,
            reason: decision.reason,
            ai_log: decision.aiLog || [],
            skill_result: actionType === 'skill' ? applied.result : null,
            random_move: actionType === 'move' ? !!(applied.result && applied.result.random_move) : false,
            direction_dice: actionType === 'move' && applied.result ? (applied.result.direction_dice ?? null) : null,
            steps_dice: actionType === 'move' && applied.result ? (applied.result.steps_dice ?? null) : null,
            direction_rolls: actionType === 'move' && applied.result && Array.isArray(applied.result.direction_rolls)
                ? applied.result.direction_rolls.slice()
                : [],
            nightmare_rolls: actionType === 'move' && applied.result && Array.isArray(applied.result.nightmare_rolls)
                ? applied.result.nightmare_rolls.slice()
                : [],
            released_possession: actionType === 'move' ? !!(applied.result && applied.result.released_possession) : false,
            engine_version: config.engineVersion,
            think_ms: thinkMs,
            used_fallback: usedFallback,
            fallback_level: fallbackLevel,
            trace,
            request_id: requestId,
            build_timestamp: AI_BUILD_INFO.buildTimestamp,
            model_hash: AI_BUILD_INFO.modelHash,
            model_version: AI_BUILD_INFO.modelVersion || diagnostics.model_version || 'unknown',
            neural_status: decision.neuralStatus || diagnostics.neural_status || (config.enableNeuralEval ? 'heuristic' : 'disabled'),
            team: repeatMeta.team,
            action_sig: repeatMeta.actionSig,
            repeat_streak: repeatMeta.repeatStreak,
            ai_debug: diagnostics,
            ai_action_summary: summarizeAiActionForSystemLog(
                current,
                repeatMeta.team || actingTeam,
                actionType,
                decision.action || null,
                applied.result || null,
                actorNameHint
            ),
            ai_reason_summary: summarizeAiReasonForSystemLog(decision.reason, decision.aiLog || [])
        };
    }

    async function apiAiDebugDecide(data) {
        const payload = (data && typeof data === 'object') ? data : {};
        const aiReq = normalizeAiMovePayload(payload);
        const config = aiReq.config;
        const sourceGame = payload.serializedGame ? deserializeGame(payload.serializedGame) : getGame().clone();
        const requestId = buildDeterministicRequestId(sourceGame, config);

        let decision = null;
        let fallbackLevel = 0;

        if (config.engineVersion === 'v2') {
            try {
                const workerPayload = await aiWorkerClient.decide(sourceGame, config, requestId);
                if (workerPayload && workerPayload.action) {
                    const diagnostics = normalizeAiDiagnostics(workerPayload, config);
                    decision = {
                        action: workerPayload.action,
                        expectedScore: workerPayload.score,
                        reason: 'AIEngineV2(Worker)决策',
                        aiLog: Array.isArray(workerPayload.trace) ? workerPayload.trace : [],
                        trace: Array.isArray(workerPayload.trace) ? workerPayload.trace : [],
                        neuralStatus: workerPayload.neuralStatus || 'unknown',
                        actionSig: typeof workerPayload.actionSig === 'string' ? workerPayload.actionSig : actionSignature(workerPayload.action),
                        repeatStreak: Number.isFinite(Number(workerPayload.repeatStreak)) ? Number(workerPayload.repeatStreak) : 0,
                        team: toValidTeam(workerPayload.team) || toValidTeam(sourceGame.current_turn),
                        diagnostics
                    };
                    if (workerPayload.modelHash) {
                        AI_BUILD_INFO.modelHash = workerPayload.modelHash;
                    }
                    if (workerPayload.modelVersion) {
                        AI_BUILD_INFO.modelVersion = workerPayload.modelVersion;
                    }
                }
            } catch (err) {
                decision = null;
            }
        }

        if (!decision && config.enableFallback) {
            const level2 = chooseDeterministicFallbackAction(sourceGame);
            if (level2 && level2.action) {
                fallbackLevel = 2;
                decision = Object.assign({}, level2, {
                    actionSig: actionSignature(level2.action),
                    repeatStreak: 0,
                    team: toValidTeam(sourceGame.current_turn)
                });
            }
        }

        if (!decision && config.enableFallback) {
            const legacy = aiAgent.getBestAction(sourceGame);
            if (legacy && legacy.action) {
                fallbackLevel = 3;
                decision = {
                    action: legacy.action,
                    expectedScore: legacy.expectedScore,
                    reason: legacy.reason || 'MoleChessAI 兼容兜底',
                    aiLog: legacy.aiLog || [],
                    trace: ['fallback_level3:legacy_ai'],
                    neuralStatus: 'legacy',
                    actionSig: actionSignature(legacy.action),
                    repeatStreak: 0,
                    team: toValidTeam(sourceGame.current_turn)
                };
            }
        }

        return {
            success: !!(decision && decision.action),
            action: decision ? decision.action : null,
            expected_score: decision ? decision.expectedScore : null,
            reason: decision ? decision.reason : 'AI 未生成可执行动作',
            ai_log: decision ? (decision.aiLog || []) : [],
            trace: decision ? (decision.trace || []) : [],
            used_fallback: fallbackLevel > 0,
            fallback_level: fallbackLevel,
            engine_version: config.engineVersion,
            request_id: requestId,
            model_hash: AI_BUILD_INFO.modelHash,
            model_version: AI_BUILD_INFO.modelVersion || 'unknown',
            neural_status: decision ? (decision.neuralStatus || 'n/a') : 'n/a',
            team: decision ? (decision.team || '') : '',
            action_sig: decision ? (decision.actionSig || '') : '',
            repeat_streak: decision ? (Number(decision.repeatStreak) || 0) : 0,
            ai_debug: decision ? (decision.diagnostics || normalizeAiDiagnostics({}, config)) : normalizeAiDiagnostics({}, config)
        };
    }

    function apiAiDebugExportState() {
        const current = getGame();
        return {
            success: true,
            serialized_game: serializeGame(current)
        };
    }

    function fallbackRandomMove(current, options = {}) {
        syncRepeatTracker(current);
        const actingTeam = toValidTeam(options.team) || toValidTeam(current.current_turn);
        const candidates = [];
        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 12; c++) {
                const piece = current.board.get_top_piece(r, c);
                if (!piece) continue;
                if (piece.name === '死神') continue;
                if (piece.is_saved || piece.state === 'monk_forever' || piece.is_arrested) continue;
                if (piece.name === '市民' && typeof current._findAttachedGreenWife === 'function' && current._findAttachedGreenWife(piece)) continue;
                if (piece.team !== current.current_turn && piece.team !== 'neutral') continue;
                const moves = piece.get_valid_moves(current.board);
                if (moves && moves.length) {
                    candidates.push({ piece, from: [r, c], moves });
                }
            }
        }

        if (!candidates.length) {
            const output = {
                success: false,
                message: 'AI 无路可走',
                engine_version: options.config && options.config.engineVersion ? options.config.engineVersion : 'v1',
                think_ms: Number.isFinite(Number(options.thinkMs)) ? Number(options.thinkMs) : 0,
                used_fallback: true,
                fallback_level: Number.isFinite(Number(options.fallbackLevel)) ? Number(options.fallbackLevel) : 4,
                trace: Array.isArray(options.trace) ? options.trace : ['fallback_level4:no_moves'],
                request_id: options.requestId || '',
                build_timestamp: AI_BUILD_INFO.buildTimestamp,
                model_hash: AI_BUILD_INFO.modelHash,
                model_version: AI_BUILD_INFO.modelVersion || 'unknown',
                neural_status: options.config && options.config.enableNeuralEval ? 'fallback' : 'disabled',
                team: actingTeam,
                action_sig: '',
                repeat_streak: 0,
                ai_debug: normalizeAiDiagnostics({}, options.config || {})
            };
            recordAiDecisionTelemetry({
                requestId: output.request_id,
                actionType: 'none',
                thinkMs: output.think_ms,
                usedFallback: true,
                fallbackLevel: output.fallback_level,
                score: null,
                trace: output.trace,
                traceDigest: digestTrace(output.trace),
                engineVersion: output.engine_version,
                platformTag: detectPlatformTag(),
                team: output.team,
                actionSig: output.action_sig,
                repeatStreak: output.repeat_streak
            });
            return output;
        }

        const seedBase = `${options.requestId || ''}|${current.turn_count}|${current.current_turn}|${options.fallbackLevel || 4}`;
        const pieceIndex = pickDeterministicIndex(candidates.length, `${seedBase}|piece`);
        const pick = candidates[pieceIndex];
        const moveIndex = pickDeterministicIndex(pick.moves.length, `${seedBase}|move|${pick.piece.name}`);
        const move = pick.moves[moveIndex];

        saveState();
        current.board.move_piece(pick.from[0], pick.from[1], move[0], move[1]);
        current.mark_move_action();
        current.log_event(`AI (随机兜底) 移动: ${pick.piece.name} (${n2a(pick.from[0], pick.from[1])} -> ${n2a(move[0], move[1])})`);
        appendAiSystemLogs(current, {
            actingTeam,
            actionType: 'move',
            action: {
                type: 'move',
                pieceName: pick.piece && pick.piece.name ? pick.piece.name : '',
                from: pick.from,
                to: move
            },
            actorName: pick.piece && pick.piece.name ? pick.piece.name : '',
            result: null,
            reason: '无可用高分动作，随机兜底',
            aiLog: []
        });
        const repeatMeta = applyRepeatTelemetry(actingTeam, actionSignature({
            type: 'move',
            pieceName: pick.piece.name,
            from: pick.from,
            to: move
        }), null);
        const fallbackAction = {
            type: 'move',
            pieceName: pick.piece.name,
            from: pick.from,
            to: move
        };
        const fallbackActionSummary = summarizeAiActionForSystemLog(
            current,
            repeatMeta.team || actingTeam,
            'move',
            fallbackAction,
            null,
            pick.piece && pick.piece.name ? pick.piece.name : ''
        );
        const fallbackReasonSummary = summarizeAiReasonForSystemLog('无可用高分动作，随机兜底', []);
        const output = {
            success: true,
            message: 'AI 思考后决定随机应变',
            from: pick.from,
            to: move,
            action_type: 'move',
            reason: '无可用高分动作，随机兜底',
            expected_score: null,
            ai_log: [],
            engine_version: options.config && options.config.engineVersion ? options.config.engineVersion : 'v1',
            think_ms: Number.isFinite(Number(options.thinkMs)) ? Number(options.thinkMs) : 0,
            used_fallback: true,
            fallback_level: Number.isFinite(Number(options.fallbackLevel)) ? Number(options.fallbackLevel) : 4,
            trace: Array.isArray(options.trace) ? options.trace : ['fallback_level4:random'],
            request_id: options.requestId || '',
            build_timestamp: AI_BUILD_INFO.buildTimestamp,
            model_hash: AI_BUILD_INFO.modelHash,
            model_version: AI_BUILD_INFO.modelVersion || 'unknown',
            neural_status: options.config && options.config.enableNeuralEval ? 'fallback' : 'disabled',
            team: repeatMeta.team,
            action_sig: repeatMeta.actionSig,
            repeat_streak: repeatMeta.repeatStreak,
            ai_debug: normalizeAiDiagnostics({}, options.config || {}),
            ai_action_summary: fallbackActionSummary,
            ai_reason_summary: fallbackReasonSummary
        };
        recordAiDecisionTelemetry({
            requestId: output.request_id,
            actionType: output.action_type,
            thinkMs: output.think_ms,
            usedFallback: true,
            fallbackLevel: output.fallback_level,
            score: null,
            trace: output.trace,
            traceDigest: digestTrace(output.trace),
            engineVersion: output.engine_version,
            platformTag: detectPlatformTag(),
            team: output.team,
            actionSig: output.action_sig,
            repeatStreak: output.repeat_streak
        });
        return output;
    }

    const handlers = {
        '/api/state': () => apiState(),
        '/api/reset': () => apiReset(),
        '/api/roll_initiative': () => apiRollInitiative(),
        '/api/start_first_turn': () => apiStartFirstTurn(),
        '/api/valid_moves': (data) => apiValidMoves(data),
        '/api/move': (data) => apiMove(data),
        '/api/end_turn': () => apiEndTurn(),
        '/api/surrender': (data) => apiSurrender(data),
        '/api/undo': () => apiUndo(),
        '/api/upgrade': (data) => apiUpgrade(data),
        '/api/skill': (data) => apiSkill(data),
        '/api/ai_move': (data) => apiAiMove(data),
        '/api/ai_debug_decide': (data) => apiAiDebugDecide(data),
        '/api/ai_debug_export_state': () => apiAiDebugExportState(),
        '/api/sandbox/toggle': (data) => apiSandboxToggle(data),
        '/api/sandbox/relocate': (data) => apiSandboxRelocate(data),
        '/api/sandbox/capture': (data) => apiSandboxCapture(data),
        '/api/story/load_snapshot': (data) => apiStoryLoadSnapshot(data),
        '/api/story/export_snapshot': () => apiStoryExportSnapshot(),
        '/api/story/reset_runtime': () => apiStoryResetRuntime(),
        '/api/formation_move': () => ({ success: false, message: '网页模式不支持该操作' }),
        '/api/upload': () => ({ success: false, message: '网页模式不支持上传' })
    };
    const MUTATING_ENDPOINTS = new Set([
        '/api/reset',
        '/api/roll_initiative',
        '/api/start_first_turn',
        '/api/move',
        '/api/end_turn',
        '/api/surrender',
        '/api/undo',
        '/api/upgrade',
        '/api/skill',
        '/api/ai_move',
        '/api/sandbox/toggle',
        '/api/sandbox/relocate',
        '/api/sandbox/capture',
        '/api/story/load_snapshot',
        '/api/story/reset_runtime'
    ]);

    const nativeFetch = global.fetch ? global.fetch.bind(global) : null;
    const isHttpProtocol = (() => {
        try {
            const protocol = String((global.location && global.location.protocol) || '');
            return protocol === 'http:' || protocol === 'https:';
        } catch (_err) {
            return false;
        }
    })();
    const forceLocalApi = (() => {
        try {
            const qs = new URLSearchParams((global.location && global.location.search) || '');
            return qs.get('api') === 'local';
        } catch (_err) {
            return false;
        }
    })();
    const preferNativeApi = !!(isHttpProtocol && nativeFetch && !forceLocalApi && !expoModeEnabled);
    try {
        global.__MOLE_CHESS_API_ROUTING__ = preferNativeApi ? 'native_first_fallback_local' : 'local_only';
    } catch (_err) { }

    global.fetch = async function (input, init = {}) {
        const inputIsRequest = input instanceof Request;
        const inputUrl = typeof input === 'string' ? input : (inputIsRequest ? input.url : '');
        const rawUrl = String(inputUrl || '');

        // Handle file:// protocol where location.origin can be "null".
        let pathname = '';
        if (rawUrl.startsWith('/')) {
            pathname = rawUrl.split('?')[0];
        } else {
            let baseUrl = 'http://localhost';
            if (global.location && global.location.origin && global.location.origin !== 'null') {
                baseUrl = global.location.origin;
            }
            try {
                const url = new URL(rawUrl, baseUrl);
                pathname = url.pathname || '';
            } catch (e) {
                const match = rawUrl.match(/^(?:https?:\/\/[^\/]+)?(\/[^?]*)/);
                pathname = match ? match[1] : rawUrl;
            }
        }

        if (!pathname.startsWith('/api/')) {
            if (nativeFetch) {
                return nativeFetch(input, init);
            }
            return Promise.reject(new Error('Fetch is not available'));
        }

        const handler = handlers[pathname];
        if (!handler) {
            if (preferNativeApi && nativeFetch) {
                return nativeFetch(input, init);
            }
            return respond({ success: false, message: `未知接口：${pathname}` }, 404);
        }

        if (preferNativeApi && nativeFetch) {
            try {
                const nativeRes = await nativeFetch(input, init);
                const contentType = nativeRes && nativeRes.headers
                    ? String(nativeRes.headers.get('content-type') || '').toLowerCase()
                    : '';
                const isJsonLike = contentType.includes('application/json');
                const shouldFallbackToLocal = !!(nativeRes
                    && (nativeRes.status === 404 || (nativeRes.ok && !isJsonLike)));
                if (nativeRes && !shouldFallbackToLocal) {
                    return nativeRes;
                }
            } catch (_nativeErr) {
                // Fallback to local handlers below.
            }
        }

        let data = null;
        const method = (inputIsRequest
            ? (input.method || 'GET')
            : ((init && init.method) || 'GET')).toUpperCase();

        if (method !== 'GET' && method !== 'HEAD') {
            let contentType = '';
            if (inputIsRequest) {
                contentType = input.headers.get('content-type') || '';
            } else if (init && init.headers) {
                try {
                    contentType = new Headers(init.headers).get('content-type') || '';
                } catch (err) {
                    contentType = '';
                }
            }

            if (inputIsRequest) {
                if (contentType.includes('application/json')) {
                    try {
                        data = await input.clone().json();
                    } catch (err) {
                        data = null;
                    }
                } else {
                    const text = await input.clone().text();
                    data = parseBody(text, contentType);
                }
            } else {
                const body = init ? init.body : null;
                if (body instanceof FormData) {
                    data = body;
                } else if (typeof body === 'string') {
                    data = parseBody(body, contentType);
                } else if (body && typeof body === 'object') {
                    data = body;
                } else {
                    data = null;
                }
            }
        }

        const runHandler = async () => {
            if (expoModeEnabled) {
                hydrateSharedState();
            }
            return Promise.resolve(handler(data));
        };

        let result;
        if (expoModeEnabled && MUTATING_ENDPOINTS.has(pathname)) {
            result = await withSharedMutationLock(async () => {
                const output = await runHandler();
                persistSharedState(pathname);
                const animationCue = buildAnimationCue(pathname, output);
                emitSharedStateUpdated(pathname, pathname, animationCue);
                return output;
            });
        } else {
            result = await runHandler();
        }
        return respond(result);
    };
})(typeof window !== 'undefined' ? window : globalThis);
