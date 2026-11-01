const {app,BrowserWindow,ipcMain,safeStorage,dialog}=require('electron');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {ProfileVault}=require('./vault.cjs');
let window,api,vault,origin;
const smoke=!app.isPackaged && process.argv.includes('--smoke-test');
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
app.whenReady().then(async()=>{
  const token=randomBytes(32).toString('hex');
  const {createApi}=require('../backend/dist/backend/src/main.js');
  api=await createApi({token,port:0,staticDirectory:path.join(__dirname,'../frontend/dist/browser')});
  origin='http://127.0.0.1:'+api.getHttpServer().address().port;
  vault=new ProfileVault(path.join(app.getPath('userData'),'profiles.sqlite'),{
    available:()=>process.platform==='win32' && safeStorage.isAsyncEncryptionAvailable(),
    encrypt:value=>safeStorage.encryptStringAsync(value),
    decrypt:value=>safeStorage.decryptStringAsync(value)
  });
  window=new BrowserWindow({width:1240,height:980,minWidth:540,minHeight:640,show:false,backgroundColor:'#090c19',autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  function trusted(event){if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Untrusted IPC sender.');}
  ipcMain.handle('desktop:session',event=>{trusted(event);return {token};});
  ipcMain.handle('profile:load',async event=>{trusted(event);return vault.load();});
  ipcMain.handle('profile:save',async(event,value)=>{trusted(event);await vault.save(value);return true;});
  ipcMain.handle('profile:remove',event=>{trusted(event);vault.remove();return true;});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  window.once('ready-to-show',()=>{if(!smoke)window.show();});
  await window.loadURL(origin);
}).catch(()=>{if(smoke){console.error('FAIL: desktop initialization.');app.exit(1);return;}dialog.showErrorBox('Sophos OTP','The application could not start. Close other instances and try again.');app.quit();});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{vault?.close();void api?.close();});
}
