import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Companion} from '../src/store.mjs';
import {workbuddyTask} from '../src/adapters.mjs';
const msg=(s,type,extra={})=>({v:1,actionId:randomUUID(),tool:s.activeTool,epoch:s.epoch,type,source:'device',...extra});
const approval=(s,decision='accept')=>{const t=s.snapshot().tasks[0];return msg(s,'interaction.resolve',{taskId:t.id,requestId:t.approval.id,requestRevision:t.approval.revision,decision})};

test('approval changes state only on receipt and preserves slot IDs; duplicate delivery is idempotent',async()=>{
 const s=new Companion();const ids=s.snapshot().tasks.map(t=>t.id),m=approval(s);
 const one=s.command(m),two=s.command(m);
 assert.equal(s.snapshot().tasks[0].state,'waiting');assert.equal(s.snapshot().tasks[0].approval.pending,true);
 const [a,b]=await Promise.all([one,two]);assert.deepEqual(a,b);assert.equal(a.simulated,true);
 assert.equal(s.snapshot().tasks[0].state,'running');assert.deepEqual(s.snapshot().tasks.map(t=>t.id),ids);
 assert.equal(s.events.filter(e=>e.type==='interaction.resolve' && e.direction==='↓').length,1);
});
test('two different actions cannot resolve a single pending approval',async()=>{
 const s=new Companion(),one=s.command(approval(s));
 await assert.rejects(s.command(approval(s,'decline')),/正在处理/);await one;
});
test('reject pauses only the selected task',async()=>{
 const s=new Companion();await s.command(approval(s,'decline'));
 assert.equal(s.snapshot().tasks[0].state,'paused');assert.equal(s.snapshot().tasks[1].state,'running');
});
test('old context, stale request, reused IDs, and tool confusion fail closed',async()=>{
 const s=new Companion(),old=approval(s);await s.command(msg(s,'tool.select',{target:'workbuddy'}));
 await assert.rejects(s.command(old),/上下文/);
 const m=msg(s,'task.select',{taskId:s.snapshot().tasks[0].id});await s.command(m);
 await assert.rejects(s.command({...m,taskId:'other'}),/动作编号/);
 await assert.rejects(s.command({...approval(s),requestRevision:22}),/过期/);
 await assert.rejects(s.command({...approval(s),tool:'codex'}),/工具已切换/);
 assert.ok(s.snapshot().tasks.every(t=>t.id.startsWith('workbuddy')));
});
test('offline device cannot act; PC can act and reconnect receives new snapshot',async()=>{
 const s=new Companion();await s.command(msg(s,'device.connection',{connected:false}));
 await assert.rejects(s.command(approval(s)),/离线/);
 await s.command({...approval(s),source:'pc'});
 await s.command(msg(s,'device.connection',{connected:true}));
 assert.equal(s.snapshot().tasks[0].state,'running');
});
test('center tool switch keeps each tool slots and rejects offline or stale device taps',async()=>{
 const s=new Companion(),codex=s.snapshot(),toWorkBuddy=msg(s,'tool.select',{target:'workbuddy'});
 await s.command(toWorkBuddy);
 assert.equal(s.snapshot().tool,'workbuddy');assert.ok(s.snapshot().tasks.every(t=>t.id.startsWith('workbuddy')));
 await assert.rejects(s.command({...toWorkBuddy,actionId:randomUUID()}),/上下文/);
 await s.command(msg(s,'device.connection',{connected:false}));
 await assert.rejects(s.command(msg(s,'tool.select',{target:'codex'})),/设备离线/);
 await s.command({...msg(s,'tool.select',{target:'codex'}),source:'pc'});
 assert.deepEqual(s.snapshot().tasks.map(t=>t.id),codex.tasks.map(t=>t.id));
});
test('reset while approval in flight never affects the replacement request',async()=>{
 const s=new Companion(),pending=s.command(approval(s));
 await s.command(msg(s,'demo.reset'));await assert.rejects(pending,/替换/);
 assert.equal(s.snapshot().tasks[0].state,'waiting');assert.equal(s.snapshot().tasks[0].approval.pending,undefined);
});
test('unknown usage is not zero and tools remain isolated',async()=>{
 const s=new Companion();assert.equal(s.snapshot().usage.tokens,70800);
 await s.command(msg(s,'tool.select',{target:'workbuddy'}));
 assert.equal(s.snapshot().usage.tokens,28000);assert.equal(s.snapshot().usage.unknown,2);
});
test('ambiguous WorkBuddy pending is not presented as an action-required alert',async()=>{
 const pending=workbuddyTask({task_id:randomUUID(),name:'新任务',status:'pending'});
 const failed=workbuddyTask({task_id:randomUUID(),name:'失败任务',status:'failed'});
 const s=new Companion({defaultMode:'live',adapters:{codex:{read:async()=>({tasks:[],quota:[]})},workbuddy:{read:async()=>({tasks:[pending,failed],quota:[]})}}});
 await s.refresh('workbuddy');await s.command({...msg(s,'tool.select',{target:'workbuddy'}),source:'pc'});
 assert.equal(s.snapshot().tasks[0].stateLabel,'等待 / 待核对');
 assert.deepEqual(s.snapshot().attention.map(t=>t.id),[failed.id]);
 await s.command({...msg(s,'mode.set',{mode:'demo'}),source:'pc'});
 assert.equal(s.snapshot().attention.length,2);
});
test('an off-screen task only replaces the slot explicitly chosen by the user',async()=>{
 const tasks=Array.from({length:5},(_,i)=>({id:`task-${i}`,title:`任务 ${i}`,state:'running',tokens:null,capabilities:{}}));
 const s=new Companion({defaultMode:'live',adapters:{codex:{read:async()=>({tasks,quota:[]})}}});
 await s.refresh();const before=s.snapshot(),outside=before.availableTasks[4];
 await assert.rejects(s.command(msg(s,'task.pin',{taskId:outside.id,slot:4})),/有效的分区/);
 const result=await s.command(msg(s,'task.pin',{taskId:outside.id,slot:2}));
 assert.equal(result.slot,2);assert.equal(s.snapshot().tasks[2].id,outside.id);
 assert.deepEqual(s.snapshot().tasks.filter((_,i)=>i!==2).map(t=>t.id),before.tasks.filter((_,i)=>i!==2).map(t=>t.id));
 assert.equal(s.snapshot().selected,outside.id);
 await assert.rejects(s.command({...msg(s,'task.pin',{taskId:outside.id,slot:0}),epoch:before.epoch}),/上下文/);
});
test('an in-flight real refresh cannot overwrite a switch to demo',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);
 const s=new Companion({defaultMode:'live',adapters:{codex:{read:()=>pending}}});
 const refresh=s.refresh();await s.command(msg(s,'mode.set',{mode:'demo'}));
 resolve({tasks:[{id:'real'}],quota:[]});await refresh;
 assert.equal(s.snapshot().mode,'demo');assert.equal(s.snapshot().tasks[0].id,'codex-demo-1');assert.equal(s.snapshot().busy,false);
});
test('real data never exposes simulated control capabilities and loses action access on read error',async()=>{
 let fail=false;const adapter={read:async()=>{if(fail)throw Error('unavailable');return {tasks:[{id:'x',title:'real',state:'unknown',tokens:null,capabilities:{}}],quota:[]}}};
 const s=new Companion({defaultMode:'live',adapters:{codex:adapter}});await s.refresh();
 assert.equal(s.snapshot().usage.tokens,null);
 await assert.rejects(s.command(msg(s,'voice.start',{taskId:'x'})),/尚未接通/);
 fail=true;await s.refresh();assert.equal(s.snapshot().connected,false);assert.equal(s.snapshot().tasks[0].id,'x');
 await assert.rejects(s.command(msg(s,'task.select',{taskId:'x'})),/断开/);
});
