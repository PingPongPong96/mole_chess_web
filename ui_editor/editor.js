(function () {
'use strict';

const schema = window.MoleChessUISchema;
const assetStore = window.MoleChessAssetStore;

if (!schema) {
    // eslint-disable-next-line no-alert
    alert('schema_v3.js 未加载，UI 编辑器无法启动');
    return;
}

const SURFACES = schema.SURFACES;
const PROFILES = [
    { id: 'desktop-16-9', label: 'Desktop 16:9 (1920x1080)', w: 1920, h: 1080 },
    { id: 'desktop-16-10', label: 'Desktop 16:10 (1920x1200)', w: 1920, h: 1200 },
    { id: 'tablet-4-3', label: 'Tablet 4:3 (1536x2048)', w: 1536, h: 2048 },
    { id: 'mobile-9-16', label: 'Mobile 9:16 (1080x1920)', w: 1080, h: 1920 },
    { id: 'custom', label: 'Custom', w: 1920, h: 1080 }
];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ASSET_KINDS = ['piece_icon', 'board_bg', 'game_bg', 'entry_bg', 'effect_image'];
const DEFAULT_ACTION_TYPES = [
    'overlay_preset', 'apply_css_class', 'play_sfx', 'play_bgm', 'spawn_material', 'show_image', 'material_action', 'vfx_preset'
];
const DEFAULT_CONDITION_TYPES = [
    'actor_name', 'actor_team', 'actor_piece_type',
    'target_name', 'target_team', 'target_piece_type',
    'victim_name', 'victim_team', 'victim_piece_type',
    'skill_type', 'result', 'cause', 'log_contains', 'dice', 'event_id'
];
const CONDITION_OPERATORS = ['equals', 'neq', 'contains', 'not_contains', 'regex', 'in', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists'];
const OVERLAY_PRESETS = [
    'none', 'flash-white', 'flash-red', 'shake-screen', 'pulse-screen', 'shake-target', 'pulse-target',
    'pc98_scanline_flicker', 'pc98_crt_bloom', 'pc98_line_wipe', 'pc98_palette_flash', 'pc98_glitch_shift', 'pc98_pixel_pop'
];
const VFX_PRESETS = ['pc98_pixel_pop', 'pc98_scanline_flicker', 'pc98_crt_bloom', 'pc98_line_wipe', 'pc98_palette_flash', 'pc98_glitch_shift'];
const GUIDE_STORAGE_KEY = 'mole_chess_ui_editor_guide_done_v1';
const GUIDE_STEPS = [
    {
        title: '1. 先选编辑页面',
        text: '在这里切换 Surface。entry=首页(index.html)，index=对局(game.html)。后面的所有修改都只作用于当前 Surface。',
        selector: '#surface-select'
    },
    {
        title: '2. 上传素材',
        text: '先选素材类型，再点“上传图片”。支持 piece_icon / board_bg / game_bg / entry_bg / effect_image。',
        selector: '#btn-asset-upload'
    },
    {
        title: '3. 绑定背景',
        text: '右侧背景绑定用于 entry/game/board 三类背景。这里选择后会立即同步到预览。',
        selector: '#bg-entry-select'
    },
    {
        title: '4. 棋子 Icon 映射',
        text: '选择 pieceType + team + 素材后点“绑定”，即可覆盖棋子显示，不会改任何规则判定。',
        selector: '#btn-piece-icon-bind'
    },
    {
        title: '5. 选择事件',
        text: '左侧事件列表选择一个触发点。右侧事件面板会同步为当前事件配置。',
        selector: '#event-list'
    },
    {
        title: '6. 添加条件',
        text: '点击“新增条件”。条件类型会自动约束操作符和值输入形态（如 dice 数字比较、in 标签多值）。',
        selector: '#btn-add-condition'
    },
    {
        title: '7. 添加动作',
        text: '点击“新增动作”。动作类型会动态显示字段，优先用可视化控件，JSON 只用于高级覆盖。',
        selector: '#btn-add-action'
    },
    {
        title: '8. 应用到预览',
        text: '编辑完点“应用”将当前配置推送到中间预览，并自动创建应用前快照。',
        selector: '#btn-apply'
    },
    {
        title: '9. 保存本地配置',
        text: '确认效果后点“保存”写入本地存储。否则刷新页面可能丢失本次修改。',
        selector: '#btn-save'
    },
    {
        title: '10. 导出备份包',
        text: '最后建议导出（可勾选“导出带素材”）。导入时会先恢复素材再恢复配置。',
        selector: '#btn-export'
    }
];

const refs = {
    surface: document.getElementById('surface-select'),
    profile: document.getElementById('preview-profile'),
    customW: document.getElementById('preview-custom-width'),
    customH: document.getElementById('preview-custom-height'),
    safeToggle: document.getElementById('safe-area-toggle'),
    frame: document.getElementById('preview-frame'),
    viewport: document.getElementById('preview-viewport'),
    stage: document.getElementById('preview-stage'),
    safeArea: document.getElementById('preview-safe-area'),

    elementList: document.getElementById('element-list'),
    eventList: document.getElementById('event-list'),
    propertyFields: document.getElementById('property-fields'),
    elementTitle: document.getElementById('element-editor-title'),
    eventTitle: document.getElementById('event-editor-title'),
    customCss: document.getElementById('custom-css-input'),

    bgEntry: document.getElementById('bg-entry-select'),
    bgGame: document.getElementById('bg-game-select'),
    bgBoard: document.getElementById('bg-board-select'),

    pieceIconType: document.getElementById('piece-icon-piece-type'),
    pieceIconTeam: document.getElementById('piece-icon-team'),
    pieceIconAsset: document.getElementById('piece-icon-asset'),
    pieceIconList: document.getElementById('piece-icon-list'),
    btnPieceIconBind: document.getElementById('btn-piece-icon-bind'),

    scenePlacementAsset: document.getElementById('scene-placement-asset'),
    scenePlacementList: document.getElementById('scene-placement-list'),
    btnAddScenePlacement: document.getElementById('btn-add-scene-placement'),

    eventEnabled: document.getElementById('event-enabled'),
    eventLogic: document.getElementById('event-logic'),
    eventCooldown: document.getElementById('event-cooldown'),
    btnAddCondition: document.getElementById('btn-add-condition'),
    btnAddAction: document.getElementById('btn-add-action'),
    conditionsList: document.getElementById('conditions-list'),
    actionsList: document.getElementById('actions-list'),
    eventJsonInput: document.getElementById('event-json-input'),
    btnApplyEventJson: document.getElementById('btn-apply-event-json'),

    assetKindUpload: document.getElementById('asset-kind-upload'),
    btnAssetUpload: document.getElementById('btn-asset-upload'),
    assetUploadInput: document.getElementById('asset-upload-input'),
    assetFilterKind: document.getElementById('asset-filter-kind'),
    btnAssetsRefresh: document.getElementById('btn-assets-refresh'),
    assetList: document.getElementById('asset-list'),

    btnSave: document.getElementById('btn-save'),
    btnApply: document.getElementById('btn-apply'),
    btnBackup: document.getElementById('btn-backup'),
    btnRollback: document.getElementById('btn-rollback'),
    btnExport: document.getElementById('btn-export'),
    btnImport: document.getElementById('btn-import'),
    importInput: document.getElementById('import-file-input'),
    btnRefreshPreview: document.getElementById('btn-refresh-preview'),
    versionSelect: document.getElementById('version-select'),
    backupNote: document.getElementById('backup-note'),
    exportWithAssets: document.getElementById('export-with-assets'),
    btnHelp: document.getElementById('btn-help'),
    btnGuide: document.getElementById('btn-guide'),
    helpModal: document.getElementById('help-modal'),
    btnHelpClose: document.getElementById('btn-help-close'),
    btnHelpStartGuide: document.getElementById('btn-help-start-guide'),
    guideOverlay: document.getElementById('guide-overlay'),
    guideSpotlight: document.getElementById('guide-spotlight'),
    guideCard: document.getElementById('guide-card'),
    guideTitle: document.getElementById('guide-title'),
    guideText: document.getElementById('guide-text'),
    guideProgress: document.getElementById('guide-progress'),
    btnGuidePrev: document.getElementById('btn-guide-prev'),
    btnGuideNext: document.getElementById('btn-guide-next'),
    btnGuideSkip: document.getElementById('btn-guide-skip'),
    status: document.getElementById('editor-status')
};

const state = {
    surface: 'index',
    elementId: '',
    eventId: '',
    profile: 'desktop-16-9',
    runtimeCatalog: null,
    runtimeStateHydrated: false,

    themePack: schema.defaultThemePack(),
    effectsPack: schema.defaultEffectsPack(),
    assetManifest: schema.defaultAssetManifest(),
    versions: [],

    assets: [],
    assetFilter: 'all'
};

const guide = {
    active: false,
    stepIndex: 0,
    targetEl: null
};

function status(msg, level) {
    if (!refs.status) return;
    refs.status.textContent = msg;
    refs.status.style.color = level === 'error' ? '#ff7b72' : level === 'ok' ? '#5cf2b3' : '#d9f8ff';
}

function clone(v) {
    return schema.clone(v);
}

function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_e) { return null; }
}

function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (_e) {}
}

