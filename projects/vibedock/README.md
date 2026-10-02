# VibeDock

圆屏四区中央打开触控菜单，提供“新会话 / 待处理 / 语音 / 切换工具”。切换工具需要再进入选择页，选定 Codex 或 WorkBuddy 才会生效；每个工具保留自己的四个任务槽位。模拟新建后还需选择分区，不会自动挤走现有任务。吧唧没有屏幕下方的实体按键；本站仅使用模拟数据。

👉 [在线演示](https://arsenaltj.github.io/creative-hub/projects/vibedock/)

Public interactive demo with simulated data only. No real client connections, recording or command execution.

👉 [下载 Windows 多端预览版](https://github.com/arsenaltj/creative-hub/releases/tag/vibedock-v0.6.0) · [PC 端源码](./companion/README.md) · [部署说明](./companion/docs/multi-device.md)

0.6 提供置顶桌面小圆屏与托盘、手机圆屏、局域网扫码配对，以及可自部署的 HTTPS 广域网中继。Windows 桌面包解压后运行 `VibeDock.exe`；浏览器便携包运行 `Start-VibeDock.cmd`。两个包自带运行时与依赖。手机在 PC「多端连接」扫码，默认只有查看权限；可分别选择 Codex / WorkBuddy。

蓝牙 GATT 客户端、分片协议与触控回执可先通过联调模拟体验。物理吧唧仍需对应 SDK 固件；真实审批、原生语音与从吧唧直接新建原客户端会话未接通。公网部署需要自己的域名和服务器。在线演示只使用模拟任务，不接入访客电脑。

[手机模拟视图](./?view=mobile) · [桌面小圆屏模拟视图](./?view=mini)


## 统一维护入口

[返回作品集](../../README.md)。此目录包含在线模拟器与 PC 伴侣程序源码；GitHub Pages 只运行静态演示，不会替访客连接本地客户端。
