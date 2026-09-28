# OrcaSlicer AI 3D Printing UX 展示页

GitHub Pages 路由：`/creative-hub/projects/orca-prd/`。本目录只含静态产品展示，无 AI 生成、切片、设备控制或真实打印执行。

正式 PRD、用户旅程与需求证据维护于 OrcaSlicer `Docs/product/ai-3d-printing-ux/`。`assets/` 下三张架构 SVG 和本目录的 `design-assets-prompts.md` 是该目录的发布副本；更新文档图或提示词时同步复制并核对文件哈希。`hero-concept.svg` 是展示概念视觉，不是 Orca 软件截图。

作品集入口由仓库根目录 `projects.json` 和 `build.mjs` 生成。修改项目卡片后运行 `node build.mjs` 并执行 `node --test tests/portfolio.test.mjs`。正式文档链接指向 OrcaSlicer 集成分支，须先让文档在远端可读，再发布本页。
