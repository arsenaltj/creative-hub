import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,appendFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {CodexEventReader,emptyLifecycle,reduceCodexRecord} from '../src/local-events.mjs';
import {WorkBuddyDesktopAdapter,desktopTask} from '../src/workbuddy-desktop.mjs';
const at=Date.now();
const event=(type,turn='turn-1',time=at,extra={})=>({timestamp:new Date(time).toISOString(),type:'event_msg',payload:{type,turn_id:turn,...extra}});
const line=e=>JSON.stringify(e)+'\n';
async function temp(t){const root=await mkdtemp(path.join(os.tmpdir(),'vibedock-status-'));t.after(()=>rm(root,{recursive:true,force:true}));return root}

test('Codex lifecycle follows start, completion and interruption; old turn completions cannot overwrite a new turn',()=>{
 const s=emptyLifecycle();reduceCodexRecord(s,event('task_started'));assert.equal(s.state,'running');
 reduceCodexRecord(s,event('task_started','turn-2',at+1));
 reduceCodexRecord(s,event('task_complete','turn-1',at+2));assert.equal(s.state,'running');
 reduceCodexRecord(s,event('turn_aborted','turn-2',at+3));assert.equal(s.state,'paused');
 reduceCodexRecord(s,event('task_started','turn-3',at+4));reduceCodexRecord(s,event('task_complete','turn-3',at+5));assert.equal(s.state,'completed');
});
test('Codex incremental reader handles partial records, malformed lines, usage and file truncation',async t=>{
 const root=await temp(t),file=path.join(root,'rollout.jsonl'),reader=new CodexEventReader({root,now:()=>at+50});
 await writeFile(file,line(event('task_started')));assert.equal((await reader.read(file)).state,'running');
 const done=line(event('task_complete','turn-1',at+10));await appendFile(file,'bad json\n'+done.slice(0,20));assert.equal((await reader.read(file)).state,'running');
 await appendFile(file,done.slice(20)+line(event('token_count','turn-1',at+20,{info:{total_token_usage:{total_tokens:500}}})));
 const completed=await reader.read(file);assert.equal(completed.state,'completed');assert.equal(completed.tokens,500);
 await writeFile(file,line(event('task_started','turn-new',at+30)));const reset=await reader.read(file);assert.equal(reset.state,'running');assert.equal(reset.turnId,'turn-new');
});
test('stale running events become unknown; terminal events remain completed; outside paths denied',async t=>{
 const root=await temp(t),file=path.join(root,'rollout.jsonl'),reader=new CodexEventReader({root,now:()=>at+200000});
 await writeFile(file,line(event('task_started')));assert.equal((await reader.read(file)).state,'unknown');
 await appendFile(file,line(event('task_complete','turn-1',at+1)));assert.equal((await reader.read(file)).state,'completed');
 assert.equal(await reader.read(path.join(root,'..','unrelated.jsonl')),null);
});
test('generic token activity alone never invents a running or completed state',()=>{
 const s=emptyLifecycle();reduceCodexRecord(s,event('token_count','x',at,{info:{total_token_usage:{total_tokens:100}}}));assert.equal(s.state,'unknown');assert.equal(s.tokens,100);
});
test('restart recovers a long active turn whose start is outside the initial tail',async t=>{
 const root=await temp(t),file=path.join(root,'long.jsonl'),reader=new CodexEventReader({root,now:()=>at+50});
 const filler=line(event('token_count','turn-1',at+10,{padding:'x'.repeat(1024)}));
 await writeFile(file,line(event('task_started'))+filler.repeat(4600));
 assert.equal((await reader.read(file)).catchingUp,true);
 const recovered=await reader.read(file);assert.equal(recovered.state,'running');assert.equal(recovered.catchingUp,false);assert.equal(recovered.turnId,'turn-1');
});
test('WorkBuddy pending remains ambiguous and has no approval permission; stale nonterminal rows are unknown',()=>{
 const row={id:'x',status:'pending',updated_at:at,last_activity_at:at};
 const waiting=desktopTask(row,{online:true,now:at});assert.equal(waiting.state,'waiting');assert.equal(waiting.stateLabel,'等待 / 未开始');assert.equal(waiting.capabilities.approve,false);
 assert.equal(desktopTask({...row,status:'working'},{online:false,now:at}).state,'unknown');
 assert.equal(desktopTask({...row,status:'working'},{online:true,now:at+200000}).state,'unknown');
 assert.equal(desktopTask({...row,status:'error'},{online:true,now:at}).state,'failed');
});
test('WorkBuddy read-only observer sees committed live changes; context occupancy is not cumulative tokens',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'vibedock-status-')),file=path.join(root,'workbuddy.db'),writer=new DatabaseSync(file);
 writer.exec('PRAGMA journal_mode=WAL; CREATE TABLE sessions(id TEXT PRIMARY KEY,title TEXT,custom_title TEXT,cwd TEXT,status TEXT,updated_at INTEGER,last_activity_at INTEGER,deleted_at INTEGER); CREATE TABLE session_usage(session_id TEXT,used INTEGER,size INTEGER);');
 writer.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,NULL)').run('x','Test',null,'workspace','working',at,at);
 writer.prepare('INSERT INTO session_usage VALUES (?,?,?)').run('x',100,200000);
 const adapter=new WorkBuddyDesktopAdapter({root,now:()=>at+50,onlineProbe:async()=>true});
 t.after(async()=>{adapter.close();writer.close();assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true})});
 let result=await adapter.read();assert.equal(result.tasks[0].state,'running');assert.equal(result.tasks[0].tokens,null);assert.deepEqual(result.tasks[0].contextUsage,{used:100,size:200000});
 writer.prepare('UPDATE sessions SET status=? WHERE id=?').run('completed','x');result=await adapter.read();assert.equal(result.tasks[0].state,'completed');
 assert.throws(()=>adapter.db.exec("UPDATE sessions SET status='failed'"),/readonly|read-only/i);
 assert.equal(writer.prepare('SELECT status FROM sessions WHERE id=?').get('x').status,'completed');
});
