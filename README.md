# 创意实验室 · Creative Hub

👉 [打开统一作品集](https://arsenaltj.github.io/creative-hub/)

统一管理 VibeDock 与栖伴两个演示项目的源码、文档和在线入口。源码位于 projects/vibedock/ 和 projects/qiban/。原独立仓库与演示地址保留为旧版，此后以本仓库为维护入口。

| 项目 | 类型 | 演示 | 源码 |
|---|---|---|---|
| VibeDock | 交互原型 | [在线演示](https://arsenaltj.github.io/creative-hub/projects/vibedock/) | [源码](https://github.com/arsenaltj/creative-hub/tree/main/projects/vibedock) |
| 栖伴 QIBAN | 交互原型 | [在线演示](https://arsenaltj.github.io/creative-hub/projects/qiban/) | [源码](https://github.com/arsenaltj/creative-hub/tree/main/projects/qiban) |

## 如何维护

修改项目时直接编辑 projects/ 对应目录。修改作品介绍时编辑 projects.json，然后运行 node build.mjs，提交 projects.json、index.html 和 README.md。GitHub Pages 从 main 分支根目录自动发布。修改页面设计时编辑 template.html 和 style.css。

- 只包含这两个项目已公开的演示源码。VibeDock 本机 PC 服务端、固件、SDK 和凭证不在本仓库。
- 在线原型的状态和数据为模拟，不能视为真实硬件或客户端能力已交付。
- 普通网页访问者只能浏览。自动更新需具备仓库写入权限的开发工具；不要把令牌写入仓库。
