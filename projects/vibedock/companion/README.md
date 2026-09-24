# VibeDock Companion 0.5

Windows PC 伴侣服务 + 圆形吧唧模拟器。PC 顶部可以切换 Codex / WorkBuddy；圆屏四区中央打开触控菜单，再进入工具选择页，选择另一个工具后才切换。圆屏内只展示当前工具的四个任务。

PC 持续读取 Codex 本地生命周期事件与 WorkBuddy 桌面状态库，模拟设备通过 HTTP + SSE 同步。圆屏触控菜单提供新会话、待处理、语音和工具切换入口；新会话必须由用户指定一个分区，不能悄悄挤走现有任务。实际批准/拒绝继续在原客户端处理，原生语音触发尚未接入。

待处理列表覆盖当前工具已识别、需要关注的任务，包括四区之外的任务。WorkBuddy 的 `pending` 可能只是尚未开始，不作为需要人工介入的提醒；仍在任务卡中显示“等待 / 待核对”。点击区外任务会替换当前选中槽位，其他三个位置保持不变。Windows 打开请求使用任务深链；回执只说明请求已发出，不代表已经核对原客户端页面。

## 启动

源码运行需要 Node.js 22.13 或更高版本（使用内置 SQLite）。Windows 免安装预览包自带 Node.js 运行时，不需要另装 Node，也不需要 `npm install`。下载并解压到普通文件夹，双击 `Start-VibeDock.cmd` 即可启动；首次会打开本机浏览器中的使用引导。关闭启动窗口会停止本机服务。

双击 **`Start-VibeDock.cmd`**，服务启动后自动打开默认浏览器；保留控制台，按 Ctrl+C 停止服务。也可以在项目目录执行：

```powershell
npm start
```

- 工作台：<http://127.0.0.1:47831/>
- 独立圆屏：<http://127.0.0.1:47831/?view=device>

两个窗口共用一个后端。独立圆屏选择任务后，PC 同步展示任务详情；每个窗口的圆屏当前页面各自保留。工具选择与四个槽位由服务统一维护。

两个工具默认读取本机真实数据，无需填写 WorkBuddy 云端令牌。右侧“数据来源 → 模拟演示”可体验完整四区、审批、语音动作回执和断线流程。两个工具均在后台刷新，切换外层工具即可查看。未上屏任务在 PC 和圆屏都有入口，选择任务后再指定被替换的分区；“换为最近四项”需要再次确认。

**新会话：**点圆屏中央打开触控菜单，再点“新会话”进入二级页；不会一按就创建。模拟模式可创建一条空会话，再明确选一个分区显示；这不会操作 Codex 或 WorkBuddy。真实模式请先在所选工具的原客户端新建并发出首条消息，VibeDock 读到后会在“未上屏”提示，再由你选分区。当前版本尚不能从吧唧直接在原客户端建立真实会话。吧唧没有屏幕下方的实体按键；用量从触控菜单的工具页查看。

Codex 可读取的最新回复在 PC 任务详情中展示节选，圆屏按短页阅读；WorkBuddy 当前主要只有状态，界面会明确写“仅状态可用”。完整对话、代码和 diff 请在原客户端查看。当前工具和真实任务的四个槽位 ID 保存在 `%LOCALAPPDATA%\VibeDock\preferences.json`，不保存任务正文、Token 或令牌。

## 可以怎样试

1. 在 Codex **真实接入**中查看本机任务；点击 Token 卡片查看已知任务用量和账户额度。
2. 切换**模拟演示**，打开独立圆屏窗口。
3. 在独立圆屏点击黄色区域，选择“查看并批准”，核对命令后确认。PC 和圆屏均收到适配器回执并变为蓝色。
4. 在 PC 联调台模拟“请求审批”，也可从 PC 拒绝，状态变为暂停。
5. 点“模拟断连”，在 PC 改变任务状态。圆屏保留旧快照、禁用动作；重新连接后全量同步。
6. 在最外层切换 WorkBuddy，检查任务、用量和操作对象一同切换。
   也可以点击圆屏中央打开触控菜单，再进入工具选择页并选择目标工具；返回菜单或四区不会切换。选择页显示当前工具的待查看数和另一工具的连接状态。离线时切换禁用，原工具四个槽位仍保留。
7. 语音页的“模拟触发入口”走真实消息链路并返回模拟回执；**不会启动录音、识别、转写或给原工具发送文字**。
8. 点击圆屏下方“新会话”，在二级页模拟新建，选择要放入的分区；返回四区后确认其他三项保持不变。

## 实际接入范围

