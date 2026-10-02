import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import QRCode from 'qrcode';
import {Companion,AppError} from './store.mjs';
import {FilePreferences} from './preferences.mjs';
import {NetworkAccess} from './network-access.mjs';
import {createNetworkServer} from './network-server.mjs';
import {RelayClient} from './relay-client.mjs';
import {securityHeaders,readJson,json,error,cookie,serveAsset,sameOrigin} from './http-common.mjs';

const same=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function createCompanionServer({store=new Companion({defaultMode:process.env.VIBEDOCK_DEMO==='1'?'demo':'live'}),networkPort=Number(process.env.VIBEDOCK_NETWORK_PORT||47832),networkAddresses,networkTls=null}={}){
 const key=randomBytes(32).toString('hex'),streams=new Set(),access=new NetworkAccess({store});let network=null,networkStarting=false;
 const snapshot=()=>({...store.snapshot(),access:{role:'admin'}});
 const relay=new RelayClient({store,access});
 const networkInfo=()=>({enabled:!!network?.server.listening,urls:network?.urls()||[],tls:!!networkTls,relay:{...relay.status},devices:access.list()});
 async function startNetwork(){
  if(network?.server.listening)return networkInfo();if(networkStarting)throw new AppError('局域网服务正在启动',409);networkStarting=true;
  try{if(!networkTls&&process.env.VIBEDOCK_TLS_CERT&&process.env.VIBEDOCK_TLS_KEY)networkTls={cert:await readFile(process.env.VIBEDOCK_TLS_CERT),key:await readFile(process.env.VIBEDOCK_TLS_KEY)};
   network=createNetworkServer({store,access,addresses:networkAddresses,tls:networkTls});await new Promise((resolve,reject)=>{network.server.once('error',reject);network.server.listen(networkPort,'0.0.0.0',resolve)});return networkInfo();
  }catch(e){await network?.stop();network=null;throw new AppError(e.code==='EADDRINUSE'?'局域网端口被占用，请修改 VIBEDOCK_NETWORK_PORT':'无法启动局域网连接，请检查网络配置',503)}finally{networkStarting=false}
 }
 const server=http.createServer(async(req,res)=>{
  securityHeaders(res);
  try{
   const origin=`http://127.0.0.1:${server.address().port}`;sameOrigin(req,origin);const url=new URL(req.url,origin);
   if(await serveAsset(req,res,url.pathname))return;
   if(req.method==='GET'&&url.pathname==='/api/session'){res.setHeader('Set-Cookie',`vibedock=${key}; HttpOnly; SameSite=Strict; Path=/`);json(res,200,{key,access:{role:'admin'},snapshot:snapshot()});return}
   if(!same(req.headers['x-vibedock-key'],key)&&!same(cookie(req,'vibedock'),key))throw new AppError('会话已过期，请刷新页面',401);
   if(req.method==='GET'&&url.pathname==='/api/events'){
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`data: ${JSON.stringify(snapshot())}\n\n`);streams.add(res);req.on('close',()=>streams.delete(res));return;
   }
   if(req.method==='GET'&&url.pathname==='/api/state'){json(res,200,snapshot());return}
   if(req.method==='GET'&&url.pathname==='/api/network'){json(res,200,networkInfo());return}
   if(req.method==='POST'){
    if(!same(req.headers['x-vibedock-key'],key))throw new AppError('缺少操作会话标识',403);const data=await readJson(req);
    if(url.pathname==='/api/command'){const ack=await store.command(data);json(res,200,{...ack,snapshot:snapshot()});if(['mode.set','tool.select'].includes(data.type))void store.refresh();return}
    if(url.pathname==='/api/refresh'){await store.refresh(store.activeTool,{visible:true});json(res,200,{snapshot:snapshot()});return}
    if(url.pathname==='/api/workbuddy/token'){store.setWorkBuddyToken(data.token);json(res,200,{ok:true,snapshot:snapshot()});void store.refresh('workbuddy');return}
    if(url.pathname==='/api/workbuddy/desktop'){store.useWorkBuddyDesktop();json(res,200,{ok:true,snapshot:snapshot()});void store.refresh('workbuddy');return}
    if(url.pathname==='/api/network'){
     if(typeof data.enabled!=='boolean')throw new AppError('无效的连接设置',400);if(data.enabled)await startNetwork();else{await network?.stop();network=null}json(res,200,networkInfo());return;
    }
    if(url.pathname==='/api/invite'){
     const base=data.kind==='wan'?relay.status.connected&&relay.status.url:network?.urls()[Number.isInteger(data.address)?data.address:0];
     if(!base)throw new AppError(data.kind==='wan'?'请先连接广域网服务器':'请先开启局域网连接',409);
     const invite=access.invite(data),link=`${base}/?view=mobile#invite=${invite.invite}`;
     const qr=await QRCode.toDataURL(link,{width:240,margin:1});json(res,200,{...invite,link,qr});return;
    }
    if(url.pathname==='/api/devices/revoke'){json(res,200,{ok:access.revoke(data.id)});return}
    if(url.pathname==='/api/relay'){if(data.disconnect)relay.disconnect();else relay.configure(data.url,data.hostKey);json(res,200,relay.status);return}
    if(url.pathname==='/api/ble/session'){
     const invite=access.invite({name:data.name||'蓝牙吧唧',role:'control'});json(res,200,access.pair(invite.invite,{peer:'bluetooth'}));return;
    }
    if(url.pathname==='/api/ble/state'){json(res,200,access.describe(access.session(data.credential)));return}
    if(url.pathname==='/api/ble/command'){json(res,200,await access.command(data.credential,data.key,data.message));return}
   }
   json(res,404,{error:'未找到接口'});
  }catch(e){error(res,e)}
 });
 const publish=()=>{const frame=`data: ${JSON.stringify(snapshot())}\n\n`;for(const res of streams){if(res.writableLength>1024*1024){res.destroy();streams.delete(res)}else res.write(frame)}};
 store.on('snapshot',publish);const pulse=setInterval(()=>{access.prune();for(const res of streams)res.write(': heartbeat\n\n')},15000);pulse.unref();const lastPoll={};
 const poll=setInterval(()=>{for(const tool of ['codex','workbuddy']){const s=store.tools[tool];if(s.mode!=='live'||Date.now()-(lastPoll[tool]||0)<(s.pollMs||2000))continue;lastPoll[tool]=Date.now();void store.refresh(tool)}},1000);poll.unref();
 let stopped=false;
 return {server,store,access,relay,startNetwork,networkInfo,networkServer:()=>network?.server,stop:async()=>{if(stopped)return;stopped=true;clearInterval(pulse);clearInterval(poll);relay.close();await network?.stop();for(const res of streams)res.end();store.off('snapshot',publish);store.close();server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve))}};
}
export function startCompanion(){
 const app=createCompanionServer({store:new Companion({defaultMode:process.env.VIBEDOCK_DEMO==='1'?'demo':'live',preferences:new FilePreferences()})}),port=Number(process.env.VIBEDOCK_PORT||47831);
 app.server.on('error',()=>{console.error('VibeDock 无法启动，请检查端口是否已被使用。');process.exitCode=1;void app.stop()});
 app.server.listen(port,'127.0.0.1',async()=>{
  const url=`http://127.0.0.1:${port}${process.argv.includes('--mini')?'/?view=mini':''}`;console.log(`VibeDock 已启动：${url}`);
  try{if(process.env.VIBEDOCK_NETWORK==='1')await app.startNetwork();if(process.env.VIBEDOCK_RELAY_URL)app.relay.configure(process.env.VIBEDOCK_RELAY_URL,process.env.VIBEDOCK_RELAY_HOST_KEY)}catch(e){console.error(e.message)}
  if(process.argv.includes('--open')&&process.platform==='win32'){const browser=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});browser.on('error',()=>console.log('请手动打开工作台'));browser.unref()}
  void app.store.refresh('codex');void app.store.refresh('workbuddy');
 });
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void app.stop().then(()=>process.exit(0)));
 return app;
}
