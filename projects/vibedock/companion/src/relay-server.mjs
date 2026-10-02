import http from 'node:http';
import {timingSafeEqual,randomUUID} from 'node:crypto';
import {WebSocketServer} from 'ws';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {AppError} from './store.mjs';
import {securityHeaders,readJson,json,error,cookie,remoteCookie,serveAsset,sameOrigin} from './http-common.mjs';

export function createRelayServer({publicOrigin,hostKey}={}){
 const origin=new URL(publicOrigin);if(origin.origin!==publicOrigin||origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['127.0.0.1','localhost'].includes(origin.hostname)))throw Error('VIBEDOCK_PUBLIC_ORIGIN must be an HTTPS origin (HTTP only on loopback)');
 if(typeof hostKey!=='string'||hostKey.length<32||hostKey.length>256||/[\r\n]/.test(hostKey))throw Error('VIBEDOCK_RELAY_HOST_KEY must contain at least 32 characters');
 let bridge=null;const pending=new Map(),streams=new Set(),pairAttempts=new Map();
 function rpc(payload){
  if(!bridge)throw new AppError('电脑离线，请启动 VibeDock PC 服务',503);
  if(pending.size>=64||bridge.bufferedAmount>1024*1024)throw new AppError('服务器忙，请稍后重试',429);
  return new Promise((resolve,reject)=>{const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(new AppError('电脑响应超时，请重试',504))},8000);pending.set(id,{resolve,reject,timer});bridge.send(JSON.stringify({id,...payload}))});
 }
 const server=http.createServer(async(req,res)=>{
  securityHeaders(res);
  try{
   sameOrigin(req,publicOrigin);const url=new URL(req.url,publicOrigin);
   if(await serveAsset(req,res,url.pathname))return;
   if(req.method==='GET'&&url.pathname==='/health'){json(res,200,{ok:true,pcOnline:!!bridge});return}
   if(req.method==='POST'&&url.pathname==='/api/pair'){
    const peer=req.socket.remoteAddress,now=Date.now();let rate=pairAttempts.get(peer);if(!rate||rate.until<=now)rate={count:0,until:now+60000};if(++rate.count>10)throw new AppError('配对尝试过多，请一分钟后重试',429);pairAttempts.set(peer,rate);if(pairAttempts.size>1024)pairAttempts.clear();
    const data=await readJson(req);const result=await rpc({path:url.pathname,data,peer});if(result.status!==200){json(res,result.status,result.value);return}
    const {credential,...view}=result.value;res.setHeader('Set-Cookie',remoteCookie(credential,origin.protocol==='https:'));json(res,200,view);return;
   }
   const credential=cookie(req);if(!credential)throw new AppError('请扫描电脑端生成的配对码',401);
   if(req.method==='GET'&&['/api/session','/api/state'].includes(url.pathname)){const result=await rpc({path:url.pathname,credential});json(res,result.status,result.value);return}
   if(req.method==='GET'&&url.pathname==='/api/events'){
    const result=await rpc({path:'/api/session',credential});if(result.status!==200){json(res,result.status,result.value);return}
    if(streams.size>=128||[...streams].filter(stream=>stream.id===result.value.access.id).length>=4)throw new AppError('设备连接窗口过多，请关闭部分窗口',429);
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','X-Accel-Buffering':'no'});res.write(`data: ${JSON.stringify(result.value.snapshot)}\n\n`);
    const stream={res,id:result.value.access.id,expiresAt:result.value.access.expiresAt};streams.add(stream);req.on('close',()=>streams.delete(stream));return;
   }
   if(req.method==='POST'&&['/api/command','/api/logout'].includes(url.pathname)){
    const data=await readJson(req),result=await rpc({path:url.pathname,credential,key:req.headers['x-vibedock-key'],data});if(url.pathname==='/api/logout'&&result.status===200)res.setHeader('Set-Cookie',remoteCookie('',origin.protocol==='https:').replace('86400','0'));json(res,result.status,result.value);return;
   }
   throw new AppError('此服务器不提供电脑管理入口',403);
  }catch(e){error(res,e)}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:1024*1024});
 server.on('upgrade',(req,socket,head)=>{
  const expected=Buffer.from(`Bearer ${hostKey}`),actual=Buffer.from(String(req.headers.authorization||''));
  if(req.url!=='/bridge'||req.headers.host!==origin.host||req.headers.origin||actual.length!==expected.length||!timingSafeEqual(actual,expected)||bridge){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return}
  wss.handleUpgrade(req,socket,head,ws=>{bridge=ws;ws.alive=true;ws.on('pong',()=>{ws.alive=true});
   ws.on('message',raw=>{try{const message=JSON.parse(String(raw));if(message.event){for(const stream of streams)if(stream.id===message.id){if(message.event==='snapshot'&&stream.expiresAt>Date.now()&&stream.res.writableLength<1024*1024)stream.res.write(`data: ${JSON.stringify(message.snapshot)}\n\n`);else if(message.event==='revoke'||stream.expiresAt<=Date.now()){stream.res.write('event: revoked\ndata: {}\n\n');stream.res.end();streams.delete(stream)}}return}const wait=pending.get(message.id);if(wait){clearTimeout(wait.timer);pending.delete(message.id);wait.resolve(message)}}catch{ws.terminate()}});
   ws.on('close',()=>{if(bridge!==ws)return;bridge=null;for(const wait of pending.values()){clearTimeout(wait.timer);wait.reject(new AppError('电脑连接已断开',503))}pending.clear();for(const stream of streams){stream.res.write('event: offline\ndata: {}\n\n');stream.res.end()}streams.clear()});
  });
 });
 const pulse=setInterval(()=>{if(bridge){if(!bridge.alive)bridge.terminate();else{bridge.alive=false;bridge.ping()}}for(const stream of streams){if(stream.expiresAt<=Date.now()){stream.res.end();streams.delete(stream)}else stream.res.write(': heartbeat\n\n')}},15000);pulse.unref();
 return {server,connected:()=>!!bridge,stop:async()=>{clearInterval(pulse);bridge?.terminate();for(const s of streams)s.res.end();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new AppError('服务器关闭',503))}pending.clear();wss.close();server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve))}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.VIBEDOCK_RELAY_PORT||8080);const app=createRelayServer({publicOrigin:process.env.VIBEDOCK_PUBLIC_ORIGIN,hostKey:process.env.VIBEDOCK_RELAY_HOST_KEY});
 app.server.listen(port,'0.0.0.0',()=>console.log(`VibeDock relay listening on port ${port}`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void app.stop().then(()=>process.exit(0)));
}
