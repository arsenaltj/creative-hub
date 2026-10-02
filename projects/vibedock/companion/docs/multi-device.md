# VibeDock 0.6：PC、手机、吧唧

一份 PC 服务读取 Codex / WorkBuddy，一份圆屏界面适配不同屏幕。新增连接不会补足原客户端尚未提供的审批、语音和新会话控制权限。

| 端 / 网络 | 当前交付 | 使用方式 | 验证边界 |
|---|---|---|---|
| Windows PC | 工作台；置顶小窗；托盘隐藏与退出 | Windows 下载包或源码 | 本机窗口与打包验证结果见 verification.md |
| 手机 / 其他电脑 | 自适应圆屏、任务详情、输出节选、工具用量 | 浏览器扫码配对；HTTPS 下可安装 PWA | 375/390px 浏览器验收；尚未用实体手机验收 |
| 局域网 | 单独的 LAN 服务、二维码、查看/控制权限、实时推送 | PC「多端连接」开启；同一 Wi-Fi 访问 | 自动化验证；防火墙与路由需按用户环境配置 |
| 广域网 | 可自部署的 HTTPS 中继；PC 主动连接；跨网访问 | 域名 + Docker 部署；PC 连接中继后扫码 | 真实 WebSocket/HTTP/SSE 链路在本机通过；公网服务器尚未部署 |
| 蓝牙吧唧 | PC Web Bluetooth GATT 客户端、分片协议、触控回执、联调模拟 | PC 本机 Chrome / Edge 选设备；设备实现指定协议 | 协议与联调模拟通过；尚未连接物理吧唧 |
| 固件 | C 协议头文件和 SDK 接入说明 | 将 BLE 与 UI 接到板型 SDK | 没有可烧录固件；仍需 SDK 工程、板型和编译工具链 |

## 第一遍使用

1. 从 GitHub Releases 下载 Windows 包并解压。桌面包运行 `VibeDock.exe`；浏览器包运行 `Start-VibeDock.cmd`。首次打开 PC 工作台确认本机 Codex / WorkBuddy 数据来源。
2. 先体验模拟任务；点圆屏中央进入触控菜单。四区中没有屏幕外实体按键；切工具要进入二级选择页。
3. 同一 Wi-Fi 的手机：PC 工作台 →「多端连接」→「开启局域网」→ 默认「仅查看」→ 生成二维码 → 手机扫描。多网卡时选择实际 Wi-Fi 地址。
4. 手机切换工具、选择任务不改变 PC 的当前工具。已授权控制的手机可改变共享的任务槽位；查看权限只读任务，区外任务通过独立详情阅读。
5. 外出使用：按下文部署中继，在 PC 输入服务器域名和连接密钥。等待显示已连接，再用「广域网」生成新的邀请。
6. 电脑关闭或睡眠时，手机显示离线并禁用动作。授权默认 24 小时；电脑重启需重新配对。PC「已配对设备」可立即撤销设备，远端停止收到快照。

局域网默认 HTTP，仅用于自己可信的专用网络。若 Windows 阻止访问，允许此应用的专用网络连接，或由管理员为 TCP 47832 添加仅限专用网络与本地子网的入站规则。不要将 LAN 端口映射到公网。可设置 `VIBEDOCK_TLS_CERT` 和 `VIBEDOCK_TLS_KEY` 启用 LAN HTTPS，证书需要手机信任且匹配访问地址。公网使用 HTTPS 中继。

## 广域网部署

每个中继实例连接一台 PC，多台 PC 可使用各自的域名与实例。服务器需要 Docker Compose、可解析到服务器的域名，以及 80/443 入站端口。

```sh
# 在 companion 目录安装 Node 24 后运行（也可在本机生成配置并安全复制 deploy/.env）
npm ci
npm run relay:init -- --domain vibedock.your-domain.com
cd deploy
docker compose up -d --build
```

