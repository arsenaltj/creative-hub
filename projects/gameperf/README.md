# GamePerf Studio · 游戏性能研发工作台

**版本：0.3.0 / 数据契约：schemaVersion 1**

把《游戏性能智能研发体系｜全局蓝图 v0.1》变成可维护的网页与结构化记录系统。
定位是**可编辑蓝图 + 业务记录 + 接入起点**，不是已经能够执行真机实验或自主修改高通代码的 Agent 平台。

## 项目入口

[在线作品](https://arsenaltj.github.io/creative-hub/projects/gameperf/) · [返回作品集](https://arsenaltj.github.io/creative-hub/) · [合并与发布边界](docs/HUB_INTEGRATION.md)

在线入口是静态演示：只在访问者浏览器保存修改，不写回 GitHub，不提供服务器登录或多人同步。完整后端源码保留，但不在 GitHub Pages 运行。

以 `arsenaltj/creative-hub` 的 `projects/gameperf/` 作为源码和需求的共同维护入口；原独立私有仓库保留为历史快照。先看 [当前状态](docs/STATUS.md)、[需求](docs/REQUIREMENTS.md)、[开发约定](AGENTS.md) 和 [部署边界](docs/SRV47_DEPLOYMENT.md)。真实服务器信息与凭据保留在受信任本机，不进入 Git。

## 本次更新

深空科技感界面与 CSS/SVG 链路示意；新增需求与边界页、节点契约面板、能力下钻、图谱筛选、七步链路演示、汇报模式与减少动效支持。保留原有业务数据契约和后端权限；不新增实时遥测或远程命令执行能力。

先看 `docs/REQUIREMENTS.md`；目标服务器交接看 `docs/SRV47_DEPLOYMENT.md`。源码包可继续用现有 Codex 维护，不需要重建已有调参 Agent。

升级前导出旧预览的 JSON。虽然沿用 v02 本地存储键，浏览器对不同文件地址的存储不保证互通；必要时在新版“部署与维护”导入。

## 先了解交付边界

- `gameperf-preview.html`：独立单文件体验版；无外部依赖和网络请求，内置记录都标为示例。使用浏览器 localStorage 保存；不同浏览器、设备或文件位置的数据不会自动互通，隐私模式可能无法保存。请及时导出 JSON。
- 服务器版：静态前端 + FastAPI REST + SQLite。首次启动只有蓝图，**没有虚构的业务任务或性能结果**。网页登录后读写数据库，多终端通过服务器共享记录。
- 没有默认账号，没有公开注册；管理员在服务器终端交互创建账号。登录与记录不包含 SSH、模型供应商密钥、远程命令执行接口。
- 已实现写入型 `/api/ingest`，可接收现有 Agent 的任务及实验草稿。**记录接收成功不等于设备已执行，也不等于优化或审核通过。**
- 服务器版本实现基本角色限制和人工审核记录，但没有公司 SSO、项目级访问隔离、设备调度器或自动独立评测。真实业务接入前需要公司批准的环境及安全评审。
- 部署包已准备；**没有部署到你的服务器**。Docker 镜像构建、反向代理、DNS 和证书需要在目标环境验证。

## 界面与功能

| 页面 | 当前可用动作 |
|---|---|
| 全局蓝图 | 选中契约、筛选、子能力下钻、七步链路示意、汇报模式、编辑目标 |
| 需求与边界 | 四方向需求、规划与实现范围、产品边界；维护项目目标 |
| 能力目录 | 新增节点、拆分子能力、编辑输入输出、责任人、状态和边界 |
| 业务任务 | 新增和修改任务，维护设备、游戏、基线、目标、约束、预算与停止条件 |
| 实验与证据 | 关联任务，记录候选、重复次数、测量值和原始证据引用；提交后冻结 |
| 能力进化 | 维护诊断、搜索、工具或流程候选，记录独立任务与可比预算 |
| 反馈闭环 | 记录外部问题，一次性转换为待处理任务，不触发执行 |
| 业务接入 | 展示接口契约、真实回传计数；没有模拟“运行中”状态 |
| 演进路线 | G0 → 并行 G1-A / G1-B → G2 的验收条件 |
| 部署与维护 | 数据导入导出、退出登录、操作记录、运行边界 |

业务节点状态是人工记录，不是连接检测。任务的“已完成”不是发布授权。界面不把单项帧时间改善自动判为优化成功。

## 快速体验

先用浏览器打开 `gameperf-preview.html`。手机系统不一定允许直接打开下载的 HTML；部署后用域名访问更方便。

本机体验版可以修改蓝图、创建任务、关联实验和导出 JSON。本机审核只是演示，不能作为独立审核证据。

## 本地启动服务器版（Python）

以下示例面向 Linux / macOS，使用 Python 3.13。端口只绑定本机。

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py create-user admin --role admin
# 密码至少 14 位，终端交互输入，不进入 shell 历史。
export GP_ORIGIN=http://localhost:8765
export GP_COOKIE_SECURE=false
python -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --no-proxy-headers
```

浏览器使用 `http://localhost:8765`，不要混用另一种域名或 IP。GP_ORIGIN 必须与浏览器地址完全一致。

PowerShell 环境变量语法是 `$env:GP_ORIGIN="http://localhost:8765"`、`$env:GP_COOKIE_SECURE="false"`，其余 Python 命令相同。

## Docker 部署

详细说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。默认只绑定服务器本机 `127.0.0.1:8765`，不会自动打开公网端口。

```bash
cp .env.example .env
bash scripts/deploy.sh local
# 首次启动后，在服务器交互创建管理员：
docker compose exec app python manage.py create-user admin --role admin
```

有现成 HTTPS 代理时优先复用，使用独立子域名；没有代理且确认 80/443 可用时才考虑可选 Caddy 配置。

## 角色和审核

| 角色 | 权限 |
|---|---|
| admin | 读写记录、导入草稿副本、审核自己未参与修改的候选 |
| editor | 读写蓝图、任务、反馈和草稿，提交候选，不具备审核权限 |
| reviewer | 读取记录；审核本人未参与的已提交候选，不能编辑其证据 |
| viewer | 只读 |
| 集成令牌 | 只允许 `/api/ingest` 新建任务和实验草稿，无读取、修改、审核或执行权限 |

创建独立审核账号：

```bash
docker compose exec app python manage.py create-user reviewer --role reviewer
```

候选的创建者和参与修改者均不得审核同一候选。提交后的候选不能直接编辑或删除，应复制为新候选。所有审核都要求填写依据及“已独立检查证据”的确认。

这些是应用层保障，不是对人员真实独立性的证明，也不是不可篡改审计；服务器管理员控制数据库和账号。首版各角色在同一工作空间，尚无细粒度项目数据隔离。

## 接入现有 Agent

参见 [docs/API.md](docs/API.md) 与 `examples/agent_report.py`。优先做薄适配，不重写现有调参程序。

```python
from examples.agent_report import StudioClient
studio = StudioClient()  # 从运行环境读取 GP_URL / GP_TOKEN
record = studio.report(
    event_id="real-job-123:task",
    kind="tasks",
    payload={
        "title": "填写真实任务名称",
        "device": "填写实际设备标识",
        "game": "填写游戏和版本",
        "baseline": "填写实际软件基线",
        "stageId": "optimize",
        "allowedActions": "填写已授权动作范围",
    },
)
# 保存 record['id']，随后关联实际实验结果；不要填造性能数值。
```

这个适配器不会接管你的 Agent，只负责将已存在的真实记录传入工作台。源码和大日志暂不上传，只记录公司批准存储中的证据引用。

## 数据与升级

`/data/studio.sqlite3` 位于 Docker 命名卷。前端或容器重建不会主动清空该数据；不要执行 `docker compose down -v`。

日常快照：`bash scripts/backup.sh`。备份包含业务记录、用户密码哈希等敏感信息，只放入批准的备份位置。

浏览器 JSON 导出适合交换业务记录；不包含账号、会话和令牌，不能替代完整灾备。服务器导入会创建业务草稿副本，不覆盖既有同 ID 蓝图节点，不继承审核决定。

详细备份、恢复、回滚与验证步骤见部署文档。

## 代码结构

```text
web/                  原生 HTML / CSS / JS，无前端构建步骤
app/main.py           登录、权限、CRUD、审核、集成与静态路由
app/models.py         Pydantic 记录契约与字段验证
app/db.py             SQLite、会话、密码哈希、审计与版本
app/seed.json         仅设计基线；服务器业务记录初始为空
manage.py             仅服务器终端的账号、令牌、备份管理
examples/             现有 Agent 的轻量回传适配器
scripts/              环境检查、部署、备份、离线恢复、单文件打包
compose*.yaml         本机端口部署与可选 HTTPS 入口
docs/                 原蓝图、部署说明、API、架构和测试报告
tests/test_api.py     接口、权限、版本、幂等和恢复等回归测试
AGENTS.md             给 Codex / 其他开发 Agent 的工程边界
```

## 测试与限制

```bash
pip install -r requirements-dev.txt
python -m pytest tests -q
node --check web/app.js  # 仅语法检查；运行前端不依赖 Node
```

实测结果与未测范围见 [docs/QA.md](docs/QA.md)。交付不是生产认证。目标服务器上的首次构建、账号登录、持久化、HTTPS、备份和回滚需要再次验收。
