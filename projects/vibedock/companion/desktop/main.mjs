import {app,BrowserWindow,Tray,Menu,ipcMain,shell,nativeImage} from 'electron';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=app.isPackaged?path.join(process.resourcesPath,'companion'):path.resolve(here,'..');
if(process.env.VIBEDOCK_DESKTOP_DATA)app.setPath('userData',process.env.VIBEDOCK_DESKTOP_DATA);
const port=Number(process.env.VIBEDOCK_PORT||47831),origin=`http://127.0.0.1:${port}`;let win,tray,child,quitting=false;
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',()=>{win?.show();win?.focus()});
 app.whenReady().then(async()=>{
  let ready=false;try{const response=await fetch(origin+'/api/session',{signal:AbortSignal.timeout(1000)});const data=await response.json();ready=response.ok&&data.snapshot?.v===1&&data.access?.role==='admin'}catch{}
  if(!ready){const bundled=path.join(root,'runtime',process.platform==='win32'?'node.exe':'node'),node=existsSync(bundled)?bundled:'node';child=spawn(node,[path.join(root,'src','server.mjs')],{cwd:root,env:{...process.env,VIBEDOCK_PORT:String(port)},windowsHide:true,stdio:'ignore'});child.on('error',()=>{});
   for(let i=0;i<80;i++){try{const response=await fetch(origin+'/api/session',{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,100))}
  }
  if(!ready){const {dialog}=await import('electron');await dialog.showMessageBox({type:'error',message:'PC 服务未能启动',detail:'请检查端口是否被占用，源码运行时需安装 Node.js；免安装版已包含运行时。'});app.quit();return}
  win=new BrowserWindow({width:390,height:450,minWidth:370,minHeight:440,frame:false,alwaysOnTop:true,show:!process.argv.includes('--hidden'),backgroundColor:'#f5f5ed',title:'VibeDock',webPreferences:{preload:path.join(here,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  win.setAlwaysOnTop(true,process.platform==='win32'?'pop-up-menu':'floating');
  const openExternal=url=>{try{const parsed=new URL(url);if(parsed.origin===origin||parsed.protocol==='https:'&&['open.workbuddy.cn','github.com'].includes(parsed.hostname))void shell.openExternal(parsed.href)}catch{}};
  win.webContents.setWindowOpenHandler(({url})=>{openExternal(url);return {action:'deny'}});
  win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin){event.preventDefault();openExternal(url)}});
  ipcMain.handle('vibedock:pin',event=>{if(event.sender!==win.webContents)return false;const pinned=!win.isAlwaysOnTop();win.setAlwaysOnTop(pinned,pinned&&process.platform==='win32'?'pop-up-menu':'floating');return win.isAlwaysOnTop()});
  ipcMain.handle('vibedock:hide',event=>{if(event.sender===win.webContents)win.hide()});
  const icon=nativeImage.createFromPath(path.join(root,'public','icon-192.png')).resize({width:24,height:24});tray=new Tray(icon);tray.setToolTip('VibeDock · 任务圆屏');tray.setContextMenu(Menu.buildFromTemplate([{label:'显示小圆屏',click:()=>win.show()},{label:'打开 PC 工作台',click:()=>openExternal(origin+'/')},{type:'separator'},{label:'退出 VibeDock',click:()=>app.quit()}]));tray.on('double-click',()=>win.show());
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide()}});await win.loadURL(origin+'/?view=mini');
 });
 app.on('window-all-closed',()=>{});app.on('before-quit',()=>{quitting=true;child?.kill();tray?.destroy()});
}
