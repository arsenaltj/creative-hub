import {readdir, stat, open} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {CodexRpc} from './rpc.mjs';
import {CodexEventReader} from './local-events.mjs';
import {HookObserver} from './hook-observer.mjs';
import {taskIdValid} from './task-links.mjs';

const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export async function findCodex() {
  if (process.env.VIBEDOCK_CODEX_BIN) return process.env.VIBEDOCK_CODEX_BIN;
  if (process.platform === 'win32') {
    const dir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'), 'OpenAI/Codex/bin');
    try {
      const candidates = await Promise.all((await readdir(dir)).map(async name => {
        const file = path.join(dir, name, 'codex.exe');
        try { return {file, time:(await stat(file)).mtimeMs}; } catch { return null; }
      }));
      const newest = candidates.filter(Boolean).sort((a,b)=>b.time-a.time)[0];
      if (newest) return newest.file;
    } catch { /* CLI on PATH is the fallback. */ }
  }
  return 'codex';
}

// A notLoaded thread belongs to another client. Never infer its live state from old turns.
export function codexTask(thread, turn) {
  const status = thread.status?.type;
  const flags = thread.status?.activeFlags || [];
  const state = status === 'active' ? (flags.some(f=>['waitingOnApproval','waitingOnUserInput'].includes(f)) ? 'waiting' : 'running')
    : status === 'systemError' ? 'failed' : 'unknown';
  const lastState = ({completed:'completed', interrupted:'paused', failed:'failed', inProgress:'running'})[turn?.status] || null;
  const message = turn?.items?.filter(i=>i.type === 'agentMessage').at(-1)?.text;
  return {
    id:thread.id, title:thread.name || thread.preview?.slice(0,70) || '未命名任务',
    project:path.basename(thread.cwd || '') || 'Codex', state, lastState,
    summary:message?.slice(0,3000) || thread.preview?.slice(0,1000) || '暂无可读取的任务摘要。',
    output:message?{kind:'latest-reply',text:message.slice(0,3000),at:thread.updatedAt ? thread.updatedAt * 1000 : null,truncated:message.length>3000}:null,
    source:'Codex 本地历史', statusNote: status === 'notLoaded' ? '原客户端拥有此任务；实时状态未接入' : '当前 App Server 可见状态',
    tokens:null, updatedAt:thread.updatedAt ? thread.updatedAt * 1000 : null,
    approval:null, capabilities:{approve:false, nativeVoice:false, openTask:false},
  };
}

export function quotaWindows(response) {
  const entries = response.rateLimitsByLimitId && Object.keys(response.rateLimitsByLimitId).length
    ? Object.entries(response.rateLimitsByLimitId) : [['codex', response.rateLimits]];
  return entries.flatMap(([id,bucket])=>['primary','secondary'].flatMap(key=>{
    const w=bucket?.[key];
    if (!w || !finite(w.usedPercent)) return [];
    const minutes=w.windowDurationMins;
    const duration=minutes ? (minutes>=1440 ? `${minutes/1440} 天` : `${minutes/60} 小时`) : key;
    return [{id:`${id}-${key}`,label:`${bucket.limitName || id} · ${duration}`,remaining:Math.max(0,Math.min(100,100-w.usedPercent)),resetsAt:w.resetsAt ? w.resetsAt*1000 : null}];
  }));
}

async function recordedTokens(file) {
  if (!file || path.extname(file) !== '.jsonl') return null;
  const root=path.resolve(process.env.CODEX_HOME || path.join(os.homedir(),'.codex'), 'sessions');
  const relative=path.relative(root,path.resolve(file));
  if(relative.startsWith('..') || path.isAbsolute(relative)) return null;
  let handle;
  try {
    handle=await open(file,'r'); const size=(await handle.stat()).size;
    const length=Math.min(size,2*1024*1024),buffer=Buffer.alloc(length);
    await handle.read(buffer,0,length,size-length);
    for(const line of buffer.toString('utf8').split('\n').reverse()) {
      let event; try {event=JSON.parse(line)} catch {continue}
      if(event.type !== 'event_msg' || event.payload?.type !== 'token_count') continue;
      const n=event.payload.info?.total_token_usage?.total_tokens;
      if(finite(n)) return n;
    }
  } catch { /* Missing/unreadable usage remains unknown, never zero. */ }
  finally {await handle?.close()}
  return null;
}

