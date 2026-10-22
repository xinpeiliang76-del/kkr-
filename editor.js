#!/usr/bin/env node
'use strict';

/**
 * Theme Studio —— 静态网站的主题编辑器
 *
 *   用法：  node editor.js [--site <网站目录>] [--port 4100]
 *
 *   它做的事：
 *     1. 把 <网站目录>/docs 当成网站，显示在浏览器预览框里；
 *     2. 把改出来的颜色和排版写进 <网站目录>/theme.json；
 *     3. 如果该目录有 build.js，保存时自动重新生成网站。
 *
 *   不联网、不上传、不修改 docs/ 里的 HTML。
 *
 * 许可：MIT
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawnSync } = require('child_process');

/* ---------------- 参数 ---------------- */

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith('--' + name + '='));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
}

const SITE = path.resolve(arg('site', process.cwd()));
const PORT = Number(arg('port', process.env.PORT || 4100));
const THEME_FILE = path.join(SITE, 'theme.json');
const DOCS = path.join(SITE, 'docs');
const BUILD_SCRIPT = path.join(SITE, 'build.js');
const UI_DIR = __dirname;
const UI_FILE = path.join(UI_DIR, 'ui.html');

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

/* ---------------- 站点操作 ---------------- */

function readTheme() {
  try {
    return sanitize(JSON.parse(fs.readFileSync(THEME_FILE, 'utf8')));
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_THEME));
  }
}

function rebuild() {
  if (!fs.existsSync(BUILD_SCRIPT)) {
    return { built: false, message: '该目录没有 build.js，只保存了 theme.json，请自行重新生成网站。' };
  }
  const r = spawnSync(process.execPath, ['build.js'], { cwd: SITE, encoding: 'utf8' });
  if (r.status !== 0) {
    const detail = ((r.stderr || '') + (r.stdout || '')).trim().slice(0, 600);
    throw new Error('重新生成失败：' + (detail || '未知错误'));
  }
  return { built: true, message: '已重新生成网站' };
}

/* ---------------- HTTP ---------------- */

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function html(body) {
  return '<meta charset="utf-8"><div style="font:15px/1.8 system-ui;padding:40px;max-width:640px;margin:auto">' + body + '</div>';
}

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) {
      return send(res, 404, html('<h2>404</h2><p>找不到 <code>' + file + '</code></p><p><a href="/">回到编辑器</a></p>'), MIME['.html']);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/info') {
    return send(res, 200, JSON.stringify({
      site: SITE,
      hasBuild: fs.existsSync(BUILD_SCRIPT),
      hasDocs: fs.existsSync(DOCS),
      hasTheme: fs.existsSync(THEME_FILE),
      themeFile: THEME_FILE,
    }));
  }

  if (pathname === '/api/theme' && req.method === 'GET') {
    return send(res, 200, JSON.stringify(readTheme()));
  }

  if (pathname === '/api/defaults' && req.method === 'GET') {
    return send(res, 200, JSON.stringify(DEFAULT_THEME));
  }

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
      try {
        fs.writeFileSync(THEME_FILE, JSON.stringify(theme, null, 2) + '\n', 'utf8');
      } catch (e) {
        return send(res, 500, JSON.stringify({ ok: false, error: '写入 theme.json 失败：' + e.message }));
      }
      try {
        const r = rebuild();
        send(res, 200, JSON.stringify({ ok: true, theme, built: r.built, message: r.message }));
      } catch (e) {
        send(res, 500, JSON.stringify({ ok: false, error: e.message, theme }));
      }
    });
    return;
  }

  if (pathname === '/' || pathname === '/editor' || pathname === '/editor.html') {
    return sendFile(res, UI_FILE);
  }

  if (pathname === '/site' || pathname.startsWith('/site/')) {
    if (!fs.existsSync(DOCS)) {
      return send(res, 404, html(
        '<h2>还没有生成网站</h2><p>目录 <code>' + DOCS + '</code> 不存在。</p>' +
        '<p>先在该目录运行 <code>node build.js</code>，然后刷新。</p>'
      ), MIME['.html']);
    }
    let rel = pathname.replace(/^\/site\/?/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(DOCS, rel);
    if (!file.startsWith(DOCS)) return send(res, 403, 'forbidden', 'text/plain');
    return sendFile(res, file);
  }

  const file = path.join(UI_DIR, pathname.replace(/^\//, ''));
  if (file.startsWith(UI_DIR)) return sendFile(res, file);
  send(res, 404, 'not found', 'text/plain');
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = 'http://localhost:' + PORT;
  console.log('');
  console.log('  Theme Studio 已启动');
  console.log('  网站目录：' + SITE);
  console.log('  构建脚本：' + (fs.existsSync(BUILD_SCRIPT) ? '已找到 build.js（保存时自动重建）' : '未找到（只保存 theme.json）'));
  console.log('  预览目录：' + (fs.existsSync(DOCS) ? 'docs ✓' : 'docs ✗ 还没有生成'));
  console.log('');
  console.log('  ' + addr);
  console.log('  关掉窗口或按 Ctrl+C 停止');
  console.log('');
  if (process.env.NO_OPEN !== '1') exec('start "" "' + addr + '"', () => {});
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 被占用，换一个：node editor.js --port 4200');
  } else {
    console.error('启动失败：' + err.message);
  }
  process.exit(1);
});
