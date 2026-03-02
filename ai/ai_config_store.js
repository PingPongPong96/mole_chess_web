(function (global) {
    'use strict';

    const STORAGE_KEY = 'mole_chess_ai_config';
    const DEFAULT_CONFIG = {
        engineVersion: 'v2',
        difficulty: 'hard',
        timeBudgetMs: 2200,
        nodeBudget: 40000,
        deterministicSeed: 20260220,
        enableNeuralEval: true,
        enableFallback: true
    };

    const DIFFICULTY_PRESETS = {
        normal: { timeBudgetMs: 1000, nodeBudget: 10000 },
        hard: { timeBudgetMs: 2200, nodeBudget: 40000 },
        expert: { timeBudgetMs: 5000, nodeBudget: 120000 }
    };

    function safeGet(key) {
        try {
            return global.localStorage ? global.localStorage.getItem(key) : null;
        } catch (err) {
            return null;
        }
    }

    function safeSet(key, value) {
        try {
            if (global.localStorage) global.localStorage.setItem(key, value);
        } catch (err) {
            // ignore
        }
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function clampInt(value, fallback, min, max) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        const rounded = Math.floor(n);
        if (rounded < min) return min;
        if (rounded > max) return max;
        return rounded;
    }

    function normalizeDifficulty(raw) {
        const val = typeof raw === 'string' ? raw.toLowerCase() : '';
        return Object.prototype.hasOwnProperty.call(DIFFICULTY_PRESETS, val) ? val : DEFAULT_CONFIG.difficulty;
    }

    function normalizeEngineVersion(raw) {
        const val = typeof raw === 'string' ? raw.toLowerCase() : '';
        return (val === 'v1' || val === 'v2') ? val : DEFAULT_CONFIG.engineVersion;
    }

    function normalizeConfig(raw) {
        const incoming = (raw && typeof raw === 'object') ? raw : {};
        const difficulty = normalizeDifficulty(incoming.difficulty);
        const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.hard;

        return {
            engineVersion: normalizeEngineVersion(incoming.engineVersion),
            difficulty,
            timeBudgetMs: clampInt(incoming.timeBudgetMs, preset.timeBudgetMs, 100, 15000),
            nodeBudget: clampInt(incoming.nodeBudget, preset.nodeBudget, 1000, 500000),
            deterministicSeed: clampInt(incoming.deterministicSeed, DEFAULT_CONFIG.deterministicSeed, 1, 2147483646),
            enableNeuralEval: incoming.enableNeuralEval !== false,
            enableFallback: incoming.enableFallback !== false
        };
    }

    function readConfig() {
        const raw = safeGet(STORAGE_KEY);
        if (!raw) return clone(DEFAULT_CONFIG);
        try {
            return normalizeConfig(JSON.parse(raw));
        } catch (err) {
            return clone(DEFAULT_CONFIG);
        }
    }

    function writeConfig(next) {
        const normalized = normalizeConfig(next);
        safeSet(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function mergeConfig(base, overrides) {
        const merged = Object.assign({}, normalizeConfig(base), normalizeConfig(overrides));
        merged.difficulty = normalizeDifficulty(overrides && overrides.difficulty ? overrides.difficulty : merged.difficulty);
        return normalizeConfig(merged);
    }

    function resolveConfig(overrides, modeHint) {
        const stored = readConfig();
        let difficultyHint = null;
        if (modeHint === 'ai_vs_ai') difficultyHint = 'expert';
        if (modeHint === 'pve') difficultyHint = 'hard';

        const merged = mergeConfig(stored, overrides || {});
        if (difficultyHint && (!overrides || !overrides.difficulty)) {
            const preset = DIFFICULTY_PRESETS[difficultyHint];
            merged.difficulty = difficultyHint;
            merged.timeBudgetMs = preset.timeBudgetMs;
            merged.nodeBudget = preset.nodeBudget;
        }
        return normalizeConfig(merged);
    }

    global.MoleChessAIConfigStore = {
        STORAGE_KEY,
        DEFAULT_CONFIG,
        DIFFICULTY_PRESETS,
        normalizeConfig,
        readConfig,
        writeConfig,
        mergeConfig,
        resolveConfig
    };
})(typeof window !== 'undefined' ? window : globalThis);
