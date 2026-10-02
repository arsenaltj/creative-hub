const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('vibeDesktop',{togglePin:()=>ipcRenderer.invoke('vibedock:pin'),close:()=>ipcRenderer.invoke('vibedock:hide')});
