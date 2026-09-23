import {open,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {StringDecoder} from 'node:string_decoder';

const INITIAL_BYTES=4*1024*1024;
export function emptyLifecycle(){return {state:'unknown',turnId:null,eventAt:null,activityAt:null,eventType:null,tokens:null,summary:null}}
export function reduceCodexRecord(state,record) {
  const at=Date.parse(record.timestamp);
  if(Number.isFinite(at))state.activityAt=Math.max(state.activityAt || 0,at);
  if(record.type!=='event_msg')return state;
  const e=record.payload || {};
  if(e.type==='token_count'){
    const tokens=e.info?.total_token_usage?.total_tokens;
    if(typeof tokens==='number' && Number.isFinite(tokens) && tokens>=0)state.tokens=tokens;
  }
  if(e.type==='item_completed' && e.item?.type==='agentMessage' && typeof e.item.text==='string')state.summary=e.item.text.slice(0,3000);
  if(!['task_started','task_complete','turn_aborted'].includes(e.type))return state;
  if(!Number.isFinite(at) || (state.eventAt && at<state.eventAt))return state;
  // A late completion from a previous turn must not finish a newer turn.
  if(e.type!=='task_started' && state.turnId && e.turn_id && e.turn_id!==state.turnId)return state;
  state.state=e.type==='task_started'?'running':e.type==='task_complete'?'completed':'paused';
  state.turnId=e.turn_id || state.turnId;state.eventAt=at;state.eventType=e.type;
  if(e.type==='task_started')state.summary=null;
  if(e.type==='task_complete' && typeof e.last_agent_message==='string')state.summary=e.last_agent_message.slice(0,3000);
  return state;
}

export class CodexEventReader {
  constructor({root=path.resolve(process.env.CODEX_HOME || path.join(os.homedir(),'.codex'),'sessions'),now=Date.now,staleMs=180000}={}) {
    this.root=path.resolve(root);this.now=now;this.staleMs=staleMs;this.files=new Map();
  }
  async allowed(file){
    const [root,target]=await Promise.all([realpath(this.root),realpath(file)]);
    const rel=path.relative(root,target);
    return path.extname(target)==='.jsonl' && rel!=='' && !rel.startsWith('..') && !path.isAbsolute(rel);
  }
  consume(entry,bytes,initial=false){
    let text=entry.remainder+entry.decoder.write(bytes);
    if(initial && entry.offset>0){const newline=text.indexOf('\n');text=newline<0?'':text.slice(newline+1)}
    const lines=text.split('\n');entry.remainder=lines.pop();
    if(entry.remainder.length>8*1024*1024)entry.remainder='';
    for(const line of lines){try{reduceCodexRecord(entry.state,JSON.parse(line))}catch{/* Incomplete/corrupt records never become state changes. */}}
  }
  async read(file){
    if(!file)return null;
    let handle;
    try {
      if(!await this.allowed(file))return null;
      handle=await open(file,'r');const info=await handle.stat();
      let entry=this.files.get(file);
      if(!entry || info.size<entry.offset || (entry.ino && info.ino!==entry.ino)){
        entry={offset:Math.max(0,info.size-INITIAL_BYTES),tailStart:Math.max(0,info.size-INITIAL_BYTES),backfilled:false,ino:info.ino,state:emptyLifecycle(),remainder:'',decoder:new StringDecoder('utf8')};
        this.files.set(file,entry);entry.initial=true;
      }
      // Incremental reads keep busy sessions cheap; bounded work per polling pass.
      const end=Math.min(info.size,entry.offset+8*1024*1024);
      while(entry.offset<end){const length=Math.min(1024*1024,end-entry.offset),buffer=Buffer.alloc(length);const {bytesRead}=await handle.read(buffer,0,length,entry.offset);if(!bytesRead)break;
        this.consume(entry,buffer.subarray(0,bytesRead),entry.initial);entry.initial=false;entry.offset+=bytesRead;
      }
      // A long active turn can have no lifecycle marker in the initial tail.
      // Replay a bounded file once, preserving the per-pass read budget.
      if(!entry.state.eventType && entry.tailStart>0 && !entry.backfilled && info.size<=64*1024*1024){
        Object.assign(entry,{offset:0,backfilled:true,initial:false,state:emptyLifecycle(),remainder:'',decoder:new StringDecoder('utf8')});
      }
      const data={...entry.state};
      const stale=data.state==='running' && (!data.activityAt || this.now()-data.activityAt>this.staleMs);
      return {...data,state:stale?'unknown':data.state,stale,catchingUp:entry.offset<info.size};
    }catch{return null}finally{await handle?.close()}
  }
  prune(paths){const keep=new Set(paths);for(const p of this.files.keys())if(!keep.has(p))this.files.delete(p)}
}
