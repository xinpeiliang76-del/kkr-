#!/usr/bin/env node
'use strict';

/**
 * 极简静态博客生成器 —— 零依赖，只需要 Node.js
 *
 *   输入： site.config.json + posts/*.md + pages/*.md + assets/
 *   输出： docs/      <-- 这个目录整体上传到 GitHub Pages 就上线了
 *
 *   用法： node build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, 'posts');
const PAGES_DIR = path.join(ROOT, 'pages');
const ASSETS_DIR = path.join(ROOT, 'assets');
const OUT_DIR = path.join(ROOT, 'docs');

const SITE = Object.assign(
  { title: '我的博客', description: '', author: '', nav: [] },
  JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'))
);

/* ============================== 工具 ============================== */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;

/** 把 markdown 里被手动折行的段落拼回去；中文之间不插空格 */
function smartJoin(lines) {
  let out = '';
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (!out) {
      out = t;
      continue;
    }
    const a = out[out.length - 1];
    const b = t[0];
    out += CJK.test(a) || CJK.test(b) ? t : ' ' + t;
  }
  return out;
}

/* ============================ Markdown ============================ */

/** 行内元素：代码 > 图片 > 链接 > 加粗 > 斜体 */
function inline(src) {
  const codes = [];
  let s = esc(src);
  s = s.replace(/`([^`]+)`/g, (_m, c) => {
    codes.push(c);
    return '\u0000' + (codes.length - 1) + '\u0000';
  });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2" loading="lazy">');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i) => '<code>' + codes[Number(i)] + '</code>');
  return s;
}

const BLOCK_START = /^(#{1,6}\s|```|>|\s*[-*+]\s+|\s*\d+\.\s+|\s*\||---+\s*$|\*\*\*+\s*$)/;

function markdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let listTag = null;
  let listBuf = [];

  const flushList = () => {
    if (!listTag) return;
    out.push('<' + listTag + '>\n' + listBuf.join('\n') + '\n</' + listTag + '>');
    listTag = null;
    listBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    // 代码围栏
    if (/^\s*```/.test(line)) {
      flushList();
      if (inCode) {
        out.push('<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre>');
        inCode = false;
        codeBuf = [];
      } else {
        inCode = true;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    // 空行
    if (/^\s*$/.test(line)) {
      flushList();
      i++;
      continue;
    }

    // 分隔线
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flushList();
      out.push('<hr>');
      i++;
      continue;
    }

    // 标题
    let m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      flushList();
      const lv = m[1].length;
      out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>');
      i++;
      continue;
    }

    // 引用
    m = line.match(/^>\s?(.*)$/);
    if (m) {
      flushList();
      const buf = [m[1]];
      i++;
      while (i < lines.length) {
        const mm = lines[i].match(/^>\s?(.*)$/);
        if (!mm) break;
        buf.push(mm[1]);
        i++;
      }
      out.push('<blockquote>' + inline(smartJoin(buf)) + '</blockquote>');
      continue;
    }

    // 无序列表
    m = line.match(/^\s*[-*+]\s+(.*)$/);
    if (m) {
      if (listTag !== 'ul') {
        flushList();
        listTag = 'ul';
      }
      listBuf.push('<li>' + inline(m[1]) + '</li>');
      i++;
      continue;
    }

    // 有序列表
    m = line.match(/^\s*\d+\.\s+(.*)$/);
    if (m) {
      if (listTag !== 'ol') {
        flushList();
        listTag = 'ol';
      }
      listBuf.push('<li>' + inline(m[1]) + '</li>');
      i++;
      continue;
    }

    // 表格
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushList();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i]);
        i++;
      }
      const cells = (r) =>
        r
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const isSep = (cs) => cs.length > 0 && cs.every((c) => /^:?-{2,}:?$/.test(c));
      const body = rows.map(cells).filter((cs) => !isSep(cs));
      if (body.length) {
        const head = body[0];
        const rest = body.slice(1);
        let html = '<table>\n<thead>\n<tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr>\n</thead>\n';
        if (rest.length) {
          html += '<tbody>\n' + rest.map((cs) => '<tr>' + cs.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('\n') + '\n</tbody>\n';
        }
        html += '</table>';
        out.push(html);
      }
      continue;
    }

    // 段落
    const para = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !BLOCK_START.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    flushList();
    out.push('<p>' + inline(smartJoin(para)) + '</p>');
  }

  flushList();
  if (inCode) out.push('<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre>');
  return out.join('\n');
}

/** 去掉标记，取一段纯文本当摘要 */
function plain(md, limit) {
  const t = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*|__/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > limit ? t.slice(0, limit).trim() + '……' : t;
}

/* ============================== 读取 ============================== */

function frontMatter(raw) {
  let text = raw.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const meta = {};
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    if (end !== -1) {
      const block = text.slice(4, end);
      text = text.slice(end + 4).replace(/^\n+/, '');
      for (const line of block.split('\n')) {
        const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
        if (!m) continue;
        let v = m[2].trim();
        if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
        meta[m[1]] = v;
      }
    }
  }
  return { meta, body: text };
}

function loadDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.md'))
    .map((f) => {
      const { meta, body } = frontMatter(fs.readFileSync(path.join(dir, f), 'utf8'));
      let base = f.replace(/\.md$/i, '');
      let date = meta.date || '';
      const dm = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
      if (dm) {
        if (!date) date = dm[1];
        base = dm[2];
      }
      return {
        slug: base,
        title: meta.title || base,
        date,
        tags: meta.tags
          ? String(meta.tags)
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        summary: meta.summary || '',
        body,
      };
    });
}

/* ============================== 渲染 ============================== */

function layout({ title, description, content, prefix, bodyClass }) {
  const p = prefix || './';
  const nav = (SITE.nav || [])
    .map((n) => '<a href="' + p + n.path + '">' + esc(n.name) + '</a>')
    .join('');
  const pageTitle = title ? esc(title) + ' · ' + esc(SITE.title) : esc(SITE.title);
  const desc = esc(description || SITE.description || '');
  const brandText = esc(SITE.shortTitle || SITE.title);
  const gh = SITE.github
    ? '<span class="sep">·</span><a href="' + esc(SITE.github) + '" target="_blank" rel="noopener">GitHub</a>'
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<meta name="description" content="${desc}">
<link rel="stylesheet" href="${p}assets/style.css">
<link rel="stylesheet" href="${p}assets/theme.css">
</head>
<body${bodyClass ? ' class="' + bodyClass + '"' : ''}>
<header class="site-head">
  <a class="brand" href="${p}index.html">${brandText}</a>
  <nav class="nav">${nav}</nav>
</header>
<main>
${content}
</main>
<footer class="site-foot">
  <span>© ${new Date().getFullYear()} ${esc(SITE.author || SITE.title)}</span>
  ${gh}
  <span class="sep">·</span>
  <span>Markdown 写就，静态托管</span>
</footer>
</body>
</html>
`;
}

function postPage(post) {
  const tags = post.tags.length
    ? '<span class="tags">' + post.tags.map((t) => '<span class="tag">' + esc(t) + '</span>').join('') + '</span>'
    : '';
  const content = `<article class="post">
  <h1>${esc(post.title)}</h1>
  <p class="meta">${post.date ? '<time>' + esc(post.date) + '</time>' : ''}${tags}</p>
  <div class="prose">
${markdown(post.body)}
  </div>
</article>
<p class="back"><a href="../index.html">← 回到首页</a></p>`;

  return layout({ title: post.title, description: plain(post.body, 120), content, prefix: '../' });
}

function pagePage(page) {
  const content = `<article class="post">
  <h1>${esc(page.title)}</h1>
  <div class="prose">
${markdown(page.body)}
  </div>
</article>`;
  return layout({ title: page.title, description: plain(page.body, 120), content, prefix: './' });
}

function indexPage(posts) {
  const c = SITE.cover || {};
  const cover = `<section class="cover">
  <p class="kicker">${esc(c.kicker || '')}</p>
  <h1 class="cover-title">${esc(c.title || SITE.title)}</h1>
  <p class="cover-sub">${esc(c.subtitle || SITE.description)}</p>
  <p class="cover-note">${esc(c.note || '')}</p>
</section>`;

  const pillarHtml = (SITE.pillars || [])
    .map(
      (p) => `  <div class="pillar">
    <span class="pillar-num">${esc(p.num)}</span>
    <h2 class="pillar-name">${esc(p.name)}</h2>
    <p>${esc(p.text)}</p>
  </div>`
    )
    .join('\n');

  const items = posts
    .map((p, i) => {
      const tags = p.tags.length
        ? '<span class="tags">' + p.tags.map((t) => '<span class="tag">' + esc(t) + '</span>').join('') + '</span>'
        : '';
      return `  <li class="item">
    <span class="item-index">${String(i + 1).padStart(2, '0')}</span>
    <div>
      <a class="item-title" href="posts/${p.slug}.html">${esc(p.title)}</a>
      <p class="meta">${p.date ? '<time>' + esc(p.date) + '</time>' : ''}${tags}</p>
      <p class="excerpt">${esc(p.summary || plain(p.body, 90))}</p>
    </div>
  </li>`;
    })
    .join('\n');

  const content = `${cover}
<section class="pillars">
${pillarHtml}
</section>
<section class="recent">
  <h2 class="sec-head">近作</h2>
  <ul class="post-list">
${items || '    <li class="item"><div><p class="excerpt">还没有文章。</p></div></li>'}
  </ul>
</section>`;

  return layout({ title: '', description: SITE.description, content, prefix: './' });
}

/* ============================== 主题 ============================== */

/**
 * theme.json → docs/assets/theme.css
 * 只覆盖 CSS 变量，不动 style.css 的骨架，所以改颜色永远不会把版式改坏。
 */
function themeCSS() {
  const file = path.join(ROOT, 'theme.json');
  let t = {};
  if (fs.existsSync(file)) {
    try {
      t = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn('⚠ theme.json 解析失败，改用 style.css 里的默认值：' + e.message);
    }
  }
  const c = t.colors || {};
  const d = t.dark || {};
  const ty = t.type || {};

  const vars = (o) => {
    const rows = [];
    if (o.paper) rows.push('  --paper: ' + o.paper + ';');
    if (o.paper2) rows.push('  --paper-2: ' + o.paper2 + ';');
    if (o.ink) rows.push('  --ink: ' + o.ink + ';');
    if (o.muted) rows.push('  --muted: ' + o.muted + ';');
    if (o.accent) rows.push('  --red: ' + o.accent + ';');
    if (o.accent || o.accent2) rows.push('  --red-2: ' + (o.accent2 || o.accent) + ';');
    if (o.rule) rows.push('  --rule: ' + o.rule + ';');
    return rows.join('\n');
  };

  const bodyRows = [];
  if (ty.fontBody) bodyRows.push('  font-family: ' + ty.fontBody + ';');
  if (ty.fontSize) bodyRows.push('  font-size: ' + ty.fontSize + ';');
  if (ty.lineHeight) bodyRows.push('  line-height: ' + ty.lineHeight + ';');

  const light = vars(c);
  const darkVars = vars(d);
  const rootExtra = ty.maxWidth ? '  --max: ' + ty.maxWidth + ';' : '';

  let css = '/* 由 theme.json 自动生成，请勿手改；改 theme.json 或使用编辑器 */\n';
  if (light || rootExtra) {
    css += ':root {\n' + [light, rootExtra].filter(Boolean).join('\n') + '\n}\n';
  }
  if (bodyRows.length) css += '\nbody {\n' + bodyRows.join('\n') + '\n}\n';
  if (darkVars) {
    css += '\n@media (prefers-color-scheme: dark) {\n  :root {\n' +
      darkVars.split('\n').map((l) => '  ' + l).join('\n') + '\n  }\n}\n';
  }

  fs.mkdirSync(path.join(OUT_DIR, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'assets', 'theme.css'), css, 'utf8');
}

/* ============================== 输出 ============================== */

function write(rel, html) {
  const file = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf8');
  return rel;
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function main() {
  // 清空产物目录（只删 docs，别的手滑不了）
  if (path.basename(OUT_DIR) === 'docs' && fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const posts = loadDir(POSTS_DIR).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const pages = loadDir(PAGES_DIR);

  for (const post of posts) write(path.join('posts', post.slug + '.html'), postPage(post));
  for (const page of pages) write(page.slug + '.html', pagePage(page));
  write('index.html', indexPage(posts));

  copyDir(ASSETS_DIR, path.join(OUT_DIR, 'assets'));
  themeCSS();
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');

  console.log('构建完成 →  docs/');
  console.log('  文章 ' + posts.length + ' 篇，独立页面 ' + pages.length + ' 个');
  for (const p of posts) console.log('  · ' + (p.date || '----------') + '  ' + p.title + '   →  docs/posts/' + p.slug + '.html');
}

if (require.main === module) main();

module.exports = { main };
