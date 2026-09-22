# GamePerf Studio 0.3.0｜实际验证记录

日期：2026-09-21；数据契约：schemaVersion 1。本报告不是生产认证，不表示 srv47 已部署，也不表示真实设备已执行。

## 1. 后端回归：已通过

执行 `python -m pytest tests -q`：**17 passed in 6.80s**。

在临时 SQLite 数据库中使用真实 FastAPI 路由/TestClient，覆盖登录和 CSRF、角色、记录 CRUD、版本冲突、提交冻结、独立审核、示例提交限制、父子循环、反馈转换、回传幂等、令牌撤销、导入草稿、持久化、备份恢复及凭证失效。

0.3 新增：静态页面保持服务端模式/CSP；部署文档、脚本、配置及数据库不能从静态路由读取；任意执行、SSH、restart-proxy 等接口不存在；首次服务器数据库没有示例业务记录。

详情见 `api-test-results.txt` 和 `tests/test_api.py`。这些是接口行为测试，不证明人员独立性、真实测量有效性或完整网络安全性。

## 2. 前端渲染与交互：10 组已通过

执行 `python scripts/check_ui.py`。1640 像素桌面与 390 像素手机，10 个页面，JavaScript 运行异常为 0。具体分组见 `ui-test-results.json`。

- 核心图 5 个业务阶段、17 个基线节点、节点文本不溢出，无虚构实时指标。
- 选中契约、下钻、创建子能力、维护字段和测试存储写入。
- 保留 v02 数据契约与存储键，通过重新初始化 UI 读取测试存储中的旧状态。
- 图谱分类筛选与嵌套节点搜索。
- 七步链路示意能自动停止，不修改业务数据；动效开关、汇报模式和 Esc。
- 任务关联实验、提交字段约束、冻结、本机演示审核。
- 反馈转任务，不执行 Agent。
- HTML 形式的节点名称按文本转义，不形成可执行标签。
- 10 个桌面页面无页面级横向溢出。
- 10 个手机页面导航可用、内部画布横滑、系统减少动态效果受到尊重。

**浏览器限制必须保留：** 本轮尝试正常访问本地 file URL，被浏览器策略以 `ERR_BLOCKED_BY_ADMINISTRATOR` 阻止。没有关闭或绕过策略。随后使用 Playwright `set_content` 渲染同一份真实 HTML/CSS/JS，并显式注入内存 localStorage 测试适配器。因此这里验证的是页面渲染和交互，而不是实际浏览器的文件打开、磁盘持久化、网络登录或服务器上线后的端到端访问。服务器登录、SQLite 与恢复由独立的接口测试覆盖，不能合并宣称为浏览器到服务器的完整验收。

截图来自实际网页渲染，不是生成的效果图。截图业务数据均为标注示例。QA 临时新增任务不写入交付种子或用户数据。

## 3. 静态检查：已通过

`node --check web/app.js`；`python -m compileall -q app manage.py scripts examples tests`；全部 shell 脚本 `bash -n`；Compose 文件 YAML 解析。

这些不等同容器镜像构建、依赖安全审计或 PowerShell 执行。

## 4. 未执行 / 待实际部署验证

| 范围 | 本次结果 |
|---|---|
| srv47 连接、OS/端口/Caddy 状态 | NOT_RUN |
| 上传、部署、Caddy validate/reload、代理改动 | NOT_RUN；未修改远端 |
| Docker build/compose config/容器启动 | NOT_RUN；本环境没有 Docker |
| inspect-srv47.ps1 运行 | NOT_RUN；本环境没有 PowerShell |
| 实际域名、DNS、TLS、Cookie 和浏览器登录链路 | NOT_RUN |
| 真实浏览器文件存储与跨设备同步 | NOT_RUN；需部署环境验证 |
| 用户生产数据、真实 Agent 和设备接入 | NOT_RUN |
| SSO、项目隔离、不可篡改审计、压力与渗透测试 | 尚未实现或未执行 |

Remote Desktop Commander 返回了一台在线电脑，但当前可用工具中无终端执行接口。未用读取工具绕过执行限制，未请求、读取或转移私钥，未调用 restart-proxy，未切换备用跳板。

## 5. 上线验收

按 `SRV47_DEPLOYMENT.md` 先核验现有入口，独立目录、127.0.0.1 端口初验；实际确认登录、角色、冲突、刷新/重登/重启持久化和测试备份恢复；再以经批准的域名新增 HTTPS 站点。复验旧站点可用。没有执行的条目保持 NOT_RUN，不用本地单元测试代替。
