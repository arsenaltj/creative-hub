# 前端继续开发指南

## 入口与状态

`web/index.html` 是服务器入口，`gp-mode=server`；`scripts/build_demo.py` 将相同的 CSS、seed、app 内联，输出 `gp-mode=demo` 的便携 HTML。不要直接编辑生成的 HTML 作为唯一源码。

`web/app.js` 维持 store/API 和视图；`web/styles.css` 保留原表单/记录基础规则，后半段是 v0.3 深空视觉与响应式覆盖。后续可按真实需求拆分模块，但不要为了形式添加大型依赖。

## 核心函数

| 函数 | 责任 |
|---|---|
| renderShell / renderPage | 导航、页路由、搜索入口、页尾 |
| overview / globalGraph | 目标、实际记录计数、稳定的核心全局图 |
| graphNode / insightPanel | 节点摘要、选中后的职责契约 |
| focusedGraph / extraMapNodes | 父子下钻、额外根节点与嵌套搜索 |
| selectNode / startTour / stopTour | 纯视图选择与说明性链路演示，不能触碰业务记录 |
| requirementsPage | 四方向需求、实现与规划边界；目标来自 project |
| openRecord / onSave | 共用表单与提交；真正授权由后端负责 |
| api / localMutation | 服务器写入或明确本机演示存储；不得静默互相回落 |

父子关系通过 nodes.parentId 维护；核心图的业务线是产品定义，不是运行链路或任意边编辑器。新增子能力会出现在下钻与目录；新增根能力出现在额外节点条中。

## 改动验收

1. UI 不将 example/sample、节点人工状态、装饰动效当作服务发现或实时实验。
2. 任何改动仍能导出旧数据并读取 schema 1；需要改 schema 时先设计迁移与回滚。
3. 不把伪造 HTML 标记、内联事件、未经验证链接或动态执行脚本放入节点内容。
4. 动画开关和系统 reduced-motion 优先；页面隐藏停止演示。
5. 完成源码变更后重新生成便携 HTML，运行接口与 UI 测试，并记录真实未测范围。

动效实现资料：https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion
