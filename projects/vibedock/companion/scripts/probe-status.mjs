import {CodexAdapter} from '../src/adapters.mjs';
import {WorkBuddyDesktopAdapter} from '../src/workbuddy-desktop.mjs';
const adapters={codex:new CodexAdapter(),workbuddy:new WorkBuddyDesktopAdapter()};
try{
 for(const [name,adapter] of Object.entries(adapters)){
  try{const result=await adapter.read();console.log(JSON.stringify({tool:name,count:result.tasks.length,online:result.localOnline,tasks:result.tasks.slice(0,4).map(t=>({id:t.id,state:t.state,evidence:t.evidence,updatedAt:t.updatedAt})),quotaWindows:result.quota.length}))}
  catch(e){console.log(JSON.stringify({tool:name,error:e.message}))}
 }
}finally{for(const adapter of Object.values(adapters))adapter.close()}
