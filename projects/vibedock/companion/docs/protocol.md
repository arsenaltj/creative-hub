# PC ↔ 圆屏消息契约 v1

当前实现是可运行的应用层协议；PC 与浏览器模拟设备用 HTTP 命令上行、SSE 全量快照下行。此文档不是已经完成的 BLE GATT 固件协议。

## 传输边界

```text
四区 UI / 设备模拟器
  → POST /api/command
  → Companion.command：校验工具、上下文、任务、请求
  → 工具适配器（当前审批为模拟适配器）
  → ack 回执 + GET /api/events 快照
  → PC 与所有在线模拟圆屏更新
```

后续 BLE/HID 驱动放在此 transport 边界，复用 Companion 与工具适配器。固件按槽位渲染状态和文字。音频走 Windows 已识别的蓝牙音频设备，不经过本协议。

## 快照

`GET /api/session` 初始化本机浏览器会话，返回操作 key 与首帧；随后 `GET /api/events` 订阅 `data: <JSON>\n\n`。15 秒发送保活注释。连接重建采用全量快照，无需回放历史事件。

主要字段：

```json
{
  "v": 1,
  "type": "snapshot",
  "instanceId": "每次 PC 服务启动生成的 UUID",
  "epoch": "当前设备上下文 UUID",
  "revision": 12,
  "tool": "codex",
  "mode": "demo",
  "connected": true,
  "deviceConnected": true,
  "selected": "codex-demo-1",
  "tasks": ["四个任务对象或 null，顺序固定"],
  "usage": {"tokens": 70800, "known": 4, "unknown": 0, "quota": []}
}
```

`tasks` 元素包含 `id/title/project/state/lastState/summary/output/source/statusNote/tokens/updatedAt/approval/capabilities`。`output` 是可读取的最新回复节选 `{kind,text,at,truncated}`，无正文时为 `null`；泛化状态摘要不冒充会话正文。状态为 `running/waiting/completed/failed/paused/unknown`；模拟新建的空会话使用 `new`，表示尚未输入，不能当成待审批。`lastState` 只是历史轮次状态，不替代实时 `state`。

0.2 增加可选 `stateLabel`（例如 WorkBuddy 的“等待 / 未开始”）、`observedAt`、`evidence`（来源、原始事件或状态、记录时间、是否陈旧）、`contextUsage: {used,size}`。上下文占用不加入累计 Token。快照增加 `provider: desktop/cloud` 和 `pollMs`。本机数据约每 2 秒刷新；云端 15 秒。`connected` 表示数据源可读，`localOnline` 是 WorkBuddy 心跳线索，均不能单独证明某个任务正在执行。`lastSync` 是读取时间，`evidence.at` 才是状态记录时间。

0.3 快照增加 `attention`（当前工具已读取任务中可确认需要关注的等待项和异常项，含 id/title/state/label/inSlots）、`hookStatus` 与 `hookLastEventAt`。WorkBuddy `pending` 有“未开始”的歧义，不进入需要处理列表。列表覆盖已读取范围，不代表账户所有任务。

本机状态同步不授予审批权限，真实任务的 `approve/nativeVoice` 仍为 false。Windows 上有效 UUID 的本机任务可启用 `openTask`。等待状态不等于可操作的审批请求；只有携带明确 `approval` 对象的模拟任务才提供批准/拒绝。真实 Codex 钩子信号的 `approval` 保持 null，处理动作交给原客户端。

槽位绑定任务 ID。普通刷新和状态变化不重排已有槽位；任务消失时才填空。“换为最近四项”显式重置绑定。每个工具有各自槽位和选中任务。

0.4 起本机服务只将当前工具和每个工具的四个任务 ID 保存到 Windows 用户的 `%LOCALAPPDATA%/VibeDock/preferences.json`；不保存任务标题、正文、Token 或授权令牌。模拟模式不覆盖真实任务的保存槽位。

同一 `instanceId` 内只接受不小于已有 `revision` 的快照，避免并行响应回滚画面。服务重启后 `instanceId` 变化，前端重新建会话并放弃旧缓存。切换工具、数据模式、重置场景、换任务组、断连/重连会更新 `epoch`，旧动作不能继续执行。

## 触控与动作

统一信封：

```json
{
  "v": 1,
  "actionId": "每个用户动作生成的 UUID；网络重传保持同一值",
  "epoch": "当前快照中的 epoch",
  "tool": "codex",
  "source": "device",
  "type": "task.select",
  "taskId": "codex-demo-1"
}
```

