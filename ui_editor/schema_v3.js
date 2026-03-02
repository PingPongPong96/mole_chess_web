(function (global) {
    'use strict';

    const SCHEMA_VERSION = '3.0';

    const STORAGE_KEYS = {
        themePack: 'mole_chess_theme_pack_v3',
        effectsPack: 'mole_chess_effects_pack_v3',
        versions: 'mole_chess_ui_versions_v3',
        assetManifest: 'mole_chess_ui_assets_manifest_v1'
    };

    const LEGACY_STORAGE_KEYS = {
        themePack: 'mole_chess_theme_pack_v2',
        effectsPack: 'mole_chess_effects_pack_v2',
        versions: 'mole_chess_ui_versions_v2',
        themeCss: 'mole_chess_theme_css',
        effectsConfig: 'mole_chess_effects_config'
    };

    const PIECE_TYPES = [
        'citizen', 'police', 'officer', 'teacher', 'child', 'red_child',
        'ye', 'nightmare', 'wife', 'green_wife', 'doctor', 'lawyer',
        'monk', 'piper', 'deathgod', 'squaredancer', 'mole', 'grave'
    ];

    const PIECE_TEAMS = ['black', 'white', 'neutral', 'any'];

    const EVENT_CONTEXT_FIELDS = {
        base: ['surface', 'eventId', 'timestamp', 'element', 'log', 'cause', 'result', 'dice'],
        actor: ['actor.id', 'actor.name', 'actor.team', 'actor.pos', 'skillType'],
        target: ['target.id', 'target.name', 'target.team', 'target.pos'],
        victim: ['victim.id', 'victim.name', 'victim.team', 'victim.pos', 'deathVictims[]']
    };

    const SURFACES = {
        entry: {
            label: 'Entry (index)',
            url: '../index.html?editor_preview=1',
            elements: [
                { id: 'entry-root', label: 'body', selector: 'body' },
                { id: 'entry-container', label: '.container', selector: '.container' },
                { id: 'entry-title-main', label: '.title-main', selector: '.title-main' },
                { id: 'entry-title-sub', label: '.title-sub', selector: '.title-sub' },
                { id: 'entry-menu-btn', label: '.menu-btn', selector: '.menu-btn' },
                { id: 'entry-rules-modal', label: '.rules-modal', selector: '.rules-modal' }
            ],
            events: ['entry_open_rules', 'entry_close_rules', 'entry_start_click']
        },
        index: {
            label: 'Game (game.html)',
            url: '../game.html?editor_preview=1',
            elements: [
                { id: 'root', label: ':root', selector: ':root', props: ['--bg-color', '--panel-bg', '--grid-color', '--text-primary', '--text-highlight', '--accent-color'] },
                { id: 'game-body', label: 'body', selector: 'body' },
                { id: 'app', label: '.app-container', selector: '.app-container' },
                { id: 'game-area', label: '.game-area', selector: '.game-area' },
                { id: 'board', label: '.board-grid', selector: '.board-grid' },
                { id: 'cell', label: '.cell', selector: '.cell' },
                { id: 'piece', label: '.piece', selector: '.piece' },
                { id: 'menu-bar', label: '.win98-menubar', selector: '.win98-menubar' },
                { id: 'window', label: '.win98-window', selector: '.win98-window' },
                { id: 'context', label: '.context-menu', selector: '.context-menu' },
                { id: 'modal', label: '.modal-content', selector: '.modal-content' },
                { id: 'pc98-menu', label: '.pc98-menu-root', selector: '.pc98-menu-root' }
            ],
            events: [
                'move_start', 'capture_execute', 'piece_captured', 'piece_to_grave', 'piece_to_ghost',
                'piece_revive', 'move_end', 'game_start', 'turn_change', 'game_over_win',
                'game_over_draw', 'skill_activate', 'skill_success', 'skill_failure', 'skill_ultimate',
                'citizen_upgrade', 'wife_possess', 'wife_depossess', 'ye_transform', 'nightmare_crush',
                'police_arrest', 'police_execute', 'mole_tunnel', 'mole_destroy_grave', 'monk_save',
                'monk_restore', 'dancer_dance', 'piper_fate', 'officer_summon', 'lawyer_swap',
                'death_god_move', 'death_god_kill', 'death_god_exit', 'day_phase', 'night_phase',
                'child_red_song', 'citizen_encircle', 'citizen_v_formation', 'detention_arrest',
                'detention_release', 'dice_roll_start', 'dice_roll_end', 'hover_piece_grave',
                'hover_piece_ghost', 'hover_piece_black', 'hover_piece_white', 'hover_piece_neutral',
                'hover_cell_highlight', 'hover_cell_empty', 'select_piece', 'select_piece_enemy',
                'stack_picker_open', 'context_menu_open'
            ]
        }
    };

    function eventDef(fields) {
        return {
            fields: Array.isArray(fields) ? fields.slice() : EVENT_CONTEXT_FIELDS.base.slice()
        };
    }

    const EVENT_DEFS = {
        move_start: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.actor)),
        capture_execute: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.actor, EVENT_CONTEXT_FIELDS.target)),
        piece_captured: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.actor, EVENT_CONTEXT_FIELDS.victim)),
        piece_to_grave: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.actor, EVENT_CONTEXT_FIELDS.victim)),
        piece_to_ghost: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.actor, EVENT_CONTEXT_FIELDS.victim)),
        piece_revive: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.target)),
        skill_activate: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.actor, EVENT_CONTEXT_FIELDS.target)),
        skill_success: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.actor, EVENT_CONTEXT_FIELDS.target)),
        skill_failure: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.actor, EVENT_CONTEXT_FIELDS.target)),
        skill_ultimate: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.actor, EVENT_CONTEXT_FIELDS.target)),
        death_god_kill: eventDef(EVENT_CONTEXT_FIELDS.base.concat(EVENT_CONTEXT_FIELDS.victim)),
        death_god_move: eventDef(EVENT_CONTEXT_FIELDS.base),
        death_god_exit: eventDef(EVENT_CONTEXT_FIELDS.base),
        story_node_enter: eventDef(EVENT_CONTEXT_FIELDS.base),
        story_dialogue_next: eventDef(EVENT_CONTEXT_FIELDS.base),
        story_choice_open: eventDef(EVENT_CONTEXT_FIELDS.base),
        story_choice_select: eventDef(EVENT_CONTEXT_FIELDS.base),
        story_battle_start: eventDef(EVENT_CONTEXT_FIELDS.base),
        story_battle_end: eventDef(EVENT_CONTEXT_FIELDS.base)
    };

    const COMMON_PROPS = [
        'margin', 'padding', 'width', 'height', 'font-size', 'font-family', 'font-weight',
        'letter-spacing', 'color', 'background-color', 'background-image', 'border-color',
        'border-width', 'border-style', 'border-radius', 'box-shadow', 'text-shadow', 'opacity',
        'filter', 'animation'
    ];

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function defaultThemeSurface() {
        return { rules: {}, extraCss: '', cssText: '' };
    }

    function defaultThemePack() {
        const surfaces = {};
        Object.keys(SURFACES).forEach((surfaceId) => {
            surfaces[surfaceId] = defaultThemeSurface();
        });
        return {
            schemaVersion: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            surfaces
        };
    }

    function defaultEventAction() {
        return {
            type: 'overlay_preset',
            overlayPreset: 'none',
            cssClass: '',
            path: '',
            assetId: '',
            volume: 0.7,
            durationMs: 1200,
            cooldownMs: 0,
            blendMode: 'normal',
            vfxPreset: 'pc98_pixel_pop',
            anchor: 'center',
            x: 50,
            y: 50,
            width: 30,
            height: 30,
            zIndex: 9998,
            layer: 'overlay'
        };
    }

    function defaultEventCondition() {
        return {
            type: 'actor_name',
            operator: 'equals',
            value: ''
        };
    }

    function defaultEventConfig() {
        return {
            enabled: true,
            logic: 'AND',
            cooldownMs: 0,
            conditions: [],
            actions: [],
            cssClass: '',
            overlayPreset: 'none',
            volume: 0.7,
            sfxPath: '',
            bgmPath: '',
            imagePath: ''
        };
    }

    function defaultScenePlacement() {
        return {
            id: 'placement_' + Date.now(),
            assetId: '',
            label: '',
            anchor: 'top-left',
            x: 4,
            y: 4,
            width: 22,
            height: 22,
            opacity: 1,
            blendMode: 'normal',
            zIndex: 20,
            vfxPreset: 'pc98_pixel_pop'
        };
    }

    function defaultEffectsSurface() {
        return {
            events: {},
            scenePlacements: []
        };
    }

    function defaultEffectsPack() {
        const surfaces = {};
        Object.keys(SURFACES).forEach((surfaceId) => {
            surfaces[surfaceId] = defaultEffectsSurface();
        });
        return {
            schemaVersion: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            surfaces
        };
    }

    function defaultAssetManifest() {
        return {
            schemaVersion: '1.0',
            updatedAt: new Date().toISOString(),
            backgrounds: {
                entry: '',
                game: '',
                board: ''
            },
            pieceIcons: {},
            scenePlacements: {
                entry: [],
                index: []
            },
            assetsMeta: {}
        };
    }

    function clampNumber(value, min, max, fallback) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        if (n < min) return min;
        if (n > max) return max;
        return n;
    }

    function normalizeThemePack(raw) {
        const out = defaultThemePack();
        const src = raw && typeof raw === 'object' ? raw : {};
        out.updatedAt = typeof src.updatedAt === 'string' ? src.updatedAt : out.updatedAt;
        Object.keys(out.surfaces).forEach((surfaceId) => {
            const item = src.surfaces && src.surfaces[surfaceId] ? src.surfaces[surfaceId] : {};
            out.surfaces[surfaceId] = {
                rules: item.rules && typeof item.rules === 'object' ? clone(item.rules) : {},
                extraCss: typeof item.extraCss === 'string' ? item.extraCss : '',
                cssText: typeof item.cssText === 'string' ? item.cssText : ''
            };
        });
        return out;
    }

    function normalizeAction(raw) {
        const base = defaultEventAction();
        const src = raw && typeof raw === 'object' ? raw : {};
        const type = typeof src.type === 'string' ? src.type : base.type;
        return {
            type,
            overlayPreset: typeof src.overlayPreset === 'string' ? src.overlayPreset : base.overlayPreset,
            cssClass: typeof src.cssClass === 'string' ? src.cssClass : base.cssClass,
            path: typeof src.path === 'string' ? src.path : base.path,
            assetId: typeof src.assetId === 'string' ? src.assetId : base.assetId,
            volume: clampNumber(src.volume, 0, 1, base.volume),
            durationMs: clampNumber(src.durationMs, 100, 60000, base.durationMs),
            cooldownMs: clampNumber(src.cooldownMs, 0, 60000, base.cooldownMs),
            blendMode: typeof src.blendMode === 'string' ? src.blendMode : base.blendMode,
            vfxPreset: typeof src.vfxPreset === 'string' ? src.vfxPreset : base.vfxPreset,
            anchor: typeof src.anchor === 'string' ? src.anchor : base.anchor,
            x: clampNumber(src.x, -200, 200, base.x),
            y: clampNumber(src.y, -200, 200, base.y),
            width: clampNumber(src.width, 1, 200, base.width),
            height: clampNumber(src.height, 1, 200, base.height),
            zIndex: clampNumber(src.zIndex, 1, 99999, base.zIndex),
            layer: typeof src.layer === 'string' ? src.layer : base.layer
        };
    }

    function normalizeCondition(raw) {
        const base = defaultEventCondition();
        const src = raw && typeof raw === 'object' ? raw : {};
        let value = base.value;
        if (typeof src.value === 'string' || typeof src.value === 'number') {
            value = src.value;
        } else if (Array.isArray(src.value)) {
            value = src.value
                .map((item) => String(item).trim())
                .filter(Boolean);
        }
        return {
            type: typeof src.type === 'string' ? src.type : base.type,
            operator: typeof src.operator === 'string' ? src.operator : base.operator,
            value
        };
    }

    function normalizeEventConfig(raw) {
        const base = defaultEventConfig();
        const src = raw && typeof raw === 'object' ? raw : {};
        const cfg = {
            enabled: src.enabled !== false,
            logic: src.logic === 'OR' ? 'OR' : 'AND',
            cooldownMs: clampNumber(src.cooldownMs, 0, 60000, 0),
            conditions: Array.isArray(src.conditions) ? src.conditions.map(normalizeCondition) : [],
            actions: Array.isArray(src.actions) ? src.actions.map(normalizeAction) : [],
            cssClass: typeof src.cssClass === 'string' ? src.cssClass : '',
            overlayPreset: typeof src.overlayPreset === 'string' ? src.overlayPreset : 'none',
            volume: clampNumber(src.volume, 0, 1, base.volume),
            sfxPath: typeof src.sfxPath === 'string' ? src.sfxPath : '',
            bgmPath: typeof src.bgmPath === 'string' ? src.bgmPath : '',
            imagePath: typeof src.imagePath === 'string' ? src.imagePath : ''
        };

        if (!cfg.actions.length) {
            if (cfg.cssClass) {
                cfg.actions.push({ type: 'apply_css_class', cssClass: cfg.cssClass, durationMs: 750 });
            }
            if (cfg.overlayPreset && cfg.overlayPreset !== 'none') {
                cfg.actions.push({ type: 'overlay_preset', overlayPreset: cfg.overlayPreset });
            }
            if (cfg.imagePath) {
                cfg.actions.push({ type: 'show_image', path: cfg.imagePath, durationMs: 1100 });
            }
            if (cfg.sfxPath) {
                cfg.actions.push({ type: 'play_sfx', path: cfg.sfxPath, volume: cfg.volume });
            }
            if (cfg.bgmPath) {
                cfg.actions.push({ type: 'play_bgm', path: cfg.bgmPath, volume: cfg.volume });
            }
        }

        return cfg;
    }

    function normalizeScenePlacement(raw) {
        const base = defaultScenePlacement();
        const src = raw && typeof raw === 'object' ? raw : {};
        return {
            id: typeof src.id === 'string' && src.id ? src.id : base.id,
            assetId: typeof src.assetId === 'string' ? src.assetId : '',
            label: typeof src.label === 'string' ? src.label : '',
            anchor: typeof src.anchor === 'string' ? src.anchor : base.anchor,
            x: clampNumber(src.x, -200, 200, base.x),
            y: clampNumber(src.y, -200, 200, base.y),
            width: clampNumber(src.width, 1, 200, base.width),
            height: clampNumber(src.height, 1, 200, base.height),
            opacity: clampNumber(src.opacity, 0, 1, base.opacity),
            blendMode: typeof src.blendMode === 'string' ? src.blendMode : base.blendMode,
            zIndex: clampNumber(src.zIndex, 1, 99999, base.zIndex),
            vfxPreset: typeof src.vfxPreset === 'string' ? src.vfxPreset : base.vfxPreset
        };
    }

    function normalizeEffectsPack(raw) {
        const out = defaultEffectsPack();
        const src = raw && typeof raw === 'object' ? raw : {};
        out.updatedAt = typeof src.updatedAt === 'string' ? src.updatedAt : out.updatedAt;
        Object.keys(out.surfaces).forEach((surfaceId) => {
            const item = src.surfaces && src.surfaces[surfaceId] ? src.surfaces[surfaceId] : {};
            const nextEvents = {};
            const eventSource = item.events && typeof item.events === 'object' ? item.events : {};
            Object.keys(eventSource).forEach((eventId) => {
                nextEvents[eventId] = normalizeEventConfig(eventSource[eventId]);
            });
            out.surfaces[surfaceId] = {
                events: nextEvents,
                scenePlacements: Array.isArray(item.scenePlacements)
                    ? item.scenePlacements.map(normalizeScenePlacement)
                    : []
            };
        });
        return out;
    }

    function normalizeAssetManifest(raw) {
        const out = defaultAssetManifest();
        const src = raw && typeof raw === 'object' ? raw : {};
        out.updatedAt = typeof src.updatedAt === 'string' ? src.updatedAt : out.updatedAt;
        if (src.backgrounds && typeof src.backgrounds === 'object') {
            out.backgrounds.entry = typeof src.backgrounds.entry === 'string' ? src.backgrounds.entry : '';
            out.backgrounds.game = typeof src.backgrounds.game === 'string' ? src.backgrounds.game : '';
            out.backgrounds.board = typeof src.backgrounds.board === 'string' ? src.backgrounds.board : '';
        }
        out.pieceIcons = src.pieceIcons && typeof src.pieceIcons === 'object' ? clone(src.pieceIcons) : {};
        const placements = src.scenePlacements && typeof src.scenePlacements === 'object' ? src.scenePlacements : {};
        Object.keys(out.scenePlacements).forEach((surfaceId) => {
            out.scenePlacements[surfaceId] = Array.isArray(placements[surfaceId])
                ? placements[surfaceId].map(normalizeScenePlacement)
                : [];
        });
        out.assetsMeta = src.assetsMeta && typeof src.assetsMeta === 'object' ? clone(src.assetsMeta) : {};
        return out;
    }

    function resolveSurfaceEvents(surfaceId, runtimeCatalog) {
        const def = SURFACES[surfaceId] || SURFACES.index;
        const localEvents = Array.isArray(def.events) ? def.events.slice() : [];
        if (!runtimeCatalog || typeof runtimeCatalog !== 'object') {
            return localEvents;
        }
        const runtimeEvents = Array.isArray(runtimeCatalog.events)
            ? runtimeCatalog.events
            : Object.keys(runtimeCatalog.events || {});
        const merged = localEvents.slice();
        runtimeEvents.forEach((eventId) => {
            if (!merged.includes(eventId)) merged.push(eventId);
        });
        return merged;
    }

    global.MoleChessUISchema = {
        SCHEMA_VERSION,
        STORAGE_KEYS,
        LEGACY_STORAGE_KEYS,
        SURFACES,
        EVENT_DEFS,
        COMMON_PROPS,
        PIECE_TYPES,
        PIECE_TEAMS,
        defaultThemePack,
        defaultEffectsPack,
        defaultAssetManifest,
        defaultEventConfig,
        defaultEventAction,
        defaultEventCondition,
        defaultScenePlacement,
        normalizeThemePack,
        normalizeEffectsPack,
        normalizeAssetManifest,
        normalizeEventConfig,
        normalizeAction,
        normalizeCondition,
        normalizeScenePlacement,
        resolveSurfaceEvents,
        clone
    };
})(typeof window !== 'undefined' ? window : globalThis);
