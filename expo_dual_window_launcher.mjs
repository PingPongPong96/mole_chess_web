#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR);
const DEFAULTS = {
  port: 8787,
  maxPortHops: 20,
  page: 'index.html',
  query: 'expo=1',
  open: 2,
  delay: 900
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [rawKey, ...rest] = token.slice(2).split('=');
    const key = String(rawKey || '').trim();
    const value = rest.join('=').trim();
    if (!key) continue;
    switch (key) {
      case 'port':
        out.port = clampInt(value, DEFAULTS.port, 1, 65535);
        break;
      case 'page':
        out.page = sanitizePage(value || DEFAULTS.page);
        break;
      case 'query':
        out.query = String(value || '').replace(/^\?+/, '');
        break;
      case 'open':
        out.open = clampInt(value, DEFAULTS.open, 0, 5);
        break;
      case 'delay':
        out.delay = clampInt(value, DEFAULTS.delay, 0, 10000);
        break;
      case 'help':
      case 'h':
        printHelpAndExit(0);
        break;
      default:
        // ignore unknown args for forward compatibility
        break;
    }
  }
  return out;
}

function clampInt(raw, fallback, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizePage(raw) {
  const cleaned = String(raw || DEFAULTS.page).replace(/^\/+/, '');
  return cleaned.length ? cleaned : DEFAULTS.page;
}

function printHelpAndExit(code) {
  console.log('Usage: node expo_dual_window_launcher.mjs [--port=8787] [--page=index.html] [--query=expo=1] [--open=2] [--delay=900]');
  process.exit(code);
}

function safeResolvePathFromRequest(reqPath) {
  let pathname = '/';
  try {
    const u = new URL(reqPath, 'http://127.0.0.1');
    pathname = decodeURIComponent(u.pathname || '/');
  } catch (_err) {
    pathname = '/';
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.resolve(ROOT, `.${pathname}`);
  const normalizedRoot = path.resolve(ROOT);
  if (!filePath.startsWith(normalizedRoot)) {
    return null;
  }
  return filePath;
}

async function serveStatic(req, res) {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  let filePath = safeResolvePathFromRequest(req.url);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const st = await fsp.stat(filePath);
    if (st.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (_err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      serveStatic(req, res).catch(() => {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      });
    });

    server.once('error', (err) => {
      reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function startServerWithFallback(startPort, hops) {
  for (let i = 0; i <= hops; i += 1) {
    const port = startPort + i;
    try {
      const server = await tryListen(port);
      return { server, port };
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') continue;
      throw err;
    }
  }
  throw new Error(`No available port in range ${startPort}-${startPort + hops}`);
}

function openUrlDefaultBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    return spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: false });
  }
  if (platform === 'darwin') {
    return spawn('open', [url], { stdio: 'ignore', detached: false });
  }
  return spawn('xdg-open', [url], { stdio: 'ignore', detached: false });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchWindows(url, count, delay) {
  for (let i = 0; i < count; i += 1) {
    try {
      openUrlDefaultBrowser(url);
      console.log(`[expo] 已尝试打开窗口 ${i + 1}/${count}: ${url}`);
    } catch (err) {
      console.warn(`[expo] 打开窗口 ${i + 1} 失败:`, err && err.message ? err.message : err);
    }
    if (i < count - 1 && delay > 0) {
      await wait(delay);
    }
  }
}

function buildFinalUrl(port, page, query) {
  const base = `http://127.0.0.1:${port}/${page}`;
  return query ? `${base}?${query}` : base;
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const { server, port } = await startServerWithFallback(cfg.port, DEFAULTS.maxPortHops);
  const finalUrl = buildFinalUrl(port, cfg.page, cfg.query);

  console.log(`[expo] 静态服务已启动: http://127.0.0.1:${port}`);
  console.log(`[expo] 游戏地址: ${finalUrl}`);
  console.log('[expo] 提示: 浏览器可能将第二次打开合并为标签页，如需独立窗口请手动新建窗口后访问同一地址。');

  await launchWindows(finalUrl, cfg.open, cfg.delay);

  const shutdown = () => {
    console.log('\n[expo] 正在关闭服务...');
    server.close(() => {
      console.log('[expo] 服务已停止。');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[expo] 启动失败:', err && err.message ? err.message : err);
  process.exit(1);
});
