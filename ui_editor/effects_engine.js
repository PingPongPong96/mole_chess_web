(function (global) {
    'use strict';

    const schema = global.MoleChessUISchema;
    const cfg = schema || {
        SCHEMA_VERSION: '3.0',
        SURFACES: { entry: {}, index: {} },
        STORAGE_KEYS: {
            themePack: 'mole_chess_theme_pack_v3',
            effectsPack: 'mole_chess_effects_pack_v3',
            assetManifest: 'mole_chess_ui_assets_manifest_v1'
        },
        LEGACY_STORAGE_KEYS: {
            themePack: 'mole_chess_theme_pack_v2',
            effectsPack: 'mole_chess_effects_pack_v2',
            themeCss: 'mole_chess_theme_css',
            effectsConfig: 'mole_chess_effects_config'
        },
        normalizeThemePack: (x) => x || { surfaces: { index: {}, entry: {} } },
        normalizeEffectsPack: (x) => x || { surfaces: { index: { events: {}, scenePlacements: [] }, entry: { events: {}, scenePlacements: [] } } },
        normalizeAssetManifest: (x) => x || { backgrounds: { entry: '', game: '', board: '' }, pieceIcons: {}, scenePlacements: { entry: [], index: [] } },
        normalizeEventConfig: (x) => x || { enabled: true, logic: 'AND', cooldownMs: 0, conditions: [], actions: [] }
    };

    const STYLE_THEME = 'mole-chess-runtime-theme-style';
    const STYLE_EFFECT = 'mole-chess-runtime-effect-style';
    const STYLE_ASSET = 'mole-chess-runtime-asset-style';
    const SCENE_LAYER_ID = 'mole-chess-scene-layer';

    const EVENT_ALIAS = {
        click_piece_select: 'select_piece',
        click_cell_move: 'move_start',
        click_cell_capture: 'capture_execute',
        skill_critical: 'skill_ultimate'
    };
    const REVERSE_ALIAS = buildReverseAlias(EVENT_ALIAS);

    const eventCooldownMap = new Map();
    const actionCooldownMap = new Map();
    let activeSurface = detectSurface();
    let themePack = loadThemePack();
    let effectsPack = loadEffectsPack();
    let assetManifest = loadAssetManifest();
    let bgmAudio = null;

    function buildReverseAlias(map) {
        const out = {};
        Object.keys(map).forEach((key) => {
            const target = map[key];
            if (!out[target]) out[target] = [];
            out[target].push(key);
        });
        return out;
    }

    function nowMs() {
        return Date.now();
    }

    function safeGet(key) {
        try { return global.localStorage ? global.localStorage.getItem(key) : null; } catch (_e) { return null; }
    }

    function safeSet(key, value) {
        try { if (global.localStorage) global.localStorage.setItem(key, value); } catch (_e) { }
    }

    function parseJson(raw, fallback) {
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch (_e) { return fallback; }
    }

    function readJson(key, fallback) {
        return parseJson(safeGet(key), fallback);
    }

    function ensureStyle(id) {
        let node = document.getElementById(id);
        if (!node) {
            node = document.createElement('style');
            node.id = id;
            document.head.appendChild(node);
        }
        return node;
    }

    function detectSurface() {
        try {
            if (document.body && document.body.dataset && document.body.dataset.mcSurface) return document.body.dataset.mcSurface;
            const path = (global.location && global.location.pathname ? global.location.pathname : '').toLowerCase();
            if (path.includes('/game.html')) return 'index';
            if (path.endsWith('/index.html') || path === '/' || path.endsWith('/index')) return 'entry';
            return 'index';
        } catch (_e) {
            return 'index';
        }
    }

    function loadThemePack() {
        const v3 = readJson(cfg.STORAGE_KEYS.themePack, null);
        if (v3) return cfg.normalizeThemePack(v3);
        const legacy = readJson(cfg.LEGACY_STORAGE_KEYS.themePack, null);
        const next = cfg.normalizeThemePack(legacy);
        const legacyCss = safeGet(cfg.LEGACY_STORAGE_KEYS.themeCss);
        if (legacyCss && next.surfaces && next.surfaces.index && !next.surfaces.index.extraCss) {
            next.surfaces.index.extraCss = legacyCss;
            next.surfaces.index.cssText = legacyCss;
        }
        return next;
    }

    function loadEffectsPack() {
        const v3 = readJson(cfg.STORAGE_KEYS.effectsPack, null);
        if (v3) return cfg.normalizeEffectsPack(v3);
        const legacy = readJson(cfg.LEGACY_STORAGE_KEYS.effectsPack, null);
        const next = cfg.normalizeEffectsPack(legacy);
        const oldCfg = readJson(cfg.LEGACY_STORAGE_KEYS.effectsConfig, null);
        if (oldCfg && oldCfg.events && next.surfaces && next.surfaces.index && !Object.keys(next.surfaces.index.events || {}).length) {
            const mapped = {};
            Object.keys(oldCfg.events).forEach((eventId) => {
                mapped[eventId] = cfg.normalizeEventConfig(oldCfg.events[eventId]);
            });
            next.surfaces.index.events = mapped;
        }
        return next;
    }

    function loadAssetManifest() {
        return cfg.normalizeAssetManifest(readJson(cfg.STORAGE_KEYS.assetManifest, null));
    }

    function saveThemePack() {
        safeSet(cfg.STORAGE_KEYS.themePack, JSON.stringify(themePack));
    }

    function saveEffectsPack() {
        safeSet(cfg.STORAGE_KEYS.effectsPack, JSON.stringify(effectsPack));
    }

    function saveAssetManifest() {
        safeSet(cfg.STORAGE_KEYS.assetManifest, JSON.stringify(assetManifest));
    }

    function cssForSurface(surfaceId) {
        const surface = themePack && themePack.surfaces ? themePack.surfaces[surfaceId] : null;
        if (!surface) return '';
        if (typeof surface.cssText === 'string' && surface.cssText.trim()) return surface.cssText;
        return typeof surface.extraCss === 'string' ? surface.extraCss : '';
    }

    function applyThemeCss(cssText) {
        ensureStyle(STYLE_THEME).textContent = typeof cssText === 'string' ? cssText : '';
    }

    function getSurfaceEffects(surfaceId) {
        if (!effectsPack || !effectsPack.surfaces) return { events: {}, scenePlacements: [] };
        return effectsPack.surfaces[surfaceId] || { events: {}, scenePlacements: [] };
    }

    function clamp(value, min, max, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        if (num < min) return min;
        if (num > max) return max;
        return num;
    }

    function getTargetElement(context) {
        if (context && context.element instanceof Element) return context.element;
        if (context && context.targetElement instanceof Element) return context.targetElement;
        return document.body;
    }

    function ensureSceneLayer() {
        let layer = document.getElementById(SCENE_LAYER_ID);
        if (!layer) {
            layer = document.createElement('div');
            layer.id = SCENE_LAYER_ID;
            layer.style.position = 'fixed';
            layer.style.inset = '0';
            layer.style.pointerEvents = 'none';
            layer.style.zIndex = '9100';
            document.body.appendChild(layer);
        }
        return layer;
    }

    function normalizeAnchor(anchor) {
        const value = String(anchor || 'center');
        if (value === 'top-left' || value === 'top-right' || value === 'bottom-left' || value === 'bottom-right' || value === 'center') {
            return value;
        }
        return 'center';
    }

    function anchorTransform(anchor) {
        if (anchor === 'top-left') return 'translate(0,0)';
        if (anchor === 'top-right') return 'translate(-100%,0)';
        if (anchor === 'bottom-left') return 'translate(0,-100%)';
        if (anchor === 'bottom-right') return 'translate(-100%,-100%)';
        return 'translate(-50%,-50%)';
    }

    function renderPlacementElement(parent, placement, url) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mcfx-material mcfx-scene-placement';
        wrapper.dataset.placementId = String(placement.id || '');
        wrapper.style.left = `${clamp(placement.x, -200, 200, 50)}%`;
        wrapper.style.top = `${clamp(placement.y, -200, 200, 50)}%`;
        wrapper.style.width = `${clamp(placement.width, 1, 200, 20)}vw`;
        wrapper.style.height = `${clamp(placement.height, 1, 200, 20)}vh`;
        wrapper.style.opacity = String(clamp(placement.opacity, 0, 1, 1));
        wrapper.style.zIndex = String(clamp(placement.zIndex, 1, 99999, 20));
        wrapper.style.mixBlendMode = placement.blendMode || 'normal';
        wrapper.style.transform = anchorTransform(normalizeAnchor(placement.anchor));
        if (placement.vfxPreset) wrapper.classList.add(`mcfx-vfx-${placement.vfxPreset}`);

        const img = document.createElement('img');
        img.src = url;
        img.alt = placement.label || placement.id || 'placement';
        wrapper.appendChild(img);
        parent.appendChild(wrapper);
    }

    async function resolveAssetPath(path, assetId) {
        if (typeof path === 'string' && path.trim()) return path.trim();
        if (!assetId || !global.MoleChessAssetStore || typeof global.MoleChessAssetStore.resolveAssetUrl !== 'function') return '';
        try {
            return await global.MoleChessAssetStore.resolveAssetUrl(assetId);
        } catch (_e) {
            return '';
        }
    }

    function getScenePlacements(surfaceId) {
        const fromManifest = assetManifest && assetManifest.scenePlacements && Array.isArray(assetManifest.scenePlacements[surfaceId])
            ? assetManifest.scenePlacements[surfaceId]
            : [];
        const fromEffects = getSurfaceEffects(surfaceId).scenePlacements;
        return fromManifest.concat(Array.isArray(fromEffects) ? fromEffects : []);
    }

    async function renderScenePlacements() {
        const layer = ensureSceneLayer();
        layer.innerHTML = '';
        const placements = getScenePlacements(activeSurface);
        if (!placements.length) return;
        for (const placement of placements) {
            if (!placement || !placement.assetId) continue;
            const url = await resolveAssetPath('', placement.assetId);
            if (!url) continue;
            renderPlacementElement(layer, placement, url);
        }
    }

    async function applySurfaceAssets() {
        const css = [];
        const backgrounds = assetManifest && assetManifest.backgrounds ? assetManifest.backgrounds : {};

        if (activeSurface === 'entry' && backgrounds.entry) {
            const url = await resolveAssetPath('', backgrounds.entry);
            if (url) css.push(`body[data-mc-surface="entry"]{background-image:url("${url}") !important;background-size:cover !important;background-position:center !important;}`);
        }

        if (activeSurface === 'index') {
            if (backgrounds.game) {
                const gameUrl = await resolveAssetPath('', backgrounds.game);
                if (gameUrl) css.push(`body[data-mc-surface="index"] .app-container{background-image:url("${gameUrl}") !important;background-size:cover !important;background-position:center !important;}`);
            }
            if (backgrounds.board) {
                const boardUrl = await resolveAssetPath('', backgrounds.board);
                if (boardUrl) css.push(`body[data-mc-surface="index"] .board-grid{background-image:url("${boardUrl}") !important;background-size:cover !important;background-position:center !important;}`);
            }

            const iconMap = assetManifest && assetManifest.pieceIcons && typeof assetManifest.pieceIcons === 'object'
                ? assetManifest.pieceIcons
                : {};
            const anyRules = [];
            const exactRules = [];
            const keys = Object.keys(iconMap);
            for (const key of keys) {
                const assetId = iconMap[key];
                if (!assetId) continue;
                const parts = key.split('|');
                const pieceType = parts[0];
                const team = parts[1] || 'any';
                if (!pieceType) continue;
                const iconUrl = await resolveAssetPath('', assetId);
                if (!iconUrl) continue;
                const base = `body[data-mc-surface="index"] .piece[data-piece-type="${pieceType}"]`;
                const selector = team === 'any' ? base : `${base}[data-piece-team="${team}"]`;
                const rule = `${selector}{background-image:url("${iconUrl}") !important;background-size:cover !important;background-position:center !important;color:transparent !important;text-shadow:none !important;}`;
                if (team === 'any') anyRules.push(rule);
                else exactRules.push(rule);
            }
            css.push(...anyRules, ...exactRules);
        }

        ensureStyle(STYLE_ASSET).textContent = css.join('\n');
        await renderScenePlacements();
    }

    function overlayElement(className, durationMs, stylePatch) {
        const overlay = document.createElement('div');
        overlay.className = className;
        if (stylePatch && typeof stylePatch === 'object') {
            Object.keys(stylePatch).forEach((key) => {
                overlay.style[key] = stylePatch[key];
            });
        }
        document.body.appendChild(overlay);
        const duration = clamp(durationMs, 60, 60000, 800);
        setTimeout(() => overlay.remove(), duration);
    }

    function runOverlayPreset(preset, context, action) {
        const target = getTargetElement(context);
        if (!preset || preset === 'none') return;
        if (preset === 'flash-white') {
            overlayElement('mcfx-overlay-flash white', action && action.durationMs);
            return;
        }
        if (preset === 'flash-red') {
            overlayElement('mcfx-overlay-flash red', action && action.durationMs);
            return;
        }
        if (preset === 'shake-screen') {
            document.body.classList.add('mcfx-screen-shake');
            setTimeout(() => document.body.classList.remove('mcfx-screen-shake'), 520);
            return;
        }
        if (preset === 'pulse-screen') {
            document.body.classList.add('mcfx-screen-pulse');
            setTimeout(() => document.body.classList.remove('mcfx-screen-pulse'), 780);
            return;
        }
        if (preset === 'shake-target') {
            target.classList.add('mcfx-shake-target');
            setTimeout(() => target.classList.remove('mcfx-shake-target'), 520);
            return;
        }
        if (preset === 'pulse-target') {
            target.classList.add('mcfx-pulse-target');
            setTimeout(() => target.classList.remove('mcfx-pulse-target'), 720);
            return;
        }
        if (preset === 'pc98_scanline_flicker') {
            overlayElement('mcfx-overlay-scanline', action && action.durationMs, { animation: 'mcfxPc98Flicker 420ms steps(4,end)' });
            return;
        }
        if (preset === 'pc98_crt_bloom') {
            overlayElement('mcfx-overlay-crt', action && action.durationMs);
            return;
        }
        if (preset === 'pc98_line_wipe') {
            overlayElement('mcfx-overlay-wipe', action && action.durationMs);
            return;
        }
        if (preset === 'pc98_palette_flash') {
            overlayElement('mcfx-overlay-flash white', action && action.durationMs, { mixBlendMode: 'difference', opacity: '0.9' });
            return;
        }
        if (preset === 'pc98_glitch_shift') {
            document.body.classList.add('mcfx-pc98-glitch');
            setTimeout(() => document.body.classList.remove('mcfx-pc98-glitch'), 420);
            return;
        }
        if (preset === 'pc98_pixel_pop') {
            target.classList.add('mcfx-pulse-target');
            setTimeout(() => target.classList.remove('mcfx-pulse-target'), 300);
        }
    }

    async function spawnMaterial(action, context) {
        const url = await resolveAssetPath(action.path, action.assetId);
        if (!url) return;

        const layer = ensureSceneLayer();
        const wrapper = document.createElement('div');
        wrapper.className = 'mcfx-material';
        if (action.vfxPreset) wrapper.classList.add(`mcfx-vfx-${action.vfxPreset}`);
        wrapper.style.left = `${clamp(action.x, -200, 200, 50)}%`;
        wrapper.style.top = `${clamp(action.y, -200, 200, 50)}%`;
        wrapper.style.width = `${clamp(action.width, 1, 200, 30)}vw`;
        wrapper.style.height = `${clamp(action.height, 1, 200, 30)}vh`;
        wrapper.style.zIndex = String(clamp(action.zIndex, 1, 99999, 9998));
        wrapper.style.mixBlendMode = action.blendMode || 'normal';
        wrapper.style.transform = anchorTransform(normalizeAnchor(action.anchor));

        const img = document.createElement('img');
        img.src = url;
        img.alt = 'material';
        wrapper.appendChild(img);
        layer.appendChild(wrapper);

        const durationMs = clamp(action.durationMs, 120, 60000, 1200);
        setTimeout(() => wrapper.remove(), durationMs);
        runOverlayPreset(action.vfxPreset, context, action);
    }

    function ensureBgmAudio() {
        if (bgmAudio && bgmAudio instanceof HTMLAudioElement) return bgmAudio;
        bgmAudio = document.getElementById('bgm-player');
        if (!bgmAudio) {
            bgmAudio = document.createElement('audio');
            bgmAudio.id = 'bgm-player';
            bgmAudio.loop = true;
            bgmAudio.style.display = 'none';
            document.body.appendChild(bgmAudio);
        }
        return bgmAudio;
    }

    function playSfx(path, volume) {
        if (!path) return;
        try {
            const audio = new Audio(path);
            audio.volume = clamp(volume, 0, 1, 0.7);
            audio.play().catch(() => { });
        } catch (_e) { }
    }

    function playBgm(path, volume) {
        if (!path) return;
        const audio = ensureBgmAudio();
        audio.src = path;
        audio.volume = clamp(volume, 0, 1, 0.7);
        audio.play().catch(() => { });
    }

    function applyCssClass(target, cssClass, durationMs) {
        if (!target || !cssClass) return;
        target.classList.add(cssClass);
        if (durationMs > 0) {
            setTimeout(() => target.classList.remove(cssClass), clamp(durationMs, 60, 60000, 700));
        }
    }

    function normalizedEventIds(eventId) {
        const canonical = EVENT_ALIAS[eventId] || eventId;
        const list = [canonical];
        if (REVERSE_ALIAS[canonical]) {
            REVERSE_ALIAS[canonical].forEach((alias) => {
                if (!list.includes(alias)) list.push(alias);
            });
        }
        if (!list.includes(eventId)) list.push(eventId);
        return list;
    }

    function getEventConfig(eventId) {
        const surface = getSurfaceEffects(activeSurface);
        const events = surface.events || {};
        const ids = normalizedEventIds(eventId);
        for (const id of ids) {
            const cfgValue = events[id];
            if (cfgValue) return cfg.normalizeEventConfig(cfgValue);
        }
        return null;
    }

    function getPathByKey(source, key) {
        if (!source || typeof key !== 'string') return undefined;
        if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
        const parts = key.split('.');
        let cur = source;
        for (const part of parts) {
            if (!cur || typeof cur !== 'object') return undefined;
            cur = cur[part];
        }
        return cur;
    }

    function asString(value) {
        if (value === undefined || value === null) return '';
        return String(value);
    }

    function matchConditionSingle(condition, context) {
        if (!condition || typeof condition !== 'object') return true;
        const type = String(condition.type || '');
        const op = String(condition.operator || 'equals');
        const expected = condition.value;

        let actual;
        if (type === 'event_id') actual = context.eventId;
        else if (type === 'log_contains') actual = context.log;
        else if (type === 'actor_name') actual = getPathByKey(context, 'actor.name');
        else if (type === 'actor_team') actual = getPathByKey(context, 'actor.team');
        else if (type === 'actor_piece_type') actual = getPathByKey(context, 'actor.pieceType');
        else if (type === 'target_name') actual = getPathByKey(context, 'target.name');
        else if (type === 'target_team') actual = getPathByKey(context, 'target.team');
        else if (type === 'target_piece_type') actual = getPathByKey(context, 'target.pieceType');
        else if (type === 'victim_name') actual = getPathByKey(context, 'victim.name');
        else if (type === 'victim_team') actual = getPathByKey(context, 'victim.team');
        else if (type === 'victim_piece_type') actual = getPathByKey(context, 'victim.pieceType');
        else if (type === 'skill_type') actual = context.skillType;
        else if (type === 'result') actual = context.result;
        else if (type === 'cause') actual = context.cause;
        else if (type === 'dice') actual = context.dice;
        else if (type.startsWith('path:')) actual = getPathByKey(context, type.slice(5));
        else actual = getPathByKey(context, type);

        if (op === 'exists') return actual !== undefined && actual !== null && asString(actual).trim() !== '';
        if (op === 'not_exists') return actual === undefined || actual === null || asString(actual).trim() === '';
        if (op === 'contains') return asString(actual).includes(asString(expected));
        if (op === 'not_contains') return !asString(actual).includes(asString(expected));
        if (op === 'regex') {
            try { return new RegExp(asString(expected), 'i').test(asString(actual)); } catch (_e) { return false; }
        }
        if (op === 'in') {
            const values = Array.isArray(expected) ? expected.map(asString) : asString(expected).split(',').map((x) => x.trim()).filter(Boolean);
            return values.includes(asString(actual));
        }
        if (op === 'neq') return asString(actual) !== asString(expected);
        if (op === 'gt') return Number(actual) > Number(expected);
        if (op === 'gte') return Number(actual) >= Number(expected);
        if (op === 'lt') return Number(actual) < Number(expected);
        if (op === 'lte') return Number(actual) <= Number(expected);
        return asString(actual) === asString(expected);
    }

    function matchConditions(config, context) {
        const list = Array.isArray(config.conditions) ? config.conditions : [];
        if (!list.length) return true;
        const logic = String(config.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
        const matches = list.map((cond) => matchConditionSingle(cond, context));
        return logic === 'OR' ? matches.some(Boolean) : matches.every(Boolean);
    }

    function canTriggerWithCooldown(key, durationMs, mapRef) {
        const ms = clamp(durationMs, 0, 600000, 0);
        if (ms <= 0) return true;
        const now = nowMs();
        const prev = mapRef.get(key) || 0;
        if (now - prev < ms) return false;
        mapRef.set(key, now);
        return true;
    }

    async function executeAction(action, context, eventId) {
        if (!action || typeof action !== 'object') return;
        const actionType = String(action.type || '').trim();
        if (!actionType) return;

        const actionKey = `${eventId}:${actionType}:${action.cssClass || action.overlayPreset || action.assetId || action.path || ''}`;
        if (!canTriggerWithCooldown(actionKey, action.cooldownMs, actionCooldownMap)) return;

        const target = getTargetElement(context);
        if (actionType === 'apply_css_class') {
            applyCssClass(target, action.cssClass, action.durationMs || 720);
            return;
        }
        if (actionType === 'overlay_preset') {
            runOverlayPreset(action.overlayPreset, context, action);
            return;
        }
        if (actionType === 'play_sfx') {
            const path = await resolveAssetPath(action.path, action.assetId);
            playSfx(path, action.volume);
            return;
        }
        if (actionType === 'play_bgm') {
            const path = await resolveAssetPath(action.path, action.assetId);
            playBgm(path, action.volume);
            return;
        }
        if (actionType === 'show_image' || actionType === 'spawn_material' || actionType === 'material_action') {
            await spawnMaterial(action, context);
            return;
        }
        if (actionType === 'vfx_preset') {
            runOverlayPreset(action.vfxPreset || action.overlayPreset, context, action);
            return;
        }
    }

    async function triggerEvent(eventId, context) {
        const canonicalEventId = EVENT_ALIAS[eventId] || eventId;
        const ctx = context && typeof context === 'object' ? Object.assign({}, context) : {};
        ctx.eventId = canonicalEventId;
        if (!ctx.surface) ctx.surface = activeSurface;
        if (!ctx.timestamp) ctx.timestamp = new Date().toISOString();

        const config = getEventConfig(canonicalEventId);
        if (!config || config.enabled === false) return;
        if (!canTriggerWithCooldown(`${activeSurface}:${canonicalEventId}`, config.cooldownMs, eventCooldownMap)) return;
        if (!matchConditions(config, ctx)) return;

        const actionList = Array.isArray(config.actions) && config.actions.length
            ? config.actions
            : cfg.normalizeEventConfig(config).actions;

        for (const action of actionList) {
            await executeAction(action, ctx, canonicalEventId);
        }
    }

    function getRuntimeCatalog() {
        if (global.MoleChessRuntimeEventCatalog && typeof global.MoleChessRuntimeEventCatalog === 'object') {
            return global.MoleChessRuntimeEventCatalog;
        }
        const fallbackEvents = {};
        Object.keys(cfg.SURFACES || {}).forEach((surfaceId) => {
            const surfaceDef = cfg.SURFACES[surfaceId];
            const events = Array.isArray(surfaceDef && surfaceDef.events) ? surfaceDef.events : [];
            events.forEach((eventId) => {
                if (!fallbackEvents[eventId]) fallbackEvents[eventId] = { fields: ['eventId', 'surface', 'timestamp', 'log'] };
            });
        });
        return {
            source: 'schema_fallback',
            generatedAt: new Date().toISOString(),
            events: fallbackEvents
        };
    }

    function messageStatePayload() {
        return {
            schemaVersion: cfg.SCHEMA_VERSION || '3.0',
            surface: activeSurface,
            themePack,
            effectsPack,
            assetManifest,
            runtimeCatalog: getRuntimeCatalog()
        };
    }

    function applyThemePack(nextThemePack) {
        themePack = cfg.normalizeThemePack(nextThemePack);
        saveThemePack();
        applyThemeCss(cssForSurface(activeSurface));
    }

    async function applyEffectsPack(nextEffectsPack) {
        effectsPack = cfg.normalizeEffectsPack(nextEffectsPack);
        saveEffectsPack();
        await applySurfaceAssets();
    }

    async function applyAssetManifest(nextManifest) {
        assetManifest = cfg.normalizeAssetManifest(nextManifest);
        saveAssetManifest();
        await applySurfaceAssets();
    }

    async function setSurface(surfaceId) {
        if (surfaceId && cfg.SURFACES && cfg.SURFACES[surfaceId]) {
            activeSurface = surfaceId;
        } else {
            activeSurface = detectSurface();
        }
        applyThemeCss(cssForSurface(activeSurface));
        await applySurfaceAssets();
    }

    function installBaseStyles() {
        ensureStyle(STYLE_EFFECT).textContent = [
            '@keyframes mcfxPulse{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}',
            '@keyframes mcfxShake{0%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}100%{transform:translateX(0)}}',
            '@keyframes mcfxFlash{0%{opacity:0}15%{opacity:.82}100%{opacity:0}}',
            '@keyframes mcfxWipe{0%{transform:translateX(-110%)}100%{transform:translateX(110%)}}',
            '@keyframes mcfxPc98Flicker{0%{opacity:.06}30%{opacity:.26}70%{opacity:.12}100%{opacity:.04}}',
            '@keyframes mcfxPc98Bloom{0%{opacity:0}20%{opacity:.28}100%{opacity:0}}',
            '.mcfx-screen-shake{animation:mcfxShake 420ms steps(4,end)}',
            '.mcfx-screen-pulse{animation:mcfxPulse 620ms steps(6,end)}',
            '.mcfx-pulse-target{animation:mcfxPulse 520ms steps(6,end)}',
            '.mcfx-shake-target{animation:mcfxShake 380ms steps(4,end)}',
            '.mcfx-overlay-flash{position:fixed;inset:0;pointer-events:none;z-index:9999;animation:mcfxFlash 650ms steps(4,end) forwards}',
            '.mcfx-overlay-flash.white{background:rgba(255,255,255,.9)}',
            '.mcfx-overlay-flash.red{background:rgba(255,0,0,.65)}',
            '.mcfx-overlay-scanline{position:fixed;inset:0;pointer-events:none;z-index:9997;background-image:linear-gradient(to bottom,rgba(255,255,255,.04) 0 50%,rgba(0,0,0,.2) 50% 100%);background-size:100% 8px;}',
            '.mcfx-overlay-crt{position:fixed;inset:0;pointer-events:none;z-index:9997;box-shadow:inset 0 0 130px rgba(255,255,255,.2), inset 0 0 260px rgba(0,255,255,.12);animation:mcfxPc98Bloom 620ms steps(5,end) forwards;}',
            '.mcfx-overlay-wipe{position:fixed;top:0;left:0;width:60%;height:100%;pointer-events:none;z-index:9997;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.42),rgba(255,255,255,0));animation:mcfxWipe 360ms steps(8,end) forwards}',
            '.mcfx-pc98-glitch{filter:contrast(1.2) hue-rotate(8deg);}',
            '.mcfx-material{position:absolute;pointer-events:none;transform:translate(-50%,-50%)}',
            '.mcfx-material img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}',
            '.mcfx-vfx-pc98_pixel_pop img{animation:mcfxPulse 340ms steps(4,end)}',
            '.mcfx-vfx-pc98_glitch_shift img{filter:contrast(1.4) saturate(1.4)}',
            '.mcfx-vfx-pc98_palette_flash img{mix-blend-mode:screen}'
        ].join('\n');
    }

    async function handleMessage(event) {
        const data = event && event.data;
        if (!data || typeof data !== 'object') return;
        const source = event.source;

        const reply = (type, payload) => {
            if (source && typeof source.postMessage === 'function') {
                source.postMessage({ type, payload }, '*');
            }
        };

        if (data.type === 'MC_EDITOR_APPLY_THEME') {
            const payload = data.payload || {};
            if (payload.themePack) {
                applyThemePack(payload.themePack);
            } else if (payload.surface) {
                const normalized = cfg.normalizeThemePack(themePack);
                if (!normalized.surfaces[payload.surface]) normalized.surfaces[payload.surface] = { rules: {}, extraCss: '', cssText: '' };
                normalized.surfaces[payload.surface].cssText = typeof payload.cssText === 'string' ? payload.cssText : '';
                themePack = normalized;
                saveThemePack();
                applyThemeCss(cssForSurface(activeSurface));
            }
            return;
        }

        if (data.type === 'MC_EDITOR_APPLY_EFFECTS') {
            const payload = data.payload || {};
            if (payload.effectsPack) {
                await applyEffectsPack(payload.effectsPack);
            } else if (payload.surface && payload.config) {
                const normalized = cfg.normalizeEffectsPack(effectsPack);
                normalized.surfaces[payload.surface] = {
                    events: payload.config.events || {},
                    scenePlacements: Array.isArray(payload.config.scenePlacements) ? payload.config.scenePlacements : []
                };
                effectsPack = cfg.normalizeEffectsPack(normalized);
                saveEffectsPack();
            }
            return;
        }

        if (data.type === 'MC_EDITOR_APPLY_ASSETS') {
            const payload = data.payload || {};
            if (payload.assetManifest) {
                await applyAssetManifest(payload.assetManifest);
            }
            return;
        }

        if (data.type === 'MC_EDITOR_SET_SURFACE') {
            const payload = data.payload || {};
            await setSurface(payload.surface);
            return;
        }

        if (data.type === 'MC_EDITOR_REQUEST_STATE') {
            reply('MC_EDITOR_STATE', messageStatePayload());
            return;
        }

        if (data.type === 'MC_EDITOR_REQUEST_RUNTIME_SCHEMA') {
            reply('MC_EDITOR_RUNTIME_SCHEMA', getRuntimeCatalog());
        }
    }

    function getState() {
        return messageStatePayload();
    }

    async function init() {
        installBaseStyles();
        applyThemeCss(cssForSurface(activeSurface));
        await applySurfaceAssets();
        global.addEventListener('message', handleMessage);
    }

    global.MoleChessEffects = {
        triggerEvent,
        applyThemePack,
        applyEffectsPack,
        applyAssetManifest,
        setSurface,
        getState,
        getRuntimeCatalog
    };

    init();
})(typeof window !== 'undefined' ? window : globalThis);
