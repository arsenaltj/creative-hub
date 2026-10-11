# 创意实验室 · Creative Hub

👉 [打开统一作品集](https://arsenaltj.github.io/creative-hub/)

统一管理 VibeDock、栖伴 QIBAN、GamePerf Studio、OrcaSlicer AI 3D Printing UX、Codex Usage Badge 的源码、文档与在线入口。此后以 projects/ 下各目录作为维护入口，原独立仓库保留为历史快照，不删除、不改变其可见性。

| 项目 | 类型 | 演示 | 源码 | 下载 |
|---|---|---|---|---|
| VibeDock | 交互演示 + PC 预览版源码 | [在线演示](https://arsenaltj.github.io/creative-hub/projects/vibedock/) | [源码](https://github.com/arsenaltj/creative-hub/tree/main/projects/vibedock) | [Windows 预览版](https://github.com/arsenaltj/creative-hub/releases/tag/vibedock-v0.5.1) |
| 栖伴 QIBAN | 交互原型 | [在线演示](https://arsenaltj.github.io/creative-hub/projects/qiban/) | [源码](https://github.com/arsenaltj/creative-hub/tree/main/projects/qiban) | — |
| GamePerf Studio | 研发工作台演示 + 后端源码 | [在线演示](https://arsenaltj.github.io/creative-hub/projects/gameperf/) | [源码](https://github.com/arsenaltj/creative-hub/tree/main/projects/gameperf) | — |
| OrcaSlicer AI 3D Printing UX | 产品文档 + 架构展示 | [展示页面](https://arsenaltj.github.io/creative-hub/projects/orca-prd/) | [源码](https://github.com/arsenaltj/OrcaSlicer) | — |
| Codex Usage Badge | 第三方桌面扩展 + MIT 源码 | [介绍与安装](https://arsenaltj.github.io/creative-hub/projects/codex-usage-badge/) | [源码](https://github.com/arsenaltj/creative-hub/tree/main/projects/codex-usage-badge) | [Windows 维护版](https://github.com/arsenaltj/creative-hub/releases/tag/codex-usage-badge-v0.10.1-hub.1) |

## 如何维护

修改项目源码时编辑 projects/ 对应目录。作品介绍编辑 projects.json；页面设计编辑 template.html 和 style.css；运行 node build.mjs 并提交生成的 index.html、README.md。GitHub Pages 继续从 main 分支根目录发布。

GamePerf 的共享 UI 在 projects/gameperf/web/。修改后运行 python projects/gameperf/scripts/build_demo.py，再运行 python projects/gameperf/scripts/build_pages.py，提交生成的 gameperf-preview.html 和 index.html。两个入口使用同一 UI；Pages 入口额外提供返回作品集和演示边界说明。

检查：node --test tests/portfolio.test.mjs；node --check projects/gameperf/web/app.js。GamePerf 后端回归在其目录安装 requirements-dev.txt 后运行 python -m pytest tests -q。

## 运行与数据边界

- 作品集与三个网页演示不需要启动后端。GamePerf 完整 FastAPI/SQLite 源码、测试及部署说明保留在其目录，但 GitHub Pages 不运行 Python、数据库或 /api/ingest。
- GamePerf 在线演示可以编辑；修改仅保存在访问者当前浏览器，不会写回 GitHub，也不与其他设备同步。只使用脱敏示例，及时导出 JSON。相同 Pages 来源的其他页面属于同一信任边界，不存放公司敏感数据。
- 真机、真实 Agent、服务器登录及多人同步均未在 Pages 接入；动态链路、任务和审核演示不构成真实执行或独立验收。
- VibeDock PC 伴侣程序源码位于 projects/vibedock/companion/，Windows 预览版在 GitHub Releases。固件、SDK、私钥、令牌与真实任务数据不在本公开仓库。原独立仓库保持不变。
- Codex Usage Badge 保留原作者 jaykinhoo9 与 MIT 许可，Hub 维护版来源和修复见 [UPSTREAM.md](projects/codex-usage-badge/UPSTREAM.md)。Windows 一键安装器在 Releases，下载后双击运行，校验固定版本 ZIP；默认关闭上游自动更新。第三方扩展使用本机调试接口，使用与卸载说明见介绍页。
- 源码合并与发布记录见 MIGRATION.md、projects/gameperf/docs/HUB_INTEGRATION.md；私人服务器版仍需独立部署与授权。