export class CodexAdapter {
  constructor({rpc, tokensReader=recordedTokens,eventReader=new CodexEventReader(),hookObserver=new HookObserver()}={}) {this.rpc=rpc;this.tokensReader=tokensReader;this.eventReader=eventReader;this.hooks=hookObserver;this.hookCheckAt=0;this.hookStatus='unknown';this.name='codex';this.connected=false;this.metadata=null;this.metadataAt=0;this.quotaAt=0;this.quota=[];this.turnCache=new Map();}
  async read() {
    if(!this.rpc) this.rpc=new CodexRpc({command:await findCodex()});
    if(!this.connected) {await this.rpc.start();this.connected=true;this.rpc.once('disconnected',()=>this.connected=false)}
    if(!this.metadata || Date.now()-this.metadataAt>5000){this.metadata=await this.rpc.call('thread/list',{limit:20,sortKey:'updated_at',useStateDbOnly:true});this.metadataAt=Date.now()}
    const list=this.metadata;
    await this.hooks.read();
    if(Date.now()-this.hookCheckAt>15000){
      try{const result=await this.rpc.call('hooks/list',{cwds:[process.cwd()]});
        const hooks=(result.data || []).flatMap(e=>e.hooks || []).filter(h=>h.command?.includes('codex-status-hook.mjs'));
        this.hookStatus=hooks.length>=5&&hooks.every(h=>h.enabled&&['trusted','managed'].includes(h.trustStatus))?'trusted':hooks.length?'needsReview':'notInstalled';
      }catch{this.hookStatus='unknown'}this.hookCheckAt=Date.now();
    }
    const tasks=await Promise.all((list.data || []).map(async thread=>{
      let cached=this.turnCache.get(thread.id);
      if(!cached || cached.updatedAt!==thread.updatedAt){try {cached={turn:(await this.rpc.call('thread/turns/list',{threadId:thread.id,limit:1})).data?.[0],updatedAt:thread.updatedAt};this.turnCache.set(thread.id,cached)}catch{}}
      const task=codexTask(thread,cached?.turn),events=await this.eventReader.read(thread.path);
      task.tokens=events?.tokens ?? await this.tokensReader(thread.path);
      if(events?.eventType){
        task.state=events.catchingUp?'unknown':events.state;
        task.source='Codex 本地生命周期事件';
        task.statusNote=events.stale?'最后记录仍在运行，但超过 3 分钟没有新事件；当前状态待确认':events.catchingUp?'正在补读本地事件':this.hookStatus==='trusted'?'每 2 秒跟踪本地事件；已启用审批信号辅助识别':'每 2 秒跟踪本地事件；审批信号尚未启用';
        task.evidence={kind:'codex-rollout',at:events.eventAt,activityAt:events.activityAt,event:events.eventType,stale:events.stale,turnId:events.turnId};
        task.lastState=null;task.observedAt=Date.now();task.updatedAt=events.eventAt || task.updatedAt;
        if(events.summary){task.summary=events.summary;task.output={kind:'latest-reply',text:events.summary,at:events.activityAt || events.eventAt,truncated:events.summary.length>=3000}}
      }
      task.capabilities.openTask=process.platform==='win32' && taskIdValid(task.id);
      return this.hooks.overlay(task);
    }));
    this.eventReader.prune((list.data || []).map(t=>t.path));
    if(Date.now()-this.quotaAt>60000){try{this.quota=quotaWindows(await this.rpc.call('account/rateLimits/read'));this.quotaNote=this.quota.length?'官方账户额度 · 最多每分钟更新':'账户额度暂不可用'}catch{this.quota=[];this.quotaNote='账户额度暂不可用'}this.quotaAt=Date.now()}
    return {tasks,quota:this.quota,quotaNote:this.quotaNote,hookStatus:this.hookStatus,hookLastEventAt:this.hooks.lastEventAt,
      note:`持续跟踪本机任务状态，可请求在原客户端打开任务。${this.hookStatus==='trusted'?'审批钩子已获信任，收到权限请求后显示提示。':this.hookStatus==='needsReview'?'审批钩子等待你在 Codex 设置中审阅；目前尚不能完整识别审批等待。':'审批事件钩子尚未启用，无法完整识别审批等待。'}`,
      scope:'本机 Codex',provider:'desktop',pollMs:2000,localOnline:null};
  }
  close(){this.rpc?.close();this.connected=false}
}

