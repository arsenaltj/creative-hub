import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {AppError} from './store.mjs';

export const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
const assets=new Set(['index.html','app.js','style.css','connections.js','bluetooth.mjs','ble-codec.mjs','manifest.webmanifest','sw.js','icon.svg','icon-192.png','icon-512.png']);
export function securityHeaders(res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}
export async function readJson(req){
 if(!req.headers['content-type']?.startsWith('application/json'))throw new AppError('需要 JSON 请求',415);
 let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16384)throw new AppError('请求过大',413)}
 try{return JSON.parse(text)}catch{throw new AppError('JSON 格式错误',400)}
}
export function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value))}
export function error(res,e){if(!res.headersSent)json(res,e.status||500,{error:e instanceof AppError?e.message:'服务暂时无法完成请求，请重试。'});else res.end()}
export function cookie(req,name='vibedock_remote'){return req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)}
export function remoteCookie(token,secure=false){return `vibedock_remote=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secure?'; Secure':''}`}
export async function serveAsset(req,res,pathname){
 const file=pathname==='/'?'index.html':pathname.slice(1);if(!assets.has(file)||req.method!=='GET')return false;
 const content=await readFile(path.join(publicRoot,file));
 const type=file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.webmanifest')?'application/manifest+json':'text/html';
 res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(content);return true;
}
export function sameOrigin(req,origin){if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')throw new AppError('仅允许同源访问',403)}
