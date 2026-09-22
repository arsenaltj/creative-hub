# 服务器部署与交接指南

本次目标 srv47 的约束和执行交接以 `SRV47_DEPLOYMENT.md` 为补充；本文件是通用流程。

## 1. 部署前提供哪些信息

目前只需要环境和使用边界，不要在聊天中发送密码、私钥、云主账号密钥或模型 Key。

```text
服务器归属：公司批准环境 / 个人服务器
云厂商或位置：
系统 / CPU 架构：
CPU / 内存 / 可用磁盘：
公网还是内网：
Docker / Docker Compose 是否可用：
是否使用宝塔、1Panel 或已有 Nginx / Caddy：
是否已有网站，占用哪些端口：
拟用域名或子域名（没有也可以）：
使用范围：仅自己 / 小组 / 更大团队
部署执行途径：已连服务器的 Codex / SSH 终端 / 管理面板 / 已授权部署连接
数据边界：仅脱敏蓝图 / 已批准承载业务数据
```

服务器地址、SSH 用户名和端口可以在确认执行途径后提供。凭证通过受支持的安全连接或服务器本地密钥管理，不通过聊天明文交换。只有服务器 IP 不等于已经建立执行权限。

`scripts/inspect-server.sh` 是可选的只读检查脚本，输出系统、架构、CPU、内存、磁盘、工具版本及 80/443/8765 监听状态；不读取环境变量、密钥、业务配置或进程名称。分享输出前仍应自行核对。

**个人服务器尚未获得公司批准时，只部署蓝图与脱敏示例，不上传内部高通源码、Trace、用户日志和供应商配置。**

## 2. 选择部署模式

建议使用独立子域名，如 `perf.your-domain.example`，不要覆盖现有网站。

| 模式 | 适用条件 | 外部访问 |
|---|---|---|
| local | 初验、内网开发、SSH 隧道 | 应用只监听服务器本机 |
| proxy | 已有 Nginx、Caddy、宝塔或 1Panel 管理 HTTPS | 由现有代理提供独立子域名 |
| tls | 专用服务器或确认 80/443 无冲突 | 可选 Caddy 容器负责 HTTPS |

上述配置都不会启动 Agent、刷机、编译高通代码或更改设备参数。

## 3. 初验：先通过本机端口运行

将整个源码目录放入一个专用目录。上传方式由你已经信任的 SSH / SFTP / Codex / 部署连接完成，勿上传密钥到网站目录。

```bash
cd /your/approved/path/gameperf-studio
cp .env.example .env
bash scripts/deploy.sh local
docker compose exec app python manage.py create-user admin --role admin
```

没有默认密码，也没有网页登录注册。密码在服务器终端交互输入。

核对：

```bash
docker compose ps
curl --fail http://127.0.0.1:8765/api/health
# 未登录的数据访问必须是 HTTP 401：
curl -i http://127.0.0.1:8765/api/workspace
```

远程服务器上端口绑定的是服务器的 localhost，不能直接用你电脑的 localhost 访问。测试时可在你自己的电脑建立 SSH 隧道：

```bash
# 使用已有授权的 SSH 配置；不要把私钥内容写入命令。
ssh -N -L 8765:127.0.0.1:8765 YOUR_DEPLOY_USER@YOUR_SERVER
```

浏览器再打开 `http://localhost:8765`。必要时为 SSH 添加自己的 `-p` 参数。该方式仍需你具备有效 SSH 访问权限。

## 4. 生产入口 A：复用现有 HTTPS 代理（优先）

编辑 `.env`：

```dotenv
GP_ORIGIN=https://perf.your-domain.example
GP_PORT=8765
GP_COOKIE_SECURE=true
GP_IMAGE_TAG=0.3.0
```

GP_ORIGIN 是实际浏览器访问的来源，不带路径。首版建议独立子域名，不支持挂在已有网站的 `/gameperf/` 子路径下。

```bash
bash scripts/deploy.sh proxy
```

在已有面板或代理中**新建独立站点**，将其反向代理到 `http://127.0.0.1:8765`，并保留请求的 Host。示例 location 见 `deploy/nginx-location.conf`，它不是完整站点文件，不能直接覆盖原站。

证书沿用现有受控管理流程。不要为了试运行关闭既有网站、清空代理配置或随意开放全部端口。

## 5. 生产入口 B：可选 Caddy TLS

只有确认 80/443 可用、域名解析和公网访问边界已经授权时才执行。

`.env` 中同时设置：

```dotenv
GP_ORIGIN=https://perf.your-domain.example
GP_COOKIE_SECURE=true
GP_DOMAIN=perf.your-domain.example
GP_PORT=8765
GP_IMAGE_TAG=0.3.0
```

```bash
bash scripts/deploy.sh tls
```

脚本会要求输入 `DEPLOY` 再绑定 80/443，不会停止既有服务或代你更改防火墙。标准公网域名自动证书方案需要域名正确指向服务器，且证书签发与访问所需端口可达。已有代理时不要重复启动这个 TLS 入口。

Caddy 的官方自动 HTTPS 条件见文末。仅内网访问时可能需要公司反向代理、公司 CA、DNS 验证或其他受批准方案，不能直接套用公网证书配置。

## 6. 账号与集成凭证

```bash
docker compose exec app python manage.py create-user editor --role editor
docker compose exec app python manage.py create-user reviewer --role reviewer
docker compose exec app python manage.py create-user viewer --role viewer
docker compose exec app python manage.py list-users
```

