import {test} from 'node:test';
import assert from 'node:assert/strict';
import {codexTask,quotaWindows,workbuddyTask,WorkBuddyAdapter} from '../src/adapters.mjs';
test('historical completed turn is not reported as a live completed task',()=>{
 const t=codexTask({id:'x',preview:'A',status:{type:'notLoaded'}},{status:'completed',items:[{type:'agentMessage',text:'Finished'}]});
 assert.equal(t.state,'unknown');assert.equal(t.lastState,'completed');assert.equal(t.capabilities.approve,false);
 assert.equal(t.summary,'Finished');assert.equal(t.tokens,null);
 assert.equal(t.output.text,'Finished');
});
test('visible active flags distinguish running from waiting without inventing approval requests',()=>{
 const t=codexTask({id:'x',status:{type:'active',activeFlags:['waitingOnApproval']}});
 assert.equal(t.state,'waiting');assert.equal(t.approval,null);
});
test('quota uses usedPercent, prefers per-limit buckets and keeps missing windows unknown',()=>{
 const q=quotaWindows({rateLimits:{primary:{usedPercent:50}},rateLimitsByLimitId:{codex:{primary:{usedPercent:91,windowDurationMins:300,resetsAt:100},secondary:null}}});
 assert.equal(q.length,1);assert.equal(q[0].remaining,9);assert.equal(q[0].resetsAt,100000);
 assert.deepEqual(quotaWindows({rateLimits:{primary:{usedPercent:null}}}),[]);
});
test('WorkBuddy pending is not converted into an approval with invented options',()=>{
 const t=workbuddyTask({task_id:'1',status:'pending'});assert.equal(t.state,'waiting');assert.equal(t.approval,null);assert.equal(t.tokens,null);
 assert.equal(t.output,null);
});
test('WorkBuddy uses only the fixed official origin; token stays in request header',async()=>{
 const calls=[];const a=new WorkBuddyAdapter({token:'private-example-token',fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('tasks?')?{tasks:[{task_id:'1',status:'working'}]}:{code:0,data:{online:true}}}}});
 const result=await a.read();assert.equal(result.localOnline,true);assert.equal(result.tasks[0].state,'running');
 assert.equal(calls.length,2);assert.ok(calls.every(c=>c.url.startsWith('https://www.workbuddy.cn/openapi/v2/')));
 assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.Authorization,'Bearer private-example-token');
 assert.ok(!JSON.stringify(result).includes('private-example-token'));a.close();assert.equal(a.token,'');
});
test('WorkBuddy missing or expired auth produces a useful error, not empty success',async()=>{
 await assert.rejects(new WorkBuddyAdapter().read(),/尚未配置/);
 await assert.rejects(new WorkBuddyAdapter({token:'x',fetcher:async()=>({ok:false,status:401})}).read(),/已过期/);
});