初始化生成 `deploy/.env` 中的随机密钥，不会输出密钥，不覆盖已有配置。这个私有文件被 Git 忽略。PC 工作台填 `https://vibedock.your-domain.com`，把该文件的 `VIBEDOCK_RELAY_HOST_KEY` 值复制到服务器连接密钥输入框。密钥只留在 PC 服务内存；重启 PC 后重新填写，或通过私有启动环境设置 `VIBEDOCK_RELAY_URL` / `VIBEDOCK_RELAY_HOST_KEY`。不要把密钥放在 GitHub、邀请链接或聊天里。

查看 `https://你的域名/health` 应返回 `ok:true`；PC 连接后 `pcOnline:true`。`docker compose logs --tail=50` 用于排查启动与证书问题。停止：`docker compose down`。域名尚未解析或 80/443 不能访问时，证书签发不会成功。

GitHub Pages 只能提供静态模拟演示，无法代替中继服务器、读取访客的 PC 状态或接收实时控制。

## 蓝牙接入

在 PC 的 `http://127.0.0.1:47831` 用 Chrome / Edge 打开「多端连接 → 蓝牙吧唧」。必须由用户点击并在系统选择器中选设备。连接目标是实现 [固件协议](../firmware/README.md) 的 BLE 外设，不会自动将现有普通音频吧唧变成此协议设备。当前可先点「联调模拟」再点「模拟点击分区 1」，验证快照、分片和控制回执。

手机优先通过 LAN / WAN 连接 PC；不要求手机浏览器支持 BLE。吧唧声音仍走 Windows 已识别的麦克风与扬声器。真实语音入口仍需接入 Codex / WorkBuddy，VibeDock 不转写语音。

## 权限与数据

| 配对权限 | 可以做 | 不提供 |
|---|---|---|
| 仅查看（默认） | 工具切换、读四区/区外详情、输出节选、用量 | 改槽位、批准/拒绝、语音、在 PC 打开任务、新建 |
| 允许控制 | 上述查看；选择槽位；在 PC 打开允许的任务；模拟审批/新会话/语音 | 管理服务、填写客户端 Token、重置任务、绕过原客户端能力限制 |
| PC 本机 | 管理连接、发邀请、撤销设备、选数据源 | 自动获得原客户端尚未接入的审批/语音权限 |

邀请 5 分钟有效且只能使用一次；邀请码在 URL fragment 中，配对后从地址栏移除。远端使用 HttpOnly 会话 Cookie 与独立操作校验；公网 Cookie 为 Secure。同源、权限、过期、重复动作和旧任务上下文都由服务器校验。授权设备将看到任务标题、摘要、可读输出与用量，请仅授权自己的设备。

中继不把任务快照写入磁盘；部署服务器会在内存中转发任务和认证数据，当前没有应用层端到端加密。TLS 保护传输，服务器必须由你信任。PC 不向远端提供 Codex / WorkBuddy 登录凭据。PWA 只缓存静态外壳，不缓存任务 API；刷新或离线启动时没有离线任务副本。

## 源码与构建

```sh
npm ci
npm start                    # 本机工作台
npm ci --prefix desktop
npm run desktop              # 原生桌面小窗
npm run build:desktop        # 当前系统 x64 打包；本版 Windows 验收
npm run relay                # 配置环境变量后启动中继，可用于自有 HTTPS 反代
npm test
npm run check
```

界面入口：`/?view=mini` 桌面圆屏、`/?view=mobile` 手机、`/?view=device` 吧唧模拟器；`/` 为完整工作台。默认 PC 47831、LAN 47832、中继 8080，可用 `VIBEDOCK_PORT/VIBEDOCK_NETWORK_PORT/VIBEDOCK_RELAY_PORT` 调整。Node 22.13 以上支持源码运行，发布版使用 Node 24.15.0。桌面源码可在其他系统打包，但本次不声称已验收 macOS/Linux 原生应用。

浏览器验收脚本 `scripts/verify-ui.mjs` 需要已安装 Playwright 和浏览器，可用 `VIBEDOCK_PLAYWRIGHT_MODULE/VIBEDOCK_BROWSER_BIN` 指定；只启动示例数据服务，不读取真实任务。
