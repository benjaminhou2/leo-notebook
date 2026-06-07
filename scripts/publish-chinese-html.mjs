import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "语文");
const publishRoot = path.join(root, "publish");
const outRoot = path.join(publishRoot, "语文");
const assetExts = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
]);

const mdFiles = [];
const assetFiles = [];
const markdownByStem = new Map();
const assetByName = new Map();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store" || entry.name === "Publish") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (ext === ".md") mdFiles.push(abs);
    else if (assetExts.has(ext)) assetFiles.push(abs);
  }
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function relFromSource(abs) {
  return path.relative(sourceRoot, abs).split(path.sep).join("/");
}

function relHref(fromFile, targetFile) {
  let href = path.relative(path.dirname(fromFile), targetFile).split(path.sep).join("/");
  if (!href.startsWith(".")) href = `./${href}`;
  return encodeURI(href);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(text, used) {
  const base =
    text
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "section";
  let slug = base;
  let i = 2;
  while (used.has(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  used.add(slug);
  return slug;
}

function resolveWikiTarget(rawTarget, sourceMd, outHtml) {
  const [rawPath, rawLabel] = rawTarget.split("|").map((part) => part.trim());
  const label = rawLabel || path.basename(rawPath).replace(/\.[^.]+$/, "");
  const normalized = rawPath.replace(/^语文\//, "");
  const hasExt = Boolean(path.extname(normalized));
  const sourceDir = path.dirname(sourceMd);
  const candidates = [];

  if (normalized.includes("/")) {
    candidates.push(path.join(sourceRoot, normalized));
    if (!hasExt) candidates.push(path.join(sourceRoot, `${normalized}.md`));
  } else {
    candidates.push(path.join(sourceDir, normalized));
    if (!hasExt) candidates.push(path.join(sourceDir, `${normalized}.md`));
    candidates.push(path.join(sourceRoot, normalized));
    if (!hasExt) candidates.push(path.join(sourceRoot, `${normalized}.md`));
    if (!hasExt && markdownByStem.has(normalized)) candidates.push(markdownByStem.get(normalized));
    if (hasExt && assetByName.has(normalized)) candidates.push(assetByName.get(normalized));
  }

  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (!existing) {
    return `<span class="missing-link">${escapeHtml(label)}</span>`;
  }

  const ext = path.extname(existing).toLowerCase();
  if (ext === ".md") {
    const targetRel = relFromSource(existing).replace(/\.md$/i, ".html");
    return `<a href="${relHref(outHtml, path.join(outRoot, targetRel))}">${escapeHtml(label)}</a>`;
  }

  if (assetExts.has(ext)) {
    const targetRel = relFromSource(existing);
    return `<a href="${relHref(outHtml, path.join(outRoot, targetRel))}">${escapeHtml(label)}</a>`;
  }

  return escapeHtml(label);
}

function inlineMarkdown(text, sourceMd, outHtml) {
  let html = escapeHtml(text);
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, target) => resolveWikiTarget(target, sourceMd, outHtml));
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, href) => {
    const safeHref = escapeHtml(href.trim());
    return `<img src="${safeHref}" alt="${escapeHtml(alt)}">`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = escapeHtml(href.trim());
    return `<a href="${safeHref}">${label}</a>`;
  });
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  return html;
}

function isTable(lines, index) {
  return (
    index + 1 < lines.length &&
    /^\s*\|.+\|\s*$/.test(lines[index]) &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function renderTable(lines, start, sourceMd, outHtml) {
  const rows = [];
  let i = start;
  while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
    rows.push(lines[i]);
    i += 1;
  }
  const cells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const html = [
    '<div class="table-wrap"><table>',
    `<thead><tr>${head.map((cell) => `<th>${inlineMarkdown(cell, sourceMd, outHtml)}</th>`).join("")}</tr></thead>`,
    "<tbody>",
    ...body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell, sourceMd, outHtml)}</td>`).join("")}</tr>`),
    "</tbody></table></div>",
  ].join("\n");
  return { html, next: i };
}

