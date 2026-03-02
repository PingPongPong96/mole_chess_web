(function (global) {
    'use strict';

    const core = global.MoleChessCore;
    if (!core) {
        console.error('[AIEngineV2] MoleChessCore is required.');
        return;
    }

    const { DiceEngine, MoleChessAI } = core;

    const MAX_INT = 1e15;

    class SeededRNG {
        constructor(seed) {
            this.state = (Number(seed) >>> 0) || 1;
        }

        nextUint32() {
            let x = this.state >>> 0;
            x ^= x << 13;
            x ^= x >>> 17;
            x ^= x << 5;
            this.state = x >>> 0;
            return this.state;
        }

        nextInt(maxExclusive) {
            if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) return 0;
            return this.nextUint32() % Math.floor(maxExclusive);
        }
    }

    class NeuralEvalRuntime {
        constructor() {
            this.ready = false;
            this.loading = false;
            this.manifest = null;
            this.modelHash = 'none';
            this.status = 'disabled';
            this.seed = 20260220;
            this.useOnnx = false;
            this.session = null;
            this.inputName = 'features';
            this.policyOutputName = 'policy_logits';
            this.valueOutputName = 'value';
            this.policyDim = 64;
            this.maxCacheEntries = 2048;
            this.evalCache = new Map();
            this.cacheHits = 0;
            this.cacheMisses = 0;
            this.lastPrefetchStates = 0;
        }

        async preload(config) {
            if (!config || !config.enableNeuralEval) {
                this.ready = false;
                this.status = 'disabled';
                this.useOnnx = false;
                this.session = null;
                return;
            }
            if (this.ready || this.loading) return;
            this.loading = true;
            this.status = 'loading';

            try {
                if (typeof fetch !== 'function') {
                    this.status = 'no_fetch';
                    this.ready = false;
                    return;
                }

                const manifestRes = await fetch(this._resolveAssetPath('ai/models/manifest.json'), { cache: 'no-store' });
                if (!manifestRes.ok) {
                    this.status = 'manifest_not_found';
                    this.ready = false;
                    return;
                }
                this.manifest = await manifestRes.json();
                this.modelHash = (((this.manifest || {}).model || {}).hash) || 'none';

                const modelPathRaw = (((this.manifest || {}).model || {}).path) || '';
                const modelPath = this._resolveAssetPath(modelPathRaw);
                if (!modelPath) {
                    this.useOnnx = false;
                    this.seed = this._seedFromString(this.modelHash || 'none');
                    this.ready = true;
                    this.status = 'manifest_only';
                    return;
                }

                const modelRes = await fetch(modelPath, { cache: 'no-store' });
                if (!modelRes.ok) {
                    this.useOnnx = false;
                    this.seed = this._seedFromString(this.modelHash || modelPathRaw || modelPath);
                    this.ready = true;
                    this.status = 'model_missing_use_manifest_seed';
                    return;
                }

                const modelBuf = await modelRes.arrayBuffer();
                const actualHash = await this._sha256Hex(modelBuf);
                const expectedHash = this._normalizeHashString(this.modelHash);
                const actualNormalized = this._normalizeHashString(actualHash);

                if (expectedHash && actualNormalized && expectedHash !== actualNormalized) {
                    this.status = 'hash_mismatch_use_model_seed';
                } else if (expectedHash) {
                    this.status = 'hash_verified';
                } else {
                    this.status = 'hash_unset_use_model_seed';
                }

                this.modelHash = this.modelHash && this.modelHash !== 'none'
                    ? this.modelHash
                    : (actualHash || 'none');
                this.seed = this._seedFromArrayBuffer(modelBuf, this.seed);
                this.evalCache.clear();
                this.cacheHits = 0;
                this.cacheMisses = 0;
                this.lastPrefetchStates = 0;

                const sessionReady = await this._createOnnxSession(modelPath, modelBuf);
                this.useOnnx = !!sessionReady;
                this.ready = true;
                if (this.useOnnx) {
                    this.status = 'onnx_ready';
                } else if (this.status === 'hash_verified' || this.status === 'hash_unset_use_model_seed' || this.status === 'hash_mismatch_use_model_seed') {
                    this.status = 'onnx_unavailable_fallback';
                }
            } catch (err) {
                this.ready = false;
                this.status = `load_error:${err && err.message ? err.message : String(err)}`;
            } finally {
                this.loading = false;
            }
        }

        beginDecision() {
            this.lastPrefetchStates = 0;
        }

        async prefetchForDecision(engine, game, team, actions, config) {
            if (!this.ready || !this.useOnnx || !this.session) return;
            const maxStates = Math.max(8, Number(config && config.neuralPrefetchStates ? config.neuralPrefetchStates : 64));
            const states = this._collectPrefetchStates(engine, game, team, actions, maxStates);
            this.lastPrefetchStates = states.length;
            if (!states.length) return;
            await this._runBatchInference(states, team);
        }

        evaluateLeaf(game, team) {
            if (!this.ready) return null;
            const key = this._stateKey(game, team);
            const cached = this.evalCache.get(key);
            if (cached) {
                this.cacheHits += 1;
                return Number(cached.value || 0) * 260;
            }
            this.cacheMisses += 1;
            const features = this._extractFeatures(game, team);
            let acc = 0;
            for (let i = 0; i < features.length; i += 1) {
                const w = this._pseudoWeight(i);
                acc += features[i] * w;
            }
            const norm = Math.tanh(acc / 48.0);
            return norm * 260;
        }

        priorForAction(game, team, actionSig) {
            if (!this.ready) return 0;
            const sig = String(actionSig || '');
            if (!sig) return 0;
            const key = this._stateKey(game, team);
            const cached = this.evalCache.get(key);
            if (cached && cached.policy && cached.policy.length) {
                const idx = this._policyIndexForAction(sig, cached.policy.length);
                const prob = Number(cached.policy[idx] || 0);
                return (prob * 120) - 6;
            }
            const base = this._seedFromString(`${sig}|${team}|${this.seed}`);
            const jitter = ((base % 2001) - 1000) / 1000; // [-1, 1]
            const features = this._extractFeatures(game, team);
            const scalar = features[0] * 0.6 + features[1] * 0.3 + features[2] * 0.1;
            return jitter * 24 + scalar * 8;
        }

        getModelHash() {
            return this.modelHash || 'none';
        }

        getStatus() {
            return this.status;
        }

        getModelVersion() {
            return (this.manifest && this.manifest.version) ? String(this.manifest.version) : 'unknown';
        }

        getCacheStats() {
            return {
                enabled: this.useOnnx,
                size: this.evalCache.size,
                hits: this.cacheHits,
                misses: this.cacheMisses,
                lastPrefetchStates: this.lastPrefetchStates
            };
        }

        _extractFeatures(game, team) {
            const board = game.board;
            const enemy = team === 'black' ? 'white' : 'black';
            let ownAlive = 0;
            let enemyAlive = 0;
            let ownSkillPieces = 0;
            let enemySkillPieces = 0;
            let ownThreat = 0;
            let enemyThreat = 0;

            for (let r = 0; r < board.size; r += 1) {
                for (let c = 0; c < board.size; c += 1) {
                    const cell = board.get_cell(r, c) || [];
                    if (!cell.length) continue;
                    const piece = cell[cell.length - 1];
                    if (!piece || piece.state !== 'alive') continue;

                    const isOwn = piece.team === team;
                    const isEnemy = piece.team === enemy;
                    if (!isOwn && !isEnemy) continue;

                    if (isOwn) {
                        ownAlive += 1;
                        if (piece.name !== '市民' && piece.name !== '老师') ownSkillPieces += 1;
                        if (piece.name === '孩子' || piece.is_red_child || piece.name === '红叶儿') ownThreat += 1.8;
                        if (piece.name === '夜魔' || piece.is_nightmare) ownThreat += 2.2;
                    } else if (isEnemy) {
                        enemyAlive += 1;
                        if (piece.name !== '市民' && piece.name !== '老师') enemySkillPieces += 1;
                        if (piece.name === '孩子' || piece.is_red_child || piece.name === '红叶儿') enemyThreat += 1.8;
                        if (piece.name === '夜魔' || piece.is_nightmare) enemyThreat += 2.2;
                    }
                }
            }

            const turnBias = game.current_turn === team ? 1 : -1;
            const features = [
                ownAlive - enemyAlive,
                ownSkillPieces - enemySkillPieces,
                ownThreat - enemyThreat,
                turnBias,
                (game.death_god_zero_count || 0) * -0.5,
                (game.turn_count || 0) * 0.01
            ];
            return features;
        }

        _extractModelFeatures(game, team) {
            const vec = new Float32Array(128);
            const coarse = this._extractFeatures(game, team);
            for (let i = 0; i < coarse.length && i < 16; i += 1) {
                vec[i] = coarse[i];
            }

            const board = game.board;
            const enemy = team === 'black' ? 'white' : 'black';
            let ownChild = 0;
            let enemyChild = 0;

            for (let r = 0; r < board.size; r += 1) {
                for (let c = 0; c < board.size; c += 1) {
                    const cell = board.get_cell(r, c) || [];
                    if (!cell.length) continue;
                    const piece = cell[cell.length - 1];
                    if (!piece || piece.state !== 'alive') continue;

                    let sign = 0;
                    if (piece.team === team) sign = 1;
                    else if (piece.team === enemy) sign = -1;
                    else if (piece.team === 'neutral') sign = 0.25;
                    if (sign === 0) continue;

                    const typeId = this._pieceTypeId(piece.name);
                    vec[16 + (typeId % 24)] += sign * 0.5;
                    vec[40 + ((r * 12 + c) % 24)] += sign * 0.25;
                    vec[64 + ((typeId * 13 + r * 7 + c * 3) % 48)] += sign * 0.2;

                    if (piece.name === '孩子' || piece.name === '红叶儿' || piece.is_red_child) {
                        if (sign > 0) ownChild += 1;
                        else enemyChild += 1;
                    }
                    if (piece.name === '夜魔' || piece.is_nightmare) {
                        vec[118] += sign * 0.7;
                    }
                    if (piece.name === '僧侣') {
                        vec[119] += sign * 0.5;
                    }
                }
            }

            vec[120] = ownChild - enemyChild;
            vec[121] = Number(game.current_turn === team ? 1 : -1);
            vec[122] = Number(game.turn_count || 0) / 120.0;
            vec[123] = Number(game.death_god_zero_count || 0) / 10.0;
            vec[124] = Number(game.game_over ? 1 : 0);
            vec[125] = Number(game.winner === team ? 1 : (game.winner ? -1 : 0));
            vec[126] = Number(game.action_taken === 'skill' ? 1 : 0);
            vec[127] = Number(game.action_taken === 'move' ? 1 : 0);

            for (let i = 0; i < vec.length; i += 1) {
                if (!Number.isFinite(vec[i])) vec[i] = 0;
                if (vec[i] > 4) vec[i] = 4;
                if (vec[i] < -4) vec[i] = -4;
            }

            return vec;
        }

        _stateKey(game, team) {
            try {
                const board = game.board;
                let text = `${team}|${game.current_turn}|${game.turn_count || 0}|${game.death_god_zero_count || 0}|${game.action_taken || 'none'}`;
                for (let r = 0; r < board.size; r += 1) {
                    for (let c = 0; c < board.size; c += 1) {
                        const cell = board.get_cell(r, c) || [];
                        const piece = cell[cell.length - 1];
                        if (!piece || piece.state !== 'alive') continue;
                        text += `|${r},${c},${piece.name},${piece.team},${piece.state}`;
                    }
                }
                return String(this._seedFromString(text));
            } catch (_err) {
                return String(this._seedFromString(`${team}|fallback_state_key`));
            }
        }

        _pieceTypeId(name) {
            const s = String(name || 'unknown');
            return this._seedFromString(s) % 97;
        }

        _policyIndexForAction(actionSig, dim) {
            const n = this._seedFromString(String(actionSig || ''));
            const d = Math.max(1, Number(dim || this.policyDim || 64));
            return n % d;
        }

        _softmaxRow(row) {
            let maxV = -Infinity;
            for (let i = 0; i < row.length; i += 1) {
                if (row[i] > maxV) maxV = row[i];
            }
            const exps = new Float32Array(row.length);
            let sum = 0;
            for (let i = 0; i < row.length; i += 1) {
                const v = Math.exp(row[i] - maxV);
                exps[i] = v;
                sum += v;
            }
            if (!(sum > 0)) {
                const out = new Float32Array(row.length);
                out[0] = 1;
                return out;
            }
            for (let i = 0; i < exps.length; i += 1) {
                exps[i] /= sum;
            }
            return exps;
        }

        _collectPrefetchStates(engine, game, team, actions, maxStates) {
            const out = [];
            const seen = new Set();
            const addState = (g) => {
                if (!g || out.length >= maxStates) return;
                const key = this._stateKey(g, team);
                if (seen.has(key)) return;
                seen.add(key);
                out.push({ key, game: g });
            };

            addState(game);
            const maxRootActions = Math.min(actions.length, 18);
            for (let i = 0; i < maxRootActions && out.length < maxStates; i += 1) {
                const action = actions[i];
                const specs = (engine._getOutcomeSpecs(action) || []).slice().sort((a, b) => (b.prob || 0) - (a.prob || 0));
                const picked = specs.slice(0, 2);
                for (const outcome of picked) {
                    if (out.length >= maxStates) break;
                    const sim = engine._simulateAction(game, action, outcome.rolls);
                    if (!sim || !sim.simGame) continue;
                    const advanced = engine._advanceTurnDeterministic(sim.simGame);
                    addState(advanced);
                }
            }
            return out;
        }

        async _runBatchInference(states, team) {
            if (!this.session || !this.useOnnx || !states.length) return;
            const batch = states.length;
            const featureDim = 128;
            const flat = new Float32Array(batch * featureDim);
            for (let i = 0; i < batch; i += 1) {
                const features = this._extractModelFeatures(states[i].game, team);
                flat.set(features, i * featureDim);
            }

            const ortApi = global.ort;
            if (!ortApi || typeof ortApi.Tensor !== 'function') return;

            const inputTensor = new ortApi.Tensor('float32', flat, [batch, featureDim]);
            const feeds = {};
            feeds[this.inputName] = inputTensor;
            const results = await this.session.run(feeds);
            const policyTensor = results[this.policyOutputName] || results.policy || results.policy_logits || null;
            const valueTensor = results[this.valueOutputName] || results.value || null;
            if (!policyTensor || !valueTensor || !policyTensor.data || !valueTensor.data) {
                throw new Error('onnx_output_missing');
            }

            const policyData = policyTensor.data;
            const valueData = valueTensor.data;
            const policyRow = Math.max(1, Math.floor(policyData.length / batch));
            const valueRow = Math.max(1, Math.floor(valueData.length / batch));
            this.policyDim = policyRow;

            for (let i = 0; i < batch; i += 1) {
                const offset = i * policyRow;
                const logits = new Float32Array(policyRow);
                for (let j = 0; j < policyRow; j += 1) {
                    logits[j] = Number(policyData[offset + j] || 0);
                }
                const probs = this._softmaxRow(logits);
                const value = Number(valueData[(i * valueRow)] || 0);
                this.evalCache.set(states[i].key, {
                    value: Math.max(-1, Math.min(1, value)),
                    policy: probs
                });
            }

            while (this.evalCache.size > this.maxCacheEntries) {
                const first = this.evalCache.keys().next();
                if (first && typeof first.value !== 'undefined') this.evalCache.delete(first.value);
                else break;
            }
        }

        async _createOnnxSession(modelPath, modelBuf) {
            try {
                if (!global.ort || !global.ort.InferenceSession || typeof global.ort.InferenceSession.create !== 'function') {
                    return false;
                }
                const ortApi = global.ort;
                if (ortApi.env && ortApi.env.wasm) {
                    ortApi.env.wasm.simd = true;
                    ortApi.env.wasm.jsep = false;
                    ortApi.env.wasm.proxy = false;
                    if (!ortApi.env.wasm.wasmPaths) {
                        ortApi.env.wasm.wasmPaths = this._resolveAssetPath('ai/runtime/');
                    }
                }
                const sessionOptions = { executionProviders: ['wasm'] };
                this.session = await ortApi.InferenceSession.create(modelBuf, sessionOptions);
                if (!this.session) return false;
                this.inputName = (this.session.inputNames && this.session.inputNames[0]) ? this.session.inputNames[0] : 'features';
                const outNames = Array.isArray(this.session.outputNames) ? this.session.outputNames : [];
                this.policyOutputName = outNames.includes('policy_logits') ? 'policy_logits' : (outNames[0] || 'policy_logits');
                this.valueOutputName = outNames.includes('value') ? 'value' : (outNames[1] || outNames[0] || 'value');
                return true;
            } catch (err) {
                this.session = null;
                this.status = `onnx_init_failed:${err && err.message ? err.message : String(err)}`;
                return false;
            }
        }

        _resolveAssetPath(pathLike) {
            const raw = String(pathLike || '').trim();
            if (!raw) return '';
            if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
            if (raw.startsWith('/')) return raw;
            return `/${raw.replace(/^\.?\//, '')}`;
        }

        _pseudoWeight(i) {
            const x = (this.seed ^ ((i + 1) * 2654435761)) >>> 0;
            return ((x % 2001) - 1000) / 1000;
        }

        _normalizeHashString(value) {
            if (!value || typeof value !== 'string') return '';
            const raw = value.toLowerCase().replace('sha256:', '').trim();
            return /^[0-9a-f]{64}$/.test(raw) ? raw : '';
        }

        async _sha256Hex(arrayBuffer) {
            try {
                if (!(global.crypto && global.crypto.subtle && typeof global.crypto.subtle.digest === 'function')) {
                    return '';
                }
                const digest = await global.crypto.subtle.digest('SHA-256', arrayBuffer);
                const bytes = new Uint8Array(digest);
                return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (_err) {
                return '';
            }
        }

        _seedFromArrayBuffer(buffer, fallbackSeed) {
            try {
                const bytes = new Uint8Array(buffer);
                let h = 2166136261 >>> 0;
                for (let i = 0; i < bytes.length; i += 97) {
                    h ^= bytes[i];
                    h = Math.imul(h, 16777619) >>> 0;
                }
                return h || fallbackSeed || 1;
            } catch (_err) {
                return fallbackSeed || 1;
            }
        }

        _seedFromString(text) {
            const src = String(text || '');
            let h = 2166136261 >>> 0;
            for (let i = 0; i < src.length; i += 1) {
                h ^= src.charCodeAt(i);
                h = Math.imul(h, 16777619) >>> 0;
            }
            return h || 1;
        }
    }

    class MoleChessAIEngineV2 {
        constructor(options = {}) {
            this.config = Object.assign({
                engineVersion: 'v2',
                difficulty: 'hard',
                timeBudgetMs: 2200,
                nodeBudget: 40000,
                deterministicSeed: 20260220,
                enableNeuralEval: true,
                enableFallback: true
            }, options || {});

            this.legacy = new MoleChessAI();
            this.neural = new NeuralEvalRuntime();
            this.tt = new Map();
            this.zobrist = new Map();
            this.zobristRng = new SeededRNG(this.config.deterministicSeed ^ 0x9e3779b9);
            this.nodeCount = 0;
            this.qNodeCount = 0;
            this.chanceNodeCount = 0;
            this.ttProbeCount = 0;
            this.ttHitCount = 0;
            this.maxDepthReached = 0;
            this.rootBranchFactor = 0;
            this.precomputeHits = { opening: 0, endgame: 0 };
            this.startMs = 0;
            this.trace = [];
            this.requestId = '';
            this.maxQuiescenceDepth = 1;
            this.learning = this._createLearningState();
        }

        setConfig(next) {
            if (!next || typeof next !== 'object') return;
            this.config = Object.assign({}, this.config, next);
        }

        async decide(game, config, requestId = '') {
            this.setConfig(config || {});
            this.requestId = requestId || '';
            this.startMs = this._now();
            this.nodeCount = 0;
            this.qNodeCount = 0;
            this.chanceNodeCount = 0;
            this.ttProbeCount = 0;
            this.ttHitCount = 0;
            this.maxDepthReached = 0;
            this.rootBranchFactor = 0;
            this.precomputeHits = { opening: 0, endgame: 0 };
            this.trace = [];
            this.tt.clear();

            await this.neural.preload(this.config);
            this.trace.push(`neural:${this.neural.getStatus()}`);
            this.neural.beginDecision();
            this._maybeResetLearningMemory(game);

            const team = game.current_turn;
            const actions = this._generateActions(game);
            if (!actions.length) {
                const diagnostics = this._buildDiagnostics([], null);
                return {
                    action: null,
                    score: -MAX_INT,
                    thinkMs: this._elapsed(),
                    usedFallback: true,
                    requestId: this.requestId,
                    trace: ['no_actions'],
                    nodeCount: this.nodeCount,
                    qNodeCount: this.qNodeCount,
                    chanceNodeCount: this.chanceNodeCount,
                    maxDepthReached: this.maxDepthReached,
                    ttProbeCount: this.ttProbeCount,
                    ttHitCount: this.ttHitCount,
                    ttHitRate: diagnostics.ttHitRate,
                    modelHash: this.neural.getModelHash(),
                    modelVersion: this.neural.getModelVersion(),
                    neuralStatus: this.neural.getStatus(),
                    diagnostics
                };
            }
            try {
                await this.neural.prefetchForDecision(this, game, team, actions, this.config);
                const cstats = this.neural.getCacheStats();
                this.trace.push(`neural_prefetch:states=${cstats.lastPrefetchStates}`);
            } catch (err) {
                this.trace.push(`neural_prefetch_err:${err && err.message ? err.message : String(err)}`);
            }

            const maxDepth = this._maxDepthByDifficulty(this.config.difficulty);
            let best = null;

            for (let depth = 1; depth <= maxDepth; depth += 1) {
                if (this._budgetExceeded()) break;
                const rootResult = this._searchRoot(game, actions, depth, team);
                if (!rootResult) break;

                best = rootResult;
                this.maxDepthReached = Math.max(this.maxDepthReached, depth);
                const lp = Number(rootResult.loopPenalty || 0).toFixed(1);
                const lb = Number(rootResult.learnedBias || 0).toFixed(1);
                this.trace.push(`d${depth}: ${rootResult.actionSig} raw=${rootResult.rawScore.toFixed(2)} adj=${rootResult.score.toFixed(2)} lp=${lp} lb=${lb}`);

                if (Math.abs(rootResult.score) >= 900000) {
                    break;
                }
            }

            if (!best) {
                const ordered = this._orderActions(game, actions, team, 0);
                best = {
                    action: ordered[0] || actions[0],
                    score: this._evaluate(game, team),
                    rawScore: this._evaluate(game, team),
                    depth: 0
                };
                this.trace.push('fallback_order_only');
            }

            const learnedMeta = this._rememberDecision(game, team, best);
            const actionSig = best.actionSig || this._actionSignature(best.action);
            this.trace.push(`learn:${actionSig} rs=${learnedMeta.repeatStreak} size=${learnedMeta.memorySize}`);
            const diagnostics = this._buildDiagnostics(actions, best);

            return {
                action: best.action,
                score: best.score,
                rawScore: Number.isFinite(best.rawScore) ? best.rawScore : best.score,
                thinkMs: this._elapsed(),
                usedFallback: false,
                requestId: this.requestId,
                trace: this.trace.slice(-24),
                nodeCount: this.nodeCount,
                qNodeCount: this.qNodeCount,
                chanceNodeCount: this.chanceNodeCount,
                maxDepthReached: this.maxDepthReached,
                ttProbeCount: this.ttProbeCount,
                ttHitCount: this.ttHitCount,
                ttHitRate: diagnostics.ttHitRate,
                modelHash: this.neural.getModelHash(),
                modelVersion: this.neural.getModelVersion(),
                neuralStatus: this.neural.getStatus(),
                team,
                actionSig,
                repeatStreak: learnedMeta.repeatStreak,
                diagnostics
            };
        }

        _searchRoot(game, actions, depth, rootTeam) {
            const boardHashText = this._hashGame(game).toString(16);
            let bestScore = -MAX_INT;
            let bestRawScore = -MAX_INT;
            let bestAction = null;
            let bestActionSig = '';
            let bestLoopPenalty = 0;
            let bestLearnedBias = 0;
            let alpha = -MAX_INT;
            const beta = MAX_INT;

            const ordered = this._orderActions(game, actions, rootTeam, depth);
            const pruned = this._applySelectivePruning(game, ordered, depth);
            this.rootBranchFactor = Math.max(this.rootBranchFactor, pruned.length);

            for (const action of pruned) {
                if (this._budgetExceeded()) break;
                const expected = this._evaluateActionExpected(game, action, depth, rootTeam, alpha, beta, 0);
                if (!expected.valid) continue;
                const actionSig = this._actionSignature(action);
                const loopPenalty = this._computeLoopPenalty(rootTeam, action, actionSig, boardHashText);
                const learnedBias = this._computeLearnedBias(rootTeam, actionSig);
                const adjustedScore = expected.score + learnedBias - loopPenalty;

                if (adjustedScore > bestScore) {
                    bestScore = adjustedScore;
                    bestRawScore = expected.score;
                    bestAction = action;
                    bestActionSig = actionSig;
                    bestLoopPenalty = loopPenalty;
                    bestLearnedBias = learnedBias;
                } else if (adjustedScore === bestScore && expected.score > bestRawScore) {
                    bestRawScore = expected.score;
                    bestAction = action;
                    bestActionSig = actionSig;
                    bestLoopPenalty = loopPenalty;
                    bestLearnedBias = learnedBias;
                } else if (adjustedScore === bestScore && expected.score === bestRawScore && this._compareActionsStable(action, bestAction) < 0) {
                    bestAction = action;
                    bestActionSig = actionSig;
                    bestLoopPenalty = loopPenalty;
                    bestLearnedBias = learnedBias;
                }

                alpha = Math.max(alpha, bestScore);
            }

            if (!bestAction) return null;
            return {
                action: bestAction,
                score: bestScore,
                rawScore: bestRawScore,
                depth,
                actionSig: bestActionSig || this._actionSignature(bestAction),
                loopPenalty: bestLoopPenalty,
                learnedBias: bestLearnedBias
            };
        }

        _createLearningState() {
            return {
                lastTurnCount: null,
                totalDecisions: 0,
                byTeam: {
                    black: this._createTeamLearningState(),
                    white: this._createTeamLearningState()
                }
            };
        }

        _createTeamLearningState() {
            return {
                recentActionSigs: [],
                recentBoardHashes: [],
                actionStats: new Map(),
                lastActionSig: '',
                repeatStreak: 0
            };
        }

        _teamLearning(team) {
            if (team !== 'black' && team !== 'white') return null;
            return this.learning.byTeam[team] || null;
        }

        _maybeResetLearningMemory(game) {
            if (!game) return;
            const turnCount = Number(game.turn_count || 0);
            const prevTurn = this.learning.lastTurnCount;
            if (Number.isFinite(prevTurn)) {
                if (turnCount < prevTurn || (turnCount <= 1 && prevTurn > 1)) {
                    this.learning = this._createLearningState();
                    this.trace.push('learn:session_reset');
                }
            }
            this.learning.lastTurnCount = turnCount;
        }

        _rememberDecision(game, team, best) {
            const mem = this._teamLearning(team);
            if (!mem || !best || !best.action) {
                return { repeatStreak: 0, memorySize: 0 };
            }

            const actionSig = best.actionSig || this._actionSignature(best.action);
            const boardHashText = this._hashGame(game).toString(16);
            const maxWindow = 24;

            mem.recentActionSigs.push(actionSig);
            if (mem.recentActionSigs.length > maxWindow) {
                mem.recentActionSigs = mem.recentActionSigs.slice(-maxWindow);
            }

            mem.recentBoardHashes.push(boardHashText);
            if (mem.recentBoardHashes.length > maxWindow) {
                mem.recentBoardHashes = mem.recentBoardHashes.slice(-maxWindow);
            }

            if (mem.lastActionSig === actionSig) mem.repeatStreak += 1;
            else mem.repeatStreak = 1;
            mem.lastActionSig = actionSig;

            const observedScore = Number.isFinite(best.rawScore)
                ? Number(best.rawScore)
                : (Number.isFinite(best.score) ? Number(best.score) : 0);
            const prior = mem.actionStats.get(actionSig) || { ema: 0, count: 0, lastUsedTurn: -1 };
            const alpha = 0.22;
            const nextEma = prior.count > 0
                ? (prior.ema * (1 - alpha)) + (observedScore * alpha)
                : observedScore;
            const next = {
                ema: nextEma,
                count: prior.count + 1,
                lastUsedTurn: Number(game.turn_count || 0)
            };
            mem.actionStats.set(actionSig, next);
            if (mem.actionStats.size > 128) {
                const firstKey = mem.actionStats.keys().next().value;
                if (typeof firstKey === 'string') mem.actionStats.delete(firstKey);
            }

            this.learning.totalDecisions += 1;
            this.learning.lastTurnCount = Number(game.turn_count || 0);
            return { repeatStreak: mem.repeatStreak, memorySize: mem.actionStats.size };
        }

        _computeLoopPenalty(team, action, actionSig, boardHashText) {
            const mem = this._teamLearning(team);
            if (!mem || !actionSig) return 0;

            let freq = 0;
            for (const sig of mem.recentActionSigs) {
                if (sig === actionSig) freq += 1;
            }

            let tailRepeat = 0;
            for (let i = mem.recentActionSigs.length - 1; i >= 0; i -= 1) {
                if (mem.recentActionSigs[i] !== actionSig) break;
                tailRepeat += 1;
            }

            let boardRepeats = 0;
            for (const bHash of mem.recentBoardHashes) {
                if (bHash === boardHashText) boardRepeats += 1;
            }

            let penalty = (freq * 24) + (tailRepeat * 64);
            if (boardRepeats > 0) {
                penalty += boardRepeats * (36 + (freq * 8));
            }

            if (this._isLoopSensitiveAction(action)) {
                penalty += 42 + (freq * 20) + (tailRepeat * 30);
            }

            if (tailRepeat >= 2) penalty += 120;
            if (tailRepeat >= 3) penalty += 180;
            return penalty;
        }

        _computeLearnedBias(team, actionSig) {
            const mem = this._teamLearning(team);
            if (!mem || !actionSig) return 0;
            const stat = mem.actionStats.get(actionSig);
            if (!stat || stat.count < 2 || !Number.isFinite(stat.ema)) return 0;
            if (stat.ema <= 0) return 0;

            const stability = Math.min(1.6, Math.log2(stat.count + 1) / 3);
            const bias = stat.ema * 0.03 * stability;
            return Math.max(0, Math.min(120, bias));
        }

        _isLoopSensitiveAction(action) {
            if (!action || action.type !== 'skill') return false;
            const name = action.pieceName || '';
            if (name === '僧侣' || name === '孩子' || name === '魔笛手') return true;
            const skill = action.skill || '';
            return skill === 'monk_save' || skill === 'child_learn' || skill === 'piper_destiny';
        }

        _evaluateActionExpected(game, action, depth, rootTeam, alpha, beta, qDepth) {
            const outcomeSpecs = this._getOutcomeSpecs(action);
            if (!outcomeSpecs.length) {
                return { valid: false, score: -MAX_INT };
            }

            let total = 0;
            let valid = false;
            let usedProb = 0;

            for (const outcome of outcomeSpecs) {
                if (this._budgetExceeded()) break;
                this.chanceNodeCount += 1;

                const sim = this._simulateAction(game, action, outcome.rolls);
                if (!sim || !sim.simGame) continue;

                valid = true;
                usedProb += outcome.prob;
                const simGame = sim.simGame;

                const advanced = this._advanceTurnDeterministic(simGame);
                const childDepth = Math.max(0, depth - 1);
                const score = this._searchNode(advanced, childDepth, rootTeam, alpha, beta, qDepth);
                total += score * outcome.prob;
            }

            if (!valid) return { valid: false, score: -MAX_INT };
            if (usedProb <= 0) return { valid: false, score: -MAX_INT };

            return { valid: true, score: total / usedProb };
        }

        _searchNode(game, depth, rootTeam, alpha, beta, qDepth) {
            this.nodeCount += 1;

            const ttKey = this._ttKey(game, depth, rootTeam);
            this.ttProbeCount += 1;
            const cached = this.tt.get(ttKey);
            if (cached && cached.depth >= depth) {
                this.ttHitCount += 1;
                return cached.score;
            }

            if (this._isTerminal(game)) {
                const terminal = this._terminalScore(game, rootTeam);
                this.tt.set(ttKey, { depth, score: terminal });
                return terminal;
            }

            if (depth <= 0) {
                const quietScore = this._quiescence(game, rootTeam, alpha, beta, qDepth);
                this.tt.set(ttKey, { depth, score: quietScore });
                return quietScore;
            }

            if (this._budgetExceeded()) {
                const score = this._evaluate(game, rootTeam);
                this.tt.set(ttKey, { depth, score });
                return score;
            }

            const actions = this._generateActions(game);
            if (!actions.length) {
                const score = this._evaluate(game, rootTeam);
                this.tt.set(ttKey, { depth, score });
                return score;
            }

            const maximizing = game.current_turn === rootTeam;
            const ordered = this._orderActions(game, actions, rootTeam, depth);
            const pruned = this._applySelectivePruning(game, ordered, depth);

            let best = maximizing ? -MAX_INT : MAX_INT;
            let hasValid = false;

            for (const action of pruned) {
                if (this._budgetExceeded()) break;
                const expected = this._evaluateActionExpected(game, action, depth, rootTeam, alpha, beta, qDepth);
                if (!expected.valid) continue;

                hasValid = true;
                if (maximizing) {
                    if (expected.score > best) best = expected.score;
                    if (best > alpha) alpha = best;
                    if (alpha >= beta) break;
                } else {
                    if (expected.score < best) best = expected.score;
                    if (best < beta) beta = best;
                    if (alpha >= beta) break;
                }
            }

            if (!hasValid) best = this._evaluate(game, rootTeam);

            this.tt.set(ttKey, { depth, score: best });
            return best;
        }

        _buildDiagnostics(actions, best) {
            const probes = Number(this.ttProbeCount || 0);
            const hits = Number(this.ttHitCount || 0);
            const ttHitRate = probes > 0 ? (hits / probes) : 0;
            const neuralCache = this.neural.getCacheStats();
            const pv = [];
            if (best && best.action) {
                pv.push(best.actionSig || this._actionSignature(best.action));
            }
            return {
                searchedNodes: Number(this.nodeCount || 0),
                quiescenceNodes: Number(this.qNodeCount || 0),
                chanceNodes: Number(this.chanceNodeCount || 0),
                maxDepthReached: Number(this.maxDepthReached || 0),
                rootActionCount: Array.isArray(actions) ? actions.length : 0,
                rootBranchFactor: Number(this.rootBranchFactor || 0),
                ttProbeCount: probes,
                ttHitCount: hits,
                ttHitRate,
                pv,
                precompute: {
                    openingHits: Number((this.precomputeHits && this.precomputeHits.opening) || 0),
                    endgameHits: Number((this.precomputeHits && this.precomputeHits.endgame) || 0)
                },
                model: {
                    hash: this.neural.getModelHash(),
                    version: this.neural.getModelVersion(),
                    status: this.neural.getStatus(),
                    onnxEnabled: !!neuralCache.enabled,
                    cacheSize: Number(neuralCache.size || 0),
                    cacheHits: Number(neuralCache.hits || 0),
                    cacheMisses: Number(neuralCache.misses || 0),
                    prefetchedStates: Number(neuralCache.lastPrefetchStates || 0)
                }
            };
        }

        _quiescence(game, rootTeam, alpha, beta, qDepth) {
            this.qNodeCount += 1;
            let standPat = this._evaluate(game, rootTeam);

            if (qDepth >= this.maxQuiescenceDepth) {
                return standPat;
            }

            const actions = this._generateActions(game).filter(action => this._isTacticalAction(game, action));
            if (!actions.length) {
                return standPat;
            }

            const maximizing = game.current_turn === rootTeam;
            const ordered = this._orderActions(game, actions, rootTeam, 0).slice(0, 10);

            if (maximizing) {
                if (standPat >= beta) return standPat;
                if (alpha < standPat) alpha = standPat;
            } else {
                if (standPat <= alpha) return standPat;
                if (beta > standPat) beta = standPat;
            }

            let best = standPat;
            for (const action of ordered) {
                const expected = this._evaluateActionExpected(game, action, 0, rootTeam, alpha, beta, qDepth + 1);
                if (!expected.valid) continue;

                if (maximizing) {
                    if (expected.score > best) best = expected.score;
                    if (best > alpha) alpha = best;
                    if (alpha >= beta) break;
                } else {
                    if (expected.score < best) best = expected.score;
                    if (best < beta) beta = best;
                    if (alpha >= beta) break;
                }
            }

            return best;
        }

        _evaluate(game, team) {
            const opponent = team === 'black' ? 'white' : 'black';
            let score = 0;

            score += (typeof game.evaluateBoard === 'function' ? game.evaluateBoard(team) : 0) * 1.0;
            score += this._featureTerminalThreat(game, team, opponent);
            score += this._featureSkillWindow(game, team, opponent);
            score += this._featureResources(game, team, opponent);
            score += this._featureRiskControl(game, team, opponent);

            if (this.config.enableNeuralEval) {
                const neural = this.neural.evaluateLeaf(game, team);
                if (Number.isFinite(neural)) {
                    score += neural;
                }
            }

            return score;
        }

        _featureTerminalThreat(game, team, opponent) {
            let bonus = 0;
            const teamChildAlive = this._hasAliveChild(game, team);
            const oppChildAlive = this._hasAliveChild(game, opponent);

            if (!oppChildAlive) bonus += 9000;
            if (!teamChildAlive) bonus -= 9000;

            if (game.game_over) {
                if (game.winner === team) bonus += 1000000;
                else if (game.winner === opponent) bonus -= 1000000;
            }
            return bonus;
        }

        _featureSkillWindow(game, team, opponent) {
            let bonus = 0;
            if (typeof game.can_use_skill_action === 'function' && game.can_use_skill_action()) {
                bonus += 20;
            }

            const board = game.board;
            for (let r = 0; r < board.size; r += 1) {
                for (let c = 0; c < board.size; c += 1) {
                    const cell = board.get_cell(r, c) || [];
                    const piece = cell[cell.length - 1];
                    if (!piece || piece.state !== 'alive') continue;
                    if (piece.team !== team) continue;

                    if (piece.name === '警察' && typeof piece.get_arrest_targets === 'function') {
                        const targets = piece.get_arrest_targets(board) || [];
                        bonus += Math.min(4, targets.length) * 35;
                    }
                    if (piece.name === '夜魔' || piece.is_nightmare) {
                        bonus += 110;
                    }
                    if (piece.name === '僧侣' && !piece.active_saved_uid) {
                        bonus += 40;
                    }
                }
            }

            if (this._isEnemyPiperInTerritory(game, team)) {
                bonus -= 120;
            }
            if (this._isEnemyPiperInTerritory(game, opponent)) {
                bonus += 120;
            }
            return bonus;
        }

        _featureResources(game, team, opponent) {
            let bonus = 0;
            const ghostPool = game.board && Array.isArray(game.board.ghost_pool) ? game.board.ghost_pool : [];
            for (const piece of ghostPool) {
                if (!piece) continue;
                if (piece.original_team === team || piece.team === team) bonus += 8;
                if (piece.original_team === opponent || piece.team === opponent) bonus -= 8;
            }

            const teamCooldown = this._countCooldowns(game, team);
            const oppCooldown = this._countCooldowns(game, opponent);
            bonus += (oppCooldown - teamCooldown) * 6;

            return bonus;
        }

        _featureRiskControl(game, team, opponent) {
            let bonus = 0;
            const deathPos = this._findDeathGod(game);
            if (!deathPos) return bonus;

            const teamChildren = this._findChildren(game, team);
            const oppChildren = this._findChildren(game, opponent);

            for (const child of teamChildren) {
                const dist = this._chebyshevDistance(child.position, deathPos);
                if (dist <= 1) bonus -= 300;
                else if (dist <= 2) bonus -= 70;
            }
            for (const child of oppChildren) {
                const dist = this._chebyshevDistance(child.position, deathPos);
                if (dist <= 1) bonus += 300;
                else if (dist <= 2) bonus += 70;
            }

            return bonus;
        }

        _countCooldowns(game, team) {
            if (!game || !game.skill_cooldowns) return 0;
            let count = 0;
            for (const [key, value] of Object.entries(game.skill_cooldowns)) {
                if (!key.startsWith(`${team}:`)) continue;
                if (Number(value) > 0) count += 1;
            }
            return count;
        }

        _generateActions(game) {
            return this.legacy._generateActions(game) || [];
        }

        _getOutcomeSpecs(action) {
            return this.legacy._getOutcomeSpecs(action) || [];
        }

        _simulateAction(game, action, rolls) {
            return this.legacy._simulateAction(game, action, rolls);
        }

        _orderActions(game, actions, team, depth) {
            const scored = actions.map(action => {
                const h = this._actionHeuristic(game, action, team, depth);
                const sig = this._actionSignature(action);
                const prior = this.config.enableNeuralEval ? this.neural.priorForAction(game, team, sig) : 0;
                return { action, h: h + prior };
            });

            scored.sort((a, b) => {
                if (a.h !== b.h) return b.h - a.h;
                return this._compareActionsStable(a.action, b.action);
            });

            return scored.map(item => item.action);
        }

        _actionHeuristic(game, action, team, depth) {
            let score = 0;
            const board = game.board;

            if (action.formation) score += 380;

            if (action.type === 'skill') {
                score += 210;
                if (action.pieceName === '警察') score += 220;
                if (action.pieceName === '夜魔') score += 190;
                if (action.pieceName === '僧侣') score += 55;
                if (action.pieceName === '官员') score += 80;
                if (action.pieceName === '广场舞大妈') score += 70;
            }

            if (action.type === 'upgrade') {
                score += 280;
            }

            if (action.type === 'move' && action.to && Array.isArray(action.to)) {
                const targetCell = board.get_cell(action.to[0], action.to[1]) || [];
                const top = targetCell[targetCell.length - 1];
                if (top && top.state === 'alive' && top.team && top.team !== team && top.team !== 'neutral') {
                    score += 220;
                }
                const distCenter = this._chebyshevDistance(action.to, [5, 5]);
                score += Math.max(0, 5 - distCenter) * 8;
            }

            if (typeof this.legacy._actionContextBonus === 'function') {
                score += this.legacy._actionContextBonus(game, action, team) || 0;
            }

            if (depth <= 1 && this._isTacticalAction(game, action)) {
                score += 120;
            }

            return score;
        }

        _applySelectivePruning(game, actions, depth) {
            if (depth < 3 || actions.length < 24) return actions;

            const limitMap = { normal: 14, hard: 24, expert: 36 };
            const limit = limitMap[this.config.difficulty] || 24;
            const head = actions.slice(0, limit);
            const tactical = actions.filter(action => this._isTacticalAction(game, action));
            const merged = head.slice();
            for (const action of tactical) {
                if (!merged.includes(action)) merged.push(action);
            }
            return merged;
        }

        _isTacticalAction(game, action) {
            if (!action) return false;
            if (action.type === 'skill' || action.type === 'upgrade') return true;
            if (action.type !== 'move' || !Array.isArray(action.to)) return false;

            const targetCell = game.board.get_cell(action.to[0], action.to[1]) || [];
            if (!targetCell.length) return false;
            const top = targetCell[targetCell.length - 1];
            if (!top || top.team === 'neutral') return false;
            return top.state === 'alive';
        }

        _advanceTurnDeterministic(simGame) {
            try {
                if (simGame.game_over) return simGame;
                if (typeof simGame.end_turn !== 'function' || typeof simGame.start_turn !== 'function') {
                    return this._fallbackAdvance(simGame);
                }

                const seed = this._seedForGame(simGame);
                const rng = new SeededRNG(seed);
                const forcedRolls = [];
                for (let i = 0; i < 96; i += 1) {
                    forcedRolls.push(rng.nextInt(10));
                }

                DiceEngine.withForcedRolls(forcedRolls, () => {
                    simGame.end_turn();
                    if (!simGame.game_over) simGame.start_turn();
                });

                return simGame;
            } catch (err) {
                return this._fallbackAdvance(simGame);
            }
        }

        _fallbackAdvance(simGame) {
            const nextTurn = simGame.current_turn === 'black' ? 'white' : 'black';
            simGame.current_turn = nextTurn;
            simGame.action_taken = null;
            simGame.turn_count = (simGame.turn_count || 0) + 1;
            return simGame;
        }

        _seedForGame(game) {
            const hash = this._hashGame(game);
            const suffix = Number(BigInt(hash) & BigInt(0xffffffff));
            return (Number(this.config.deterministicSeed) ^ suffix) >>> 0;
        }

        _hashGame(game) {
            let key = BigInt(0);
            const board = game.board;
            for (let r = 0; r < board.size; r += 1) {
                for (let c = 0; c < board.size; c += 1) {
                    const cell = board.get_cell(r, c) || [];
                    for (let i = 0; i < cell.length; i += 1) {
                        const piece = cell[i];
                        if (!piece) continue;
                        key ^= this._zobristKey(`${piece.name}|${piece.team}|${piece.state}|${r}|${c}|${i}`);
                    }
                }
            }
            key ^= this._zobristKey(`turn:${game.current_turn}`);
            key ^= this._zobristKey(`action:${game.action_taken || 'none'}`);
            key ^= this._zobristKey(`t:${game.turn_count || 0}`);
            key ^= this._zobristKey(`z:${game.death_god_zero_count || 0}`);
            return key;
        }

        _zobristKey(id) {
            if (this.zobrist.has(id)) return this.zobrist.get(id);
            const hi = BigInt(this.zobristRng.nextUint32());
            const lo = BigInt(this.zobristRng.nextUint32());
            const val = (hi << BigInt(32)) ^ lo;
            this.zobrist.set(id, val);
            return val;
        }

        _ttKey(game, depth, rootTeam) {
            const h = this._hashGame(game);
            return `${h.toString(16)}|d${depth}|rt:${rootTeam}`;
        }

        _isTerminal(game) {
            return !!(game && game.game_over);
        }

        _terminalScore(game, rootTeam) {
            if (!game || !game.game_over) return this._evaluate(game, rootTeam);
            if (game.winner === rootTeam) return 1000000;
            if (game.winner === 'draw') return 0;
            return -1000000;
        }

        _hasAliveChild(game, team) {
            return this.legacy._hasAliveChild(game, team);
        }

        _isEnemyPiperInTerritory(game, team) {
            return this.legacy._isEnemyPiperInTerritory(game, team);
        }

        _findDeathGod(game) {
            const board = game.board;
            for (let r = 0; r < board.size; r += 1) {
                for (let c = 0; c < board.size; c += 1) {
                    const cell = board.get_cell(r, c) || [];
                    for (const piece of cell) {
                        if (piece && piece.name === '死神' && piece.state === 'alive') return piece.position.slice();
                    }
                }
            }
            return null;
        }

        _findChildren(game, team) {
            const out = [];
            const board = game.board;
            for (let r = 0; r < board.size; r += 1) {
                for (let c = 0; c < board.size; c += 1) {
                    const cell = board.get_cell(r, c) || [];
                    for (const piece of cell) {
                        if (!piece || piece.team !== team || piece.state !== 'alive') continue;
                        if (piece.name === '孩子' || piece.name === '红叶儿' || piece.is_red_child) {
                            out.push(piece);
                        }
                    }
                }
            }
            return out;
        }

        _maxDepthByDifficulty(difficulty) {
            if (difficulty === 'normal') return 3;
            if (difficulty === 'expert') return 5;
            return 4;
        }

        _actionSignature(action) {
            if (!action) return '';
            const parts = [action.type || 'unknown'];
            if (action.pieceName) parts.push(action.pieceName);
            if (Array.isArray(action.from)) parts.push(`f${action.from[0]}_${action.from[1]}`);
            if (Array.isArray(action.to)) parts.push(`t${action.to[0]}_${action.to[1]}`);
            if (Array.isArray(action.pos)) parts.push(`p${action.pos[0]}_${action.pos[1]}`);
            if (Array.isArray(action.targetPos)) parts.push(`x${action.targetPos.join('_')}`);
            if (action.upgradeTo) parts.push(`u${action.upgradeTo}`);
            if (action.skill) parts.push(`s${action.skill}`);
            if (action.formation) parts.push('v');
            return parts.join('|');
        }

        _compareActionsStable(a, b) {
            if (!a && !b) return 0;
            if (!a) return 1;
            if (!b) return -1;
            const sa = this._actionSignature(a);
            const sb = this._actionSignature(b);
            if (sa < sb) return -1;
            if (sa > sb) return 1;
            return 0;
        }

        _chebyshevDistance(a, b) {
            if (!Array.isArray(a) || !Array.isArray(b)) return 0;
            return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
        }

        _now() {
            if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
                return performance.now();
            }
            return Date.now();
        }

        _elapsed() {
            return Math.max(0, this._now() - this.startMs);
        }

        _budgetExceeded() {
            if (this.nodeCount >= Number(this.config.nodeBudget || 0)) return true;
            if (this._elapsed() >= Number(this.config.timeBudgetMs || 0)) return true;
            return false;
        }
    }

    global.MoleChessAIEngineV2 = MoleChessAIEngineV2;
})(typeof self !== 'undefined' ? self : globalThis);
