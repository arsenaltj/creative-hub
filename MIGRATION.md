# 源码归并记录

日期：2026-09-22。只归并以下两个公开演示仓库的最新源码快照，不导入其他项目；原仓库提交历史保留在原址。

| 项目 | 来源提交 | 新目录 |
|---|---|---|
| VibeDock | arsenaltj/vibedock-demo @ d79e0d0343da1995f0fedd49c8f19ee55c04a13c | projects/vibedock/ |
| 栖伴 | arsenaltj/qiban-desktop-pet @ f40627d76c7a682d31dfaa5769eba6a21972a126 | projects/qiban/ |

项目运行源码保持原样，项目 README 更新为统一入口。后续从此仓库维护；旧仓库未删除、未重定向。

## GamePerf Studio 合并

2026-09-22：按用户指令从 arsenaltj/gameperf-studio 的 b4b70a4ac2ece12959d25d3b06296b18ff779c41 合入 projects/gameperf/。保留完整前后端、测试、需求与脱敏部署说明；不导入 .git、凭据、数据库、日志或私有部署参数。原私有仓库不修改、不删除。

新增 projects/gameperf/index.html 作为 Pages 演示入口，共享 web/ 源码；作品清单新增第三项，原两项目目录未改动。后续在本仓库维护，Pages 发布不等于私人服务器后端上线。详见 projects/gameperf/docs/HUB_INTEGRATION.md。