| 能力 | Codex | WorkBuddy |
|---|---|---|
| 任务数据 | 官方 App Server 列表与本机会话事件；可读最新回复节选 | 默认本机 `workbuddy.db`，可选官方云端 API；暂无可读会话正文 |
| 当前状态 | 每 2 秒读取开始、完成、中断事件；本机已观察到执行中与完成 | 每 2 秒只读查询桌面状态库；本机已读到 31 项历史任务，新请求变化待实测 |
| Token | 从 App Server 给出的本地会话记录路径读取最近累计记录；不可读时未知 | 列表没有提供，显示未知 |
| 账户额度 | `account/rateLimits/read`，本机实测通过；只展示实际返回窗口 | 暂不可用 |
| 客户端在线线索 | 会话事件更新时间 | 本地 CLI host 心跳和进程存活；不保证某个任务正在执行 |
| 真实批准/拒绝 | 未接入原客户端审批连接；仅模拟闭环 | 未接入 ACP 权限请求；仅模拟闭环 |
| 真实任务跳转 | `codex://threads/<任务 UUID>`；已验证发送请求，页面定位待人工核对 | `workbuddy://task/<任务 UUID>`；本地任务已验证发送请求，页面定位待人工核对 |
| 原生语音 | 尚未接入精确定位与触发；仅模拟动作 | 尚未接入精确定位与触发；仅模拟动作 |
| 从吧唧新建真实会话 | 尚未接入；请在原客户端新建后从未上屏列表选分区 | 同左 |
| 物理蓝牙、固件 | 共用模拟器；真实 BLE / HID 驱动与固件未实现 | 同左 |

**Token 与额度不是一回事。** 四项任务的已知历史累计 Token 之和不等于本轮消耗，也不用于推算账户剩余额度。没有数据时显示 `—`。实时状态未知时，执行中/待介入数量也不会错误显示为 0。

### Codex

自动查找 Windows Codex 安装目录下最新的 CLI，回退到 PATH 中的 `codex`。使用 CLI 自己的已登录状态，不解析或复制凭据文件。

RPC 调用范围限于 `initialize`、`thread/list`、`thread/turns/list`、`account/rateLimits/read`、`hooks/list`。列表使用 `useStateDbOnly:true`，元数据缓存 5 秒，账户额度最多每分钟更新。事件首次读取文件末尾 4 MiB，之后增量读取，每轮最多补读 8 MiB；使用 `task_started/task_complete/turn_aborted` 判断状态，提取最后摘要及累计 Token。无事件用量时保留原末尾 2 MiB Token 读取降级。文件必须位于 Codex home 的 `sessions/` 下。

运行中超过 3 分钟没有新事件会保守显示未知；完成事件仍保留完成状态。首次末尾读取找不到生命周期标记且文件不超过 64 MiB 时，会分批补读一次，每轮仍最多 8 MiB；补读期间显示未知。更大文件无标记时保持未知，不从历史轮次猜测实时状态。未启用审批钩子时，“执行中”可能包括等待审批；待介入数量显示未知。启用后也只报告已识别的请求，不承诺覆盖所有会话。任务详情展示状态依据和时间。

#### 启用审批信号

执行 `npm run hooks:install`，将 5 项状态钩子合并注册到 Codex home 的 `hooks.json`（默认 `~/.codex/hooks.json`）。本机本轮已经注册，无需重复安装。已有配置修改前会生成时间戳备份，重复注册不会重复添加。

