import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {FilePreferences,cleanPreferences} from '../src/preferences.mjs';
import {Companion} from '../src/store.mjs';

test('preferences save only tool and four task IDs, and restore chosen slots',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'vibedock-preferences-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'preferences.json'),preferences=new FilePreferences(file);
 const tasks=Array.from({length:5},(_,i)=>({id:`task-${i}`,title:`任务 ${i}`,state:'running',tokens:null,capabilities:{}}));
 const adapters={codex:{read:async()=>({tasks,quota:[]})},workbuddy:{read:async()=>({tasks:[],quota:[]})}};
 const first=new Companion({defaultMode:'live',adapters,preferences});await first.refresh('codex');
 await first.command({v:1,actionId:'pin-task-100',tool:'codex',epoch:first.epoch,source:'pc',type:'task.pin',taskId:'task-4',slot:1});
 const raw=await readFile(file,'utf8');assert.ok(!raw.includes('title'));assert.ok(!raw.includes('token'));assert.ok(!raw.includes('summary'));
 assert.deepEqual(JSON.parse(raw).slots.codex,['task-0','task-4','task-2','task-3']);
 const second=new Companion({defaultMode:'live',adapters,preferences});await second.refresh('codex');
 assert.deepEqual(second.snapshot().tasks.map(v=>v.id),['task-0','task-4','task-2','task-3']);
 first.close();second.close();
});

test('invalid preference contents are discarded without affecting startup',()=>{
 assert.deepEqual(cleanPreferences({activeTool:'evil',slots:{codex:['good',7,'x'.repeat(200)]}}),{
  activeTool:'codex',slots:{codex:['good',null,null,null],workbuddy:[null,null,null,null]}
 });
});
