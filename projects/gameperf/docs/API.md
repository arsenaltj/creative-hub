# API 契约 v1

## 原则

前端和集成接口只维护记录。接口不执行 Shell、不连接设备、不调用大模型、不修改底层代码、不发版。

所有 `/api/workspace` 与业务记录接口要求有效浏览器会话。浏览器写入还要求 CSRF token；来源与 Host 受限制。集成只写 `/api/ingest`，使用独立 Bearer token，不能拿该令牌读取工作台或审核。

服务器端错误状态：401 未认证；403 权限或来源不符；409 版本/引用/幂等冲突；413 请求过大；415 内容类型错误；422 字段或提交条件不符；428 缺少版本；429 登录或回传频率限制。

记录输入契约以 `app/models.py` 为准，未知字段会拒绝。显示字段还包括服务器管理的 `id`、`version`、`author`、`updatedAt`、参与修改者和审核记录，不能在普通写入时自行指定。

## 浏览器端主要路由

| 方法 | 路径 | 权限 / 语义 |
|---|---|---|
| GET | /api/info | 模式和是否已创建账号；不包含业务数据 |
| GET | /api/health | 最小健康状态 |
| POST | /api/login | JSON 用户名密码；要求 X-GP-Client: web |
| GET | /api/me | 会话身份与 CSRF token |
| POST | /api/logout | 注销当前会话 |
| GET | /api/workspace | 工作空间记录与最近审计；需登录 |
| PUT | /api/project | admin/editor；需 If-Match |
| POST | /api/records/{kind} | admin/editor 新建记录 |
| PUT | /api/records/{kind}/{id} | admin/editor 修改；需 If-Match |
| DELETE | /api/records/{kind}/{id} | admin/editor 删除未冻结且无引用的记录 |
| POST | /api/review/{kind}/{id} | 独立 admin/reviewer 的人工判断；需 If-Match |
| POST | /api/feedback/{id}/task | 原子转换，不重复创建；需 If-Match |
| POST | /api/import | admin；最多 1 MB / 1000 条；新增草稿副本 |

`kind` 为 nodes、tasks、experiments、evolutions、feedback。

### 提交与审核

实验草稿提交前至少提供：关联任务、假设、基线、候选、环境、重复次数 >=1、原始证据引用。方法候选还需旧版、候选版、模型版、评测版、独立任务范围、可比预算及结果描述。

提交是显式状态 `review`，提交后冻结。提交者及参与修改者不能审核。审核只接受：

```json
{"decision":"accepted","note":"填写独立检查的证据及结论","attested":true}
```

这不是自动评测通过，也不触发代码合入、发版或运行中的 Agent 升级。示例记录不能提交服务器正式审核。

## 已有 Agent 的写入接口

### 签发凭证

```bash
python manage.py create-token tuning-agent --days 30
```

从服务器终端取得令牌后，仅在运行 Agent 的安全环境保存。示例 Python 适配器读取 `GP_URL` 和 `GP_TOKEN`；不打印令牌。

### 1. 上报真实任务

```http
POST /api/ingest
Authorization: Bearer YOUR_RUNTIME_TOKEN
Content-Type: application/json
```

```json
{
  "eventId": "job-123:task",
  "type": "tasks",
  "payload": {
    "title": "实际任务标题",
    "stageId": "optimize",
    "status": "optimizing",
    "device": "实际设备标识",
    "game": "实际游戏与版本",
    "baseline": "实际软件基线",
    "objective": "负责人确定的优化目标",
    "constraints": "负责人确定的不可突破约束",
    "allowedActions": "已授权的白名单参数范围",
    "budget": "已批准的真机预算",
    "stopCondition": "停止与恢复条件"
  }
}
```

成功返回新建记录的 `id`、`version` 和 `type`，用于后续实验关联。

### 2. 上报真实实验草稿

```json
{
  "eventId": "job-123:experiment:1",
  "type": "experiments",
  "payload": {
    "title": "实际候选名称",
    "taskId": "上一步返回的工作台任务 ID",
    "hypothesis": "实际提出的机制假设",
    "baseline": "实际基线版本",
    "candidate": "实际参数或构建版本",
    "device": "实际设备标识",
    "game": "实际游戏版本",
    "scene": "实际场景",
    "environment": "实际室温、起始温度、电量等条件",
    "repeats": 0,
    "p95Baseline": null,
    "p95Candidate": null,
    "powerBaseline": null,
    "powerCandidate": null,
    "tempCandidate": null,
    "evidence": "公司批准存储中的原始证据引用",
    "notes": "填入实际结果和测量方法；没有测量就保留 null"
  }
}
```

无论客户端提供什么状态，该接口只生成实验草稿。这里的 0 和 null 表示尚未测量，不是有效实验结果；实际使用应替换为真实记录。

### 重试与限制

同一令牌 + `eventId` 的相同规范化内容返回同一记录，包含 `duplicate: true`；同一事件 ID 对应不同内容返回 409。重新签发令牌后幂等范围也改变；应在 Agent 侧保留回传 ID 及发送状态，避免误创建重复记录。

单请求最多 1 MB；同一令牌每分钟最多接受 120 个新事件。超大日志留在受控存储，只传引用。过期或已撤销令牌返回 401。

首版没有回调订阅、WebSocket 状态流、任务领取、批量更新或后台 Worker。不要用轮询伪造任务运行，也不要把未来执行能力描述为已支持。

## 数据交换

网页导出为 `schemaVersion: 1` 的 JSON，包含蓝图及业务记录，不含账号、会话、令牌。服务器导入会保留同 ID 的既有节点，新增未知节点；任务与实验使用新 ID 并重建关联；审核结论不导入，候选回到草稿。导入动作不可替代数据库灾备。
