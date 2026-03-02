(function () {
    'use strict';

    function safeImport(path) {
        try {
            importScripts(path);
            return true;
        } catch (err) {
            return false;
        }
    }

    if (typeof self !== 'undefined' && !self.MoleChessCore) {
        safeImport('../../game_core.js');
    }
    if (typeof self !== 'undefined' && !self.ort) {
        safeImport('../runtime/ort.min.js');
    }
    if (typeof self !== 'undefined' && !self.MoleChessAIEngineV2) {
        safeImport('../engine_v2.js');
    }

    const core = self.MoleChessCore;
    const EngineCtor = self.MoleChessAIEngineV2;

    if (!core || !EngineCtor) {
        self.postMessage({
            type: 'AI_WORKER_READY',
            payload: {
                ok: false,
                message: 'Missing MoleChessCore or MoleChessAIEngineV2 in worker context.'
            }
        });
        return;
    }

    const engine = new EngineCtor({ engineVersion: 'v2' });

    self.postMessage({
        type: 'AI_WORKER_READY',
        payload: {
            ok: true,
            engineVersion: 'v2'
        }
    });

    self.onmessage = async function (event) {
        const data = event && event.data ? event.data : {};
        if (!data || data.type !== 'AI_DECIDE') return;

        const payload = data.payload || {};
        const requestId = payload.requestId || '';
        try {
            const serializedGame = payload.serializedGame;
            const config = payload.config || {};

            const game = core.deserializeGame(serializedGame);
            const result = await engine.decide(game, config, requestId);

            self.postMessage({
                type: 'AI_DECIDE_RESULT',
                payload: {
                    action: result.action || null,
                    score: Number.isFinite(result.score) ? result.score : null,
                    rawScore: Number.isFinite(result.rawScore) ? result.rawScore : null,
                    thinkMs: Number.isFinite(result.thinkMs) ? result.thinkMs : null,
                    usedFallback: result.usedFallback === true,
                    requestId,
                    trace: Array.isArray(result.trace) ? result.trace : [],
                    nodeCount: result.nodeCount || 0,
                    qNodeCount: result.qNodeCount || 0,
                    chanceNodeCount: result.chanceNodeCount || 0,
                    maxDepthReached: result.maxDepthReached || 0,
                    ttProbeCount: result.ttProbeCount || 0,
                    ttHitCount: result.ttHitCount || 0,
                    ttHitRate: Number.isFinite(result.ttHitRate) ? result.ttHitRate : 0,
                    modelHash: result.modelHash || 'none',
                    modelVersion: result.modelVersion || 'unknown',
                    neuralStatus: result.neuralStatus || 'unknown',
                    team: result.team || '',
                    actionSig: result.actionSig || '',
                    repeatStreak: Number(result.repeatStreak || 0),
                    diagnostics: result.diagnostics || null
                }
            });
        } catch (err) {
            self.postMessage({
                type: 'AI_DECIDE_RESULT',
                payload: {
                    action: null,
                    score: null,
                    thinkMs: null,
                    usedFallback: true,
                    requestId,
                    trace: [`worker_error:${err && err.message ? err.message : String(err)}`],
                    nodeCount: 0,
                    qNodeCount: 0,
                    chanceNodeCount: 0,
                    maxDepthReached: 0,
                    ttProbeCount: 0,
                    ttHitCount: 0,
                    ttHitRate: 0,
                    modelHash: 'none',
                    modelVersion: 'unknown',
                    neuralStatus: 'worker_error',
                    team: '',
                    actionSig: '',
                    repeatStreak: 0,
                    diagnostics: null
                }
            });
        }
    };
})();
