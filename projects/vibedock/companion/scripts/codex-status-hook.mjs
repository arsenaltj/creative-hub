import {appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const supported=new Set(['PermissionRequest','PostToolUse','UserPromptSubmit','Stop','Interrupt']);
export function safeEvent(input,now=Date.now()){
  if(!supported.has(input.hook_event_name)||!isId(input.session_id)||!isId(input.turn_id))return null;
  const event={v:1,sessionId:input.session_id,turnId:input.turn_id,event:input.hook_event_name,at:now};
  if(['PermissionRequest','PostToolUse'].includes(event.event)){
    if(typeof input.tool_name!=='string')return null;
    event.tool=input.tool_name.slice(0,120);
    // Correlate the result with the pending request without retaining commands, paths, prompts or outputs.
    event.callHash=createHash('sha256').update(JSON.stringify([input.tool_name,canonical(input.tool_input)])).digest('hex');
  }
  return event;
}
function canonical(value){return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value}
function isId(value){return typeof value==='string'&&/^[\w-]{8,80}$/.test(value)}
export async function writeHook(input,file){const event=safeEvent(input);if(!event)return;await mkdir(path.dirname(file),{recursive:true});await appendFile(file,JSON.stringify(event)+'\n',{mode:0o600})}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // Fail open: no output or decision, and never block the original client if the companion is unavailable.
  const timeout=setTimeout(()=>process.exit(0),1500);
  try{let data='';for await(const part of process.stdin){data+=part;if(data.length>2*1024*1024)throw Error('limit')}
    await writeHook(JSON.parse(data),fileURLToPath(new URL('../.local/codex-hook-events.jsonl',import.meta.url)));
  }catch{}finally{clearTimeout(timeout)}
}
