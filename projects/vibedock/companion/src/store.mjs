import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
import {CodexAdapter,WorkBuddyAdapter,demoData} from './adapters.mjs';
import {WorkBuddyDesktopAdapter} from './workbuddy-desktop.mjs';
import {openDesktopTask} from './task-links.mjs';

export class AppError extends Error {constructor(message,status=409){super(message);this.status=status}}
const requireThat=(condition,message,status)=>{if(!condition)throw new AppError(message,status)};
const validTool=t=>['codex','workbuddy'].includes(t);
export class Companion extends EventEmitter {
  constructor({adapters,defaultMode='demo',taskOpener=openDesktopTask,preferences=null}={}) {
    super();this.adapters=adapters || {codex:new CodexAdapter(),workbuddy:process.env.VIBEDOCK_WORKBUDDY_TOKEN?new WorkBuddyAdapter({token:process.env.VIBEDOCK_WORKBUDDY_TOKEN}):new WorkBuddyDesktopAdapter()};
    this.preferences=preferences;this.savedPreferences=preferences?.read() || {activeTool:'codex',slots:{codex:[],workbuddy:[]}};
    this.taskOpener=taskOpener;this.activeTool=validTool(this.savedPreferences.activeTool)?this.savedPreferences.activeTool:'codex';this.instanceId=randomUUID();this.epoch=randomUUID();this.revision=0;this.deviceConnected=true;this.results=new Map();this.events=[];
    this.tools=Object.fromEntries(['codex','workbuddy'].map(tool=>[tool,{mode:defaultMode,...demoData(tool),provider:'desktop',pollMs:2000,slots:[],selected:null,connected:true,lastSync:null,error:null,generation:0,busy:false}]));
    for(const tool of Object.keys(this.tools)) {const s=this.tools[tool];if(s.mode==='live'){s.tasks=[];s.quota=[];s.quotaNote='等待真实额度';s.scope=tool==='codex'?'本机 Codex':'本机 WorkBuddy';s.connected=false;s.note='正在连接本机客户端…'}this.assign(tool)}
  }
  assign(tool,reset=false) {
    const s=this.tools[tool],ids=new Set(s.tasks.map(t=>t.id));
    if(reset)s.slots=[];
    s.slots=Array.from({length:4},(_,i)=>ids.has(s.slots[i])?s.slots[i]:null);
    for(const task of s.tasks) {if(s.slots.includes(task.id))continue;const index=s.slots.indexOf(null);if(index<0)break;s.slots[index]=task.id}
    if(!s.slots.includes(s.selected))s.selected=s.slots.find(Boolean)||null;
  }
  savePreferences(){
    if(!this.preferences)return;
    const next={activeTool:this.activeTool,slots:{...this.savedPreferences.slots}};
    for(const tool of ['codex','workbuddy']){const s=this.tools[tool];if(s.mode==='live' && s.restored && s.connected)next.slots[tool]=s.slots.slice()}
    try{this.preferences.write(next);this.savedPreferences=next}
    catch{this.log('!', 'preferences.write','未能保存任务分区设置')}
  }
  snapshot() {
    const s=this.tools[this.activeTool];
    const tasks=s.slots.map(id=>s.tasks.find(t=>t.id===id)||null);
    const known=tasks.filter(t=>t && t.tokens!==null),unknown=tasks.filter(t=>t && t.tokens===null).length;
    return {v:1,type:'snapshot',instanceId:this.instanceId,epoch:this.epoch,revision:this.revision,tool:this.activeTool,mode:s.mode,provider:s.provider,pollMs:s.pollMs,scope:s.scope,connected:s.connected,deviceConnected:this.deviceConnected,
      lastSync:s.lastSync,error:s.error,note:s.note,busy:s.busy,tasks,availableTasks:s.tasks.map(t=>({id:t.id,title:t.title,state:t.state,updatedAt:t.updatedAt})),selected:s.selected,
      hookStatus:s.hookStatus || null,hookLastEventAt:s.hookLastEventAt || null,
      attention:s.tasks.filter(t=>t.state==='failed' || t.state==='waiting' && (this.activeTool==='codex' || !!t.approval)).map(t=>({id:t.id,title:t.title,state:t.state,label:t.stateLabel || (t.state==='failed'?'任务异常':'需要回应'),inSlots:s.slots.includes(t.id)})),
      usage:{tokens:known.length?known.reduce((sum,t)=>sum+t.tokens,0):null,known:known.length,unknown,quota:s.quota,quotaNote:s.quotaNote},localOnline:s.localOnline,
      integrations:Object.fromEntries(Object.entries(this.tools).map(([name,t])=>[name,{mode:t.mode,connected:t.connected,error:t.error}])),events:this.events.slice(-12)};
  }
  publish(){this.revision++;this.emit('snapshot',this.snapshot())}
  log(direction,type,result){this.events.push({time:Date.now(),direction,type,result});if(this.events.length>50)this.events.shift()}
  async refresh(tool=this.activeTool,{visible=false}={}) {
    const s=this.tools[tool];if(s.mode!=='live' || s.busy)return;
    const generation=s.generation;s.busy=true;if(visible)this.publish();
    try {
      const data=await this.adapters[tool].read();if(s.generation!==generation)return;
      if(!s.tasks.length && data.tasks.length)this.log('↓',`${tool}.snapshot`,`读取 ${data.tasks.length} 项`);
      for(const task of data.tasks){const previous=s.tasks.find(t=>t.id===task.id);if(previous && previous.state!==task.state)this.log('↓',`${tool}.state`,`${task.id.slice(0,8)} ${previous.state} → ${task.state}`)}
      Object.assign(s,data,{connected:true,error:null,lastSync:Date.now()});
      if(!s.restored && s.mode==='live'){s.slots=this.savedPreferences.slots?.[tool] || [];s.restored=true}
      this.assign(tool);
    }
    catch(error){if(s.generation!==generation)return;s.connected=false;s.error=tool==='workbuddy'?(s.provider==='cloud'?error.message:'WorkBuddy 本地状态库暂不可读，请确认客户端已安装并打开。'):'Codex 读取失败，请确认本机已登录且 CLI 可启动。';s.note='保留最后快照；恢复连接前禁用操作。'}
    finally {if(s.generation===generation){s.busy=false;this.publish()}}
  }
  async command(msg) {
    requireThat(msg && msg.v===1 && typeof msg.actionId==='string' && /^[\w-]{8,80}$/.test(msg.actionId),'无效的协议或动作编号',400);
    const fingerprint=JSON.stringify(msg);const cached=this.results.get(msg.actionId);
    if(cached){requireThat(cached.fingerprint===fingerprint,'动作编号不能用于不同操作');return cached.promise}
    const promise=this.execute(msg).then(result=>({v:1,type:'ack',actionId:msg.actionId,ok:true,...result}));
    this.results.set(msg.actionId,{fingerprint,promise});
    if(this.results.size>1000)this.results.delete(this.results.keys().next().value);
    return promise;
  }
  async execute(m) {
    requireThat(['device','pc'].includes(m.source),'未知消息来源',400);
    requireThat(validTool(m.tool),'未知工具',400);
    requireThat(m.epoch===this.epoch,'上下文已变化，请同步后重试');
    requireThat(m.tool===this.activeTool,'当前工具已切换，请重新选择任务');
    const s=this.tools[m.tool];
    this.log('↑',m.type,'收到');
    if(m.type==='tool.select') {
      if(m.source==='device')requireThat(this.deviceConnected,'设备离线，请重新连接');
      requireThat(validTool(m.target),'未知工具',400);this.activeTool=m.target;this.epoch=randomUUID();this.savePreferences();
    } else if(m.type==='mode.set') {
      requireThat(['demo','live'].includes(m.mode),'未知模式',400);
      s.generation++;s.busy=false;s.mode=m.mode;s.error=null;s.lastSync=null;s.selected=null;s.slots=[];
      if(m.mode==='demo')Object.assign(s,demoData(m.tool),{connected:true});
      else Object.assign(s,{tasks:[],quota:[],quotaNote:'等待同步',connected:false,note:'正在接入真实数据…',scope:m.tool==='codex'?'本机 Codex':s.provider==='cloud'?'WorkBuddy 云端':'本机 WorkBuddy',localOnline:null,restored:false});
      this.assign(m.tool);this.epoch=randomUUID();
    } else if(m.type==='device.connection') {
      requireThat(typeof m.connected==='boolean','无效的连接状态',400);this.deviceConnected=m.connected;this.epoch=randomUUID();
    } else if(m.type==='tasks.latest') {
      this.assign(m.tool,true);this.epoch=randomUUID();this.savePreferences();
    } else if(m.type==='demo.reset') {
      requireThat(s.mode==='demo','真实数据不支持重置');Object.assign(s,demoData(m.tool));this.assign(m.tool,true);this.epoch=randomUUID();
    } else {
      if(m.source==='device')requireThat(this.deviceConnected,'设备离线，请重新连接');
      requireThat(s.connected,'工具连接已断开，请先同步');
      if(m.type==='task.focus'){
        const target=s.tasks.find(t=>t.id===m.taskId);requireThat(target,'任务已不在当前读取范围');
        if(!s.slots.includes(target.id)){const slot=Math.max(0,s.slots.indexOf(s.selected));s.slots[slot]=target.id;this.epoch=randomUUID()}
        s.selected=target.id;this.savePreferences();this.log('↓',m.type,'已定位');this.publish();return {simulated:s.mode==='demo'};
      }
      if(m.type==='task.pin'){
        requireThat(Number.isInteger(m.slot) && m.slot>=0 && m.slot<4,'请选择有效的分区',400);
        const target=s.tasks.find(t=>t.id===m.taskId);requireThat(target,'任务已不在当前读取范围');
        requireThat(!s.slots.includes(target.id),'任务已经在四区中');
        s.slots[m.slot]=target.id;s.selected=target.id;this.epoch=randomUUID();this.savePreferences();
        this.log('↓',m.type,`已放入分区 ${m.slot+1}`);this.publish();return {simulated:s.mode==='demo',slot:m.slot};
      }
      const task=s.tasks.find(t=>t.id===m.taskId);requireThat(task && s.slots.includes(task.id),'任务已移出当前四区');
      if(m.type==='task.select')s.selected=task.id;
      else if(m.type==='interaction.resolve') {
        requireThat(s.mode==='demo' && task.capabilities.approve,'此任务的真实审批通道尚未接入');
        const request=task.approval;
        requireThat(request && request.id===m.requestId && request.revision===m.requestRevision,'请求已处理或已过期，请查看最新状态');
        requireThat(request.decisions.includes(m.decision),'不支持该决定',400);
        requireThat(!request.pending,'这个请求正在处理，请等待回执');
        request.pending=true;this.publish();
        await new Promise(resolve=>setTimeout(resolve,180));
        // Simulated adapter receipt: a real adapter must use the original request/connection.
        // Guard against a mode reset while the receipt was in flight.
        requireThat(s.mode==='demo' && s.tasks.includes(task) && task.approval===request,'请求已被替换');
        task.state=m.decision==='accept'?'running':'paused';task.summary=m.decision==='accept'?'模拟适配器已确认批准，本轮继续执行。':'模拟适配器已确认拒绝，当前操作已暂停。';task.approval=null;task.capabilities.approve=false;
      } else if(m.type==='task.open' && s.mode==='live') {
        requireThat(task.capabilities.openTask,'此任务暂不支持打开原客户端');
        let result;try{result=await this.taskOpener(m.tool,task.id)}catch(error){throw new AppError(error.message,503)}
        this.log('↓',m.type,'已发送打开请求（未确认页面）');this.publish();return {simulated:false,taskId:task.id,tool:m.tool,...result};
      } else if(m.type==='voice.start' || m.type==='task.open') {
        requireThat(s.mode==='demo','原客户端的任务定位和原生语音控制尚未接通。请在原客户端操作。');
        this.log('↓',m.type,'模拟回执');this.publish();return {simulated:true,message:m.type==='voice.start'?'已模拟触发原生语音；没有录音或转写。':'已模拟定位任务；没有操作原客户端。'};
      } else if(m.type==='demo.state') {
        requireThat(s.mode==='demo','只能修改模拟任务');requireThat(['running','completed','failed','waiting'].includes(m.state),'无效状态',400);
        requireThat(!task.approval?.pending,'请求正在处理');task.state=m.state;
        task.summary='模拟场景状态已更新，设备通过服务端快照收到变化。';
        task.output=m.state==='waiting'?null:{kind:'latest-reply',text:`模拟任务状态已变为${{running:'执行中',completed:'已完成',failed:'异常'}[m.state]}。这是新的演示输出；完整内容请在原客户端查看。`,at:Date.now(),truncated:false};
        task.approval=m.state==='waiting'?{id:randomUUID(),revision:1,command:'npm run test -- --run',scope:'模拟工作区 · 仅本次',decisions:['accept','decline']}:null;
        task.capabilities.approve=!!task.approval;
      } else throw new AppError('不支持的消息类型',400);
    }
    this.log('↓',m.type,'已确认');this.publish();
    return {simulated:s.mode==='demo',message:'已同步'};
  }
  setWorkBuddyToken(token) {
    requireThat(typeof token==='string' && token.length>=10 && token.length<=8192 && !/[\r\n]/.test(token),'令牌格式无效',400);
    const s=this.tools.workbuddy;s.generation++;s.busy=false;this.adapters.workbuddy.close?.();this.adapters.workbuddy=new WorkBuddyAdapter({token});
    Object.assign(s,{mode:'live',provider:'cloud',pollMs:15000,tasks:[],slots:[],selected:null,quota:[],connected:false,error:null,lastSync:null,note:'正在连接 WorkBuddy…',scope:'WorkBuddy 云端',restored:false});
    this.epoch=randomUUID();this.publish();
  }
  useWorkBuddyDesktop(){
    const s=this.tools.workbuddy;s.generation++;s.busy=false;this.adapters.workbuddy.close?.();this.adapters.workbuddy=new WorkBuddyDesktopAdapter();
    Object.assign(s,{mode:'live',provider:'desktop',pollMs:2000,tasks:[],slots:[],selected:null,quota:[],connected:false,error:null,lastSync:null,note:'正在读取本机 WorkBuddy…',scope:'本机 WorkBuddy',restored:false});
    this.epoch=randomUUID();this.publish();
  }
  close(){for(const a of Object.values(this.adapters))a.close?.()}
}