function renderMarkdown(markdown, sourceMd, outHtml) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const used = new Set();
  const toc = [];
  const parts = [];
  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeLines = [];
  let paragraph = [];
  let list = null;
  let quote = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    parts.push(`<p>${inlineMarkdown(paragraph.join(" "), sourceMd, outHtml)}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    parts.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item, sourceMd, outHtml)}</li>`).join("")}</${list.type}>`);
    list = null;
  }

  function flushQuote() {
    if (!quote.length) return;
    parts.push(`<blockquote>${quote.map((line) => `<p>${inlineMarkdown(line, sourceMd, outHtml)}</p>`).join("")}</blockquote>`);
    quote = [];
  }

  while (i < lines.length) {
    const line = lines[i];

    if (inCode) {
      if (/^```/.test(line)) {
        parts.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLang = "";
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      i += 1;
      continue;
    }

    if (/^```/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      inCode = true;
      codeLang = line.replace(/^```/, "").trim();
      i += 1;
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      i += 1;
      continue;
    }

    if (isTable(lines, i)) {
      flushParagraph();
      flushList();
      flushQuote();
      const table = renderTable(lines, i, sourceMd, outHtml);
      parts.push(table.html);
      i = table.next;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text, used);
      if (level <= 3) toc.push({ level, text, id });
      parts.push(`<h${level} id="${id}">${inlineMarkdown(text, sourceMd, outHtml)}</h${level}>`);
      i += 1;
      continue;
    }

    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      flushQuote();
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((bullet || ordered)[1].trim());
      i += 1;
      continue;
    }

    const quoteLine = /^\s*>\s?(.+)$/.exec(line);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1].trim());
      i += 1;
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }

  flushParagraph();
  flushList();
  flushQuote();

  return { body: parts.join("\n"), toc };
}

function getTitle(markdown, file) {
  const title = /^#\s+(.+)$/m.exec(markdown);
  if (title) return title[1].trim();
  return path.basename(file, ".md");
}

