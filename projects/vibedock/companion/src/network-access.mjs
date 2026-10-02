import {EventEmitter} from 'node:events';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {AppError} from './store.mjs';

const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const tools=new Set(['codex','workbuddy']);
const controlActions=new Set(['task.pin','task.focus','tasks.latest','task.open','voice.start','interaction.resolve','demo.session.create']);
export class NetworkAccess extends EventEmitter {
 constructor({store,now=Date.now,inviteMs=300000,sessionMs=86400000}={}){super();this.store=store;this.now=now;this.inviteMs=inviteMs;this.sessionMs=sessionMs;this.invites=new Map();this.sessions=new Map();this.attempts=new Map()}
 invite({role='viewer',name='我的设备'}={}){
  if(!['viewer','control'].includes(role))throw new AppError('请选择有效权限',400);
  this.prune();if(this.invites.size>=32)throw new AppError('待配对邀请过多，请稍后重试',429);
  const token=randomBytes(24).toString('base64url'),expiresAt=this.now()+this.inviteMs;
  this.invites.set(digest(token),{role,name:String(name).slice(0,60),expiresAt});return {invite:token,role,expiresAt};
 }
 pair(token,{peer='unknown',name}={}){
  this.prune();const attempts=this.attempts.get(peer)||{count:0,until:this.now()+60000};
  if(attempts.count>=10)throw new AppError('配对尝试过多，请一分钟后重试',429);
  attempts.count++;this.attempts.set(peer,attempts);
  const hash=digest(token),invite=this.invites.get(hash);
  if(typeof token!=='string'||token.length>128||!invite||invite.expiresAt<=this.now())throw new AppError('配对链接已过期或已被使用，请在电脑重新生成',401);
  if(this.sessions.size>=64)throw new AppError('已配对设备过多，请先移除旧设备',429);
  this.invites.delete(hash);this.attempts.delete(peer);
  const credential=randomBytes(32).toString('base64url');
  const session={id:randomUUID(),name:String(name||invite.name).slice(0,60),role:invite.role,key:randomBytes(32).toString('hex'),createdAt:this.now(),expiresAt:this.now()+this.sessionMs,tool:this.store.activeTool,selected:null,view:0,actions:new Map()};
  this.sessions.set(digest(credential),session);this.emit('change');return {credential,...this.describe(session)};
 }
 session(credential){const s=typeof credential==='string'?this.sessions.get(digest(credential)):null;if(!s||s.expiresAt<=this.now())throw new AppError('设备尚未配对或授权已过期，请重新配对',401);return s}
 describe(s){return {key:s.key,access:{id:s.id,name:s.name,role:s.role,expiresAt:s.expiresAt},snapshot:this.snapshot(s)}}
 snapshot(s){
  const data=structuredClone(this.store.snapshot(s.tool));
  const selected=this.store.tools[s.tool].tasks.find(t=>t.id===s.selected);
  if(selected){data.selected=s.selected;if(!data.tasks.some(t=>t?.id===s.selected))data.detailTask=structuredClone(selected)}
  data.epoch=`${data.epoch}.${s.id}.${s.view}`;data.events=[];
  data.access={id:s.id,role:s.role};data.deviceConnected=true;
  for(const t of [...data.tasks,data.detailTask]){if(!t)continue;if(t.evidence){delete t.evidence.path;delete t.evidence.file}if(s.role==='viewer')t.capabilities={...t.capabilities,approve:false,nativeVoice:false,openTask:false}}
  return data;
 }
 async command(credential,key,message){
  const s=this.session(credential);if(key!==s.key)throw new AppError('操作授权无效，请重新连接',403);
  if(!message||message.v!==1||typeof message.actionId!=='string'||! /^[\w-]{8,80}$/.test(message.actionId))throw new AppError('无效动作',400);
  const fingerprint=digest(JSON.stringify(message)),previous=s.actions.get(message.actionId);
  if(previous){if(previous.fingerprint!==fingerprint)throw new AppError('动作标识已被用于其他请求');return {...await previous.promise,snapshot:this.snapshot(s)}}
  if(message.epoch!==this.snapshot(s).epoch||message.tool!==s.tool)throw new AppError('任务视图已变化，请同步后重试');
  if(s.actions.size>=128){const removable=[...s.actions].find(([,value])=>value.done);if(removable)s.actions.delete(removable[0]);else throw new AppError('设备操作过多，请稍后再试',429)}
  const entry={fingerprint,done:false};s.actions.set(message.actionId,entry);
  entry.promise=this.perform(s,message);
  try{const result=await entry.promise;entry.done=true;return result}catch(e){s.actions.delete(message.actionId);throw e}
 }
 async perform(s,message){
  if(message.type==='tool.select'){
   if(!tools.has(message.target))throw new AppError('未知工具',400);s.tool=message.target;s.selected=null;s.view++;
  } else if(message.type==='task.select'){
   if(!this.store.tools[s.tool].tasks.some(t=>t.id===message.taskId))throw new AppError('任务已移出读取范围');s.selected=message.taskId;
  } else {
   if(s.role!=='control'||!controlActions.has(message.type))throw new AppError('此设备仅可查看；请在电脑授权控制权限',403);
   const result=await this.store.command({...message,epoch:this.store.epoch,source:'pc'},{independentTool:true});
   if(message.taskId)s.selected=message.taskId;
   this.emit('view',s.id);
   return {...result,snapshot:this.snapshot(s)};
  }
  this.emit('view',s.id);return {v:1,type:'ack',actionId:message.actionId,ok:true,snapshot:this.snapshot(s)};
 }
 list(){this.prune();return [...this.sessions.values()].map(({id,name,role,createdAt,expiresAt})=>({id,name,role,createdAt,expiresAt}))}
 revoke(id){for(const [hash,s]of this.sessions)if(s.id===id){this.sessions.delete(hash);this.emit('revoke',id);this.emit('change');return true}return false}
 prune(){const now=this.now();for(const [k,v]of this.invites)if(v.expiresAt<=now)this.invites.delete(k);for(const [k,v]of this.sessions)if(v.expiresAt<=now){this.sessions.delete(k);this.emit('revoke',v.id)}for(const [k,v]of this.attempts)if(v.until<=now)this.attempts.delete(k);if(this.attempts.size>1024)this.attempts.clear()}
}
