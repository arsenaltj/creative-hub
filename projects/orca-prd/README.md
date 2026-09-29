# OrcaSlicer AI 3D Printing UX 展示页

GitHub Pages 路由：`/creative-hub/projects/orca-prd/`。本目录只含静态产品展示，无 AI 生成、切片、设备控制或真实打印执行。

PRD、用户旅程、需求证据和资料入口统一维护于本项目的 [`docs/`](docs/README.md)。三张可编辑架构 SVG 位于 `assets/`，展示素材提示词位于本目录；它们都只在 creative-hub 维护。`hero-concept.svg` 是展示概念视觉，不是 Orca 软件截图。文档中指向 OrcaSlicer 的链接仅用于定位指定版本的源码与架构证据。

作品集入口由仓库根目录 `projects.json` 和 `build.mjs` 生成。修改项目卡片后运行 `node build.mjs` 并执行 `node --test tests/portfolio.test.mjs`。展示页的文档卡片指向 creative-hub `main` 下的 Markdown，随本仓库提交更新；修改证据标签时需核对其注明的 OrcaSlicer 源码基线。
