# 冲突、纠错与解放 · 站点源码

一个零依赖的静态博客：Markdown 写文章 → 一个 Node 脚本生成 HTML → 整个 `docs/` 丢给 GitHub Pages。

没有服务器、没有数据库、没有后台。**从零上手的详细教程在仓库根目录的 [`教程.md`](教程.md)**，这里只留最必要的部分。

## 最快的三条路

装好 Node.js（<https://nodejs.org/zh-cn>）之后，双击对应文件即可：

| 文件 | 作用 |
|---|---|
| `启动编辑器.cmd` | 打开样式编辑器，左边调色右边实时预览 |
| `本地预览.cmd` | 生成并预览，浏览器打开 `localhost:4000` |
| `生成网站.cmd` | 只生成，产物在 `docs/` |

不想双击，命令行等价：

```bash
node build.js      # 生成
node serve.js      # 预览 localhost:4000
node editor.js     # 编辑器 localhost:4100
```

## 目录

```
blog/
├── site.config.json     站名、简介、导航、封面、三条支柱
├── theme.json           颜色与排版（编辑器改的就是它）
├── posts/               文章，一篇一个 .md
├── pages/               独立页面
├── assets/style.css     版式骨架（一般不用动）
├── build.js             生成器
├── serve.js             本地预览
├── editor.js            编辑器后端
├── editor/ui.html       编辑器界面
├── docs/                ★ 构建产物，发布的就是这个目录
└── *.cmd                双击运行的入口
```

`posts/`、`pages/` 是源文件，`docs/` 是生成物。**不要手改 `docs/`**，每次生成会整个覆盖。

## 写文章

`posts/` 里新建 `日期-网址名.md`，开头写元信息：

```markdown
---
title: 标题
tags: 标签一, 标签二
---

正文。
```

文件名里的日期会变发布日期，后半截变成网址——**发布后别改名**。

## 改样式

优先用编辑器（`启动编辑器.cmd`）：预设配色、逐项调色、字号行高版心、字体，改完点保存会自动重建。

也可以直接编辑 `theme.json` 里的十六进制颜色值。`theme.css` 由它生成，不要手改。

## 发布

仓库设置 → **Settings → Pages → Deploy from a branch → main / `/docs`**。

更新内容后重新上传或 `git push`，GitHub 约半分钟内自动重新部署。

## 注意

- 国内访问 `github.io` 可能较慢，可换 Cloudflare Pages / Vercel，文件不用改；
- 私有仓库的 Pages 需要付费账户；
- 本地预览只听 `localhost`，别人打不开是正常的。
