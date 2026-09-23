import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import {createCompanionServer} from '../src/server.mjs';
import {Companion} from '../src/store.mjs';
async function setup(t){
 const app=createCompanionServer({store:new Companion()});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.stop());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const session=await (await fetch(base+'/api/session')).json();
 return {...app,base,key:session.key,post:(route,data,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Vibedock-Key':session.key,...headers},body:JSON.stringify(data)})};
}
test('HTTP approval traverses the real server; SSE emits initial and changed snapshots',async t=>{
 const {store,base,key,post}=await setup(t);
 const controller=new AbortController();t.after(()=>controller.abort());
 const stream=await fetch(base+'/api/events',{headers:{'X-Vibedock-Key':key},signal:controller.signal});const reader=stream.body.getReader();
 assert.match(new TextDecoder().decode((await reader.read()).value),/"type":"snapshot"/);
 const s=store.snapshot(),task=s.tasks[0];
 const response=await post('/api/command',{v:1,actionId:randomUUID(),epoch:s.epoch,tool:s.tool,type:'interaction.resolve',source:'device',taskId:task.id,requestId:task.approval.id,requestRevision:1,decision:'accept'});
 assert.equal(response.status,200);const ack=await response.json();assert.equal(ack.type,'ack');assert.equal(ack.snapshot.tasks[0].state,'running');
 assert.match(new TextDecoder().decode((await reader.read()).value),/interaction.resolve/);await reader.cancel();
});
test('server rejects cross-origin requests, foreign Host, missing key, invalid JSON and arbitrary paths',async t=>{
 const {base,key,post}=await setup(t);
 assert.equal((await fetch(base+'/api/state')).status,401);
 assert.equal((await fetch(base+'/api/session',{headers:{Origin:'https://evil.example'}})).status,403);
 const foreignHost=await new Promise((resolve,reject)=>{const req=http.get(base+'/api/session',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject)});
 assert.equal(foreignHost,403);
 assert.equal((await fetch(base+'/api/session',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
 assert.equal((await post('/api/refresh',{}, {'X-Vibedock-Key':''})).status,401);
 assert.equal((await post('/api/refresh',{}, {'Content-Type':'text/plain'})).status,415);
 assert.equal((await post('/api/command',{v:1})).status,400);
 assert.equal((await fetch(base+'/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-Vibedock-Key':key},body:'{broken'})).status,400);
 assert.equal((await fetch(base+'/src/server.mjs')).status,401);
 const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
