import http from 'node:http';
import https from 'node:https';
import {networkInterfaces} from 'node:os';
import {AppError} from './store.mjs';
import {securityHeaders,readJson,json,error,cookie,remoteCookie,serveAsset,sameOrigin} from './http-common.mjs';

export function lanAddresses(){return [...new Set(Object.values(networkInterfaces()).flat().filter(v=>v?.family==='IPv4'&&!v.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(v.address)).map(v=>v.address))]}
export function createNetworkServer({store,access,addresses=lanAddresses(),tls=null}={}){
 const streams=new Set(),allowed=new Set(['127.0.0.1','localhost',...addresses]);
 const server=(tls?https:http).createServer(tls||{},async(req,res)=>{
  securityHeaders(res);
  try{
   const host=new URL(`http://${req.headers.host}`).hostname;
   if(!allowed.has(host)||new URL(`http://${req.headers.host}`).port!==String(server.address().port))throw new AppError('访问地址不在局域网允许列表',403);
   const origin=`${tls?'https':'http'}://${req.headers.host}`;sameOrigin(req,origin);
   const url=new URL(req.url,origin);
   if(await serveAsset(req,res,url.pathname))return;
   if(req.method==='POST'&&url.pathname==='/api/pair'){
    const data=await readJson(req);const result=access.pair(data.invite,{peer:req.socket.remoteAddress,name:data.name});
    res.setHeader('Set-Cookie',remoteCookie(result.credential,!!tls));const {credential,...view}=result;json(res,200,view);return;
   }
   const credential=cookie(req),s=access.session(credential);
   if(req.method==='GET'&&url.pathname==='/api/session'){json(res,200,access.describe(s));return}
   if(req.method==='GET'&&url.pathname==='/api/state'){json(res,200,access.snapshot(s));return}
   if(req.method==='GET'&&url.pathname==='/api/events'){
    if(streams.size>=128||[...streams].filter(stream=>stream.s.id===s.id).length>=4)throw new AppError('设备连接窗口过多，请关闭部分窗口',429);
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','X-Accel-Buffering':'no'});
    const stream={res,s,credential};streams.add(stream);res.write(`data: ${JSON.stringify(access.snapshot(s))}\n\n`);req.on('close',()=>streams.delete(stream));return;
   }
   if(req.method==='POST'&&url.pathname==='/api/command'){const data=await readJson(req);json(res,200,await access.command(credential,req.headers['x-vibedock-key'],data));return}
   if(req.method==='POST'&&url.pathname==='/api/logout'){
    if(req.headers['x-vibedock-key']!==s.key)throw new AppError('缺少操作授权',403);await readJson(req);access.revoke(s.id);res.setHeader('Set-Cookie',remoteCookie('',!!tls).replace('86400','0'));json(res,200,{ok:true});return;
   }
   throw new AppError('此入口不提供电脑管理操作',403);
  }catch(e){error(res,e)}
 });
 const publish=()=>{for(const stream of streams){try{access.session(stream.credential);if(stream.res.writableLength>1024*1024)throw Error();stream.res.write(`data: ${JSON.stringify(access.snapshot(stream.s))}\n\n`)}catch{stream.res.end();streams.delete(stream)}}};
 const revoke=id=>{for(const stream of streams)if(stream.s.id===id){stream.res.write('event: revoked\ndata: {}\n\n');stream.res.end();streams.delete(stream)}};
 store.on('snapshot',publish);access.on('view',publish);access.on('revoke',revoke);
 const pulse=setInterval(()=>{access.prune();for(const s of streams)s.res.write(': heartbeat\n\n')},15000);pulse.unref();
 return {server,urls:()=>addresses.map(ip=>`${tls?'https':'http'}://${ip}:${server.address()?.port}`),stop:async()=>{clearInterval(pulse);store.off('snapshot',publish);access.off('view',publish);access.off('revoke',revoke);for(const s of streams)s.res.end();server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve))}};
}
