# 创意实验室 · Creative Hub

👉 [打开统一作品集](https://arsenaltj.github.io/creative-hub/)

统一管理 VibeDock、栖伴 QIBAN、GamePerf Studio 的源码、文档与在线入口。此后以 projects/ 下各目录作为维护入口，原独立仓库保留为历史快照，不删除、不改变其可见性。

| 项目 | 类型 | 演示 | 源码 |
|---|---|---|---|
| VibeDock | 交互原型 | [在线演示](https://arsenaltj.github.io/creative-hub/projects/vibedock/) | [源码](https://github.com/arsenaltj/creative-hub/tree/main/projects/vibedock) |
| 栖伴 QIBAN | 交互原型 | [在线演示](https://arsenaltj.github.io/creative-hub/projects/qiban/) | [源码](https://github.com/arsenaltj/creative-hub/tree/main/projects/qiban) |
| GamePerf Studio | 研发工作台演示 + 后端源码 | [在线演示](https://arsenaltj.github.io/creative-hub/projects/gameperf/) | [源码](https://github.com/arsenaltj/creative-hub/tree/main/projects/gameperf) |

## 如何维护

修改项目源码时编辑 projects/ 对应目录。作品介绍编辑 projects.json；页面设计编辑 template.html 和 style.css；运行 node build.mjs 并提交生成的 index.html、README.md。GitHub Pages 继续从 main 分支根目录发布。

GamePerf 的共享 UI 在 projects/gameperf/web/。修改后运行 python projects/gameperf/scripts/build_demo.py，再运行 python projects/gameperf/scripts/build_pages.py，提交生成的 gameperf-preview.html 和 index.html。两个入口使用同一 UI；Pages 入口额外提供返回作品集和演示边界说明。

检查：node --test tests/portfolio.test.mjs；node --check projects/gameperf/web/app.js。GamePerf 后端回归在其目录安装 requirements-dev.txt 后运行 python -m pytest tests -q。

## 运行与数据边界

- 作品集与三个网页演示不需要启动后端。GamePerf 完整 FastAPI/SQLite 源码、测试及部署说明保留在其目录，但 GitHub Pages 不运行 Python、数据库或 /api/ingest。
- GamePerf 在线演示可以编辑；修改仅保存在访问者当前浏览器，不会写回 GitHub，也不与其他设备同步。只使用脱敏示例，及时导出 JSON。相同 Pages 来源的其他页面属于同一信任边界，不存放公司敏感数据。
- 真机、真实 Agent、服务器登录及多人同步均未在 Pages 接入；动态链路、任务和审核演示不构成真实执行或独立验收。
- VibeDock 本机服务、固件、SDK、内部源码、SSH 私钥、令牌和真实业务日志不在本公开仓库。原两项目源码保持不变。
- 源码合并与发布记录见 MIGRATION.md、projects/gameperf/docs/HUB_INTEGRATION.md；私人服务器版仍需独立部署与授权。
