const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('sophosDesktop',Object.freeze({session:()=>ipcRenderer.invoke('desktop:session')}));