function parseJson(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (_e) { return fallback; }
}

function openHelpModal() {
    if (!refs.helpModal) return;
    refs.helpModal.classList.add('show');
}

function closeHelpModal() {
    if (!refs.helpModal) return;
    refs.helpModal.classList.remove('show');
}

function clearGuideFocus() {
    if (guide.targetEl) {
        guide.targetEl.classList.remove('guide-focus-target');
        guide.targetEl = null;
    }
}

function hideGuideSpotlight() {
    if (!refs.guideSpotlight) return;
    refs.guideSpotlight.style.left = '-9999px';
    refs.guideSpotlight.style.top = '-9999px';
    refs.guideSpotlight.style.width = '1px';
    refs.guideSpotlight.style.height = '1px';
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function resolveGuideTarget(step) {
    if (!step) return null;
    if (typeof step.selector === 'string' && step.selector.trim()) {
        return document.querySelector(step.selector);
    }
    return null;
}

function positionGuideCard(targetRect) {
    if (!refs.guideCard) return;
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 1200;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 800;
    const margin = 12;
    const cardRect = refs.guideCard.getBoundingClientRect();
    const cardWidth = Math.max(280, cardRect.width || 320);
    const cardHeight = Math.max(120, cardRect.height || 180);

    let left = margin;
    let top = margin;
    if (targetRect) {
        const rightSpace = viewportW - targetRect.right - margin;
        const leftSpace = targetRect.left - margin;
        if (rightSpace >= cardWidth) {
            left = targetRect.right + 10;
        } else if (leftSpace >= cardWidth) {
            left = targetRect.left - cardWidth - 10;
        } else {
            left = clamp(targetRect.left, margin, viewportW - cardWidth - margin);
        }
        top = clamp(targetRect.top, margin, viewportH - cardHeight - margin);
    } else {
        left = clamp((viewportW - cardWidth) / 2, margin, viewportW - cardWidth - margin);
        top = margin + 4;
    }
    refs.guideCard.style.left = `${Math.round(left)}px`;
    refs.guideCard.style.top = `${Math.round(top)}px`;
}

function renderGuideStep() {
    if (!guide.active || !refs.guideOverlay) return;
    const total = GUIDE_STEPS.length;
    if (!total) return;
    guide.stepIndex = clamp(guide.stepIndex, 0, total - 1);
    const step = GUIDE_STEPS[guide.stepIndex];

    if (refs.guideTitle) refs.guideTitle.textContent = step.title || `步骤 ${guide.stepIndex + 1}`;
    if (refs.guideText) refs.guideText.textContent = step.text || '';
    if (refs.guideProgress) refs.guideProgress.textContent = `${guide.stepIndex + 1} / ${total}`;
    if (refs.btnGuidePrev) refs.btnGuidePrev.disabled = guide.stepIndex === 0;
    if (refs.btnGuideNext) refs.btnGuideNext.textContent = guide.stepIndex >= total - 1 ? '完成' : '下一步';

    clearGuideFocus();
    const target = resolveGuideTarget(step);
    if (!target) {
        hideGuideSpotlight();
        positionGuideCard(null);
        return;
    }
    guide.targetEl = target;
    guide.targetEl.classList.add('guide-focus-target');
    try {
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
    } catch (_e) {}

    const rect = target.getBoundingClientRect();
    const padding = 6;
    const left = clamp(rect.left - padding, 0, (window.innerWidth || 0) - 1);
    const top = clamp(rect.top - padding, 0, (window.innerHeight || 0) - 1);
    if (refs.guideSpotlight) {
        refs.guideSpotlight.style.left = `${Math.round(left)}px`;
        refs.guideSpotlight.style.top = `${Math.round(top)}px`;
        refs.guideSpotlight.style.width = `${Math.round(Math.max(20, rect.width + padding * 2))}px`;
        refs.guideSpotlight.style.height = `${Math.round(Math.max(20, rect.height + padding * 2))}px`;
    }
    positionGuideCard(rect);
}

function stopGuide(markCompleted) {
    if (markCompleted) {
        safeSet(GUIDE_STORAGE_KEY, '1');
    }
    guide.active = false;
    guide.stepIndex = 0;
    clearGuideFocus();
    hideGuideSpotlight();
    if (refs.guideOverlay) {
        refs.guideOverlay.classList.remove('show');
        refs.guideOverlay.setAttribute('aria-hidden', 'true');
    }
    status(markCompleted ? '新手引导已完成，可随时再次打开' : '已退出新手引导', markCompleted ? 'ok' : undefined);
}

function startGuide(startIndex) {
    if (!refs.guideOverlay) return;
    closeHelpModal();
    const total = GUIDE_STEPS.length || 1;
    guide.active = true;
    guide.stepIndex = clamp(Number(startIndex) || 0, 0, total - 1);
    refs.guideOverlay.classList.add('show');
    refs.guideOverlay.setAttribute('aria-hidden', 'false');
    renderGuideStep();
    status('新手引导已开始', 'ok');
}

function nextGuideStep() {
    if (!guide.active) return;
    if (guide.stepIndex >= GUIDE_STEPS.length - 1) {
        stopGuide(true);
        return;
    }
    guide.stepIndex += 1;
    renderGuideStep();
}

function prevGuideStep() {
    if (!guide.active) return;
    guide.stepIndex = clamp(guide.stepIndex - 1, 0, GUIDE_STEPS.length - 1);
    renderGuideStep();
}

function currentSurfaceDef() {
    return SURFACES[state.surface] || SURFACES.index;
}

function currentThemeSurface() {
    const surfaces = state.themePack && state.themePack.surfaces ? state.themePack.surfaces : {};
    if (!surfaces[state.surface]) surfaces[state.surface] = { rules: {}, extraCss: '', cssText: '' };
    return surfaces[state.surface];
}

function currentEffectsSurface() {
    const surfaces = state.effectsPack && state.effectsPack.surfaces ? state.effectsPack.surfaces : {};
    if (!surfaces[state.surface]) surfaces[state.surface] = { events: {}, scenePlacements: [] };
    return surfaces[state.surface];
}

function currentScenePlacements() {
    if (!state.assetManifest.scenePlacements[state.surface]) state.assetManifest.scenePlacements[state.surface] = [];
    return state.assetManifest.scenePlacements[state.surface];
}

function ensureRule() {
    const themeSurface = currentThemeSurface();
    if (!themeSurface.rules[state.elementId]) themeSurface.rules[state.elementId] = {};
    return themeSurface.rules[state.elementId];
}

function ensureEventConfig() {
    if (!state.eventId) return null;
    const fxSurface = currentEffectsSurface();
    if (!fxSurface.events[state.eventId]) fxSurface.events[state.eventId] = schema.defaultEventConfig();
    fxSurface.events[state.eventId] = schema.normalizeEventConfig(fxSurface.events[state.eventId]);
    return fxSurface.events[state.eventId];
}

function loadStateFromStorage() {
    state.themePack = schema.normalizeThemePack(parseJson(safeGet(schema.STORAGE_KEYS.themePack), null));
    state.effectsPack = schema.normalizeEffectsPack(parseJson(safeGet(schema.STORAGE_KEYS.effectsPack), null));
    state.assetManifest = schema.normalizeAssetManifest(parseJson(safeGet(schema.STORAGE_KEYS.assetManifest), null));
    state.versions = parseJson(safeGet(schema.STORAGE_KEYS.versions), []);
    if (!Array.isArray(state.versions)) state.versions = [];

    if (!safeGet(schema.STORAGE_KEYS.themePack)) {
        const legacyCss = safeGet(schema.LEGACY_STORAGE_KEYS.themeCss);
        if (legacyCss && state.themePack.surfaces && state.themePack.surfaces.index) {
            state.themePack.surfaces.index.extraCss = legacyCss;
            state.themePack.surfaces.index.cssText = legacyCss;
        }
    }
    if (!safeGet(schema.STORAGE_KEYS.effectsPack)) {
        const legacyConfig = parseJson(safeGet(schema.LEGACY_STORAGE_KEYS.effectsConfig), null);
        if (legacyConfig && legacyConfig.events && state.effectsPack.surfaces && state.effectsPack.surfaces.index) {
            const mapped = {};
            Object.keys(legacyConfig.events).forEach((eventId) => {
                mapped[eventId] = schema.normalizeEventConfig(legacyConfig.events[eventId]);
            });
            state.effectsPack.surfaces.index.events = mapped;
        }
    }

    const firstElement = (SURFACES[state.surface] && SURFACES[state.surface].elements && SURFACES[state.surface].elements[0]) || { id: '' };
    state.elementId = firstElement.id || '';
}

function persistState() {
    state.themePack.updatedAt = new Date().toISOString();
    state.effectsPack.updatedAt = new Date().toISOString();
    state.assetManifest.updatedAt = new Date().toISOString();
    Object.keys(SURFACES).forEach((surfaceId) => {
        if (!state.themePack.surfaces[surfaceId]) state.themePack.surfaces[surfaceId] = { rules: {}, extraCss: '', cssText: '' };
        state.themePack.surfaces[surfaceId].cssText = serializeCss(surfaceId);
    });
    safeSet(schema.STORAGE_KEYS.themePack, JSON.stringify(state.themePack));
    safeSet(schema.STORAGE_KEYS.effectsPack, JSON.stringify(state.effectsPack));
    safeSet(schema.STORAGE_KEYS.assetManifest, JSON.stringify(state.assetManifest));
    safeSet(schema.STORAGE_KEYS.versions, JSON.stringify(state.versions.slice(0, 50)));
}

function serializeCss(surfaceId) {
    const surfaceDef = SURFACES[surfaceId] || SURFACES.index;
    const surface = state.themePack.surfaces[surfaceId] || { rules: {}, extraCss: '' };
    const blocks = [];
    (surfaceDef.elements || []).forEach((item) => {
        const rule = surface.rules[item.id];
        if (!rule || typeof rule !== 'object') return;
        const lines = Object.entries(rule)
            .filter(([, value]) => typeof value === 'string' && value.trim())
            .map(([key, value]) => `  ${key}: ${value.trim()};`);
        if (lines.length) {
            blocks.push(`${item.selector} {\n${lines.join('\n')}\n}`);
        }
    });
    if (surface.extraCss && surface.extraCss.trim()) blocks.push(surface.extraCss.trim());
    return `/* surface:${surfaceId} */\n${blocks.join('\n\n')}`;
}

function postToPreview(type, payload) {
    const target = refs.frame && refs.frame.contentWindow;
    if (!target) return;
    target.postMessage({ type, payload }, '*');
}

function applyPreview() {
    postToPreview('MC_EDITOR_SET_SURFACE', { surface: state.surface });
    postToPreview('MC_EDITOR_APPLY_THEME', {
        surface: state.surface,
        cssText: serializeCss(state.surface),
        themePack: state.themePack
    });
    postToPreview('MC_EDITOR_APPLY_EFFECTS', {
        surface: state.surface,
        config: currentEffectsSurface(),
        effectsPack: state.effectsPack
    });
    postToPreview('MC_EDITOR_APPLY_ASSETS', {
        assetManifest: state.assetManifest
    });
}

function requestRuntimeSchema() {
    postToPreview('MC_EDITOR_REQUEST_RUNTIME_SCHEMA', { surface: state.surface });
    postToPreview('MC_EDITOR_REQUEST_STATE', { surface: state.surface });
}

function refreshPreview() {
    const def = currentSurfaceDef();
    const url = `${def.url}${def.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    refs.frame.src = url;
}

function previewSize() {
    const p = PROFILES.find((item) => item.id === state.profile) || PROFILES[0];
    if (p.id === 'custom') {
        return {
            w: Math.max(240, Number(refs.customW.value) || 1920),
            h: Math.max(240, Number(refs.customH.value) || 1080)
        };
    }
    return { w: p.w, h: p.h };
}

function resizePreview() {
    const rect = refs.viewport.getBoundingClientRect();
    const target = previewSize();
    const maxW = Math.max(200, rect.width - 30);
    const maxH = Math.max(200, rect.height - 30);
    const scale = Math.min(maxW / target.w, maxH / target.h);
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    refs.stage.style.width = `${Math.round(target.w * safeScale)}px`;
    refs.stage.style.height = `${Math.round(target.h * safeScale)}px`;
}

function renderSurfaceSelect() {
    refs.surface.innerHTML = '';
    Object.keys(SURFACES).forEach((id) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = SURFACES[id].label;
        refs.surface.appendChild(opt);
    });
    refs.surface.value = state.surface;
}

function renderProfiles() {
    refs.profile.innerHTML = '';
    PROFILES.forEach((profile) => {
        const opt = document.createElement('option');
        opt.value = profile.id;
        opt.textContent = profile.label;
        refs.profile.appendChild(opt);
    });
    refs.profile.value = state.profile;
}

function renderElements() {
    const def = currentSurfaceDef();
    if (!(def.elements || []).some((item) => item.id === state.elementId)) {
        state.elementId = (def.elements[0] && def.elements[0].id) || '';
    }
    refs.elementList.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'pick-list';
    (def.elements || []).forEach((item) => {
        const li = document.createElement('li');
        li.className = 'pick-item';
        li.textContent = item.label;
        li.classList.toggle('active', state.elementId === item.id);
        li.addEventListener('click', () => {
            state.elementId = item.id;
            renderElements();
            renderPropertyEditor();
        });
        ul.appendChild(li);
    });
    refs.elementList.appendChild(ul);
}

function getSurfaceEvents() {
    const runtime = state.runtimeCatalog || null;
    return schema.resolveSurfaceEvents(state.surface, runtime);
}

function renderEvents() {
    const events = getSurfaceEvents();
    if (!events.includes(state.eventId)) state.eventId = events[0] || '';
    refs.eventList.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'pick-list';
    events.forEach((eventId) => {
        const li = document.createElement('li');
        li.className = 'pick-item';
        li.textContent = eventId;
        li.classList.toggle('active', state.eventId === eventId);
        li.addEventListener('click', () => {
            state.eventId = eventId;
            renderEvents();
            renderEventEditor();
        });
        ul.appendChild(li);
    });
    refs.eventList.appendChild(ul);
}

function renderPropertyEditor() {
    const def = currentSurfaceDef();
    const elementDef = (def.elements || []).find((item) => item.id === state.elementId) || def.elements[0];
    if (!elementDef) return;

    refs.elementTitle.textContent = `元素属性: ${elementDef.label}`;
    refs.propertyFields.innerHTML = '';
    const rule = ensureRule();
    const props = elementDef.props || schema.COMMON_PROPS;
    props.forEach((name) => {
        const row = document.createElement('label');
        row.className = 'field-row';
        row.textContent = name;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = typeof rule[name] === 'string' ? rule[name] : '';
        input.addEventListener('input', () => {
            rule[name] = input.value;
            applyPreview();
        });
        row.appendChild(input);
        refs.propertyFields.appendChild(row);
    });

    refs.customCss.value = currentThemeSurface().extraCss || '';
}

function optionItem(value, label) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    return opt;
}

function assetLabel(asset) {
    const kb = Math.round((Number(asset.size) || 0) / 1024);
    return `${asset.name || asset.id} [${asset.kind}] (${kb}KB)`;
}

function findAssetMeta(assetId) {
    return state.assets.find((asset) => asset.id === assetId) || null;
}

async function loadAssets() {
    if (!assetStore || typeof assetStore.listAssets !== 'function') {
        state.assets = [];
        return;
    }
    const kind = state.assetFilter === 'all' ? null : state.assetFilter;
    state.assets = await assetStore.listAssets(kind);
}

function fillAssetSelect(selectEl, filterFn, includeEmptyLabel = '（不设置）') {
    if (!selectEl) return;
    const selected = selectEl.value;
    selectEl.innerHTML = '';
    selectEl.appendChild(optionItem('', includeEmptyLabel));
    state.assets.filter(filterFn).forEach((asset) => {
        selectEl.appendChild(optionItem(asset.id, assetLabel(asset)));
    });
    if ([...selectEl.options].some((opt) => opt.value === selected)) {
        selectEl.value = selected;
    }
}

function renderBackgroundBindings() {
    fillAssetSelect(refs.bgEntry, (asset) => ['entry_bg', 'effect_image'].includes(asset.kind), 'entry 默认');
    fillAssetSelect(refs.bgGame, (asset) => ['game_bg', 'effect_image'].includes(asset.kind), 'game 默认');
    fillAssetSelect(refs.bgBoard, (asset) => ['board_bg', 'effect_image'].includes(asset.kind), 'board 默认');

    refs.bgEntry.value = state.assetManifest.backgrounds.entry || '';
    refs.bgGame.value = state.assetManifest.backgrounds.game || '';
    refs.bgBoard.value = state.assetManifest.backgrounds.board || '';
}

function renderPieceIconSelectors() {
    refs.pieceIconType.innerHTML = '';
    schema.PIECE_TYPES.forEach((pieceType) => {
        refs.pieceIconType.appendChild(optionItem(pieceType, pieceType));
    });
    refs.pieceIconTeam.innerHTML = '';
    schema.PIECE_TEAMS.forEach((team) => {
        refs.pieceIconTeam.appendChild(optionItem(team, team));
    });
    fillAssetSelect(refs.pieceIconAsset, (asset) => ['piece_icon', 'effect_image'].includes(asset.kind), '选择素材');
}

function renderPieceIconList() {
    refs.pieceIconList.innerHTML = '';
    const iconMap = state.assetManifest.pieceIcons || {};
    Object.keys(iconMap).forEach((key) => {
        const assetId = iconMap[key];
        const row = document.createElement('div');
        row.className = 'mapping-item';
        const meta = findAssetMeta(assetId);
        row.innerHTML = `
            <div>${key}</div>
            <div>${meta ? assetLabel(meta) : assetId || '未绑定'}</div>
        `;
        const actions = document.createElement('div');
        actions.className = 'inline-row';
        actions.style.gridTemplateColumns = '1fr';
        const btn = document.createElement('button');
        btn.className = 'toolbar-btn tiny warning';
        btn.textContent = '删除映射';
        btn.addEventListener('click', () => {
            delete state.assetManifest.pieceIcons[key];
            renderPieceIconList();
            applyPreview();
        });
        actions.appendChild(btn);
        row.appendChild(actions);
        refs.pieceIconList.appendChild(row);
    });
}

function renderScenePlacementSelectors() {
    fillAssetSelect(refs.scenePlacementAsset, (asset) => ['effect_image', 'entry_bg', 'game_bg', 'board_bg', 'piece_icon'].includes(asset.kind), '选择素材');
}

function createNumberInput(value, min, max, step, onInput) {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => onInput(Number(input.value)));
    return input;
}

function createSelect(options, value, onChange) {
    const select = document.createElement('select');
    options.forEach((item) => select.appendChild(optionItem(item, item)));
    select.value = value;
    select.addEventListener('change', () => onChange(select.value));
    return select;
}

function renderScenePlacementList() {
    const list = currentScenePlacements();
    refs.scenePlacementList.innerHTML = '';
    list.forEach((placement, index) => {
        const row = document.createElement('div');
        row.className = 'mapping-item';
        const head = document.createElement('div');
        head.textContent = placement.label || placement.id || `placement_${index + 1}`;
        row.appendChild(head);

        const controls = document.createElement('div');
        controls.className = 'inline-row';
        controls.style.gridTemplateColumns = '1fr 1fr';
        const assetSelect = document.createElement('select');
        state.assets.forEach((asset) => assetSelect.appendChild(optionItem(asset.id, assetLabel(asset))));
        if (![...assetSelect.options].some((opt) => opt.value === placement.assetId)) {
            assetSelect.prepend(optionItem('', '缺失素材'));
            assetSelect.value = '';
        } else {
            assetSelect.value = placement.assetId;
        }
        assetSelect.addEventListener('change', () => {
            placement.assetId = assetSelect.value;
            applyPreview();
        });
        controls.appendChild(assetSelect);
        controls.appendChild(createSelect(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'], placement.anchor || 'top-left', (value) => {
            placement.anchor = value;
            applyPreview();
        }));
        controls.appendChild(createNumberInput(placement.x || 4, -200, 200, 1, (value) => { placement.x = value; applyPreview(); }));
        controls.appendChild(createNumberInput(placement.y || 4, -200, 200, 1, (value) => { placement.y = value; applyPreview(); }));
        controls.appendChild(createNumberInput(placement.width || 22, 1, 200, 1, (value) => { placement.width = value; applyPreview(); }));
        controls.appendChild(createNumberInput(placement.height || 22, 1, 200, 1, (value) => { placement.height = value; applyPreview(); }));
        controls.appendChild(createSelect(VFX_PRESETS, placement.vfxPreset || 'pc98_pixel_pop', (value) => {
            placement.vfxPreset = value;
            applyPreview();
        }));
        controls.appendChild(createNumberInput(placement.zIndex || 20, 1, 99999, 1, (value) => { placement.zIndex = value; applyPreview(); }));
        row.appendChild(controls);

        const actions = document.createElement('div');
        actions.className = 'inline-row';
        actions.style.gridTemplateColumns = '1fr';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'toolbar-btn tiny warning';
        removeBtn.textContent = '删除摆件';
        removeBtn.addEventListener('click', () => {
            list.splice(index, 1);
            renderScenePlacementList();
            applyPreview();
        });
        actions.appendChild(removeBtn);
        row.appendChild(actions);
        refs.scenePlacementList.appendChild(row);
    });
}

async function renderAssetList() {
    refs.assetList.innerHTML = '';
    for (const asset of state.assets) {
        const row = document.createElement('div');
        row.className = 'asset-row';
        const thumb = document.createElement('img');
        thumb.className = 'asset-thumb';
        try {
            thumb.src = await assetStore.resolveAssetUrl(asset.id);
        } catch (_e) {
            thumb.src = '';
        }
        const meta = document.createElement('div');
        meta.className = 'asset-meta';
        meta.innerHTML = `
            <strong>${asset.name || asset.id}</strong>
            <span>${asset.kind}</span>
            <span>${Math.round((asset.size || 0) / 1024)}KB</span>
        `;
        const actions = document.createElement('div');
        actions.className = 'asset-actions';
        const renameBtn = document.createElement('button');
        renameBtn.className = 'toolbar-btn tiny';
        renameBtn.textContent = '重命名';
        renameBtn.addEventListener('click', async () => {
            const nextName = prompt('输入新名称', asset.name || asset.id);
            if (!nextName || !nextName.trim()) return;
            await assetStore.renameAsset(asset.id, nextName.trim());
            await refreshAssetsAndBindings();
            status('素材已重命名', 'ok');
        });
        const delBtn = document.createElement('button');
        delBtn.className = 'toolbar-btn tiny warning';
        delBtn.textContent = '删除';
        delBtn.addEventListener('click', async () => {
            if (!confirm('确认删除该素材？')) return;
            await assetStore.deleteAsset(asset.id);
            cleanupAssetReferences(asset.id);
            await refreshAssetsAndBindings();
            applyPreview();
            status('素材已删除', 'ok');
        });
        actions.appendChild(renameBtn);
        actions.appendChild(delBtn);

        row.appendChild(thumb);
        row.appendChild(meta);
        row.appendChild(actions);
        refs.assetList.appendChild(row);
    }
}

function cleanupAssetReferences(assetId) {
    const manifest = state.assetManifest;
    Object.keys(manifest.backgrounds || {}).forEach((key) => {
        if (manifest.backgrounds[key] === assetId) manifest.backgrounds[key] = '';
    });
    Object.keys(manifest.pieceIcons || {}).forEach((key) => {
        if (manifest.pieceIcons[key] === assetId) delete manifest.pieceIcons[key];
    });
    Object.keys(manifest.scenePlacements || {}).forEach((surfaceId) => {
        manifest.scenePlacements[surfaceId] = (manifest.scenePlacements[surfaceId] || []).filter((placement) => placement.assetId !== assetId);
    });
    Object.keys(state.effectsPack.surfaces || {}).forEach((surfaceId) => {
        const events = state.effectsPack.surfaces[surfaceId].events || {};
        Object.keys(events).forEach((eventId) => {
            const cfg = events[eventId];
            cfg.actions = (cfg.actions || []).filter((action) => action.assetId !== assetId);
        });
    });
}

async function refreshAssetsAndBindings() {
    await loadAssets();
    renderBackgroundBindings();
    renderPieceIconSelectors();
    renderPieceIconList();
    renderScenePlacementSelectors();
    renderScenePlacementList();
    await renderAssetList();
    if (guide.active) renderGuideStep();
}

function renderVersions(preferId) {
    refs.versionSelect.innerHTML = '';
    if (!state.versions.length) {
        refs.versionSelect.appendChild(optionItem('', '暂无快照'));
        return;
    }
    state.versions.forEach((item) => {
        const opt = optionItem(item.id, `${new Date(item.createdAt).toLocaleString()} - ${item.note}`);
        refs.versionSelect.appendChild(opt);
    });
    if (preferId) refs.versionSelect.value = preferId;
}

function createSnapshot(note, autoMode) {
    const snapshot = {
        id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        note: (note || '').trim() || (autoMode ? '自动快照' : '手动快照'),
        themePack: clone(state.themePack),
        effectsPack: clone(state.effectsPack),
        assetManifest: clone(state.assetManifest)
    };
    state.versions.unshift(snapshot);
    state.versions = state.versions.slice(0, 50);
    renderVersions(snapshot.id);
}

function applySnapshot(id) {
    const hit = state.versions.find((item) => item.id === id);
    if (!hit) throw new Error('找不到快照');
    state.themePack = schema.normalizeThemePack(hit.themePack);
    state.effectsPack = schema.normalizeEffectsPack(hit.effectsPack);
    state.assetManifest = schema.normalizeAssetManifest(hit.assetManifest);
    renderBackgroundBindings();
    renderPieceIconList();
    renderScenePlacementList();
    renderSurfaceData();
    applyPreview();
}

function getConditionMeta(conditionType) {
    const type = conditionType || 'actor_name';
    const teamOptions = ['black', 'white', 'neutral', 'any'];
    const pieceTypeOptions = schema.PIECE_TYPES.slice();
    const resultOptions = ['success', 'failure', 'ultimate', 'captured', 'grave', 'ghost', 'revive', 'hover', 'move', 'kill', 'win', 'draw', 'rolling', 'next_turn', 'day', 'night', 'exit'];
    const causeOptions = ['skill', 'capture', 'move', 'context_menu', 'stack_picker', 'board_click', 'state_diff', 'log_sync', 'death_god_dice', 'start_button', 'end_turn', 'game_over', 'upgrade', 'ai_upgrade', 'ai_end_turn'];
    const skillOptions = ['possess', 'day_night', 'crush', 'arrest', 'resurrect', 'swap', 'summon', 'save', 'vortex', 'tunnel_roll', 'destroy', 'destiny_success', 'destiny_fail', 'learn'];

    const metaByType = {
        actor_team: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'select', options: teamOptions },
        target_team: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'select', options: teamOptions },
        victim_team: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'select', options: teamOptions },
        actor_piece_type: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'select', options: pieceTypeOptions },
        target_piece_type: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'select', options: pieceTypeOptions },
        victim_piece_type: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'select', options: pieceTypeOptions },
        result: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'select', options: resultOptions },
        cause: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'select', options: causeOptions },
        skill_type: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'select', options: skillOptions },
        event_id: { operators: ['equals', 'neq', 'in', 'exists', 'not_exists'], valueKind: 'event_select' },
        dice: { operators: ['equals', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists'], valueKind: 'number' },
        log_contains: { operators: ['contains', 'not_contains', 'regex', 'exists', 'not_exists'], valueKind: 'text', placeholder: '输入日志片段/正则' }
    };
    return metaByType[type] || {
        operators: ['equals', 'neq', 'contains', 'not_contains', 'regex', 'in', 'exists', 'not_exists'],
        valueKind: 'text',
        placeholder: '条件值'
    };
}

function isConditionValueHidden(operator) {
    return operator === 'exists' || operator === 'not_exists';
}

function normalizeConditionForEditor(condition) {
    const meta = getConditionMeta(condition.type);
    const operators = meta.operators || CONDITION_OPERATORS;
    if (!operators.includes(condition.operator)) {
        condition.operator = operators[0] || 'equals';
    }
    if (isConditionValueHidden(condition.operator)) {
        condition.value = '';
        return;
    }
    if (condition.operator === 'in') {
        if (Array.isArray(condition.value)) {
            condition.value = condition.value.map((item) => String(item).trim()).filter(Boolean);
        } else if (typeof condition.value === 'string') {
            condition.value = condition.value.split(',').map((item) => item.trim()).filter(Boolean);
        } else if (condition.value === undefined || condition.value === null) {
            condition.value = [];
        } else {
            condition.value = [String(condition.value)];
        }
        if (meta.valueKind === 'select' || meta.valueKind === 'event_select') {
            const options = meta.valueKind === 'event_select' ? getSurfaceEvents() : (meta.options || []);
            const allow = new Set(options.map((item) => String(item)));
            condition.value = condition.value.filter((item) => allow.has(String(item)));
        }
        return;
    }
    if (meta.valueKind === 'number') {
        const num = Number(condition.value);
        condition.value = Number.isFinite(num) ? num : 0;
        return;
    }
    if ((meta.valueKind === 'select' || meta.valueKind === 'event_select') && condition.operator !== 'in') {
        const options = meta.valueKind === 'event_select' ? getSurfaceEvents() : (meta.options || []);
        const values = options.map((item) => String(item));
        if (!values.includes(String(condition.value))) {
            condition.value = values[0] || '';
        }
        return;
    }
    if (condition.value === undefined || condition.value === null) {
        condition.value = '';
    }
}

function getConditionValueTags(condition) {
    if (Array.isArray(condition.value)) {
        return condition.value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof condition.value === 'string') {
        return condition.value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    if (condition.value === undefined || condition.value === null) {
        return [];
    }
    return [String(condition.value)];
}

function setConditionValueTags(condition, values, options, allowFreeText) {
    const unique = [];
    const seen = new Set();
    const allow = Array.isArray(options) ? new Set(options.map((item) => String(item))) : null;
    values.forEach((raw) => {
        const value = String(raw || '').trim();
        if (!value || seen.has(value)) return;
        if (!allowFreeText && allow && !allow.has(value)) return;
        seen.add(value);
        unique.push(value);
    });
    condition.value = unique;
}

function createConditionTagInput(condition, options, allowFreeText) {
    const root = document.createElement('div');
    root.className = 'tag-editor';
    const listEl = document.createElement('div');
    listEl.className = 'tag-list';
    root.appendChild(listEl);

    const addRow = document.createElement('div');
    addRow.className = 'tag-add-row';
    root.appendChild(addRow);

    let inputEl;
    if (Array.isArray(options) && options.length) {
        inputEl = document.createElement('select');
        options.forEach((item) => inputEl.appendChild(optionItem(String(item), String(item))));
    } else {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.placeholder = '输入后点添加';
    }
    addRow.appendChild(inputEl);

    const addBtn = document.createElement('button');
    addBtn.className = 'toolbar-btn tiny';
    addBtn.type = 'button';
    addBtn.textContent = '添加';
    addRow.appendChild(addBtn);

    const commit = (nextValues) => {
        setConditionValueTags(condition, nextValues, options, allowFreeText);
        syncEventJsonFromConfig();
        applyPreview();
        renderTags();
    };

    const renderTags = () => {
        const tags = getConditionValueTags(condition);
        listEl.innerHTML = '';
        tags.forEach((tag) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            const text = document.createElement('span');
            text.textContent = tag;
            chip.appendChild(text);
            const close = document.createElement('button');
            close.type = 'button';
            close.textContent = 'x';
            close.addEventListener('click', () => {
                commit(tags.filter((item) => item !== tag));
            });
            chip.appendChild(close);
            listEl.appendChild(chip);
        });
    };

    const readCandidate = () => {
        if (inputEl.tagName === 'SELECT') return String(inputEl.value || '').trim();
        return String(inputEl.value || '').trim();
    };

    const clearCandidate = () => {
        if (inputEl.tagName === 'SELECT') return;
        inputEl.value = '';
    };

    const addCandidate = () => {
        const candidate = readCandidate();
        if (!candidate) return;
        const current = getConditionValueTags(condition);
        if (current.includes(candidate)) return;
        commit(current.concat([candidate]));
        clearCandidate();
    };

    addBtn.addEventListener('click', addCandidate);
    if (inputEl.tagName !== 'SELECT') {
        inputEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addCandidate();
            }
        });
    }

    renderTags();
    return root;
}

function createConditionValueInput(condition, cfg) {
    const meta = getConditionMeta(condition.type);
    const operator = condition.operator || 'equals';
    if (isConditionValueHidden(operator)) {
        return null;
    }

    if (meta.valueKind === 'number') {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '1';
        input.value = String(Number.isFinite(Number(condition.value)) ? Number(condition.value) : 0);
        input.addEventListener('input', () => {
            condition.value = Number.isFinite(Number(input.value)) ? Number(input.value) : 0;
            syncEventJsonFromConfig();
            applyPreview();
        });
        return input;
    }

    if (operator === 'in') {
        if (meta.valueKind === 'select' || meta.valueKind === 'event_select') {
            const options = meta.valueKind === 'event_select' ? getSurfaceEvents() : (meta.options || []);
            return createConditionTagInput(condition, options, false);
        }
        return createConditionTagInput(condition, null, true);
    }

    if (meta.valueKind === 'select' || meta.valueKind === 'event_select') {
        const options = meta.valueKind === 'event_select' ? getSurfaceEvents() : (meta.options || []);
        const select = document.createElement('select');
        options.forEach((item) => {
            select.appendChild(optionItem(String(item), String(item)));
        });
        if (![...select.options].some((opt) => opt.value === String(condition.value))) {
            condition.value = options[0] || '';
        }
        select.value = String(condition.value || '');
        select.addEventListener('change', () => {
            condition.value = select.value;
            syncEventJsonFromConfig();
            applyPreview();
        });
        return select;
    }

    return createTextInput(condition.value === undefined || condition.value === null ? '' : String(condition.value), meta.placeholder || '条件值', (value) => {
        condition.value = value;
        syncEventJsonFromConfig();
        applyPreview();
    });
}

function renderConditionsList(cfg) {
    refs.conditionsList.innerHTML = '';
    (cfg.conditions || []).forEach((condition, index) => {
        normalizeConditionForEditor(condition);
        const meta = getConditionMeta(condition.type);
        const row = document.createElement('div');
        row.className = 'mapping-item';

        const header = document.createElement('div');
        header.className = 'action-header';
        const title = document.createElement('span');
        title.textContent = `条件 #${index + 1}`;
        header.appendChild(title);
        const hint = document.createElement('span');
        hint.className = 'action-hint';
        hint.textContent = `type: ${condition.type || 'actor_name'}`;
        header.appendChild(hint);
        row.appendChild(header);

        const controls = document.createElement('div');
        controls.className = 'action-fields';
        const conditionTypeOptions = DEFAULT_CONDITION_TYPES.includes(condition.type)
            ? DEFAULT_CONDITION_TYPES
            : DEFAULT_CONDITION_TYPES.concat([condition.type || 'actor_name']);
        controls.appendChild(createSelect(conditionTypeOptions, condition.type || 'actor_name', (value) => {
            condition.type = value;
            normalizeConditionForEditor(condition);
            renderConditionsList(cfg);
            syncEventJsonFromConfig();
            applyPreview();
        }));
        const operatorOptions = (meta.operators && meta.operators.length) ? meta.operators : CONDITION_OPERATORS;
        controls.appendChild(createSelect(operatorOptions, condition.operator || operatorOptions[0], (value) => {
            condition.operator = value;
            normalizeConditionForEditor(condition);
            renderConditionsList(cfg);
            syncEventJsonFromConfig();
            applyPreview();
        }));
        const valueInput = createConditionValueInput(condition, cfg);
        if (valueInput) {
            controls.appendChild(valueInput);
        } else {
            const hiddenHint = document.createElement('div');
            hiddenHint.className = 'action-hint';
            hiddenHint.textContent = '当前操作符无需填写值';
            controls.appendChild(hiddenHint);
        }
        row.appendChild(controls);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'toolbar-btn tiny warning';
        removeBtn.textContent = '删除条件';
        removeBtn.addEventListener('click', () => {
            cfg.conditions.splice(index, 1);
            renderConditionsList(cfg);
            syncEventJsonFromConfig();
            applyPreview();
        });
        row.appendChild(removeBtn);
        refs.conditionsList.appendChild(row);
    });
}

