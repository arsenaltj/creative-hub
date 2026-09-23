import {readFileSync,writeFileSync,mkdirSync,renameSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function preferencesPath(){
 const base=process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local');
 return path.join(base,'VibeDock','preferences.json');
}

export function cleanPreferences(value){
 const result={activeTool:['codex','workbuddy'].includes(value?.activeTool)?value.activeTool:'codex',slots:{}};
 for(const tool of ['codex','workbuddy'])result.slots[tool]=Array.from({length:4},(_,i)=>{
  const id=value?.slots?.[tool]?.[i];return typeof id==='string' && id.length<=160?id:null;
 });
 return result;
}

export class FilePreferences {
 constructor(file=preferencesPath()){this.file=file}
 read(){try{return cleanPreferences(JSON.parse(readFileSync(this.file,'utf8')))}catch{return cleanPreferences(null)}}
 write(value){
  const safe=cleanPreferences(value),folder=path.dirname(this.file),temp=`${this.file}.${process.pid}.tmp`;
  mkdirSync(folder,{recursive:true});
  try {writeFileSync(temp,JSON.stringify(safe),'utf8');renameSync(temp,this.file)}
  catch(error){try{unlinkSync(temp)}catch{}throw error}
 }
}