| type | 额外字段 | 当前行为 |
|---|---|---|
| `task.select` | `taskId` | 同步选中任务 |
| `task.focus` | `taskId` | 选择已读取任务；区外任务替换当前选中槽位并更新 epoch |
| `task.pin` | `taskId,slot(0..3)` | 用户显式选择替换分区，只变更一槽并更新 epoch；新版界面对区外任务使用此动作 |
| `demo.session.create` | 无 | 仅在模拟模式创建空会话，先进入未上屏列表，不自动占用四区；真实模式拒绝并引导在原客户端新建 |
| `interaction.resolve` | `taskId, requestId, requestRevision, decision` | 模拟批准/拒绝，校验后等回执 |
| `voice.start` | `taskId` | 仅模拟原生语音触发，不录音 |
| `task.open` | `taskId` | 模拟回执，或 Windows 原客户端任务深链请求 |
| `tool.select` | `target: codex/workbuddy` | PC 顶部可直接切换；设备四区中央先打开触控菜单，再进工具选择页，用户选择目标后才发送动作。切换更新 epoch，各工具槽位独立，设备离线时拒绝设备触控 |
| `mode.set` | `mode: live/demo` | PC 数据来源切换 |
| `tasks.latest` | 无 | 重新绑定最近四项 |
| `device.connection` | `connected: boolean` | 断连/重连故障注入 |
| `demo.state` | `taskId,state` | 模拟场景变更 |
| `demo.reset` | 无 | 重置当前工具模拟数据 |

最后几项是联调台控制消息，不表示真实固件应有权限切换适配器或注入状态。真实 transport 必须白名单化触控类消息，PC 设置操作不得暴露给设备。

审批信封示例：

```json
{
  "v": 1,
  "actionId": "c1cf00aa-50f4-48a2-bf57-a8f254c131f2",
  "epoch": "从最新快照读取",
  "tool": "codex",
  "source": "device",
  "type": "interaction.resolve",
  "taskId": "codex-demo-1",
  "requestId": "codex-request-1",
  "requestRevision": 1,
  "decision": "accept"
}
```

`decision` 必须来自该请求的 `decisions`，当前模拟为 `accept/decline`。问答请求不能改成批准/拒绝。批准确认前必须看清操作与范围；当前模拟命令均为短内容。真实长命令和 diff 的设备审阅能力尚未实现，不能直接开启远程批准。

HTTP 成功响应包含：

```json
{"v":1,"type":"ack","actionId":"同一动作 ID","ok":true,"simulated":true,"message":"已同步","snapshot":{}}
```

失败使用 HTTP 400/401/403/409 等及 `{ "error": "可展示的失败原因" }`。客户端不会乐观把批准改成执行中。`approval.pending` 表示已发出、尚未确认。新请求替换旧请求后，旧回执不得修改新请求。

真实 `task.open` 回执包含 `simulated:false, dispatched:true, verified:false`：通过固定 Windows Explorer 可执行文件发送白名单协议和 UUID，无 shell、无任意 URL。它只确认启动请求，不改变任务状态，也不表示已验证原客户端打开了目标页。Codex 与 WorkBuddy 深链基于本机安装代码核对，客户端更新后需重新验证。

进程内缓存最近 1000 个动作与结果；同 ID/同内容重传返回相同结果，同 ID/不同内容拒绝。审批还校验请求存在性与 pending 状态，因此另一动作 ID 也不能重复处理同一请求。进程重启后 epoch 改变，旧消息失效。此有限缓存不是跨重启持久消息队列。

## 本机访问

HTTP 只绑定 `127.0.0.1`，校验 Host/Origin/Fetch-Site。浏览器会话使用 SameSite Strict HttpOnly cookie；操作额外需要请求头 `X-Vibedock-Key` 与 JSON 内容类型。拒绝跨域请求，不开启通配 CORS。静态文件只允许三个固定路径，不暴露工程、凭证或日志文件。

工作台与模拟器是同源开发客户端，所以共享操作会话。真实固件不能复制该浏览器会话。以后 BLE transport 应实现设备配对、连接级动作授权、消息长度限制、序号与分片重组；Open API Access Token 和 Codex 登录凭据始终只留在 PC。

## 真机尚需实施

BLE GATT service/characteristic UUID、MTU、分片、CRC/认证、重连策略与设备能力握手要与 SDK 一起落地。当前每帧快照可能含完整摘要，**不能不经裁剪直接塞入 BLE characteristic**；设备适配层要输出四槽精简 DTO 并分页详情。HID 可用于唤醒与选择快捷事件；审批仍需双向数据关联请求，不用裸键盘按键代替请求身份。