function createTextInput(value, placeholder, onInput) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.addEventListener('input', () => onInput(input.value));
    return input;
}

function appendLabeledField(container, labelText, inputEl) {
    const label = document.createElement('label');
    label.className = 'field-row';
    label.textContent = labelText;
    label.appendChild(inputEl);
    container.appendChild(label);
}

function createAssetSelectInput(value, onChange, includeEmptyLabel = '不使用素材', filterFn = null) {
    const select = document.createElement('select');
    select.appendChild(optionItem('', includeEmptyLabel));
    const filtered = typeof filterFn === 'function' ? state.assets.filter(filterFn) : state.assets.slice();
    filtered.forEach((asset) => select.appendChild(optionItem(asset.id, assetLabel(asset))));
    select.value = value || '';
    if (![...select.options].some((opt) => opt.value === (value || ''))) {
        select.value = '';
    }
    select.addEventListener('change', () => onChange(select.value));
    return select;
}

function applyActionTemplate(action, actionType) {
    action.type = actionType;
    const defaults = schema.defaultEventAction();
    const templates = {
        overlay_preset: {
            overlayPreset: action.overlayPreset && action.overlayPreset !== 'none' ? action.overlayPreset : 'flash-white',
            durationMs: action.durationMs || 700,
            cooldownMs: action.cooldownMs || 0
        },
        apply_css_class: {
            cssClass: action.cssClass || 'mcfx-pulse-target',
            durationMs: action.durationMs || 700,
            cooldownMs: action.cooldownMs || 0
        },
        play_sfx: {
            path: action.path || '',
            assetId: action.assetId || '',
            volume: Number.isFinite(Number(action.volume)) ? Number(action.volume) : 0.7,
            cooldownMs: action.cooldownMs || 0
        },
        play_bgm: {
            path: action.path || '',
            assetId: action.assetId || '',
            volume: Number.isFinite(Number(action.volume)) ? Number(action.volume) : 0.6,
            cooldownMs: action.cooldownMs || 0
        },
        spawn_material: {
            path: action.path || '',
            assetId: action.assetId || '',
            anchor: action.anchor || 'center',
            x: Number.isFinite(Number(action.x)) ? Number(action.x) : 50,
            y: Number.isFinite(Number(action.y)) ? Number(action.y) : 50,
            width: Number.isFinite(Number(action.width)) ? Number(action.width) : 30,
            height: Number.isFinite(Number(action.height)) ? Number(action.height) : 30,
            zIndex: Number.isFinite(Number(action.zIndex)) ? Number(action.zIndex) : 9998,
            blendMode: action.blendMode || 'normal',
            durationMs: action.durationMs || 1200,
            cooldownMs: action.cooldownMs || 0,
            vfxPreset: action.vfxPreset || 'pc98_pixel_pop'
        },
        show_image: {
            path: action.path || '',
            assetId: action.assetId || '',
            anchor: action.anchor || 'center',
            x: Number.isFinite(Number(action.x)) ? Number(action.x) : 50,
            y: Number.isFinite(Number(action.y)) ? Number(action.y) : 50,
            width: Number.isFinite(Number(action.width)) ? Number(action.width) : 30,
            height: Number.isFinite(Number(action.height)) ? Number(action.height) : 30,
            zIndex: Number.isFinite(Number(action.zIndex)) ? Number(action.zIndex) : 9998,
            blendMode: action.blendMode || 'normal',
            durationMs: action.durationMs || 1200,
            cooldownMs: action.cooldownMs || 0,
            vfxPreset: action.vfxPreset || 'pc98_pixel_pop'
        },
        material_action: {
            path: action.path || '',
            assetId: action.assetId || '',
            anchor: action.anchor || 'center',
            x: Number.isFinite(Number(action.x)) ? Number(action.x) : 50,
            y: Number.isFinite(Number(action.y)) ? Number(action.y) : 50,
            width: Number.isFinite(Number(action.width)) ? Number(action.width) : 30,
            height: Number.isFinite(Number(action.height)) ? Number(action.height) : 30,
            zIndex: Number.isFinite(Number(action.zIndex)) ? Number(action.zIndex) : 9998,
            blendMode: action.blendMode || 'normal',
            durationMs: action.durationMs || 1200,
            cooldownMs: action.cooldownMs || 0,
            vfxPreset: action.vfxPreset || 'pc98_pixel_pop'
        },
        vfx_preset: {
            vfxPreset: action.vfxPreset || 'pc98_pixel_pop',
            overlayPreset: action.overlayPreset || 'none',
            durationMs: action.durationMs || 600,
            cooldownMs: action.cooldownMs || 0
        }
    };
    const patch = templates[actionType] || {};
    Object.keys(defaults).forEach((key) => {
        if (action[key] === undefined) action[key] = defaults[key];
    });
    Object.assign(action, patch);
}

