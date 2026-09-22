# 栖伴 QIBAN · Android 桌面萌宠

[打开在线交互演示](https://arsenaltj.github.io/creative-hub/projects/qiban/) · [产品需求与技术方案](docs/PRD.md)

这是用于产品与技术评审的交互原型，不是 Android APK，也不是厂商正式产品。通知、电量、时间、权限和桌面状态均为模拟，不会读取访问者手机上的真实数据。

## 演示内容

点击「一键故事演示」查看连续体验，也可手动模拟消息提醒、拖动图标、触摸与拖动宠物、切换桌面、电量变化、充电、夜间陪伴、锁屏与离开桌面。网站包含用户旅程、技术架构和完整 PRD。

## 文件与运行

- `index.html`：自包含网站，原始文件完整保留。可直接用浏览器打开，无构建依赖。
- `docs/PRD.md`：从网站内嵌的 PRD 原文导出。
- `.nojekyll`：让 GitHub Pages 直接发布静态文件。

GitHub Pages 从 `main` 分支根目录发布。更新并提交 `index.html` 后，Pages 会重新部署。

## 版本校验

迁入演示 HTML：164573 字节。SHA-256：

`0b69638d152e8b3e450bbed4f5bdd8af28768e4ba4e56f99d49d58bd9aea9d4d`

## 原型边界

程序化角色与浏览器内模拟不代表 Android 原生渲染性能；真实系统权限、功耗、内存和 Launcher 集成仍需在 Android 工程验证。未接入 Kimodo 在线推理。

## 统一维护入口

[返回作品集](../../README.md)。此目录为统一仓库中的演示源码；更新请提交到 creative-hub。GitHub Pages 从总仓库根目录发布，本项目通过 projects/qiban/ 访问。