然后由用户在 **Codex 设置 → Hooks** 审阅并信任命令包含 `codex-status-hook.mjs` 的五项钩子。安装器不修改信任记录或审批策略；未审阅时工作台明确提示未启用。依据：[Codex 官方 Hooks 文档](https://developers.openai.com/zh-Hans/docs/hooks)。

监听 `PermissionRequest/PostToolUse/UserPromptSubmit/Stop/Interrupt`，仅向项目 `.local/codex-hook-events.jsonl` 追加任务 ID、轮次、事件时间、工具名和工具输入的关联哈希，不保存命令、提示词、输出或批准决定。脚本不返回任何审批决定；读取或写入失败会静默结束，最多等待 1.5 秒。

匹配执行结果、轮次结束或新轮次会清除待审批信号；超过 3 分钟没有结果降级为待核对，不显示已批准。旧轮次迟到事件不会清除新轮次请求。拒绝请求若没有后续事件，需在原客户端核对，不能从信号消失反推用户决定。

停用时在 Hooks 中禁用这五项；卸载可仅移除 `hooks.json` 中命令指向本项目 `scripts/codex-status-hook.mjs` 的条目，保留其他钩子。项目路径或 Node 安装路径变化后需要重新注册并审阅。

不会调用 `thread/resume`、`turn/start` 或执行真实审批。独立启动 App Server 不代表拥有原桌面客户端的实时任务。本机官方 daemon 只读版本探测也未连通控制 socket，所以没有将它宣传成已有任务的实时控制通道。

若 CLI 自动定位失败，可指定：

```powershell
$env:VIBEDOCK_CODEX_BIN='C:\path\to\codex.exe'
npm start
```

### WorkBuddy

默认以 SQLite 只读连接访问 `~/.workbuddy/workbuddy.db`，查询任务标题、状态、更新时间和上下文占用。不读取登录凭据，不向数据库写入数据。通过本地安装代码核对状态映射：`working/planning` 为执行中，`completed` 为完成，`error/failed` 为异常，`terminated` 为暂停。`pending` 同时可能表示等待输入或尚未开始，因此显示“等待 / 未开始”，不生成批准按钮。

非终态记录超过 3 分钟未更新或没有新鲜心跳时显示未知。心跳在线与任务记录新鲜度分别展示；如果最新任务记录超过一天，页面提示其时间。这个兼容读取器依赖客户端内部格式，客户端更新后可能需要适配。本机目前可读历史记录，但尚未观察到用户新测试请求的执行→完成变化；不能用历史读取成功代替这一项验收。

如果客户端使用非默认数据目录，在启动前设置 `$env:VIBEDOCK_WORKBUDDY_HOME='实际目录'`。上下文占用不等于累计 Token，不计入 Token 卡片。

可选：在“接入设置”填写通过官方授权流程获取的 **Open API Access Token** 切换云端数据。令牌只保存在当前 PC 服务内存中，不写磁盘、不下发圆屏、不输出日志；重启后重新填写。也可点击“连接本机 WorkBuddy”切回本地读取。云端请求使用官方固定 HTTPS 域名。

已实现 `GET /openapi/v2/tasks?page=1&size=20` 和 `GET /openapi/v2/localassistant`。任务列表是云端任务，不能视作当前桌面的全部任务。令牌无效、过期或权限不足会显示错误。

云端适配器尚无授权实测，仅通过固定响应验证格式映射、凭据不泄露和错误处理。应用注册、OAuth 后端与令牌刷新留到后续授权集成，不会把 `client_secret` 放进浏览器。

依据：[官方 Open API](https://open.workbuddy.cn/docs/openapi)、[用户提供的智能硬件白皮书](https://www.workbuddy.link/p/JVM0gKdRyl8k9EgElw5TxA)、[Codex App Server](https://learn.chatgpt.com/docs/app-server)。

## 工程结构

```text
public/               PC 工作台 + 独立圆屏视图
src/server.mjs        回环 HTTP、同源校验、会话、SSE
src/store.mjs         工具隔离、固定槽位、审批校验与动作回执
src/adapters.mjs      Codex / WorkBuddy 只读适配器与模拟数据
src/local-events.mjs  Codex 生命周期事件增量读取器
src/hook-observer.mjs Codex 审批信号关联与过期处理
src/task-links.mjs    Windows 原客户端任务深链
scripts/codex-status-hook.mjs  仅输出本地状态事件的钩子
scripts/install-codex-hook.mjs 合并注册钩子，不修改信任
src/workbuddy-desktop.mjs  WorkBuddy 桌面 SQLite 只读适配器
src/rpc.mjs           Codex stdio JSON-RPC 客户端
docs/protocol.md      消息契约与真机替换位置
test/                 Node 内置测试，无外部服务费用
scripts/probe-codex.mjs  只读连通性探针，不输出任务正文
scripts/probe-status.mjs  两工具状态探针，只输出标识、状态与时间
design/               前期设计评审稿，保留供对照
```

当前选用无依赖 Node 服务 + 浏览器工作台，以便先验证接入和消息链路。尚未打包成 Electron 托盘程序。后续桌面壳可以复用现有服务与前端。

## 验证

```powershell
npm test
npm run check
npm run probe:codex
npm run probe:status
```

自动化验证覆盖动作幂等、重复/过期审批、工具隔离、离线事件拒绝、模式切换竞态、未知用量、真实适配器降级、HTTP 会话/同源校验与 SSE，以及增量事件、半行写入、陈旧记录、SQLite 实时提交读取及只读保护。探针需要本机客户端可读；不会开始模型任务。

浏览器验收过程与结果记录在 [verification.md](docs/verification.md)。

## 下一步接真机

1. PC：验证两个客户端的精确任务定位、原生语音触发入口以及审批连接归属。没有可靠请求身份时继续禁用真实审批。
2. WorkBuddy：用当前客户端新任务验证数据库位置及完整状态变化；云端授权与 ACP 请求关联单独接入。
3. 设备：使用 SDK 工程实现四区渲染、触控事件与 BLE/HID transport，将当前模拟传输替换掉。自定义界面、双向通信、Windows 音频能力按已确认条件实施。
4. 按已提供烧录流程生成并验证正确板型的 `.fw`，再做断连、锁屏、休眠、长请求与语音路由验收。

本轮未运行烧录程序、修改设备固件，也未生成可烧录固件。声音继续使用系统已识别的设备麦克风/扬声器。
