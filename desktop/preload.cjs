const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('sophosDesktop',Object.freeze({
  session:()=>ipcRenderer.invoke('desktop:session'),
  load:()=>ipcRenderer.invoke('profile:load'),
  save:profile=>ipcRenderer.invoke('profile:save',profile),
  remove:()=>ipcRenderer.invoke('profile:remove')
}));
