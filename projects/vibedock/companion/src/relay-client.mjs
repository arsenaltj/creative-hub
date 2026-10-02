import WebSocket from 'ws';
import {AppError} from './store.mjs';

export class RelayClient {
 constructor({store,access,onStatus=()=>{}}={}){this.store=store;this.access=access;this.onStatus=onStatus;this.socket=null;this.timer=null;this.generation=0;this.status={connected:false,url:null,note:'未连接广域网服务器'};this.publish=()=>this.push();this.revoke=id=>this.send({event:'revoke',id});store.on('snapshot',this.publish);access.on('view',this.publish);access.on('revoke',this.revoke)}
 configure(url,key){
  let origin;try{origin=new URL(url)}catch{throw new AppError('请输入完整的广域网服务器地址',400)}
  if(origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||!['https:','http:'].includes(origin.protocol)||origin.protocol==='http:'&&!['localhost','127.0.0.1'].includes(origin.hostname))throw new AppError('广域网地址必须是 HTTPS 根地址；HTTP 仅限本机联调',400);
  if(typeof key!=='string'||key.length<32||key.length>256||/[\r\n]/.test(key))throw new AppError('服务器连接密钥至少需要 32 字符',400);
  this.disconnect();this.url=origin.origin;this.key=key;this.generation++;this.status={connected:false,url:this.url,note:'正在连接服务器'};this.connect(this.generation);this.onStatus();return this.status;
 }
 connect(generation){
  if(generation!==this.generation||!this.url)return;
  const address=new URL('/bridge',this.url);address.protocol=address.protocol==='https:'?'wss:':'ws:';
  const ws=new WebSocket(address,{headers:{Authorization:`Bearer ${this.key}`},maxPayload:1024*1024,handshakeTimeout:8000});this.socket=ws;
  ws.on('open',()=>{if(generation!==this.generation)return;this.status={connected:true,url:this.url,note:'PC 已连接广域网服务器'};this.onStatus();this.push()});
  ws.on('message',async raw=>{
   let request;try{
    request=JSON.parse(String(raw));if(!request.id||typeof request.id!=='string'||request.id.length>80)throw Error();
    let value;const {path,credential,key,data,peer}=request;
    if(path==='/api/pair')value=this.access.pair(data?.invite,{peer:'relay:'+String(peer).slice(0,80),name:data?.name});
    else {const s=this.access.session(credential);if(path==='/api/session')value=this.access.describe(s);else if(path==='/api/state')value=this.access.snapshot(s);else if(path==='/api/command')value=await this.access.command(credential,key,data);else if(path==='/api/logout'){if(key!==s.key)throw new AppError('操作授权无效',403);this.access.revoke(s.id);value={ok:true}}else throw new AppError('未知远程接口',404)}
    if(this.socket===ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({id:request.id,status:200,value}));
   }catch(e){if(request?.id&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({id:request.id,status:e.status||500,value:{error:e instanceof AppError?e.message:'PC 暂时无法完成请求'}}))}
  });
  ws.on('error',()=>{});
  ws.on('close',()=>{if(generation!==this.generation)return;this.status={connected:false,url:this.url,note:'与服务器断开，正在重连'};this.onStatus();this.timer=setTimeout(()=>this.connect(generation),5000);this.timer.unref()});
 }
 send(message){if(this.socket?.readyState===WebSocket.OPEN&&this.socket.bufferedAmount<1024*1024)this.socket.send(JSON.stringify(message))}
 push(){for(const s of this.access.sessions.values())if(s.expiresAt>Date.now())this.send({event:'snapshot',id:s.id,snapshot:this.access.snapshot(s)})}
 disconnect(){this.generation++;clearTimeout(this.timer);this.socket?.terminate();this.socket=null;this.url=null;this.key=null;this.status={connected:false,url:null,note:'未连接广域网服务器'};this.onStatus()}
 close(){this.disconnect();this.store.off('snapshot',this.publish);this.access.off('view',this.publish);this.access.off('revoke',this.revoke)}
}
