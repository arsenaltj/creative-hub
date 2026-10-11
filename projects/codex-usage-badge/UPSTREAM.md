# Codex Usage Badge · Creative Hub 维护版

原项目：[jaykinhoo9/codex-usage-badge](https://github.com/jaykinhoo9/codex-usage-badge)，MIT 许可，版权归原作者所有。完整许可证见 [LICENSE](LICENSE)。这是第三方本地界面扩展，与 OpenAI 官方插件无关。

本次同步基于上游 `d014efcd7735a4349576c6b424cac23b614f9115`，Windows 版本 `0.10.1`。引入 [PR #9](https://github.com/jaykinhoo9/codex-usage-badge/pull/9) 的两项修复，对应提交 `bd4cabe`、`2b774ef0eb0686f4644bd36e6f16a2018ee4966c`。截至 2026-10-11，PR 尚未合并；本目录为快照，不自动追踪上游。

Hub 维护版 `0.10.1-hub.1` 额外包含：

- Windows 新启动窗口的等待时间从 8 秒调整为 30 秒，继续检查前台、用户输入、进程身份与冷却时间；不接管已有工作窗口。
- 安装到 `%LOCALAPPDATA%\CreativeHub\CodexUsageBadge`，使用独立所有权标记、互斥锁、登录启动项与桌面「Codex 用量条 Hub」入口。重新启动会重新发现 Store 安装路径。
- 默认并固定关闭上游自动更新，避免上游安装包覆盖维护版修复。更新需要下载新的 Hub 版本。
- 创建桌面恢复入口，并纳入安装失败回滚；保留安装目录内的 MIT 许可证。
- 固定版本下载器，下载完整 ZIP 后验证 SHA-256，拒绝目录穿越与超出限制的 ZIP；再执行文件安装器。SHA-256 校验不等于数字签名。
- 为源码定义固定换行符，生成 agent 时使用 LF，使公开包的固定校验值可复现；Windows PowerShell 脚本保留 UTF-8 BOM。

网页预览使用人工编写的示例数据。本公开目录不包含实际账号、认证文件、聊天数据库、安装状态、日志、屏幕截图或本机路径。`assets/cover.png` 来自上游已审查的项目封面。

## 使用

1. Windows 10/11 上先安装并登录 Codex 桌面版，至少打开一次，使内置 CLI / Node 运行时就绪。需要 Node.js 24+（带 `node:sqlite`）；安装器优先寻找 Codex 自带运行时，不另外下载 Node。
2. 从 [介绍页](https://arsenaltj.github.io/creative-hub/projects/codex-usage-badge/) 下载一键安装器并双击；或下载 ZIP，完整解压后双击 `Install.cmd`。无需管理员权限。浏览器不会直接执行安装器，下载后需要手动运行。
3. 从 Codex 菜单或托盘完全退出，再双击桌面「Codex 用量条 Hub」。更新 Codex 后若消失，也使用这个入口恢复。
4. 卸载：在安装目录运行 `Uninstall.cmd`。安装器会停止后台、清理自有快捷方式并把安装目录留作备份；正常重启 Codex 关闭调试端口。登录与聊天数据保留。

不要同时启用多个 Badge 版本：它们共享本机调试端口 `127.0.0.1:39222`。现有本地试用版不由此安装器卸载或覆盖。

## 数据与连接

配额经 Codex CLI 的 `account/rateLimits/read` 获取；Token 读取本机 SQLite 中的会话 ID 与 `tokens_used`；文件夹大小扫描本地项目，颜色存储在客户端本地配置中。安装后的后台不检查 GitHub 更新；配额查询仍依赖 Codex 官方服务。调试接口仅监听回环地址，但同一电脑上的其他程序可能通过该接口操作 Codex。关闭插件并正常重启 Codex 可关闭接口。

## 开发与发布

```text
python scripts/build_hub_release.py
node tests/windows-startup.cjs
node tests/windows-startup-controller.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File tests/windows.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/windows-launch.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/hub-bootstrap.ps1
python scripts/audit_release.py
```

原 macOS 源码与测试保留供参考；Hub 下载器和安装包仅维护 Windows。`scripts/build_release.py` 生成供上游回归测试使用的包；`scripts/build_hub_release.py` 在其基础上生成带 Hub 说明的公开包与下载器。公开版本附件放在 Creative Hub Releases，不提交 ZIP 到 Pages。

发布时保留不可变版本与校验值；上传 `dist/Install-CodexUsageBadge.cmd`、Hub ZIP、`dist/HUB-SHA256SUMS.txt`。运行根目录 `node build.mjs`，提交源码与生成页面。不要把运行时 `config.json`、`worker.json`、日志或数据库纳入源码。
