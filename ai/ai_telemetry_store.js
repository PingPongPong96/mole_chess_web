(function (global) {
    'use strict';

    const STORAGE_KEY = 'mole_chess_ai_telemetry';
    const MAX_DECISIONS = 50;

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

    function detectPlatformTag() {
        try {
            const ua = (global.navigator && global.navigator.userAgent) ? global.navigator.userAgent : 'unknown';
            if (/MicroMessenger/i.test(ua)) return 'wechat_webview';
            if (/Android/i.test(ua)) return 'android_browser';
            if (/iPhone|iPad|iPod/i.test(ua)) return 'ios_browser';
            if (/Windows/i.test(ua)) return 'desktop_windows';
            if (/Macintosh/i.test(ua)) return 'desktop_macos';
            return 'web_unknown';
        } catch (err) {
            return 'web_unknown';
        }
    }

    function defaultTelemetry() {
        return {
            fallbackCount: 0,
            avgThinkMs: 0,
            skillActionRate: 0,
            engineVersion: 'v1',
            platformTag: detectPlatformTag(),
            last50Decisions: [],
            sampleCount: 0,
            updatedAt: new Date().toISOString()
        };
    }

    function normalizeDecision(entry) {
        const src = (entry && typeof entry === 'object') ? entry : {};
        const team = (src.team === 'black' || src.team === 'white') ? src.team : '';
        const repeatStreakRaw = Number(src.repeatStreak);
        const repeatStreak = Number.isFinite(repeatStreakRaw) && repeatStreakRaw > 0
            ? Math.floor(repeatStreakRaw)
            : 0;
        return {
            ts: typeof src.ts === 'string' ? src.ts : new Date().toISOString(),
            requestId: src.requestId || '',
            actionType: src.actionType || 'unknown',
            thinkMs: Number.isFinite(Number(src.thinkMs)) ? Number(src.thinkMs) : 0,
            usedFallback: src.usedFallback === true,
            fallbackLevel: Number.isFinite(Number(src.fallbackLevel)) ? Number(src.fallbackLevel) : 0,
            score: Number.isFinite(Number(src.score)) ? Number(src.score) : null,
            traceDigest: typeof src.traceDigest === 'string' ? src.traceDigest : '',
            team,
            actionSig: typeof src.actionSig === 'string' ? src.actionSig : '',
            repeatStreak
        };
    }

    function normalizeTelemetry(raw) {
        const base = defaultTelemetry();
        const src = (raw && typeof raw === 'object') ? raw : {};
        const decisions = Array.isArray(src.last50Decisions)
            ? src.last50Decisions.map(normalizeDecision).slice(-MAX_DECISIONS)
            : [];

        base.fallbackCount = Number.isFinite(Number(src.fallbackCount)) ? Number(src.fallbackCount) : 0;
        base.avgThinkMs = Number.isFinite(Number(src.avgThinkMs)) ? Number(src.avgThinkMs) : 0;
        base.skillActionRate = Number.isFinite(Number(src.skillActionRate)) ? Number(src.skillActionRate) : 0;
        base.engineVersion = typeof src.engineVersion === 'string' ? src.engineVersion : base.engineVersion;
        base.platformTag = typeof src.platformTag === 'string' ? src.platformTag : base.platformTag;
        base.last50Decisions = decisions;
        base.sampleCount = Number.isFinite(Number(src.sampleCount)) ? Number(src.sampleCount) : decisions.length;
        base.updatedAt = typeof src.updatedAt === 'string' ? src.updatedAt : base.updatedAt;
        return base;
    }

    function readTelemetry() {
        const raw = safeGet(STORAGE_KEY);
        if (!raw) return defaultTelemetry();
        try {
            return normalizeTelemetry(JSON.parse(raw));
        } catch (err) {
            return defaultTelemetry();
        }
    }

    function writeTelemetry(next) {
        const normalized = normalizeTelemetry(next);
        normalized.updatedAt = new Date().toISOString();
        safeSet(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function digestTrace(trace) {
        if (!trace) return '';
        const text = typeof trace === 'string' ? trace : JSON.stringify(trace);
        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return `fnv1a:${(hash >>> 0).toString(16)}`;
    }

    function recordDecision(input) {
        const current = readTelemetry();
        const entry = normalizeDecision({
            ts: new Date().toISOString(),
            requestId: input && input.requestId,
            actionType: input && input.actionType,
            thinkMs: input && input.thinkMs,
            usedFallback: input && input.usedFallback,
            fallbackLevel: input && input.fallbackLevel,
            score: input && input.score,
            traceDigest: (input && input.traceDigest) || digestTrace(input && input.trace),
            team: input && input.team,
            actionSig: input && input.actionSig,
            repeatStreak: input && input.repeatStreak
        });

        current.sampleCount += 1;
        current.avgThinkMs = ((current.avgThinkMs * (current.sampleCount - 1)) + entry.thinkMs) / current.sampleCount;
        if (entry.usedFallback) current.fallbackCount += 1;

        current.engineVersion = (input && input.engineVersion) || current.engineVersion;
        current.platformTag = (input && input.platformTag) || current.platformTag || detectPlatformTag();

        current.last50Decisions.push(entry);
        if (current.last50Decisions.length > MAX_DECISIONS) {
            current.last50Decisions = current.last50Decisions.slice(-MAX_DECISIONS);
        }

        const total = current.last50Decisions.length || 1;
        const skillCount = current.last50Decisions.filter(item => item.actionType === 'skill').length;
        current.skillActionRate = skillCount / total;

        return writeTelemetry(current);
    }

    function resetTelemetry() {
        return writeTelemetry(defaultTelemetry());
    }

    global.MoleChessAITelemetryStore = {
        STORAGE_KEY,
        MAX_DECISIONS,
        defaultTelemetry,
        normalizeTelemetry,
        readTelemetry,
        writeTelemetry,
        digestTrace,
        recordDecision,
        resetTelemetry,
        detectPlatformTag
    };
})(typeof window !== 'undefined' ? window : globalThis);
