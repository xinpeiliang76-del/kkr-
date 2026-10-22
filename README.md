# 我的博客

零依赖静态博客：Markdown 写文章 → 一个 Node 脚本生成 HTML → 整个 `docs/` 丢给 GitHub Pages。

没有服务器、没有数据库、没有后台，也不需要备案。

## 目录结构

```
blog/
├── site.config.json      # 站点名字、简介、导航
├── posts/                # 文章：一个 .md 一个文件
├── pages/                # 独立页面（关于、友链……）
├── assets/               # CSS、图片
├── build.js              # 生成器（只有它会"编译"）
├── serve.js              # 本地预览用的小服务器
├── docs/                 # ★ 构建产物，要发布的就是这个目录
└── README.md
```

`posts/` 和 `pages/` 是**源文件**，`docs/` 是**生成物**。别手动改 `docs/` 里的东西，`build.js` 每次会把它整个覆盖掉。

## 环境

只需要 Node.js（18 以上就行，推荐装 LTS 版）：<https://nodejs.org/>

装完在终端里 `node -v` 能出数字就好了。

> 当前这台机器上还没装 Node.js（只有 DSH 自带的运行时）。所以现在想要预览，可以先直接双击 `docs/index.html`，浏览器里就能看效果——生成好的页面已经在这里了。

## 写一篇新文章

1. 在 `posts/` 里新建文件，命名规则 `日期-网址名.md`：

   ```
   posts/2026-10-24-my-first-post.md
   ```

2. 文件开头写元信息，然后正文随便写：

   ```markdown
   ---
   title: 我的第一篇文章
   tags: 随笔, 生活
   ---

   正文从这里开始。支持 **加粗**、*斜体*、`代码`、列表、表格、代码块……
   ```

3. 生成 + 预览：

   ```bash
   npm run dev        # 等于 node build.js && node serve.js
   ```

   然后打开 <http://localhost:4000>。

4. 只想生成不预览：`npm run build`。

改站点名字、简介、导航项，都去 `site.config.json` 里改，改完重新 build。

## 发布到 GitHub Pages

### 方式 A：网页上传（不用装任何东西）

1. 注册 / 登录 GitHub。
2. 右上角 **+** → **New repository**，名字随便起（比如 `blog`），选 **Public**，**不要**勾选 "Add a README file"。
3. 进入仓库 → **Add file** → **Upload files** → 把整个 `blog` 文件夹拖进去（含 `docs` 子目录）。
4. 点 **Commit changes**。
5. 仓库 **Settings** → 左侧 **Pages** → **Source** 选 **Deploy from a branch** → 分支 `main`、目录 `/docs` → **Save**。
6. 等 1~2 分钟，页面上方会出现网址：

   ```
   https://你的用户名.github.io/仓库名/
   ```

   打不开就多看两眼 Actions 标签页，构建失败会有红叉。

> 网址规则：仓库叫 `blog` → `用户名.github.io/blog/`；仓库叫 `用户名.github.io` → 直接就是 `用户名.github.io/`（根路径）。
> 本站所有链接都是相对路径，放根目录还是子目录都能正常工作。

### 方式 B：装 Git，用命令行（以后要更新文章就用这个）

```bash
winget install --id Git.Git -e      # 或者去 git-scm.com 下载安装

git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

注意 Git 首次 push 会要求认证。**不要用账号密码**（2021 年就废弃了），要去
GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
生成一个带 `repo` 权限的 token，粘贴到密码位置。

### 方式 C：GitHub Desktop

图形界面，免命令行，装完登录账号，`File → Add local repository` 选中 `blog` 文件夹，然后 Publish。适合完全不想碰终端的情况。

## 日常更新流程

```bash
# 写文章 → 生成 → 提交
npm run build
git add .
git commit -m "新文章：xxx"
git push
```

push 之后 GitHub 大概 30 秒内会自动重新部署。

## 换成自己的域名（可选）

1. 买个域名（阿里云 / 腾讯云 / Cloudflare，`.com` 一般 60~80 元/年，`.top` 之类首年更便宜但续费坑）。
2. 在域名服务商那里加一条 CNAME 记录：主机记录填 `blog`，指向 `你的用户名.github.io`。
3. 仓库 **Settings → Pages → Custom domain** 填 `blog.你的域名.com` → Save。
4. 顺手把 **Enforce HTTPS** 勾上（证书 GitHub 自动签，免费）。

因为托管在境外，**不需要 ICP 备案**。代价是国内访问速度看运气。

## 关于访问速度（重要）

`github.io` 在国内的访问经常很慢，甚至需要梯子。可以按这个优先级试：

1. 先直接用 `github.io` 的网址，很多地区其实还能开；
2. 换成 **Cloudflare Pages** 或 **Vercel**：连同一个仓库，白嫖 CDN，国内速度稍好一点，做法几乎一模一样（注册 → Import Git Repository → 直接部署）；
3. 真要国内稳定快速，就得回到方案 B：买国内云服务器 + 域名备案（备案 2~3 周）。

三种情况 Markdown 文章都不用改，只换发布方式。

## 常见问题

**改了文章，网页没变？**
先确认跑过 `node build.js`，再确认 `docs/` 里的文件确实更新了、也提交 push 了。

**404？**
先看 Pages 设置里的目录是不是 `/docs`；再确认仓库里 `docs/index.html` 存在。

**中文标点 / 字体难看？**
改 `assets/style.css` 里 `body` 的 `font-family`，或者整份 CSS 换成喜欢的主题。

**想要黑暗模式？**
已经带了，跟系统设置自动切换（`prefers-color-scheme`）。

**想要评论？**
以后想加的话，推荐 giscus（用 GitHub Discussions 存评论，免费、无广告），在 `build.js` 的 `layout()` 里插一段 script 就行。
