# Creative Hub 合并与发布记录

更新：2026-09-22。来源：arsenaltj/gameperf-studio @ b4b70a4ac2ece12959d25d3b06296b18ff779c41。

## 实现

- 完整工程归入 projects/gameperf/；原两个作品源码不变，原私有仓库不变。
- 主作品清单、生成器、首页和 README 增加 GamePerf；计数改为按清单生成。
- 同源 UI 生成离线文件和 Pages index.html，使用明确的 UTF-8，增加相对作品集回链。
- Pages 强制 demo 模式，connect-src none；无后端、无设备接入。编辑只存在当前浏览器，建议导出 JSON，不填写敏感资料。
- FastAPI、SQLite、权限、回传接口及部署脚本保留为源码；本次静态发布不声称它们已在服务器上线。

## 验收

- 本机 Node 24：6 项作品集检查通过；JavaScript 与 Python 语法检查通过。
- 本机未安装 pytest，未修改全局 Python 环境。隔离 Linux 测试环境运行相同后端代码，17 项通过（10.74s）；8 个关键源码/测试文件 SHA-256 与待提交版本一致。
- 作品首页、README、离线演示和 Pages 演示重复构建一致。
- 原两项目目录无修改；提交前敏感模式扫描未发现匹配，不等于完整安全审计。
- 真实 Chrome 通过本地 HTTP（非 set_content、无存储替身）完成 10 组检查：三张作品卡片、入口/回链、节点下钻、原生 localStorage 保存与刷新、十个桌面/手机路由、减少动效、无外部/API请求、原两作品渲染；未发现 JavaScript 异常。详情见 portfolio-browser-check.json。
- Pages 在 main 更新后自动发布；发布结果须以对应提交的 GitHub Actions 和在线 HTTP/内容核验为准。私人服务器后端未部署。
