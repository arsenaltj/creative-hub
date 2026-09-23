import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Companion} from '../share-demo/public/demo-model.mjs';
const action=(s,type,extra={})=>({v:1,actionId:crypto.randomUUID(),epoch:s.epoch,tool:s.activeTool,source:'pc',type,...extra});
test('share demo rejects real connection modes; simulated approval is isolated per visitor',async()=>{
 const a=new Companion(),b=new Companion(),task=a.snapshot().tasks[0];
 await assert.rejects(a.command(action(a,'mode.set',{mode:'live'})),/仅支持模拟/);
 await a.command(action(a,'interaction.resolve',{taskId:task.id,requestId:task.approval.id,requestRevision:1,decision:'accept'}));
 assert.equal(a.snapshot().tasks[0].state,'running');assert.equal(b.snapshot().tasks[0].state,'waiting');
 assert.equal(a.snapshot().mode,'demo');
});
test('published asset set has no network transport, credentials form or real adapters',async()=>{
 const root=new URL('../share-demo/public/',import.meta.url);
 for(const file of ['app.js','demo-model.mjs','demo-transport.mjs']){
  const source=await readFile(new URL(file,root),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(|new EventSource|node:|127\.0\.0\.1|new CodexAdapter|new WorkBuddyAdapter/);
 }
 const html=await readFile(new URL('index.html',root),'utf8');assert.doesNotMatch(html,/<input|value="live"/);assert.match(html,/全部为模拟数据/);
 assert.doesNotMatch(html,/(?:href|src)="\//);assert.match(html,/href="\.\/\?view=device"/);
});
