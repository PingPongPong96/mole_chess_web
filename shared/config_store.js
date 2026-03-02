(function (global) {
    'use strict';

    const STORAGE_KEYS = {
        layoutConfig: 'mole_chess_ui_layout_config',
        storyDataOverride: 'mole_chess_story_data_override',
        storyLevelDrafts: 'mole_chess_story_level_drafts',
        storyProjectV2: 'mole_chess_story_project_v2',
        storyProjectV2Backup: 'mole_chess_story_project_v2_backup'
    };

    const DEFAULT_LAYOUT_CONFIG = {
        version: '1.0',
        sidebar: {
            dock: 'left',
            width: 320,
            minWidth: 240,
            maxWidth: 480,
            float: {
                x: 24,
                y: 24,
                height: 88
            },
            collapsed: false,
            hotkey: 'Shift+Tab',
            showCollapseButton: true,
            showPanelToggles: true
        },
        panels: {
            status: { visible: true, order: 10 },
            log: { visible: true, order: 20 },
            aiLog: { visible: true, order: 30 },
            ghost: { visible: true, order: 40 },
            detention: { visible: true, order: 50 },
            controls: { visible: true, order: 60 },
            config: { visible: true, order: 70 }
        },
        buttons: {
            startGame: true,
            undo: true,
            surrender: true,
            reset: true,
            aiMode: true,
            aiVsAi: true,
            sandbox: true,
            storyMode: true,
            rulesGuide: true
        }
    };

    function safeLocalStorageGet(key) {
        try {
            return global.localStorage ? global.localStorage.getItem(key) : null;
        } catch (err) {
            return null;
        }
    }

    function safeLocalStorageSet(key, value) {
        try {
            if (global.localStorage) {
                global.localStorage.setItem(key, value);
            }
        } catch (err) {
            // ignore
        }
    }

    function safeLocalStorageRemove(key) {
        try {
            if (global.localStorage) {
                global.localStorage.removeItem(key);
            }
        } catch (err) {
            // ignore
        }
    }

    function clampNumber(value, min, max, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        if (num < min) return min;
        if (num > max) return max;
        return num;
    }

    function normalizeLayoutConfig(raw) {
        const base = JSON.parse(JSON.stringify(DEFAULT_LAYOUT_CONFIG));
        if (!raw || typeof raw !== 'object') return base;

        const out = base;
        const sidebar = raw.sidebar || {};
        const dock = typeof sidebar.dock === 'string' ? sidebar.dock.toLowerCase() : out.sidebar.dock;
        out.sidebar.dock = ['left', 'right', 'float'].includes(dock) ? dock : out.sidebar.dock;
        out.sidebar.width = clampNumber(sidebar.width, 200, 640, out.sidebar.width);
        out.sidebar.minWidth = clampNumber(sidebar.minWidth, 160, out.sidebar.width, out.sidebar.minWidth);
        out.sidebar.maxWidth = clampNumber(sidebar.maxWidth, out.sidebar.width, 800, out.sidebar.maxWidth);
        out.sidebar.collapsed = sidebar.collapsed === true;
        out.sidebar.hotkey = typeof sidebar.hotkey === 'string' ? sidebar.hotkey : out.sidebar.hotkey;
        out.sidebar.showCollapseButton = sidebar.showCollapseButton !== false;
        out.sidebar.showPanelToggles = sidebar.showPanelToggles !== false;

        const float = sidebar.float || {};
        out.sidebar.float.x = clampNumber(float.x, -200, 2000, out.sidebar.float.x);
        out.sidebar.float.y = clampNumber(float.y, -200, 2000, out.sidebar.float.y);
        out.sidebar.float.height = clampNumber(float.height, 40, 100, out.sidebar.float.height);

        const panels = raw.panels || {};
        Object.keys(out.panels).forEach((key) => {
            if (panels[key]) {
                out.panels[key].visible = panels[key].visible !== false;
                out.panels[key].order = clampNumber(panels[key].order, 0, 999, out.panels[key].order);
            }
        });

        const buttons = raw.buttons || {};
        Object.keys(out.buttons).forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(buttons, key)) {
                out.buttons[key] = buttons[key] !== false;
            }
        });

        return out;
    }

    function readJson(key, fallback) {
        const raw = safeLocalStorageGet(key);
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch (err) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        safeLocalStorageSet(key, JSON.stringify(value));
    }

    function getLayoutConfig() {
        return normalizeLayoutConfig(readJson(STORAGE_KEYS.layoutConfig, null));
    }

    function setLayoutConfig(nextConfig) {
        const normalized = normalizeLayoutConfig(nextConfig);
        writeJson(STORAGE_KEYS.layoutConfig, normalized);
        return normalized;
    }

    function clearLayoutConfig() {
        safeLocalStorageRemove(STORAGE_KEYS.layoutConfig);
    }

    function downloadJson(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function createDefaultStoryProject() {
        return {
            schemaVersion: 2,
            meta: {
                title: '鼹鼠棋故事工程',
                author: '',
                version: '0.1.0',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            assets: {
                backgrounds: [],
                bgms: [],
                sfx: [],
                portraits: []
            },
            chapters: [
                { id: 'chapter-1', title: '第一章', nodeIds: ['node-start'] }
            ],
            nodes: [
                {
                    id: 'node-start',
                    type: 'dialogue',
                    title: '开场',
                    chapterId: 'chapter-1',
                    speaker: '旁白',
                    text: '故事开始。',
                    commands: [],
                    nextId: null
                }
            ],
            levels: [],
            triggers: [],
            flags: {},
            runtime: {
                startNodeId: 'node-start'
            }
        };
    }

    function normalizeStoryProjectV2(raw) {
        const base = createDefaultStoryProject();
        const src = (raw && typeof raw === 'object') ? raw : {};
        const out = JSON.parse(JSON.stringify(base));
        out.schemaVersion = 2;
        out.meta = Object.assign({}, out.meta, (src.meta && typeof src.meta === 'object') ? src.meta : {});
        out.assets = Object.assign({}, out.assets, (src.assets && typeof src.assets === 'object') ? src.assets : {});
        out.chapters = Array.isArray(src.chapters) && src.chapters.length ? src.chapters : out.chapters;
        out.nodes = Array.isArray(src.nodes) && src.nodes.length ? src.nodes : out.nodes;
        out.levels = Array.isArray(src.levels) ? src.levels : [];
        out.triggers = Array.isArray(src.triggers) ? src.triggers : [];
        out.flags = (src.flags && typeof src.flags === 'object') ? src.flags : {};
        out.runtime = Object.assign({}, out.runtime, (src.runtime && typeof src.runtime === 'object') ? src.runtime : {});
        out.meta.updatedAt = new Date().toISOString();
        if (!out.meta.createdAt) out.meta.createdAt = new Date().toISOString();
        return out;
    }

    function getStoryProjectV2() {
        const existing = readJson(STORAGE_KEYS.storyProjectV2, null);
        if (existing && typeof existing === 'object') {
            return normalizeStoryProjectV2(existing);
        }
        return null;
    }

    function setStoryProjectV2(project) {
        const normalized = normalizeStoryProjectV2(project);
        writeJson(STORAGE_KEYS.storyProjectV2, normalized);
        return normalized;
    }

    function buildNodeFromLegacyScene(scene, chapterId, levelId, idx) {
        return {
            id: `legacy_${chapterId}_${levelId}_scene_${idx + 1}`,
            type: 'dialogue',
            title: scene && scene.id ? scene.id : `场景${idx + 1}`,
            chapterId,
            speaker: scene && scene.speaker ? scene.speaker : '旁白',
            text: scene && scene.text ? scene.text : '',
            commands: [],
            nextId: null
        };
    }

    function migrateLegacyStoryDataV1() {
        const legacyStory = readJson(STORAGE_KEYS.storyDataOverride, null);
        const legacyDrafts = readJson(STORAGE_KEYS.storyLevelDrafts, []);

        if (!legacyStory && (!Array.isArray(legacyDrafts) || !legacyDrafts.length)) {
            return { migrated: false, project: null, reason: 'no_legacy_data' };
        }

        const next = createDefaultStoryProject();
        next.meta.title = (legacyStory && legacyStory.title) || next.meta.title;

        if (legacyStory && Array.isArray(legacyStory.chapters) && legacyStory.chapters.length) {
            next.chapters = [];
            next.nodes = [];
            legacyStory.chapters.forEach((chapter, chapterIndex) => {
                const chapterId = chapter && chapter.id ? chapter.id : `legacy_chapter_${chapterIndex + 1}`;
                const chapterEntry = {
                    id: chapterId,
                    title: chapter && chapter.title ? chapter.title : `章节 ${chapterIndex + 1}`,
                    nodeIds: []
                };
                next.chapters.push(chapterEntry);

                const levels = Array.isArray(chapter && chapter.levels) ? chapter.levels : [];
                levels.forEach((level, levelIndex) => {
                    const levelId = level && level.id ? level.id : `legacy_level_${chapterIndex + 1}_${levelIndex + 1}`;
                    const scenes = Array.isArray(level && level.scenes) ? level.scenes : [];
                    if (!scenes.length) {
                        const fallbackNode = {
                            id: `legacy_${chapterId}_${levelId}_entry`,
                            type: 'dialogue',
                            title: level && level.title ? level.title : '剧情节点',
                            chapterId,
                            speaker: '旁白',
                            text: (level && level.description) || '',
                            commands: [],
                            nextId: null
                        };
                        chapterEntry.nodeIds.push(fallbackNode.id);
                        next.nodes.push(fallbackNode);
                    } else {
                        const generated = scenes.map((scene, sceneIndex) =>
                            buildNodeFromLegacyScene(scene, chapterId, levelId, sceneIndex));
                        generated.forEach((node, idx) => {
                            node.nextId = generated[idx + 1] ? generated[idx + 1].id : null;
                            next.nodes.push(node);
                        });
                        chapterEntry.nodeIds.push(generated[0].id);
                    }

                    if (level && level.battle && level.battle.snapshot) {
                        next.levels.push({
                            id: levelId,
                            title: level.title || levelId,
                            description: level.description || '',
                            snapshot: level.battle.snapshot,
                            source: 'legacy_story_v1'
                        });
                    }
                });
            });
            if (next.nodes.length) {
                next.runtime.startNodeId = next.nodes[0].id;
            }
        }

        if (Array.isArray(legacyDrafts) && legacyDrafts.length) {
            legacyDrafts.forEach((draft, idx) => {
                if (!draft || !draft.snapshot) return;
                next.levels.push({
                    id: draft.id || `legacy_draft_${idx + 1}`,
                    title: draft.name || `旧草稿 ${idx + 1}`,
                    description: '从旧版关卡草稿迁移',
                    snapshot: draft.snapshot,
                    source: 'legacy_level_draft'
                });
            });
        }

        const normalized = normalizeStoryProjectV2(next);
        writeJson(STORAGE_KEYS.storyProjectV2Backup, normalized);
        writeJson(STORAGE_KEYS.storyProjectV2, normalized);
        return { migrated: true, project: normalized, reason: 'ok' };
    }

    function getOrMigrateStoryProjectV2() {
        const existing = getStoryProjectV2();
        if (existing) return { migrated: false, project: existing, reason: 'existing_v2' };
        return migrateLegacyStoryDataV1();
    }

    global.MoleChessConfigStore = {
        STORAGE_KEYS,
        DEFAULT_LAYOUT_CONFIG,
        normalizeLayoutConfig,
        readJson,
        writeJson,
        getLayoutConfig,
        setLayoutConfig,
        clearLayoutConfig,
        downloadJson,
        createDefaultStoryProject,
        normalizeStoryProjectV2,
        getStoryProjectV2,
        setStoryProjectV2,
        migrateLegacyStoryDataV1,
        getOrMigrateStoryProjectV2
    };
})(typeof window !== 'undefined' ? window : globalThis);
