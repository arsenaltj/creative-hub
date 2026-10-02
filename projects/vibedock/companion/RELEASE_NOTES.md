# VibeDock 0.6.0 · 多端预览版

下载 `VibeDock-Windows-Desktop-0.6.0.zip`，解压后运行 `VibeDock.exe`，获得可置顶、可隐藏到托盘的小圆屏。托盘菜单打开完整 PC 工作台，退出时停止由本程序启动的服务。

也可下载较小的 `VibeDock-Windows-Portable-0.6.0.zip`，解压后运行 `Start-VibeDock.cmd`，在浏览器中使用工作台。两个包都带 Node 运行时与依赖，无需另外安装。

本版新增手机圆屏、LAN 扫码配对、查看/控制权限、授权撤销，以及可自行部署的 HTTPS 广域网中继。PC 主动连接中继，配对手机通过服务器看任务。多端可以分别选择 Codex / WorkBuddy；控制设备改变任务槽位会同步到其他设备。PC 源码与部署文件在 `projects/vibedock/companion/`，详见 `docs/multi-device.md`。

蓝牙已提供 PC GATT 客户端、分片与回执协议、联调模拟，以及固件接入头文件。**尚未连接物理吧唧，没有可烧录固件**；需要对应 SDK 工程。公网部署需自己的域名/服务器，本仓库的 GitHub Pages 仍是模拟演示。

真实数据读取延续前版：Codex 部分任务状态、最新输出节选和已知用量；WorkBuddy 本地任务状态。真实审批、原生语音触发、直接创建原客户端新会话和 WorkBuddy 输出仍未接通。Windows 包为未签名预览软件，没有安装器或自动更新。
