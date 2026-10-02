import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import WebSocket from 'ws';
import {Companion} from '../src/store.mjs';
import {createCompanionServer} from '../src/server.mjs';
import {NetworkAccess} from '../src/network-access.mjs';
import {createRelayServer} from '../src/relay-server.mjs';
const command=(snapshot,type,extra={})=>({v:1,actionId:randomUUID(),epoch:snapshot.epoch,tool:snapshot.tool,source:'pc',type,...extra});
async function local(t){const app=createCompanionServer({store:new Companion(),networkPort:0,networkAddresses:['127.0.0.1']});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.stop());const base=`http://127.0.0.1:${app.server.address().port}`,session=await(await fetch(base+'/api/session')).json();return {app,base,session}}
async function post(base,path,data,headers={}){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)})}
async function pair(base,invite){const response=await post(base,'/api/pair',{invite,name:'test phone'});assert.equal(response.status,200);const session=await response.json();assert.equal(session.credential,undefined);return {...session,cookie:response.headers.get('set-cookie').split(';')[0]}}
async function get(base,session,path='/api/session'){const response=await fetch(base+path,{headers:{Cookie:session.cookie}});return {response,data:await response.json()}}
async function send(base,snapshot,session,type,extra={},key=session.key){return post(base,'/api/command',command(snapshot,type,extra),{Cookie:session.cookie,'X-Vibedock-Key':key})}

test('LAN requires one-time pairing; view navigation is independent and read-only cannot mutate slots or approve',async t=>{
 const {app,base,session:admin}=await local(t);await app.startNetwork();const network=`http://127.0.0.1:${app.networkServer().address().port}`;
 assert.equal((await fetch(network+'/api/session')).status,401);
 const invite=await(await post(base,'/api/invite',{kind:'lan',role:'viewer'},{'X-Vibedock-Key':admin.key})).json();assert.match(invite.qr,/^data:image\/png;base64,/);
 const phone=await pair(network,invite.invite);assert.equal((await post(network,'/api/pair',{invite:invite.invite})).status,401);
 const original=app.store.snapshot();let snapshot=phone.snapshot;
 let response=await send(network,snapshot,phone,'tool.select',{target:'workbuddy'});assert.equal(response.status,200);snapshot=(await response.json()).snapshot;assert.equal(snapshot.tool,'workbuddy');assert.equal(app.store.activeTool,'codex');
 const outside=app.store.tools.workbuddy.tasks.find(task=>!app.store.tools.workbuddy.slots.includes(task.id));response=await send(network,snapshot,phone,'task.select',{taskId:outside.id});snapshot=(await response.json()).snapshot;assert.equal(snapshot.detailTask.id,outside.id);assert.equal(app.store.tools.workbuddy.slots.includes(outside.id),false);
 for(const [type,extra]of [['task.pin',{taskId:outside.id,slot:0}],['mode.set',{mode:'demo'}],['interaction.resolve',{decision:'accept'}],['device.connection',{connected:false}],['demo.session.create',{}]])assert.equal((await send(network,snapshot,phone,type,extra)).status,403);
 assert.equal((await send(network,snapshot,phone,'task.select',{taskId:snapshot.tasks[0].id},'wrong')).status,403);
 assert.deepEqual(app.store.snapshot().tasks.map(t=>t.id),original.tasks.map(t=>t.id));
 assert.equal((await post(network,'/api/workbuddy/token',{token:'private-example-token'},{Cookie:phone.cookie,'X-Vibedock-Key':phone.key})).status,403);
 assert.equal((await fetch(network+'/api/session',{headers:{Origin:'https://attacker.example',Cookie:phone.cookie}})).status,403);
 const foreign=await new Promise((resolve,reject)=>{const req=http.get(network+'/api/session',{headers:{Host:'attacker.example:'+app.networkServer().address().port}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject)});assert.equal(foreign,403);
});

test('authorized LAN control receives approval acknowledgement; revocation closes SSE and invalidates authorization',async t=>{
 const {app}=await local(t);await app.startNetwork();const base=`http://127.0.0.1:${app.networkServer().address().port}`,phone=await pair(base,app.access.invite({role:'control'}).invite),snapshot=phone.snapshot,task=snapshot.tasks[0];
 const abort=new AbortController();t.after(()=>abort.abort());const stream=await fetch(base+'/api/events',{headers:{Cookie:phone.cookie},signal:abort.signal}),reader=stream.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/snapshot/);
 const response=await send(base,snapshot,phone,'interaction.resolve',{taskId:task.id,requestId:task.approval.id,requestRevision:task.approval.revision,decision:'accept'});assert.equal(response.status,200);assert.equal((await response.json()).snapshot.tasks[0].state,'running');
 app.access.revoke(phone.access.id);assert.equal((await get(base,phone)).response.status,401);let output='';for(;;){const part=await reader.read();if(part.done)break;output+=new TextDecoder().decode(part.value)}assert.match(output,/event: revoked/);
});

