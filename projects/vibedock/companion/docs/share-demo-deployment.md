# 在线演示发布记录

2026-09-22 通过 Sites 发布，用户已选择“拿到链接的人都能看”。

- 地址：https://vibedock-demo.lingard1024.chatgpt.site
- 独立圆屏：https://vibedock-demo.lingard1024.chatgpt.site/?view=device
- 源码目录：`share-demo/`，独立 Git 仓库，只含模拟数据。
- Sites 项目：`appgprj_6ab2329a9f708191bc9edc6d5edfdbc6`，持久绑定见 `share-demo/.openai/hosting.json`。
- 版本：1，`appgprj_6ab2329a9f708191bc9edc6d5edfdbc6~appgver_fbe63e0075f08191b38d397d2fb07b59`。
- 发布：`appgdep_6ab234f201208191b06fd76778cbf596`，Sites 返回 succeeded。
- 已推送源码：`0c99ecb980f24d991d030e2755ba1f8c3fa5d208`。

分享版完全在浏览器中执行模拟动作，不向真实 Codex / WorkBuddy 发请求，不访问本地伴侣服务，不录音、不收集凭据。每个浏览器独立存储模拟状态，同一浏览器下两个页面可以同步。

部署包只含 `dist/` 和 `.openai/hosting.json`。未上传父工程内的真实任务、SDK、固件工具或本地配置。此次发布不改变本机版的运行方式。

验证：分享版新增两项测试通过，覆盖不允许真实模式、模拟状态隔离、静态资产没有网络适配器或令牌表单。本地浏览器验证模拟批准、两窗口同步、工具切换及模拟断连。线上页面加载验证通过。

线上验收补充：不携带登录凭据的 HTTP 请求返回 200；公开页面中的模拟批准成功切换为执行中，独立圆屏同步显示，未捕获页面 JavaScript 错误。验收后恢复为初始演示场景。

后续更新：在父工程执行 `node scripts/build-share-demo.mjs`，验证后提交并推送 `share-demo/`，从同一提交打包 `.openai/hosting.json` 与 `dist/`；复用当前 Sites 项目保存新版本并部署，不重新创建站点。

## GitHub Pages（2026-09-22）
- 用户反馈 Sites 无法打开后，改用 GitHub Pages。
- 公开地址：https://arsenaltj.github.io/vibedock-demo/
- 独立圆屏：https://arsenaltj.github.io/vibedock-demo/?view=device
- 仓库：https://github.com/arsenaltj/vibedock-demo
- 发布分支：main，根目录；HTTPS 已启用。
- 仅发布 share-demo/dist 的五个静态文件、README 与 .nojekyll；不包含主工程、本地数据、SDK 或凭证。
- scripts/build-share-demo.mjs 已改为相对资源和导航路径，适配子目录；两项演示隔离测试通过。
- 本地发布副本：.cache/github-pages；初始发布提交 b9b800a。