function renderActionTypeSpecificFields(action, container) {
    const type = action.type || 'overlay_preset';
    const blendModes = ['normal', 'screen', 'multiply', 'overlay', 'difference', 'lighten', 'darken'];
    const anchors = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

    if (type === 'overlay_preset') {
        appendLabeledField(container, '预设效果', createSelect(OVERLAY_PRESETS, action.overlayPreset || 'flash-white', (value) => {
            action.overlayPreset = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '持续(ms)', createNumberInput(action.durationMs || 700, 100, 60000, 50, (value) => {
            action.durationMs = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '冷却(ms)', createNumberInput(action.cooldownMs || 0, 0, 600000, 50, (value) => {
            action.cooldownMs = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        return;
    }

    if (type === 'apply_css_class') {
        appendLabeledField(container, 'CSS 类名', createTextInput(action.cssClass || '', '如 mcfx-pulse-target', (value) => {
            action.cssClass = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '持续(ms)', createNumberInput(action.durationMs || 700, 100, 60000, 50, (value) => {
            action.durationMs = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '冷却(ms)', createNumberInput(action.cooldownMs || 0, 0, 600000, 50, (value) => {
            action.cooldownMs = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        return;
    }

    if (type === 'play_sfx' || type === 'play_bgm') {
        appendLabeledField(container, '素材ID(可选)', createAssetSelectInput(action.assetId || '', (value) => {
            action.assetId = value;
            syncEventJsonFromConfig();
            applyPreview();
        }, '不使用素材ID'));
        appendLabeledField(container, '文件路径(可选)', createTextInput(action.path || '', 'static/uploads/xxx.mp3', (value) => {
            action.path = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '音量(0~1)', createNumberInput(action.volume || 0.7, 0, 1, 0.05, (value) => {
            action.volume = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '冷却(ms)', createNumberInput(action.cooldownMs || 0, 0, 600000, 50, (value) => {
            action.cooldownMs = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        return;
    }

    if (type === 'spawn_material' || type === 'material_action' || type === 'show_image') {
        appendLabeledField(container, '素材ID', createAssetSelectInput(action.assetId || '', (value) => {
            action.assetId = value;
            syncEventJsonFromConfig();
            applyPreview();
        }, '请选择素材'));
        appendLabeledField(container, '文件路径(备选)', createTextInput(action.path || '', 'static/uploads/xxx.png', (value) => {
            action.path = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, 'VFX 预设', createSelect(VFX_PRESETS, action.vfxPreset || 'pc98_pixel_pop', (value) => {
            action.vfxPreset = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '混合模式', createSelect(blendModes, action.blendMode || 'normal', (value) => {
            action.blendMode = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '锚点', createSelect(anchors, action.anchor || 'center', (value) => {
            action.anchor = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, 'X(%)', createNumberInput(action.x || 50, -200, 200, 1, (value) => {
            action.x = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, 'Y(%)', createNumberInput(action.y || 50, -200, 200, 1, (value) => {
            action.y = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '宽(vw)', createNumberInput(action.width || 30, 1, 200, 1, (value) => {
            action.width = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '高(vh)', createNumberInput(action.height || 30, 1, 200, 1, (value) => {
            action.height = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '层级(z)', createNumberInput(action.zIndex || 9998, 1, 99999, 1, (value) => {
            action.zIndex = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '持续(ms)', createNumberInput(action.durationMs || 1200, 100, 60000, 50, (value) => {
            action.durationMs = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '冷却(ms)', createNumberInput(action.cooldownMs || 0, 0, 600000, 50, (value) => {
            action.cooldownMs = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        return;
    }

    if (type === 'vfx_preset') {
        appendLabeledField(container, 'VFX 预设', createSelect(VFX_PRESETS, action.vfxPreset || 'pc98_pixel_pop', (value) => {
            action.vfxPreset = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, 'overlay(可选)', createSelect(OVERLAY_PRESETS, action.overlayPreset || 'none', (value) => {
            action.overlayPreset = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '持续(ms)', createNumberInput(action.durationMs || 600, 100, 60000, 50, (value) => {
            action.durationMs = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        appendLabeledField(container, '冷却(ms)', createNumberInput(action.cooldownMs || 0, 0, 600000, 50, (value) => {
            action.cooldownMs = value;
            syncEventJsonFromConfig();
            applyPreview();
        }));
        return;
    }

    // Fallback for unknown action types: expose generic set
    appendLabeledField(container, '素材ID(可选)', createAssetSelectInput(action.assetId || '', (value) => {
        action.assetId = value;
        syncEventJsonFromConfig();
        applyPreview();
    }, '不使用素材ID'));
    appendLabeledField(container, '路径(可选)', createTextInput(action.path || '', 'path', (value) => {
        action.path = value;
        syncEventJsonFromConfig();
        applyPreview();
    }));
    appendLabeledField(container, 'CSS 类名(可选)', createTextInput(action.cssClass || '', 'css class', (value) => {
        action.cssClass = value;
        syncEventJsonFromConfig();
        applyPreview();
    }));
    appendLabeledField(container, 'overlay(可选)', createSelect(OVERLAY_PRESETS, action.overlayPreset || 'none', (value) => {
        action.overlayPreset = value;
        syncEventJsonFromConfig();
        applyPreview();
    }));
    appendLabeledField(container, 'VFX(可选)', createSelect(VFX_PRESETS, action.vfxPreset || 'pc98_pixel_pop', (value) => {
        action.vfxPreset = value;
        syncEventJsonFromConfig();
        applyPreview();
    }));
    appendLabeledField(container, '持续(ms)', createNumberInput(action.durationMs || 1200, 100, 60000, 50, (value) => {
        action.durationMs = value;
        syncEventJsonFromConfig();
        applyPreview();
    }));
    appendLabeledField(container, '冷却(ms)', createNumberInput(action.cooldownMs || 0, 0, 600000, 50, (value) => {
        action.cooldownMs = value;
        syncEventJsonFromConfig();
        applyPreview();
    }));
}

function renderActionsList(cfg) {
    refs.actionsList.innerHTML = '';
    (cfg.actions || []).forEach((action, index) => {
        const row = document.createElement('div');
        row.className = 'mapping-item action-card';

        const header = document.createElement('div');
        header.className = 'action-header';
        const title = document.createElement('span');
        title.textContent = `动作 #${index + 1}`;
        header.appendChild(title);
        const actionTypeOptions = DEFAULT_ACTION_TYPES.includes(action.type) ? DEFAULT_ACTION_TYPES : DEFAULT_ACTION_TYPES.concat([action.type || 'overlay_preset']);
        const typeSelect = createSelect(actionTypeOptions, action.type || 'overlay_preset', (value) => {
            applyActionTemplate(action, value);
            renderActionsList(cfg);
            syncEventJsonFromConfig();
            applyPreview();
        });
        typeSelect.style.maxWidth = '220px';
        header.appendChild(typeSelect);
        row.appendChild(header);

        const hint = document.createElement('div');
        hint.className = 'action-hint';
        const hintTextMap = {
            overlay_preset: '全屏/目标预设效果',
            apply_css_class: '给目标元素添加临时类名',
            play_sfx: '播放一次音效',
            play_bgm: '切换/播放背景音乐',
            spawn_material: '在场景生成素材精灵',
            vfx_preset: '独立触发 VFX 预设'
        };
        hint.textContent = hintTextMap[action.type] || '通用动作';
        row.appendChild(hint);

        const controls = document.createElement('div');
        controls.className = 'action-fields';
        renderActionTypeSpecificFields(action, controls);
        row.appendChild(controls);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'toolbar-btn tiny warning';
        removeBtn.textContent = '删除动作';
        removeBtn.addEventListener('click', () => {
            cfg.actions.splice(index, 1);
            renderActionsList(cfg);
            syncEventJsonFromConfig();
            applyPreview();
        });
        row.appendChild(removeBtn);
        refs.actionsList.appendChild(row);
    });
}

function syncEventJsonFromConfig() {
    const cfg = ensureEventConfig();
    if (!cfg) return;
    refs.eventJsonInput.value = JSON.stringify(schema.normalizeEventConfig(cfg), null, 2);
}

function applyEventJson() {
    const cfg = ensureEventConfig();
    if (!cfg) return;
    try {
        const raw = JSON.parse(refs.eventJsonInput.value);
        const normalized = schema.normalizeEventConfig(raw);
        currentEffectsSurface().events[state.eventId] = normalized;
        renderEventEditor();
        applyPreview();
        status('事件 JSON 已应用', 'ok');
    } catch (err) {
        status(`事件 JSON 解析失败: ${err.message}`, 'error');
    }
}

function renderEventEditor() {
    if (!state.eventId) {
        refs.eventTitle.textContent = '事件效果（事件+条件+动作）';
        refs.conditionsList.innerHTML = '';
        refs.actionsList.innerHTML = '';
        refs.eventJsonInput.value = '';
        return;
    }
    refs.eventTitle.textContent = `事件效果: ${state.eventId}`;
    const cfg = ensureEventConfig();
    refs.eventEnabled.checked = cfg.enabled !== false;
    refs.eventLogic.value = cfg.logic === 'OR' ? 'OR' : 'AND';
    refs.eventCooldown.value = String(cfg.cooldownMs || 0);
    renderConditionsList(cfg);
    renderActionsList(cfg);
    syncEventJsonFromConfig();
}

function renderSurfaceData() {
    const def = currentSurfaceDef();
    if (!(def.elements || []).some((item) => item.id === state.elementId)) {
        state.elementId = (def.elements[0] && def.elements[0].id) || '';
    }
    const events = getSurfaceEvents();
    if (!events.includes(state.eventId)) state.eventId = events[0] || '';
    refs.customCss.value = currentThemeSurface().extraCss || '';
    renderElements();
    renderEvents();
    renderPropertyEditor();
    renderEventEditor();
    renderScenePlacementList();
    if (guide.active) renderGuideStep();
}

function referencedAssetIds() {
    const ids = new Set();
    const manifest = state.assetManifest || {};
    Object.values(manifest.backgrounds || {}).forEach((id) => { if (id) ids.add(id); });
    Object.values(manifest.pieceIcons || {}).forEach((id) => { if (id) ids.add(id); });
    Object.keys(manifest.scenePlacements || {}).forEach((surfaceId) => {
        (manifest.scenePlacements[surfaceId] || []).forEach((item) => { if (item.assetId) ids.add(item.assetId); });
    });
    Object.keys(state.effectsPack.surfaces || {}).forEach((surfaceId) => {
        const surface = state.effectsPack.surfaces[surfaceId];
        Object.keys(surface.events || {}).forEach((eventId) => {
            const cfg = schema.normalizeEventConfig(surface.events[eventId]);
            (cfg.actions || []).forEach((action) => { if (action.assetId) ids.add(action.assetId); });
        });
        (surface.scenePlacements || []).forEach((item) => { if (item.assetId) ids.add(item.assetId); });
    });
    return [...ids];
}

async function exportAll() {
    const includeAssets = !!refs.exportWithAssets.checked;
    const payload = {
        schemaVersion: schema.SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        themePack: state.themePack,
        effectsPack: state.effectsPack,
        assetManifest: state.assetManifest,
        versions: state.versions,
        assets: []
    };
    if (includeAssets && assetStore && typeof assetStore.exportAssets === 'function') {
        payload.assets = await assetStore.exportAssets(referencedAssetIds());
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mole_chess_ui_editor_v3_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function importAll(file) {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (Array.isArray(payload.assets) && payload.assets.length && assetStore && typeof assetStore.importAssets === 'function') {
        await assetStore.importAssets(payload.assets);
    }
    state.themePack = schema.normalizeThemePack(payload.themePack || payload);
    state.effectsPack = schema.normalizeEffectsPack(payload.effectsPack || {});
    state.assetManifest = schema.normalizeAssetManifest(payload.assetManifest || {});
    state.versions = Array.isArray(payload.versions) ? payload.versions.slice(0, 50) : [];
    persistState();
    await refreshAssetsAndBindings();
    renderSurfaceData();
    applyPreview();
}

function bindMessage() {
    window.addEventListener('message', (event) => {
        const data = event && event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'MC_EDITOR_RUNTIME_SCHEMA' && data.payload) {
            state.runtimeCatalog = data.payload;
            renderEvents();
            if (!state.eventId) renderEventEditor();
        }
        if (data.type === 'MC_EDITOR_STATE' && data.payload && !state.runtimeStateHydrated) {
            state.runtimeStateHydrated = true;
            if (data.payload.runtimeCatalog) {
                state.runtimeCatalog = data.payload.runtimeCatalog;
                renderEvents();
            }
        }
    });
}

function bindEvents() {
    refs.surface.addEventListener('change', () => {
        state.surface = refs.surface.value;
        renderSurfaceData();
        refreshPreview();
        status(`已切换 Surface: ${state.surface}`, 'ok');
    });
    refs.profile.addEventListener('change', () => {
        state.profile = refs.profile.value;
        resizePreview();
    });
    refs.customW.addEventListener('input', resizePreview);
    refs.customH.addEventListener('input', resizePreview);
    refs.safeToggle.addEventListener('change', () => {
        refs.safeArea.style.display = refs.safeToggle.checked ? 'block' : 'none';
    });
    refs.customCss.addEventListener('input', () => {
        currentThemeSurface().extraCss = refs.customCss.value;
        applyPreview();
    });

    refs.bgEntry.addEventListener('change', () => { state.assetManifest.backgrounds.entry = refs.bgEntry.value; applyPreview(); });
    refs.bgGame.addEventListener('change', () => { state.assetManifest.backgrounds.game = refs.bgGame.value; applyPreview(); });
    refs.bgBoard.addEventListener('change', () => { state.assetManifest.backgrounds.board = refs.bgBoard.value; applyPreview(); });

    refs.btnPieceIconBind.addEventListener('click', () => {
        const key = `${refs.pieceIconType.value}|${refs.pieceIconTeam.value}`;
        const assetId = refs.pieceIconAsset.value;
        if (!assetId) {
            status('请选择棋子 icon 素材', 'error');
            return;
        }
        state.assetManifest.pieceIcons[key] = assetId;
        renderPieceIconList();
        applyPreview();
    });

    refs.btnAddScenePlacement.addEventListener('click', () => {
        const assetId = refs.scenePlacementAsset.value;
        if (!assetId) {
            status('请选择摆件素材', 'error');
            return;
        }
        const placement = schema.defaultScenePlacement();
        placement.id = `placement_${Date.now()}`;
        placement.assetId = assetId;
        placement.label = findAssetMeta(assetId)?.name || placement.id;
        currentScenePlacements().push(placement);
        renderScenePlacementList();
        applyPreview();
    });

    const syncEventHeader = () => {
        const cfg = ensureEventConfig();
        if (!cfg) return;
        cfg.enabled = !!refs.eventEnabled.checked;
        cfg.logic = refs.eventLogic.value === 'OR' ? 'OR' : 'AND';
        cfg.cooldownMs = Number(refs.eventCooldown.value) || 0;
        syncEventJsonFromConfig();
        applyPreview();
    };
    refs.eventEnabled.addEventListener('change', syncEventHeader);
    refs.eventLogic.addEventListener('change', syncEventHeader);
    refs.eventCooldown.addEventListener('input', syncEventHeader);

    refs.btnAddCondition.addEventListener('click', () => {
        const cfg = ensureEventConfig();
        if (!cfg) return;
        cfg.conditions.push(schema.defaultEventCondition());
        renderConditionsList(cfg);
        syncEventJsonFromConfig();
        applyPreview();
    });
    refs.btnAddAction.addEventListener('click', () => {
        const cfg = ensureEventConfig();
        if (!cfg) return;
        cfg.actions.push(schema.defaultEventAction());
        renderActionsList(cfg);
        syncEventJsonFromConfig();
        applyPreview();
    });
    refs.btnApplyEventJson.addEventListener('click', applyEventJson);

    refs.btnAssetUpload.addEventListener('click', () => refs.assetUploadInput.click());
    refs.assetUploadInput.addEventListener('change', async () => {
        const files = Array.from(refs.assetUploadInput.files || []);
        const kind = refs.assetKindUpload.value || 'effect_image';
        for (const file of files) {
            if (!ACCEPTED_IMAGE_MIME.includes(file.type)) {
                status(`跳过 ${file.name}：格式不支持`, 'error');
                continue;
            }
            if (file.size > MAX_IMAGE_BYTES) {
                status(`跳过 ${file.name}：超过 8MB`, 'error');
                continue;
            }
            await assetStore.putAsset({
                kind,
                name: file.name,
                blob: file,
                meta: { origin: 'editor_upload' }
            });
        }
        refs.assetUploadInput.value = '';
        await refreshAssetsAndBindings();
        applyPreview();
        status('图片上传完成', 'ok');
    });
    refs.assetFilterKind.addEventListener('change', async () => {
        state.assetFilter = refs.assetFilterKind.value;
        await refreshAssetsAndBindings();
    });
    refs.btnAssetsRefresh.addEventListener('click', async () => {
        await refreshAssetsAndBindings();
        status('素材列表已刷新', 'ok');
    });

    if (refs.btnHelp) refs.btnHelp.addEventListener('click', openHelpModal);
    if (refs.btnGuide) refs.btnGuide.addEventListener('click', () => startGuide(0));
    if (refs.btnHelpStartGuide) refs.btnHelpStartGuide.addEventListener('click', () => startGuide(0));
    if (refs.btnHelpClose) refs.btnHelpClose.addEventListener('click', closeHelpModal);
    if (refs.btnGuidePrev) refs.btnGuidePrev.addEventListener('click', prevGuideStep);
    if (refs.btnGuideNext) refs.btnGuideNext.addEventListener('click', nextGuideStep);
    if (refs.btnGuideSkip) refs.btnGuideSkip.addEventListener('click', () => stopGuide(false));
    if (refs.helpModal) {
        refs.helpModal.addEventListener('click', (event) => {
            if (event.target === refs.helpModal) closeHelpModal();
        });
    }
    window.addEventListener('keydown', (event) => {
        const tagName = event.target && event.target.tagName ? String(event.target.tagName).toUpperCase() : '';
        const inInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
        if (guide.active) {
            if (event.key === 'Escape') {
                event.preventDefault();
                stopGuide(false);
                return;
            }
            if (!inInput && (event.key === 'ArrowLeft')) {
                event.preventDefault();
                prevGuideStep();
                return;
            }
            if (!inInput && (event.key === 'ArrowRight' || event.key === 'Enter')) {
                event.preventDefault();
                nextGuideStep();
                return;
            }
        }
        if (event.key === 'Escape' && refs.helpModal && refs.helpModal.classList.contains('show')) {
            closeHelpModal();
        }
    });

    refs.btnSave.addEventListener('click', () => {
        persistState();
        status('配置已保存', 'ok');
    });
    refs.btnApply.addEventListener('click', () => {
        createSnapshot('自动快照（应用前）', true);
        persistState();
        applyPreview();
        status('配置已应用', 'ok');
    });
    refs.btnBackup.addEventListener('click', () => {
        createSnapshot(refs.backupNote.value, false);
        persistState();
        status('快照已创建', 'ok');
    });
    refs.btnRollback.addEventListener('click', () => {
        try {
            if (!refs.versionSelect.value) throw new Error('请先选择快照');
            applySnapshot(refs.versionSelect.value);
            persistState();
            status('已回滚到选中快照', 'ok');
        } catch (err) {
            status(`回滚失败: ${err.message}`, 'error');
        }
    });
    refs.btnExport.addEventListener('click', async () => {
        await exportAll();
        status('配置导出完成', 'ok');
    });
    refs.btnImport.addEventListener('click', () => refs.importInput.click());
    refs.importInput.addEventListener('change', async () => {
        const file = refs.importInput.files && refs.importInput.files[0];
        if (!file) return;
        try {
            await importAll(file);
            status('配置导入成功', 'ok');
        } catch (err) {
            status(`导入失败: ${err.message}`, 'error');
        } finally {
            refs.importInput.value = '';
        }
    });
    refs.btnRefreshPreview.addEventListener('click', refreshPreview);
    refs.frame.addEventListener('load', () => {
        resizePreview();
        requestRuntimeSchema();
        applyPreview();
    });
    window.addEventListener('resize', () => {
        resizePreview();
        if (guide.active) renderGuideStep();
    });
}

async function init() {
    loadStateFromStorage();
    state.surface = 'index';
    state.eventId = getSurfaceEvents()[0] || '';
    renderSurfaceSelect();
    renderProfiles();
    renderVersions();
    await refreshAssetsAndBindings();
    renderSurfaceData();
    bindMessage();
    bindEvents();
    resizePreview();
    refreshPreview();
    if (safeGet(GUIDE_STORAGE_KEY) === '1') {
        status('编辑器 V3 就绪');
    } else {
        status('编辑器 V3 就绪，可点右上角“新手引导”');
    }
}

init();

})();
