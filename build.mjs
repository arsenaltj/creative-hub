import {readFile, writeFile, access} from 'node:fs/promises';
const root = import.meta.url;
const projects = JSON.parse(await readFile(new URL('projects.json', root), 'utf8'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repo = p => `https://github.com/arsenaltj/creative-hub/tree/main/projects/${p.path}`;
const seen = new Set();
for (const p of projects) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.path) || seen.has(p.path)) throw Error('Invalid or duplicate project path');
  if (!/^[\w.-]+$/.test(p.repo)) throw Error('Invalid repository');
  if (p.demo && p.demo !== `./projects/${p.path}/`) throw Error('Verify demo URL');
  if (p.download && (p.path !== 'vibedock' || !/^https:\/\/github\.com\/arsenaltj\/creative-hub\/releases\/tag\/vibedock-v[\d.]+$/.test(p.download))) throw Error('Verify download URL');
  if (p.art && !['dock','pet','perf'].includes(p.art)) throw Error('Unknown project artwork');
  if (p.demo) await access(new URL(`projects/${p.path}/index.html`, root));
  seen.add(p.path);
}
function art(p) {
  if (p.art === 'dock') return '<div class="dial" aria-hidden="true"><i>01<br>待介入</i><i>02<br>执行中</i><i>03<br>已完成</i><i>04<br>异常</i></div>';
  if (p.art === 'perf') return '<div class="perf-art" aria-hidden="true"><div class="perf-orbit"></div><div class="perf-core">GP<span>STUDIO</span></div><div class="perf-flow"><span>诊断</span><i>→</i><span>寻优</span><i>→</i><span>验证</span></div><span class="perf-caption">PRODUCT × METHOD</span></div>';
  return '<div class="pet" aria-hidden="true"><div class="ears"></div><div class="face">• ᴥ •</div><span>今天也一起慢慢来。</span></div>';
}
const active = projects.filter(p => p.kind !== 'archive');
const cards = active.map((p,i) => `<article class="project ${p.art || 'code'}"><div class="visual"><span class="serial">EXPERIMENT / ${String(i+1).padStart(2,'0')}</span>${p.art ? art(p) : '<div class="type-art" aria-hidden="true">3D<span>MAKE / LEARN / SHARE</span></div>'}<span class="visual-label">${p.demo ? '可交互演示' : '代码项目'}</span></div><div class="project-body"><p class="eyebrow">${esc(p.label)}</p><h3>${esc(p.name)}</h3><p class="description">${esc(p.description)}</p><p class="note">${esc(p.note)}</p><div class="actions">${p.demo ? `<a class="primary" href="${esc(p.demo)}">体验作品 <span>↗</span></a>` : ''}${p.download ? `<a href="${esc(p.download)}">下载 PC 版 ↓</a>` : ''}<a href="${repo(p)}">查看源码 ↗</a></div></div></article>`).join('');
const archive = projects.filter(p => p.kind === 'archive').map(p => `<a href="${repo(p)}"><span>${esc(p.name)}</span><span aria-hidden="true">↗</span></a>`).join('');
const template = await readFile(new URL('template.html', root), 'utf8');
await writeFile(new URL('index.html', root), template.replace('<!-- PROJECTS -->',cards).replace('<!-- ARCHIVE -->',archive).replaceAll('<!-- COUNT -->',String(active.length).padStart(2,'0')));
const lines = projects.map(p => `| ${p.name} | ${p.path === 'gameperf' ? '研发工作台演示 + 后端源码' : p.path === 'vibedock' ? '交互演示 + PC 预览版源码' : p.demo ? '交互原型' : '代码目录'} | ${p.demo ? `[在线演示](https://arsenaltj.github.io/creative-hub/projects/${p.path}/)` : '—'} | [源码](${repo(p)}) | ${p.download ? `[Windows 预览版](${p.download})` : '—'} |`).join('\n');
await writeFile(new URL('README.md', root), `# 创意实验室 · Creative Hub

👉 [打开统一作品集](https://arsenaltj.github.io/creative-hub/)

统一管理 ${projects.map(p=>p.name).join('、')} 的源码、文档与在线入口。此后以 projects/ 下各目录作为维护入口，原独立仓库保留为历史快照，不删除、不改变其可见性。

| 项目 | 类型 | 演示 | 源码 | 下载 |
|---|---|---|---|---|
${lines}

## 如何维护

修改项目源码时编辑 projects/ 对应目录。作品介绍编辑 projects.json；页面设计编辑 template.html 和 style.css；运行 node build.mjs 并提交生成的 index.html、README.md。GitHub Pages 继续从 main 分支根目录发布。

GamePerf 的共享 UI 在 projects/gameperf/web/。修改后运行 python projects/gameperf/scripts/build_demo.py，再运行 python projects/gameperf/scripts/build_pages.py，提交生成的 gameperf-preview.html 和 index.html。两个入口使用同一 UI；Pages 入口额外提供返回作品集和演示边界说明。

检查：node --test tests/portfolio.test.mjs；node --check projects/gameperf/web/app.js。GamePerf 后端回归在其目录安装 requirements-dev.txt 后运行 python -m pytest tests -q。

## 运行与数据边界

- 作品集与三个网页演示不需要启动后端。GamePerf 完整 FastAPI/SQLite 源码、测试及部署说明保留在其目录，但 GitHub Pages 不运行 Python、数据库或 /api/ingest。
- GamePerf 在线演示可以编辑；修改仅保存在访问者当前浏览器，不会写回 GitHub，也不与其他设备同步。只使用脱敏示例，及时导出 JSON。相同 Pages 来源的其他页面属于同一信任边界，不存放公司敏感数据。
- 真机、真实 Agent、服务器登录及多人同步均未在 Pages 接入；动态链路、任务和审核演示不构成真实执行或独立验收。
- VibeDock PC 伴侣程序源码位于 projects/vibedock/companion/，Windows 预览版在 GitHub Releases。固件、SDK、私钥、令牌与真实任务数据不在本公开仓库。原独立仓库保持不变。
- 源码合并与发布记录见 MIGRATION.md、projects/gameperf/docs/HUB_INTEGRATION.md；私人服务器版仍需独立部署与授权。
`);
console.log(`Built ${projects.length} project entries`);
