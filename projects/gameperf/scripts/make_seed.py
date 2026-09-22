"""Design-time blueprint seed; no connected hardware or fabricated measurements."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def node(id, name, group, subtitle, inputs, outputs, gate, owner='待指定', status='planned', parentId='', notes=''):
    return dict(id=id, name=name, group=group, subtitle=subtitle, inputs=inputs, outputs=outputs, gate=gate, owner=owner, status=status, parentId=parentId, notes=notes, version=1)
nodes = [
 node('upper','上层产品 / 整机协同','governance','定义目标与约束，裁决跨域取舍','产品体验目标、交付要求','目标 / 硬约束 / 预算','目标与硬约束由责任人明确，不由优化 Agent 自行放宽'),
 node('orchestrator','游戏性能域编排','governance','你的团队级能力入口','设备、游戏、基线、目标、约束与预算','任务、依赖、路由、结果、证据与风险','每个任务只有一个结果负责人，具备停止与恢复条件',owner='游戏性能小组'),
 node('adapt','平台适配与基线','business','先明确能观察、能调、能改的边界','平台版本、工具链、设备条件','能力清单、软件基线、约束','可复现的基线；构建与恢复链路可用'),
 node('diagnose','复现与瓶颈诊断','business','把体验问题转成可检验假设','问题、场景、Trace 与实验记录','复现条件、瓶颈假设、实验计划','证据支持下一步；证据不足时补采集'),
 node('optimize','参数 / 策略 / 代码优化','business','选最小可验证改动，不默认改代码','机制假设、允许动作、资源预算','参数候选、策略候选、隔离补丁','在授权范围内提出可恢复候选'),
 node('validate','独立回归与送测','business','收益与副作用都要有证据','候选版本、固定基线、验收版本','证据包、风险、回滚方案','真机对照与独立审核；正式发布另行授权'),
 node('feedback','媒体评测与用户反馈','business','外部结论转成可复现问题','媒体测评、用户反馈、设备与版本','新任务、新场景、问题优先级','无法复现则保留待验证；不是自动改代码指令'),
 node('tuner','现有高通参数调优 Agent','agent','保留已有实现，通过适配接口接入','任务与参数空间、边界与预算','参数候选、实验结果、原始证据','按用户描述已有；本工作台尚未建立连接',status='existing',parentId='optimize'),
 node('cpu','CPU 调度分析','capability','按需调用，不要求常驻 Agent','调度 Trace、线程信息','机制假设、可观察证据','与 GPU / 温控等证据交叉验证',parentId='diagnose'),
 node('gpu','GPU 与渲染分析','capability','区分渲染瓶颈和资源等待','渲染链路与 GPU 指标','瓶颈证据与实验建议','不将插帧显示帧率等同真实渲染吞吐',parentId='diagnose'),
 node('thermal','温控 / 功耗分析','capability','关注持续表现而非短时峰值','温度、功耗、初始状态','约束检查与持续性能结论','不得绕过温控和稳定性保护',parentId='diagnose'),
 node('evolution','Agent 方法自改进','evolution','让研发方法变强，不只让产品变好','历史任务、失败记录、成本','诊断 / 搜索 / 工具 / 流程候选版本','独立任务、可比较预算、对照旧版后才可晋升'),
 node('judge','独立验收与证据','assurance','真实工具结果优先于 Agent 自述','基线、候选、原始证据、留出任务','独立判断、验收版本、审核记录','候选提交者不可自行审核；本版仅提供人工审核记录，不执行真实评测'),
 node('lab','设备实验与资源管理','shared','排队、互斥、恢复','设备、实验计划、预算','执行记录、设备状态','后续接入；当前不执行刷机与真机任务'),
 node('build','构建 / 刷机 / 采集','shared','可靠的确定性工具','候选代码与采集配置','构建物、Trace、恢复结果','后续接入；敏感数据只进入批准环境'),
 node('knowledge','知识与证据库','shared','沉淀适用范围，而非只保存总结','成功 / 失败实验与原始证据引用','可追溯经验、适用与失效条件','只保存引用和结构化记录，首版不上传大日志'),
 node('version','版本 / 权限 / 审计','shared','把边界落实到接口','用户身份、允许动作、版本','版本记录、权限判定、操作审计','服务器端执行；不授予工作台远程命令执行权限'),
]
seed = dict(schemaVersion=1, project=dict(name='游戏性能智能研发体系', tagline='让业务形成闭环，让方法持续变强。', owner='游戏性能小组', goal='覆盖游戏体验全生命周期，以真实实验为依据，受控改进优化方法。',version=1), nodes=nodes,tasks=[],experiments=[],evolutions=[],feedback=[], audit=[])
(ROOT/'app/seed.json').write_text(json.dumps(seed,ensure_ascii=False,indent=2))
demo=json.loads(json.dumps(seed))
base=dict(owner='示例负责人', device='示例设备 A', game='示例游戏 A', baseline='baseline-demo', objective='在既定温控与画质约束下改善长帧',constraints='温控保护不变；画质不降；稳定性不退化',budget='待确认真机实验次数',stopCondition='达到预算、触发保护或关键回归时停止',allowedActions='仅白名单参数；不修改底层代码',evalVersion='eval-demo-v1',sample=True,version=1)
demo['tasks']=[dict(base,id='demo-task-1',title='团战场景长帧：建立复现与基线',status='diagnosing',stageId='diagnose',priority='high',notes='示例记录，无真实设备连接。先核对初始温度与场景一致性。'),dict(base,id='demo-task-2',title='现有调参 Agent 接口适配',status='planned',stageId='optimize',priority='high',notes='示例：让已有 Agent 回传任务、候选、实验与证据引用。'),dict(base,id='demo-task-3',title='媒体卡顿反馈转化为实验任务',status='planned',stageId='feedback',priority='normal',notes='示例：先补充版本和复现条件，不直接触发代码修改。')]
demo['experiments']=[dict(id='demo-exp-1',title='白名单参数候选 A',taskId='demo-task-1',hypothesis='检查关键线程等待是否与长帧相关',baseline='baseline-demo',candidate='params-demo-a',device='示例设备 A',game='示例游戏 A',scene='团战回放 / 示例',environment='起始温度、室温、电量待补',repeats=0,p95Baseline=None,p95Candidate=None,powerBaseline=None,powerCandidate=None,tempCandidate=None,evidence='',notes='仅为录入样式示例；所有测量值为空。',status='draft',sample=True,version=1)]
demo['evolutions']=[dict(id='demo-evo-1',title='先诊断再搜索：减少无效参数实验',kind='workflow',oldVersion='agent-demo-v1',candidateVersion='agent-demo-v2',modelVersion='待记录',evalVersion='待冻结',holdout='待指定独立任务集',budget='旧版与新版使用可比真机预算',result='尚未实验，不代表能力已经提升',evidence='',notes='示例候选，与产品代码优化独立验收。',status='draft',sample=True,version=1)]
demo['feedback']=[dict(id='demo-feedback-1',title='复杂场景偶发卡顿',source='用户反馈',device='示例设备 A',game='示例游戏 A',baseline='待补充',description='待补复现步骤与日志；当前不能直接归因于调度。',status='unverified',sample=True,version=1)]
(ROOT/'web/seed.js').write_text('window.GP_SEED = '+json.dumps(seed,ensure_ascii=False)+';\nwindow.GP_DEMO = '+json.dumps(demo,ensure_ascii=False)+';\n')
