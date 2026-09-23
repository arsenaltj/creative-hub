import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function mergeHooks(config,command){
  const next=structuredClone(config);next.hooks??={};
  for(const event of ['PermissionRequest','PostToolUse','UserPromptSubmit','Stop','Interrupt']){
    const groups=next.hooks[event]??=[];
    if(!Array.isArray(groups))throw Error('现有钩子格式不支持，未修改配置');
    if(!groups.some(g=>g.hooks?.some(h=>h.command===command)))groups.push({hooks:[{type:'command',command,timeout:2,statusMessage:'同步 VibeDock 状态'}]});
    next.hooks[event]=groups;
  }
  return next;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const home=process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),file=path.join(home,'hooks.json');
  const script=fileURLToPath(new URL('./codex-status-hook.mjs',import.meta.url));
  const command=`"${process.execPath}" "${script}"`;
  let config={},exists=false;
  try{config=JSON.parse(await readFile(file,'utf8'));exists=true}catch(e){if(e.code!=='ENOENT')throw e}
  const next=mergeHooks(config,command);
  if(JSON.stringify(next)!==JSON.stringify(config)){
    await mkdir(home,{recursive:true});if(exists)await copyFile(file,`${file}.vibedock-backup-${Date.now()}`);
    await writeFile(file,JSON.stringify(next,null,2)+'\n',{mode:0o600});
  }
  console.log('已注册 5 个仅上报状态的 VibeDock 钩子，保留原有配置。请在 Codex 设置 → Hooks 中审阅并信任这些钩子。没有修改任何钩子信任或审批策略。');
}
