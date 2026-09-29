# OrcaSlicer AI 3D Printing UX

> 让普通用户从一个想法或一张图片，快速完成AI创作并进入真实3D打印流程。

这是一套产品与架构资料，描述从输入、设计确认、3D生成、可选美颜、材料匹配到 Orca 原生准备、切片和打印的连续旅程。图中的连线是**目标工作流**，不是“全部步骤已经完成并通过实物验收”的声明。

**维护位置：** 本目录是 creative-hub 中的产品文档源。展示页、架构 SVG 和素材提示词也在 `projects/orca-prd/` 下；更新这些资料不需要向 OrcaSlicer 的集成分支提交文档。源码实现与测试证据仍指向 OrcaSlicer 的指定版本。

## 按角色阅读

| 角色 | 先读 | 重点 |
|---|---|---|
| 架构师 | [技术架构图](../assets/technical-architecture.svg) → [需求证据](Requirements-Evidence.md) | 系统边界、模块关系、数据流和当前缺口 |
| 测试 | [用户旅程](User-Journey.md) → [PRD 验收标准](PRD.md#10-验收标准) | 正常路径、不满意返回、失败恢复、版本与设备边界 |
| 领导 | [产品架构图](../assets/architecture-overview.svg) → [PRD 产品定位](PRD.md#1-产品定位) | 为什么做、用户价值、当前成果、后续方向 |

## 资料目录

| 资料 | 用途 |
|---|---|
| [PRD](PRD.md) | 产品目标、功能状态、状态与异常、验收和规划 |
| [User Journey](User-Journey.md) | 照片创作、已有模型、历史继续三条可测试路径 |
| [Requirements Evidence](Requirements-Evidence.md) | 需求 → Figma 节点 → 集成分支代码 → 测试关注点 |
| [产品架构图](../assets/architecture-overview.svg) | 用户价值链与阶段边界 |
| [用户旅程图](../assets/user-journey-overview.svg) | 正常路径、返回和失败恢复 |
| [技术架构图](../assets/technical-architecture.svg) | 设计、桌面模块、契约与原生打印链 |
| [在线展示页](https://arsenaltj.github.io/creative-hub/projects/orca-prd/) | 产品价值与架构的公开入口 |
| [展示素材提示词](../design-assets-prompts.md) | 只用于展示图片，不用于架构图或实现证明 |

## 当前成果与证据边界

- **代码证据基线：** OrcaSlicer `codex/team/integration` 的 `19a0b7f05e96c304b0a1e333a61d67643cb2e21b`（2026-09-28 静态核对）。这是文档引用的源码版本，不是本目录所在分支。代码存在仅证明该快照包含相应结构；本次未重新构建、运行 GUI、生成模型或启动打印机。
- **交接资料：** 本次整理所用的 `6pro/` 交接稿（PRD、旅程、需求证据和网页草稿）基于较新的 `a6d3743…` 模型生成快照及设计审查。它们提供需求与历史验证线索，不能直接当作本集成分支的运行验收。
- **Figma：** [框架节点 21:77](https://www.figma.com/design/EDEWtTOoWCBYt1FAezUArZ/?node-id=21-77) 和各功能节点是设计意图。按钮、文案和示例值不等于已实现、已接通或硬件能力。
- **当前能力：** 已能在源码中找到生成宿主与付费确认、`GeneratedModelArtifact`、`BeautyWorkbenchControls`、颜色意图契约、Orca Prepare、智能切片候选/应用/撤销，以及原生设备页面。跨页面全链路、组合格式、设备启动及实物效果各有待验证项，详见 [PRD §11](PRD.md#11-当前能力)。

## 架构原则

1. AI 生成结束于可校验的模型产物；Orca 拥有项目、预设、3MF、正式切片、G-code 与预览。
2. 原件、用户目标外观、打印材料近似和正式工程是不同对象。编辑与匹配不得悄悄覆盖原件。
3. 导入不隐式切片或改变预设；智能切片建议先比较，再显式应用，且需能撤销。
4. “去准备”“应用并切片”“启动设备”是不同动作。屏幕颜色和算法检查不能替代实物校准。

详细边界参见 OrcaSlicer 同一代码基线中的 [ADR-002](https://github.com/arsenaltj/OrcaSlicer/blob/19a0b7f05e96c304b0a1e333a61d67643cb2e21b/Docs/architecture/ADR-002-smart-slicing-transactional-workbench.md)、[ADR-006](https://github.com/arsenaltj/OrcaSlicer/blob/19a0b7f05e96c304b0a1e333a61d67643cb2e21b/Docs/architecture/ADR-006-six-channel-model-color-intent.md) 与 [打印颜色边界](https://github.com/arsenaltj/OrcaSlicer/blob/19a0b7f05e96c304b0a1e333a61d67643cb2e21b/Docs/domain/printing-color-boundaries.md)。实施状态仍以对应版本的源码与验证记录为准。