test('pairing expires, limits attempts and never treats a PC admin key as a paired remote credential',()=>{
 let now=100;const access=new NetworkAccess({store:new Companion(),now:()=>now,inviteMs:5,sessionMs:10});const invite=access.invite();now=106;assert.throws(()=>access.pair(invite.invite),/过期/);
 const valid=access.invite();const s=access.pair(valid.invite);assert.throws(()=>access.session(s.key),/未配对/);assert.equal(access.session(s.credential).role,'viewer');now+=11;assert.throws(()=>access.session(s.credential),/过期/);
 for(let i=0;i<10;i++)assert.throws(()=>access.pair('bad',{peer:'attacker'}));assert.throws(()=>access.pair('bad',{peer:'attacker'}),/尝试过多/);
});

async function freePort(){const server=http.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port}
async function until(predicate){for(let i=0;i<150;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20))}throw Error('connection timed out')}
test('WAN relay connects outbound PC, authenticates pairing, forwards SSE/control, revokes and reports PC offline',async t=>{
 const {app}=await local(t),port=await freePort(),base=`http://127.0.0.1:${port}`,secret=randomBytes(32).toString('hex'),relay=createRelayServer({publicOrigin:base,hostKey:secret});await new Promise(resolve=>relay.server.listen(port,'127.0.0.1',resolve));t.after(()=>relay.stop());
 const denied=new WebSocket(base.replace('http:','ws:')+'/bridge',{headers:{Authorization:'Bearer incorrect'}});const deniedStatus=await new Promise(resolve=>{denied.on('unexpected-response',(_,res)=>{res.resume();denied.terminate();resolve(res.statusCode)});denied.on('error',()=>{})});assert.equal(deniedStatus,403);
 app.relay.configure(base,secret);await until(()=>app.relay.status.connected);
 const phone=await pair(base,app.access.invite({role:'control'}).invite);assert.equal((await get(base,phone)).response.status,200);
 const abort=new AbortController();t.after(()=>abort.abort());const stream=await fetch(base+'/api/events',{headers:{Cookie:phone.cookie},signal:abort.signal}),reader=stream.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/snapshot/);
 const task=phone.snapshot.tasks[0],response=await send(base,phone.snapshot,phone,'interaction.resolve',{taskId:task.id,requestId:task.approval.id,requestRevision:1,decision:'accept'});assert.equal(response.status,200);assert.equal((await response.json()).snapshot.tasks[0].state,'running');assert.match(new TextDecoder().decode((await reader.read()).value),/snapshot/);
 assert.equal((await post(base,'/api/network',{enabled:true},{Cookie:phone.cookie,'X-Vibedock-Key':phone.key})).status,403);
 app.access.revoke(phone.access.id);await until(()=>!app.access.list().some(s=>s.id===phone.access.id));assert.equal((await get(base,phone)).response.status,401);await reader.cancel();
 app.relay.disconnect();await until(()=>!relay.connected());const offline=await post(base,'/api/pair',{invite:'anything'});assert.equal(offline.status,503);
});

test('WAN configuration rejects non-TLS public destinations and weak host credentials',()=>{
 const app=createCompanionServer({store:new Companion()});assert.throws(()=>app.relay.configure('http://public.example',randomBytes(32).toString('hex')),/HTTPS/);assert.throws(()=>createRelayServer({publicOrigin:'https://example.com',hostKey:'weak'}),/32/);void app.stop();
});

test('remote retries never repeat a tool switch or create a second session',async()=>{
 const store=new Companion(),access=new NetworkAccess({store});const phone=access.pair(access.invite({role:'control'}).invite);
 const switchAction=command(phone.snapshot,'tool.select',{target:'workbuddy'});
 const first=await access.command(phone.credential,phone.key,switchAction),second=await access.command(phone.credential,phone.key,switchAction);
 assert.equal(first.snapshot.epoch,second.snapshot.epoch);assert.equal(second.snapshot.tool,'workbuddy');assert.equal(store.activeTool,'codex');
 const createAction=command(second.snapshot,'demo.session.create'),before=store.tools.workbuddy.tasks.length;
 const results=await Promise.all([access.command(phone.credential,phone.key,createAction),access.command(phone.credential,phone.key,createAction)]);
 assert.equal(results[0].taskId,results[1].taskId);assert.equal(store.tools.workbuddy.tasks.length,before+1);
 await assert.rejects(access.command(phone.credential,phone.key,{...createAction,type:'task.open'}),/标识/);store.close();
});
