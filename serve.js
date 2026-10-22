#!/usr/bin/env node
'use strict';

/**
 * 本地预览服务器（零依赖）
 *   node serve.js           → http://localhost:4000
 *   set PORT=8080 & node serve.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'docs');
const PORT = Number(process.env.PORT) || 4000;

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
  '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(ROOT)) {
  console.error('找不到 docs/，先运行 node build.js');
  process.exit(1);
}

http
  .createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch {
      urlPath = '/';
    }
    if (urlPath.endsWith('/')) urlPath += 'index.html';

    const file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403');
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<meta charset="utf-8"><h1>404</h1><p>没有这个页面。</p><p><a href="/">回首页</a></p>');
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    const addr = 'http://localhost:' + PORT;
    console.log('本地预览： ' + addr);
    console.log('按 Ctrl+C 停止');
    if (PORT === 4000) require('child_process').exec('start "" "' + addr + '"', () => {});
  });
