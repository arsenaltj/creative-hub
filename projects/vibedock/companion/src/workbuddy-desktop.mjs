import {DatabaseSync} from 'node:sqlite';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {taskIdValid} from './task-links.mjs';

export function mapDesktopState(raw){
  const value=String(raw || '').trim().toLowerCase();
  if(['working','planning','running','preparing','connecting'].includes(value))return 'running';
  if(['completed','done'].includes(value))return 'completed';
  if(['failed','error','errored'].includes(value))return 'failed';
  if(['terminated','cancelled','canceled','paused'].includes(value))return 'paused';
  // WorkBuddy also uses pending for new sessions that have never received a prompt.
  if(['pending','idle','await_input','waiting_input'].includes(value))return 'waiting';
  return 'unknown';
}
export function desktopTask(row,{online,now=Date.now()}={}) {
  const raw=String(row.status || '').toLowerCase(),reported=mapDesktopState(raw);
  const active=['running','waiting'].includes(reported);
  // Non-terminal rows can survive an application crash. Do not present old rows as live.
  const age=now-Math.max(row.last_activity_at || 0,row.updated_at || 0);
  const stale=active && (!online || age>180000);
  return {id:row.id,title:row.custom_title || row.title || '未命名任务',project:path.basename(row.cwd || '') || 'WorkBuddy',state:stale?'unknown':reported,
    stateLabel:reported==='waiting' && !stale?'等待 / 未开始':null,lastState:stale?reported:null,
    source:'WorkBuddy 本地状态库',statusNote:stale?'运行记录较旧或客户端离线，当前状态未确认':raw==='pending'?'本地记录 pending：等待输入或尚未开始，不能直接视作审批':'桌面状态库 · 每 2 秒读取 · 非官方对外 API',
    summary:raw==='pending'?'WorkBuddy 标记此任务等待输入或尚未开始。具体问题及权限请求请在原客户端核对。':`客户端记录状态：${raw || '未知'}。`,
    tokens:null,contextUsage:Number.isFinite(row.context_used)&&Number.isFinite(row.context_size)?{used:row.context_used,size:row.context_size}:null,
    updatedAt:row.updated_at || null,observedAt:now,output:null,approval:null,capabilities:{approve:false,nativeVoice:false,openTask:process.platform==='win32'&&taskIdValid(row.id)},
    evidence:{kind:'workbuddy-sqlite',at:row.updated_at || null,stale,rawState:raw}};
}

export class WorkBuddyDesktopAdapter {
  constructor({root=process.env.VIBEDOCK_WORKBUDDY_HOME || path.join(os.homedir(),'.workbuddy'),now=Date.now,onlineProbe}={}){this.root=root;this.now=now;this.onlineProbe=onlineProbe;this.db=null}
  async online(){
    if(this.onlineProbe)return this.onlineProbe();
    try {
      for(const name of (await readdir(path.join(this.root,'sessions'))).filter(n=>/^\d+\.json$/.test(n))){
        try{const record=JSON.parse(await readFile(path.join(this.root,'sessions',name),'utf8'));
          if(!Number.isInteger(record.pid)||!Number.isFinite(record.lastHeartbeat)||this.now()-record.lastHeartbeat>45000)continue;
          process.kill(record.pid,0);return true;
        }catch{}
      }
    }catch{}
    return false;
  }
  async read(){
    if(!this.db){this.db=new DatabaseSync(path.join(this.root,'workbuddy.db'),{readOnly:true});this.db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=800;')}
    const online=await this.online();
    const rows=this.db.prepare(`SELECT s.id,s.title,s.custom_title,s.cwd,s.status,s.updated_at,s.last_activity_at,
      u.used AS context_used,u.size AS context_size
      FROM sessions s LEFT JOIN session_usage u ON u.session_id=s.id
      WHERE s.deleted_at IS NULL AND lower(s.status) NOT IN ('archived','deleted')
      ORDER BY max(coalesce(s.last_activity_at,0),s.updated_at) DESC LIMIT 40`).all();
    const latest=rows.reduce((max,row)=>Math.max(max,row.updated_at || 0,row.last_activity_at || 0),0);
    const historyNote=latest && this.now()-latest>86400000?` 最近任务记录：${new Date(latest).toLocaleString('zh-CN')}；暂未读取到今天的新任务。`:'';
    return {tasks:rows.map(row=>desktopTask(row,{online,now:this.now()})),quota:[],quotaNote:'累计 Token 与账户额度未接入；任务详情可显示已记录的上下文占用',
      localOnline:online,provider:'desktop',scope:'本机 WorkBuddy',pollMs:2000,
      note:(online?'已连接本机 WorkBuddy 状态库，持续读取桌面任务。审批与原生语音仍由原客户端处理。':'可读取本地历史；暂未检测到新鲜的客户端心跳。')+historyNote};
  }
  close(){this.db?.close();this.db=null}
}
