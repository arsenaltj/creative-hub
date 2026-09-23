import {open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export class HookObserver {
  constructor({file=fileURLToPath(new URL('../.local/codex-hook-events.jsonl',import.meta.url)),now=Date.now}={}){this.file=file;this.now=now;this.sessions=new Map();this.offset=0;this.remainder='';this.lastEventAt=null}
  consume(e){
    if(e?.v!==1||typeof e.sessionId!=='string'||typeof e.turnId!=='string'||!Number.isFinite(e.at)||e.at>this.now()+5000)return;
    let s=this.sessions.get(e.sessionId);
    if(s && e.at<s.at)return;
    if(s && s.turnId!==e.turnId && (s.retired.has(e.turnId)||['PostToolUse','Stop','Interrupt'].includes(e.event)))return;
    if(!s||s.turnId!==e.turnId){
      const retired=s?.retired||new Set();if(s)retired.add(s.turnId);
      if(retired.size>100)retired.delete(retired.values().next().value);
      s={turnId:e.turnId,at:e.at,pending:new Map(),closed:false,retired};this.sessions.set(e.sessionId,s);
    }
    s.at=e.at;this.lastEventAt=Math.max(this.lastEventAt||0,e.at);
    if(e.event==='UserPromptSubmit'){s.pending.clear();s.closed=false}
    if(['Stop','Interrupt'].includes(e.event)){s.pending.clear();s.closed=true}
    if(e.event==='PermissionRequest'&&!s.closed&&typeof e.callHash==='string')s.pending.set(e.callHash,{at:e.at,tool:e.tool});
    if(e.event==='PostToolUse')s.pending.delete(e.callHash);
  }
  async read(){
    let h;try{
      h=await open(this.file,'r');const {size}=await h.stat();
      if(size<this.offset){this.offset=0;this.remainder='';this.sessions.clear()}
      if(size-this.offset>2*1024*1024){this.offset=size-2*1024*1024;this.remainder='';this.sessions.clear();this.skipFirst=true}
      if(size===this.offset)return;
      const bytes=Buffer.alloc(size-this.offset);const {bytesRead}=await h.read(bytes,0,bytes.length,this.offset);this.offset+=bytesRead;
      let data=this.remainder+bytes.subarray(0,bytesRead).toString('utf8');
      if(this.skipFirst){data=data.slice(data.indexOf('\n')+1);this.skipFirst=false}
      const lines=data.split('\n');this.remainder=lines.pop();
      for(const line of lines){try{this.consume(JSON.parse(line))}catch{}}
      for(const [id,s] of this.sessions)if(this.now()-s.at>86400000)this.sessions.delete(id);
    }catch{}finally{await h?.close()}
  }
  overlay(task){
    const s=this.sessions.get(task.id);if(!s||!s.pending.size||s.closed)return task;
    const newest=Math.max(...[...s.pending.values()].map(p=>p.at));
    // A later lifecycle event (or another turn) invalidates an old pending request.
    if(task.evidence?.turnId && task.evidence.turnId!==s.turnId)return task;
    if((task.evidence?.at||0)>newest && ['completed','paused'].includes(task.state))return task;
    const stale=this.now()-newest>180000;
    return {...task,state:stale?'unknown':'waiting',stateLabel:stale?'审批状态待核对':'请求审批',
      summary:'Codex 发出了权限请求。打开原任务核对并处理；本工具不会代替你批准。',
      statusNote:stale?'审批信号超过 3 分钟，尚无匹配的执行结果，请在原任务核对':'收到原生 PermissionRequest 信号；可能由用户或自动审查处理',
      evidence:{kind:'codex-hook',event:'PermissionRequest',at:newest,turnId:s.turnId,stale},approval:null};
  }
}