export function workbuddyTask(task) {
  const states={CREATING:'running',idle:'paused',planning:'running',working:'running',pending:'waiting',completed:'completed',failed:'failed',archived:'paused'};
  return {id:String(task.task_id),title:task.name || '未命名云端任务',project:'WorkBuddy 云端',state:states[task.status] || 'unknown',stateLabel:task.status==='pending'?'等待 / 待核对':null,lastState:null,
    summary:task.status==='pending'?'云端任务暂停或等待输入，请在原客户端核对具体请求。':'从官方 Open API 读取的云端任务。此列表不代表本地桌面全部任务。',
    source:'WorkBuddy 云端 API',statusNote:'轮询状态 · 非桌面任务列表',tokens:null,updatedAt:Date.parse(task.updated_at)||null,
    output:null,approval:null,capabilities:{approve:false,nativeVoice:false,openTask:false}};
}
export class WorkBuddyAdapter {
  constructor({token='',fetcher=fetch}={}){this.token=token;this.fetcher=fetcher}
  async get(route) {
    const response=await this.fetcher(`https://www.workbuddy.cn/openapi/v2/${route}`,{headers:{Authorization:`Bearer ${this.token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw new Error(response.status===401 || response.status===403 ? 'WorkBuddy 授权无效、已过期或缺少权限。' : `WorkBuddy 接口暂不可用（HTTP ${response.status}）。`);
    return response.json();
  }
  async read() {
    if(!this.token) throw new Error('尚未配置 WorkBuddy Open API 访问令牌，请在接入设置中填写。');
    const list=await this.get('tasks?page=1&size=20');
    if(!Array.isArray(list.tasks)) throw new Error('WorkBuddy 返回了无法识别的任务格式。');
    let localOnline=null;
    try {const status=await this.get('localassistant');if(status.code===0 && typeof status.data?.online==='boolean')localOnline=status.data.online} catch {}
    return {tasks:list.tasks.filter(t=>t.task_id && t.status!=='deleted').map(workbuddyTask),quota:[],quotaNote:'Open API 任务列表未提供 Token 和账户额度',localOnline,scope:'WorkBuddy 云端',provider:'cloud',pollMs:15000,
      note:'真实云端任务；本地助理在线状态单独显示。桌面任务、审批和原生语音尚未接入。'};
  }
  close(){this.token=''}
}

export function demoData(tool) {
  const codex=tool==='codex';
  const titles=codex?['官网深色模式','登录表单校验','项目启动说明','构建失败排查','版本发布检查']:['产品反馈汇总','竞品功能清单','会议纪要整理','周报资料收集','用户研究速记'];
  const states=['waiting','running','completed','failed','completed'];
  return {tasks:titles.map((title,i)=>({id:`${tool}-demo-${i+1}`,title,project:codex?'website':'workspace',state:states[i],lastState:null,
    summary:['等待你确认本次操作；批准后模拟恢复执行。','正在处理任务，可以模拟完成或异常。','本轮任务已完成，可以查看结果。','环境配置缺失，需要介入处理。','最近完成的任务尚未放入四区；选择一个位置后可在圆屏查看。'][i],
    output:i===0?null:{kind:'latest-reply',text:[null,'已完成页面结构与样式检查。正在核对移动端布局，随后会运行构建。','已更新项目启动说明，并检查了安装、运行和常见问题。完整改动请在电脑端原会话查看。','构建未通过：缺少必要的环境配置。请在电脑端查看错误详情并补齐配置后重试。','已整理本轮要点并标记下一步。点击任务可查看最新回复节选；完整内容仍在原客户端。'][i],at:Date.now(),truncated:false},
    source:'模拟适配器',statusNote:'演示状态，不会执行实际命令',tokens:codex?[32600,21400,14000,2800,1800][i]:[18400,null,9600,null,2000][i],updatedAt:Date.now(),
    approval:i===0?{id:`${tool}-request-1`,revision:1,command:codex?'npm run test -- --run':'创建 reports/feedback.md',scope:'模拟工作区 · 仅本次',decisions:['accept','decline']}:null,
    capabilities:{approve:i===0,nativeVoice:true,openTask:true}})),quota:codex?[{id:'demo-5h',label:'模拟 · 5 小时',remaining:64,resetsAt:null},{id:'demo-week',label:'模拟 · 每周',remaining:42,resetsAt:null}]:[],
    quotaNote:'模拟账户额度',note:'完整交互演示。任务、审批、语音触发均由模拟适配器响应。',scope:'模拟任务',localOnline:null};
}