管理员、编辑和审核账号按真实责任分配；多建一个自己掌握的账号不代表真正独立验收。

为现有 Agent 签发只写回传凭证：

```bash
docker compose exec app python manage.py create-token tuning-agent --days 30
```

令牌只在服务器终端显示一次；保存到 Agent 所在的批准环境，不放到前端、截图、聊天、Git 仓库或公开下载目录。

```bash
docker compose exec app python manage.py list-tokens
docker compose exec app python manage.py revoke-token TOKEN_ID
```

账户密码忘记时在服务器重置；该账户旧会话会失效：

```bash
docker compose exec app python manage.py reset-password admin
```

## 7. 数据备份与恢复

### 在线备份

```bash
bash scripts/backup.sh
```

脚本使用 SQLite 在线备份 API，而不是直接复制可能处于写入中的主数据库文件。文件写入宿主机 `backups/`，权限设为 600。按公司要求另存至备份位置并制定保留策略。脚本本身没有自动定时；没有为你创建任何后台备份任务。

网页 JSON 导出不包含用户、会话和凭证，不是完整灾备。导入 JSON 会创建新业务记录副本，候选返回草稿，既有蓝图节点不被覆盖。

### 离线恢复

先确认正确的备份，备份当前状态，再停止所有使用目标数据库的应用实例。以下操作会恢复业务状态并使所有登录会话和集成令牌失效。

```bash
bash scripts/backup.sh
docker compose stop app
# 将下面的文件名替换为已核对的备份，保留 .sqlite3 扩展名。
docker compose run --rm --no-deps \
  -v "$PWD/backups:/backups:ro" app \
  python scripts/restore_db.py /backups/CONFIRMED_BACKUP.sqlite3 \
  --confirm-offline-restore
docker compose up -d app
```

恢复程序会核对 SQLite 完整性和 schema，先保存当前数据库的预恢复副本，然后恢复；清除旧会话与令牌，防止旧备份使已撤销凭证重新生效。需要重新签发确有必要的集成令牌。

不要执行 `docker compose down -v`；它会删除包含数据库的卷。跨 schema 版本的恢复与迁移需要单独设计，当前仅支持 schema 1。

## 8. 升级与回滚

升级前记录当前源码版本和 `GP_IMAGE_TAG`，保存备份。新版本使用新目录或 Git 提交，运行测试并检查数据契约，然后重建应用镜像。

当前 `GP_IMAGE_TAG` 标识本地构建镜像，不是已发布到公共镜像仓库的镜像。恢复旧镜像或重新构建旧源码前，先确认数据库 schema 兼容；不要在未确认迁移关系时让旧代码连接新 schema。

生产使用前，应把基础 Python / Caddy 镜像固定到经过目标环境验证的版本或 digest，并建立依赖扫描与升级回归。随包的锁定依赖用于复现当前接口测试，不代表没有安全漏洞。

## 9. 必须在目标服务器再次验收

1. HTTPS 证书、重定向和域名正确；GP_ORIGIN 与实际地址一致。
2. 未登录不能读业务数据；viewer 不能写入，editor 不能审核；参与修改者不能自审。
3. 新建记录后刷新、退出重新登录及应用重启，数据仍存在。
4. 浏览器或反向代理断网时，前端明确报错，不偷偷转到另一份本机数据。
5. 同一记录冲突修改返回 409，而不是静默覆盖。
6. 备份可用，在测试环境完成一次恢复并确认令牌失效。
7. 不开放 8765 公网入口，不把数据库、日志、源码和备份目录作为静态网站暴露。
8. 首次回传使用脱敏任务，确认接口只接收记录、不会执行任务。

首版缺少企业 SSO、项目级数据隔离、不可篡改审计、自动证据校验、完整限流与压力测试。公开大规模部署或承载敏感数据前需进一步加固。

## 10. 给已有服务器连接的 Codex 的交接提示词

> 在当前服务器为 gameperf-studio 建立独立部署。先只读确认系统、架构、Docker/Compose、既有站点与端口、域名和数据使用授权。不要停止既有网站、覆盖代理配置、改动全局防火墙或读取无关密钥。先阅读 README.md、AGENTS.md 和 docs/DEPLOYMENT.md，核对代码与部署包版本，默认应用只绑定 127.0.0.1。使用现有 HTTPS 代理的独立子域名优先；新的公网入口需明确确认。密码与令牌只在受信任的终端/凭证管理中处理，不写入 Git、前端或公开目录。部署后实际验证匿名访问拒绝、角色权限、版本冲突、重启持久化和备份恢复。未建立执行连接时只输出待执行命令，不能宣称已部署；不连接真机、不运行调参、不上传业务源码，除非有单独明确授权。

## 官方资料

- FastAPI 容器部署：https://fastapi.tiangolo.com/deployment/docker/
- Caddy 自动 HTTPS：https://caddyserver.com/docs/automatic-https
- Caddy 反向代理：https://caddyserver.com/docs/quick-starts/reverse-proxy
- SQLite 在线备份 API：https://docs.python.org/3.13/library/sqlite3.html#sqlite3.Connection.backup
- Docker Compose secrets：https://docs.docker.com/compose/how-tos/use-secrets/

本项目没有把密码放进 Compose 环境变量；运行时账号和令牌通过服务器管理命令建立。未来接入其他供应商凭证时使用公司批准的凭证管理，不把这些资料当作已集成能力。