function descriptionFrom(markdown) {
  const line = markdown
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#") && !item.startsWith("|") && !item.startsWith("---"));
  return (line || "Leo 语文学习资料").replace(/\[\[|\]\]|`|\*\*/g, "").slice(0, 120);
}

function layout({ title, description, body, toc, sourceRel, outFile }) {
  const cssHref = relHref(outFile, path.join(outRoot, "assets", "styles.css"));
  const indexHref = relHref(outFile, path.join(outRoot, "index.html"));
  const accessHref = relHref(outFile, path.join(publishRoot, "assets", "access.js"));
  const portalHref = relHref(outFile, path.join(publishRoot, "index.html"));
  const tocHtml =
    toc.length >= 3
      ? `<nav class="toc" aria-label="目录"><strong>目录</strong>${toc
          .map((item) => `<a class="toc-level-${item.level}" href="#${encodeURI(item.id)}">${escapeHtml(item.text)}</a>`)
          .join("")}</nav>`
      : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Leo 语文学习资料</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="${cssHref}">
  <script src="${accessHref}"></script>
  <script>window.LeoAccess.requireAccess("${portalHref}");</script>
</head>
<body>
  <header class="site-header">
    <a class="home-link" href="${indexHref}">Leo 语文学习资料</a>
  </header>
  <main class="page-shell">
    <article class="article">
      <header class="article-header">
        <p class="eyebrow">语文 / ${escapeHtml(path.dirname(sourceRel).replaceAll("/", " / "))}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="summary">${escapeHtml(description)}</p>
        <p class="source-path">来源：${escapeHtml(sourceRel)}</p>
      </header>
      ${tocHtml}
      <div class="content">
${body}
      </div>
    </article>
  </main>
</body>
</html>
`;
}

function makeCss() {
  return `:root {
  color-scheme: light;
  --paper: #fffaf0;
  --surface: #fffdf8;
  --soft: #f7ead7;
  --soft-blue: #eaf5f4;
  --soft-mint: #edf7e9;
  --ink: #3f372f;
  --muted: #786c60;
  --line: #eadcc9;
  --accent: #9a6a3f;
  --accent-soft: #fff2d9;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background:
    linear-gradient(180deg, #fff7e8 0%, #fffdf8 42%, #f4fbf7 100%);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 17px;
  line-height: 1.82;
}

a {
  color: #8b5e34;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid var(--line);
}

.site-header {
  padding: 16px clamp(16px, 4vw, 40px);
  border-bottom: 1px solid rgba(226, 205, 177, 0.72);
  background: rgba(255, 253, 248, 0.92);
}

.home-link {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  color: var(--accent);
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
}

.page-shell {
  width: min(100%, 1040px);
  margin: 0 auto;
  padding: clamp(18px, 4vw, 48px) clamp(16px, 4vw, 32px) 64px;
}

.article {
  max-width: 820px;
  margin: 0 auto;
}

.article-header {
  padding: 8px 0 22px;
  border-bottom: 1px solid var(--line);
}

.eyebrow,
.source-path,
.summary,
.card-meta {
  color: var(--muted);
}

.eyebrow {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
}

h1 {
  margin: 0;
  color: #3d3329;
  font-size: clamp(30px, 7vw, 46px);
  line-height: 1.18;
  letter-spacing: 0;
}

.summary {
  margin: 16px 0 0;
  max-width: 680px;
  font-size: 18px;
}

.source-path {
  margin: 10px 0 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.toc {
  margin: 22px 0 28px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--accent-soft);
}

.toc strong {
  display: block;
  margin-bottom: 8px;
  font-size: 15px;
}

.toc a {
  display: block;
  padding: 5px 0;
  color: #6f563d;
  font-size: 15px;
  text-decoration: none;
}

.toc-level-3 {
  padding-left: 16px !important;
}

.content {
  padding-top: 16px;
}

.content h1,
.content h2,
.content h3,
.content h4 {
  color: #4b3d31;
  line-height: 1.32;
  letter-spacing: 0;
}

.content h1 {
  margin: 34px 0 14px;
  font-size: 28px;
}

.content h2 {
  margin: 34px 0 12px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  font-size: 25px;
}

.content h3 {
  margin: 26px 0 10px;
  font-size: 21px;
}

.content h4 {
  margin: 22px 0 8px;
  font-size: 18px;
}

.content p,
.content ul,
.content ol,
.content blockquote,
.table-wrap,
pre {
  margin: 0 0 18px;
}

.content ul,
.content ol {
  padding-left: 1.4em;
}

.content li + li {
  margin-top: 6px;
}

blockquote {
  padding: 14px 18px;
  border-left: 4px solid #dab98d;
  border-radius: 0 8px 8px 0;
  background: #fff5e4;
  color: #55483c;
}

code {
  padding: 0.08em 0.34em;
  border-radius: 5px;
  background: #f4eadb;
  color: #5a4532;
  font-size: 0.92em;
}

pre {
  overflow-x: auto;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff8ea;
}

pre code {
  padding: 0;
  background: transparent;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

table {
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  font-size: 15px;
  line-height: 1.65;
}

th,
td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
  text-align: left;
}

th {
  background: #fff1d8;
  color: #4c3c2e;
}

tr:last-child td {
  border-bottom: 0;
}

.missing-link {
  color: #a06f45;
  border-bottom: 1px dotted #cfa574;
}

.index-hero {
  max-width: 920px;
  margin: 0 auto 26px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.index-hero h1 {
  max-width: 720px;
}

.section-list {
  display: grid;
  gap: 16px;
  max-width: 920px;
  margin: 0 auto;
}

.section-title {
  margin: 30px 0 4px;
  color: #4b3d31;
  font-size: 22px;
}

.card-grid {
  display: grid;
  gap: 12px;
}

.doc-card {
  display: block;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 253, 248, 0.88);
  text-decoration: none;
}

.doc-card:hover {
  background: #fff8eb;
}

.doc-card strong {
  display: block;
  color: #3f372f;
  font-size: 18px;
}

.card-meta {
  display: block;
  margin-top: 4px;
  font-size: 14px;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  body {
    font-size: 16px;
    line-height: 1.78;
  }

  .site-header {
    padding: 12px 16px;
  }

  .page-shell {
    padding: 18px 15px 44px;
  }

  .article-header {
    padding-top: 4px;
  }

  h1 {
    font-size: 30px;
  }

  .summary {
    font-size: 16px;
  }

  .toc {
    padding: 13px 14px;
  }

  .content h2 {
    font-size: 22px;
  }

  .content h3 {
    font-size: 19px;
  }

  table {
    min-width: 560px;
    font-size: 14px;
  }

  th,
  td {
    padding: 9px 10px;
  }
}
`;
}

function makeIndex(pages) {
  const indexFile = path.join(outRoot, "index.html");
  const cssHref = relHref(indexFile, path.join(outRoot, "assets", "styles.css"));
  const trainingCssHref = relHref(indexFile, path.join(publishRoot, "assets", "training.css"));
  const accessHref = relHref(indexFile, path.join(publishRoot, "assets", "access.js"));
  const portalHref = relHref(indexFile, path.join(publishRoot, "index.html"));
  const knowledgeHref = relHref(indexFile, path.join(publishRoot, "assets", "knowledge-data.js"));
  const subjectPageHref = relHref(indexFile, path.join(publishRoot, "assets", "subject-page.js"));
  const grouped = new Map();
  for (const page of pages) {
    const group = path.dirname(page.sourceRel);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(page);
  }
  const sections = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "zh-Hans-CN"))
    .map(([group, items]) => {
      const cards = items
        .sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"))
        .map(
          (item) => `<a class="doc-card" href="${relHref(path.join(outRoot, "index.html"), item.outFile)}">
  <strong>${escapeHtml(item.title)}</strong>
  <span class="card-meta">${escapeHtml(item.sourceRel)}</span>
</a>`,
        )
        .join("\n");
      return `<section>
  <h2 class="section-title">${escapeHtml(group.replaceAll("/", " / "))}</h2>
  <div class="card-grid">${cards}</div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Leo 语文学习资料</title>
  <meta name="description" content="Leo 语文作文、阅读、试卷分析和专项提升资料的本地 HTML 阅读入口。">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="${cssHref}">
  <link rel="stylesheet" href="${trainingCssHref}">
  <script src="${accessHref}"></script>
  <script>window.LeoAccess.requireAccess("${portalHref}");</script>
</head>
<body data-subject="chinese">
  <header class="site-header">
    <a class="home-link" href="./index.html">Leo 语文学习资料</a>
  </header>
  <main class="page-shell">
    <header class="index-hero">
      <p class="eyebrow">本地发布页</p>
      <h1>Leo 语文学习资料</h1>
      <p class="summary">这里把语文目录下的 Markdown 转成了更适合阅读的 HTML，保留原来的子目录路径，方便按作文、试卷分析和专项练习查看。</p>
    </header>
    <section class="knowledge-section">
      <div class="knowledge-heading">
        <h2>当前最需要加强的知识点</h2>
        <p>这些知识点来自作文和试卷诊断。点击任意一项，完成第一轮基础诊断和第二轮错题强化。</p>
      </div>
      <div class="knowledge-list" id="knowledgeList"></div>
    </section>
    <div class="section-list">
      ${sections}
    </div>
  </main>
  <script src="${knowledgeHref}"></script>
  <script src="${subjectPageHref}"></script>
</body>
</html>
`;
}

walk(sourceRoot);
for (const md of mdFiles) {
  const stem = path.basename(md, ".md");
  if (!markdownByStem.has(stem)) markdownByStem.set(stem, md);
}
for (const asset of assetFiles) {
  const name = path.basename(asset);
  if (!assetByName.has(name)) assetByName.set(name, asset);
}
fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(outRoot, "assets"), { recursive: true });

for (const asset of assetFiles) {
  const dest = path.join(outRoot, relFromSource(asset));
  ensureDir(dest);
  fs.copyFileSync(asset, dest);
}

const pages = [];
for (const md of mdFiles.sort((a, b) => relFromSource(a).localeCompare(relFromSource(b), "zh-Hans-CN"))) {
  const sourceRel = relFromSource(md);
  const outFile = path.join(outRoot, sourceRel.replace(/\.md$/i, ".html"));
  const markdown = fs.readFileSync(md, "utf8");
  const title = getTitle(markdown, md);
  const description = descriptionFrom(markdown);
  const rendered = renderMarkdown(markdown, md, outFile);
  ensureDir(outFile);
  fs.writeFileSync(
    outFile,
    layout({
      title,
      description,
      body: rendered.body,
      toc: rendered.toc,
      sourceRel,
      outFile,
    }),
  );
  pages.push({ title, sourceRel, outFile });
}

fs.writeFileSync(path.join(outRoot, "assets", "styles.css"), makeCss());
fs.writeFileSync(path.join(outRoot, "index.html"), makeIndex(pages));

console.log(`Published ${pages.length} Markdown files to ${path.relative(root, outRoot)}`);
