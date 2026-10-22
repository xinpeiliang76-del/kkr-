#!/usr/bin/env node
'use strict';

/**
 * 一键编辑器 —— 本地跑起来，在浏览器里调颜色、字号、版心，实时看效果
 *
 *   启动：  node editor.js        （或双击「启动编辑器.cmd」）
 *   地址：  http://localhost:4100
 *
 * 它只做两件事：
 *   1. 把 docs/ 当成网站显示在右边的预览框里；
 *   2. 把左边改出来的样式写进 theme.json，并自动重新生成 docs/。
 * 不联网、不上传、不碰 docs/ 里的 HTML。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { main: build } = require('./build.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 4100;
const THEME_FILE = path.join(ROOT, 'theme.json');
const DOCS = path.join(ROOT, 'docs');
const EDITOR = path.join(ROOT, 'editor');

const DEFAULT_THEME = {
  colors: {
    paper: '#f4efe3',
    paper2: '#eee7d6',
    ink: '#1a1613',
    muted: '#6d6255',
    accent: '#971c1c',
    accent2: '#b23a2e',
    rule: '#d9ceb9',
  },
  dark: {
    paper: '#131110',
    paper2: '#1c1917',
    ink: '#e9e1d1',
    muted: '#9b8f7e',
    accent: '#d1554a',
    accent2: '#e0705f',
    rule: '#302a24',
  },
  type: {
    fontBody: '"Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", "SimSun", Georgia, serif',
    fontSize: '17.5px',
    lineHeight: '1.95',
    maxWidth: '44rem',
  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* ---------------- 校验：只接受能安全写进 CSS 的东西 ---------------- */

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function cleanColor(v, fallback) {
  return typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : fallback;
}

function cleanFont(v, fallback) {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  if (!s || s.length > 220) return fallback;
  if (/[;{}<>\\]/.test(s)) return fallback;
  return s;
}

function sanitize(input) {
  const base = JSON.parse(JSON.stringify(DEFAULT_THEME));
  const src = input && typeof input === 'object' ? input : {};
  const pick = (group) => {
    const out = {};
    for (const k of Object.keys(base[group])) {
      out[k] = src[group] && src[group][k] !== undefined ? src[group][k] : base[group][k];
    }
    return out;
  };

  const colors = pick('colors');
  for (const k of Object.keys(colors)) colors[k] = cleanColor(colors[k], base.colors[k]);

  const dark = pick('dark');
  for (const k of Object.keys(dark)) dark[k] = cleanColor(dark[k], base.dark[k]);

  const type = pick('type');
  type.fontBody = cleanFont(type.fontBody, base.type.fontBody);

  const size = Number(String(type.fontSize).replace('px', ''));
  type.fontSize = (Number.isFinite(size) ? Math.min(22, Math.max(13, size)) : 17.5) + 'px';

  const lh = Number(type.lineHeight);
  type.lineHeight = String(Number.isFinite(lh) ? Math.min(2.4, Math.max(1.4, lh)) : 1.95);

  const mw = Number(String(type.maxWidth).replace('rem', ''));
  type.maxWidth = (Number.isFinite(mw) ? Math.min(60, Math.max(32, Math.round(mw))) : 44) + 'rem';

  return { colors, dark, type };
}

/* ---------------- 工具 ---------------- */

function readTheme() {
  try {
    return sanitize(JSON.parse(fs.readFileSync(THEME_FILE, 'utf8')));
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_THEME));
  }
}

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, '<meta charset="utf-8"><h1>404</h1><p>找不到 ' + path.basename(file) + '</p>', MIME['.html']);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

/* ---------------- 服务 ---------------- */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  // 接口：读取当前主题
  if (pathname === '/api/theme' && req.method === 'GET') {
    return send(res, 200, JSON.stringify(readTheme()));
  }

  // 接口：恢复默认
  if (pathname === '/api/defaults' && req.method === 'GET') {
    return send(res, 200, JSON.stringify(DEFAULT_THEME));
  }

  // 接口：保存并重新生成
  if (pathname === '/api/theme' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        return send(res, 400, JSON.stringify({ ok: false, error: '提交的数据不是合法 JSON' }));
      }
      const theme = sanitize(parsed);
      fs.writeFileSync(THEME_FILE, JSON.stringify(theme, null, 2) + '\n', 'utf8');
      try {
        build();
        send(res, 200, JSON.stringify({ ok: true, theme }));
      } catch (e) {
        send(res, 500, JSON.stringify({ ok: false, error: '重新生成失败：' + e.message, theme }));
      }
    });
    return;
  }

  // 编辑器界面
  if (pathname === '/' || pathname === '/editor' || pathname === '/editor.html') {
    return sendFile(res, path.join(EDITOR, 'ui.html'));
  }

  // 预览用的站点
  if (pathname === '/site' || pathname.startsWith('/site/')) {
    let rel = pathname.replace(/^\/site\/?/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(DOCS, rel);
    if (!file.startsWith(DOCS)) return send(res, 403, 'forbidden', 'text/plain');
    return sendFile(res, file);
  }

  // 编辑器自己的静态资源
  const file = path.join(EDITOR, pathname.replace(/^\//, ''));
  if (file.startsWith(EDITOR)) return sendFile(res, file);
  send(res, 404, 'not found', 'text/plain');
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = 'http://localhost:' + PORT;
  console.log('');
  console.log('  一键编辑器已启动');
  console.log('  ' + addr);
  console.log('  关闭这个窗口即可停止（或按 Ctrl+C）');
  console.log('');
  if (process.env.NO_OPEN !== '1') exec('start "" "' + addr + '"', () => {});
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 已被占用，换一个：set PORT=4200 && node editor.js');
  } else {
    console.error('启动失败：' + err.message);
  }
  process.exit(1);
});
