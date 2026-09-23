import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {Companion,AppError} from './store.mjs';
import {FilePreferences} from './preferences.mjs';

const root=fileURLToPath(new URL('../public/',import.meta.url));
const publicFiles=new Map([['/','index.html'],['/app.js','app.js'],['/style.css','style.css']]);
const same=(a,b)=>typeof a==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function body(req) {
  let text='';
  for await (const chunk of req) {text+=chunk;if(Buffer.byteLength(text)>16384)throw new AppError('请求过大',413)}
  try {return JSON.parse(text)} catch {throw new AppError('JSON 格式错误',400)}
}
export function createCompanionServer({store=new Companion({defaultMode:process.env.VIBEDOCK_DEMO==='1'?'demo':'live'})}={}) {
  const key=randomBytes(32).toString('hex');const streams=new Set();
  const server=http.createServer(async(req,res)=>{
    const address=server.address();const expected=`127.0.0.1:${address.port}`;
    const origin=`http://${expected}`;
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value))};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      if(req.headers.host!==expected || (req.headers.origin && req.headers.origin!==origin) || req.headers['sec-fetch-site']==='cross-site')throw new AppError('仅允许本机同源访问',403);
      const url=new URL(req.url,origin);
      if(req.method==='GET' && publicFiles.has(url.pathname)) {
        const file=publicFiles.get(url.pathname);const content=await readFile(path.join(root,file));
        res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(content);return;
      }
      if(req.method==='GET' && url.pathname==='/api/session') {
        res.setHeader('Set-Cookie',`vibedock=${key}; HttpOnly; SameSite=Strict; Path=/`);send(200,{key,snapshot:store.snapshot()});return;
      }
      const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('vibedock='))?.slice(9);
      if(!same(req.headers['x-vibedock-key'],key) && !same(cookie,key))throw new AppError('会话已过期，请刷新页面',401);
      if(req.method==='GET' && url.pathname==='/api/events') {
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'});
        res.write(`data: ${JSON.stringify(store.snapshot())}\n\n`);streams.add(res);
        req.on('close',()=>streams.delete(res));return;
      }
      if(req.method==='GET' && url.pathname==='/api/state'){send(200,store.snapshot());return}
      if(req.method==='POST') {
        if(!same(req.headers['x-vibedock-key'],key))throw new AppError('缺少操作会话标识',403);
        if(!req.headers['content-type']?.startsWith('application/json'))throw new AppError('需要 JSON 请求',415);
        const data=await body(req);
        if(url.pathname==='/api/command'){
          const ack=await store.command(data);send(200,{...ack,snapshot:store.snapshot()});
          if(['mode.set','tool.select'].includes(data.type))void store.refresh();return;
        }
        if(url.pathname==='/api/refresh') {await store.refresh(store.activeTool,{visible:true});send(200,{snapshot:store.snapshot()});return}
        if(url.pathname==='/api/workbuddy/token'){store.setWorkBuddyToken(data.token);send(200,{ok:true,snapshot:store.snapshot()});void store.refresh('workbuddy');return}
        if(url.pathname==='/api/workbuddy/desktop'){store.useWorkBuddyDesktop();send(200,{ok:true,snapshot:store.snapshot()});void store.refresh('workbuddy');return}
      }
      send(404,{error:'未找到接口'});
    } catch(e){if(!res.headersSent)send(e.status || 500,{error:e instanceof AppError?e.message:'本地服务暂时无法完成请求，请重试。'})}
  });
  const publish=s=>{const frame=`data: ${JSON.stringify(s)}\n\n`;for(const res of streams){if(res.writableLength>1024*1024){res.destroy();streams.delete(res)}else res.write(frame)}};
  store.on('snapshot',publish);
  const pulse=setInterval(()=>{for(const res of streams)res.write(': heartbeat\n\n')},15000);pulse.unref();
  const lastPoll={};
  const poll=setInterval(()=>{
    for(const tool of ['codex','workbuddy']){
      const s=store.tools[tool];if(s.mode!=='live' || Date.now()-(lastPoll[tool] || 0)<(s.pollMs || 2000))continue;
      lastPoll[tool]=Date.now();void store.refresh(tool);
    }
  },1000);poll.unref();
  server.on('close',()=>{clearInterval(pulse);clearInterval(poll);store.off('snapshot',publish);store.close()});
  return {server,store,stop:async()=>{for(const res of streams)res.end();await new Promise(resolve=>server.close(resolve))}};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const app=createCompanionServer({store:new Companion({defaultMode:process.env.VIBEDOCK_DEMO==='1'?'demo':'live',preferences:new FilePreferences()})});const port=Number(process.env.VIBEDOCK_PORT || 47831);
  app.server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已被使用。请打开已有 VibeDock，或设置 VIBEDOCK_PORT。`:'VibeDock 无法启动。');process.exitCode=1;app.store.close()});
  app.server.listen(port,'127.0.0.1',()=>{
    const url=`http://127.0.0.1:${port}`;console.log(`VibeDock 已启动：${url}`);
    if(process.argv.includes('--open') && process.platform==='win32'){
      const browser=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});browser.on('error',()=>console.log(`请手动打开 ${url}`));browser.unref();
    }
    void app.store.refresh('codex');void app.store.refresh('workbuddy');
  });
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>void app.stop().then(()=>process.exit(0)));
}
