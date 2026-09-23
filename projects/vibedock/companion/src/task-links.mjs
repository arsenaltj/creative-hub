import {spawn} from 'node:child_process';
import path from 'node:path';

export const taskIdValid=id=>typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function taskLink(tool,id){
  if(!taskIdValid(id))throw new Error('无法打开：任务标识格式不支持');
  if(tool==='codex')return `codex://threads/${id}`;
  if(tool==='workbuddy')return `workbuddy://task/${id}`;
  throw new Error('不支持的工具');
}
// URLs are constructed from a known tool and validated local task ID, never supplied by the browser.
export async function openDesktopTask(tool,id,{platform=process.platform,launch=spawn}={}){
  const url=taskLink(tool,id);
  if(platform!=='win32')throw new Error('当前任务定位只支持 Windows');
  const exe=path.win32.join(process.env.SystemRoot || 'C:\\Windows','explorer.exe');
  await new Promise((resolve,reject)=>{
    const child=launch(exe,[url],{shell:false,windowsHide:true,stdio:'ignore'});
    child.once('error',()=>reject(new Error('无法请求打开原客户端，请确认应用已安装')));
    child.once('spawn',()=>{child.unref();resolve()});
  });
  return {dispatched:true,verified:false,message:'已向原客户端发送任务链接；请核对打开的任务。审批仍在原客户端完成。'};
}
