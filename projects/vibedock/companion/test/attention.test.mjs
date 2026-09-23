import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {taskLink,openDesktopTask} from '../src/task-links.mjs';
import {HookObserver} from '../src/hook-observer.mjs';
import {safeEvent,writeHook} from '../scripts/codex-status-hook.mjs';
import {mergeHooks} from '../scripts/install-codex-hook.mjs';
import {Companion} from '../src/store.mjs';
const id=randomUUID(),turn=randomUUID();
const message=(s,type,extra={})=>({v:1,actionId:randomUUID(),tool:s.activeTool,epoch:s.epoch,source:'device',type,...extra});
const hook=(event,command='echo private',at=100)=>safeEvent({session_id:id,turn_id:turn,hook_event_name:event,tool_name:'Bash',tool_input:{command}},at);

test('desktop links only accept known tools and UUID task IDs; never accept arbitrary URLs or shell payloads',()=>{
 assert.equal(taskLink('codex',id),`codex://threads/${id}`);assert.equal(taskLink('workbuddy',id),`workbuddy://task/${id}`);
 for(const bad of ['new','https://example.com',id+'?prompt=run',id+' & whoami','../x'])assert.throws(()=>taskLink('codex',bad));
 assert.throws(()=>taskLink('other',id));
});
test('Windows opener dispatches a fixed protocol URL without shell and does not claim page verification',async()=>{
 let invocation;const launch=(...args)=>{invocation=args;const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child};
 const result=await openDesktopTask('codex',id,{platform:'win32',launch});
 assert.deepEqual(invocation[1],[taskLink('codex',id)]);assert.equal(invocation[2].shell,false);assert.equal(result.verified,false);
 await assert.rejects(openDesktopTask('codex',id,{platform:'linux',launch}),/只支持/);
});
test('hook payload keeps only identity, event and a correlation hash, never commands, outputs or decisions',()=>{
 const event=hook('PermissionRequest');const text=JSON.stringify(event);assert.ok(!text.includes('private'));assert.ok(!text.includes('allow'));assert.equal(event.callHash.length,64);
 assert.equal(safeEvent({session_id:id,turn_id:turn,hook_event_name:'Unsupported'}),null);
 const a=safeEvent({session_id:id,turn_id:turn,hook_event_name:'PostToolUse',tool_name:'Bash',tool_input:{a:1,b:2}});
 const b=safeEvent({session_id:id,turn_id:turn,hook_event_name:'PermissionRequest',tool_name:'Bash',tool_input:{b:2,a:1}});assert.equal(a.callHash,b.callHash);
});
test('pending approval clears only for its matching tool result, completed turn or new turn; stale pending becomes unknown',()=>{
 let now=110;const observer=new HookObserver({now:()=>now});const task={id,state:'running',capabilities:{approve:false},evidence:{at:90,turnId:turn}};
 observer.consume(hook('PermissionRequest'));assert.equal(observer.overlay(task).state,'waiting');assert.equal(observer.overlay(task).approval,null);
 observer.consume(hook('PostToolUse','different',111));assert.equal(observer.overlay(task).state,'waiting');
 observer.consume(hook('PostToolUse','echo private',112));assert.equal(observer.overlay(task).state,'running');
 observer.consume(hook('PermissionRequest','echo private',113));now=190000;assert.equal(observer.overlay(task).state,'unknown');
 assert.equal(observer.overlay({...task,state:'completed',evidence:{at:114,turnId:turn}}).state,'completed');
 assert.equal(observer.overlay({...task,evidence:{at:114,turnId:'another-turn'}}).state,'running');
 observer.consume(hook('Stop','',190000));assert.equal(observer.overlay(task).state,'running');
});
test('hook file producer and incremental reader work together without duplicating old requests',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'vibedock-hook-')),file=path.join(root,'events.jsonl');
 try{
  const observer=new HookObserver({file});await writeHook({session_id:id,turn_id:turn,hook_event_name:'PermissionRequest',tool_name:'Bash',tool_input:{command:'private'}},file);
  await observer.read();assert.equal(observer.overlay({id,state:'running'}).state,'waiting');
  await writeHook({session_id:id,turn_id:turn,hook_event_name:'PostToolUse',tool_name:'Bash',tool_input:{command:'private'}},file);await observer.read();await observer.read();assert.equal(observer.overlay({id,state:'running'}).state,'running');
  assert.ok(!(await readFile(file,'utf8')).includes('private'));
 }finally{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true})}
});
test('late hooks from a retired turn cannot clear the current turn approval',()=>{
 const observer=new HookObserver({now:()=>1000}),next=randomUUID();
 observer.consume(hook('PermissionRequest','first',100));
 observer.consume({...hook('UserPromptSubmit','',110),turnId:next});
 observer.consume({...hook('PermissionRequest','second',120),turnId:next});
 for(const event of ['PostToolUse','Stop','Interrupt','PermissionRequest','UserPromptSubmit'])observer.consume(hook(event,'first',130));
 assert.equal(observer.overlay({id,state:'running',evidence:{turnId:next}}).state,'waiting');
});
test('hook installer merges without replacing existing hooks and is idempotent, with no approval decisions or trust edits',()=>{
 const original={description:'keep',hooks:{Stop:[{hooks:[{type:'command',command:'existing'}]}]}};
 const merged=mergeHooks(original,'node hook.mjs');assert.equal(merged.hooks.Stop.length,2);assert.deepEqual(mergeHooks(merged,'node hook.mjs'),merged);
 assert.equal(original.hooks.Stop.length,1);assert.ok(!JSON.stringify(merged).includes('trust'));assert.ok(!JSON.stringify(merged).includes('permissionDecision'));
});
test('attention covers tasks outside four slots; focus replaces only selected slot and invalidates old context',async()=>{
 const tasks=Array.from({length:6},(_,i)=>({id:randomUUID(),title:String(i),state:i===5?'waiting':'running',tokens:null,capabilities:{openTask:true}}));
 let calls=0;const s=new Companion({defaultMode:'live',adapters:{codex:{read:async()=>({tasks,quota:[]})}},taskOpener:async()=>{calls++;return {dispatched:true,verified:false}}});
 await s.refresh();const first=s.snapshot();assert.equal(first.attention[0].inSlots,false);
 const old=message(s,'task.open',{taskId:tasks[0].id});await s.command(message(s,'task.focus',{taskId:tasks[5].id}));
 const next=s.snapshot();assert.equal(next.tasks[0].id,tasks[5].id);assert.deepEqual(next.tasks.slice(1),first.tasks.slice(1));
 await assert.rejects(s.command(old),/上下文/);
 const open=message(s,'task.open',{taskId:tasks[5].id});const [a,b]=await Promise.all([s.command(open),s.command(open)]);assert.equal(calls,1);assert.equal(a.simulated,false);assert.deepEqual(a,b);assert.equal(s.snapshot().tasks[0].state,'waiting');
 await s.command(message(s,'device.connection',{connected:false}));await assert.rejects(s.command(message(s,'task.open',{taskId:tasks[5].id})),/离线/);
});
