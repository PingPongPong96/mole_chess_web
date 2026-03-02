(function (global) {
    'use strict';

    const DB_NAME = 'mole_chess_assets_v1';
    const DB_VERSION = 1;
    const STORE_ASSETS = 'assets';

    let dbPromise = null;
    const objectUrlCache = new Map();

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_ASSETS)) {
                    const store = db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
                    store.createIndex('kind', 'kind', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
        });
        return dbPromise;
    }

    function txComplete(tx) {
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
            tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
        });
    }

    function toAssetId(prefix) {
        return (prefix || 'asset') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function normalizeKind(kind) {
        return typeof kind === 'string' && kind.trim() ? kind.trim() : 'misc';
    }

    async function putAsset(input) {
        if (!input || typeof input !== 'object') {
            throw new Error('Invalid asset input');
        }
        const blob = input.blob instanceof Blob ? input.blob : null;
        if (!blob) throw new Error('Asset blob is required');

        const now = new Date().toISOString();
        const id = typeof input.id === 'string' && input.id ? input.id : toAssetId(normalizeKind(input.kind));
        const record = {
            id,
            kind: normalizeKind(input.kind),
            name: typeof input.name === 'string' ? input.name : id,
            mime: blob.type || input.mime || 'application/octet-stream',
            size: Number(blob.size) || 0,
            blob,
            meta: input.meta && typeof input.meta === 'object' ? input.meta : {},
            createdAt: typeof input.createdAt === 'string' ? input.createdAt : now,
            updatedAt: now
        };

        const db = await openDb();
        const tx = db.transaction(STORE_ASSETS, 'readwrite');
        tx.objectStore(STORE_ASSETS).put(record);
        await txComplete(tx);
        revokeAssetUrl(id);
        return summarizeRecord(record);
    }

    async function getAsset(id) {
        if (!id) return null;
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ASSETS, 'readonly');
            const req = tx.objectStore(STORE_ASSETS).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error || new Error('Failed to get asset'));
        });
    }

    function summarizeRecord(record) {
        if (!record) return null;
        return {
            id: record.id,
            kind: record.kind,
            name: record.name,
            mime: record.mime,
            size: record.size,
            meta: record.meta || {},
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        };
    }

    async function listAssets(kind) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ASSETS, 'readonly');
            const store = tx.objectStore(STORE_ASSETS);
            const req = kind ? store.index('kind').getAll(normalizeKind(kind)) : store.getAll();
            req.onsuccess = () => {
                const out = Array.isArray(req.result) ? req.result.map(summarizeRecord) : [];
                out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
                resolve(out);
            };
            req.onerror = () => reject(req.error || new Error('Failed to list assets'));
        });
    }

    async function deleteAsset(id) {
        if (!id) return false;
        const db = await openDb();
        const tx = db.transaction(STORE_ASSETS, 'readwrite');
        tx.objectStore(STORE_ASSETS).delete(id);
        await txComplete(tx);
        revokeAssetUrl(id);
        return true;
    }

    async function clearAssets() {
        const db = await openDb();
        const tx = db.transaction(STORE_ASSETS, 'readwrite');
        tx.objectStore(STORE_ASSETS).clear();
        await txComplete(tx);
        revokeAllAssetUrls();
    }

    async function resolveAssetUrl(assetId) {
        if (!assetId) return '';
        if (objectUrlCache.has(assetId)) return objectUrlCache.get(assetId);
        const record = await getAsset(assetId);
        if (!record || !(record.blob instanceof Blob)) return '';
        const url = URL.createObjectURL(record.blob);
        objectUrlCache.set(assetId, url);
        return url;
    }

    function revokeAssetUrl(assetId) {
        if (!assetId || !objectUrlCache.has(assetId)) return;
        const url = objectUrlCache.get(assetId);
        objectUrlCache.delete(assetId);
        try {
            URL.revokeObjectURL(url);
        } catch (_err) {
            // ignore
        }
    }

    function revokeAllAssetUrls() {
        objectUrlCache.forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            } catch (_err) {
                // ignore
            }
        });
        objectUrlCache.clear();
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => reject(reader.error || new Error('Failed to encode blob'));
            reader.readAsDataURL(blob);
        });
    }

    function dataUrlToBlob(dataUrl) {
        const parts = String(dataUrl || '').split(',');
        if (parts.length < 2) return null;
        const header = parts[0];
        const base64 = parts[1];
        const mimeMatch = header.match(/data:([^;]+);base64/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mime });
    }

    async function exportAssets(assetIds) {
        const ids = Array.isArray(assetIds) ? assetIds.filter(Boolean) : null;
        const db = await openDb();
        const records = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ASSETS, 'readonly');
            const store = tx.objectStore(STORE_ASSETS);
            const req = store.getAll();
            req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
            req.onerror = () => reject(req.error || new Error('Failed to export assets'));
        });

        const selected = ids ? records.filter((record) => ids.includes(record.id)) : records;
        const out = [];
        for (const record of selected) {
            const dataUrl = await blobToDataUrl(record.blob);
            out.push({
                id: record.id,
                kind: record.kind,
                name: record.name,
                mime: record.mime,
                size: record.size,
                meta: record.meta || {},
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                dataUrl
            });
        }
        return out;
    }

    async function importAssets(serializedAssets) {
        if (!Array.isArray(serializedAssets)) return [];
        const results = [];
        for (const item of serializedAssets) {
            if (!item || typeof item !== 'object' || !item.id || !item.dataUrl) continue;
            const blob = dataUrlToBlob(item.dataUrl);
            if (!(blob instanceof Blob)) continue;
            const saved = await putAsset({
                id: item.id,
                kind: item.kind,
                name: item.name,
                blob,
                meta: item.meta,
                createdAt: item.createdAt
            });
            results.push(saved);
        }
        return results;
    }

    async function getAssetBlob(assetId) {
        const record = await getAsset(assetId);
        return record && record.blob instanceof Blob ? record.blob : null;
    }

    async function renameAsset(assetId, nextName) {
        const record = await getAsset(assetId);
        if (!record) return null;
        record.name = typeof nextName === 'string' && nextName.trim() ? nextName.trim() : record.name;
        record.updatedAt = new Date().toISOString();
        const db = await openDb();
        const tx = db.transaction(STORE_ASSETS, 'readwrite');
        tx.objectStore(STORE_ASSETS).put(record);
        await txComplete(tx);
        return summarizeRecord(record);
    }

    global.MoleChessAssetStore = {
        DB_NAME,
        STORE_ASSETS,
        openDb,
        putAsset,
        getAsset,
        getAssetBlob,
        listAssets,
        deleteAsset,
        clearAssets,
        renameAsset,
        resolveAssetUrl,
        revokeAssetUrl,
        revokeAllAssetUrls,
        exportAssets,
        importAssets,
        blobToDataUrl,
        dataUrlToBlob,
        summarizeRecord
    };
})(typeof window !== 'undefined' ? window : globalThis);
