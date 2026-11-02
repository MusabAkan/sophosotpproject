const {app,BrowserWindow,ipcMain,safeStorage,dialog}=require('electron');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {openVault}=require('@sophos-otp/storage');
let window,api,vault,origin;
const smoke=!app.isPackaged&&process.argv.includes('--smoke-test');
const cliIndex=process.argv.indexOf('--cli');
function createVault(){return openVault({
  legacyFiles:process.env.SOPHOS_OTP_DATA_DIR?[]:[path.join(app.getPath('userData'),'profiles.sqlite'),path.join(app.getPath('appData'),'Sophos OTP','profiles.sqlite')],
  legacyCrypto:{available:()=>safeStorage.isAsyncEncryptionAvailable(),encrypt:value=>safeStorage.encryptStringAsync(value),decrypt:value=>safeStorage.decryptStringAsync(value)}
});}
if(cliIndex>=0){
  app.whenReady().then(async()=>{
    vault=createVault();
    const code=await require('../cli/index.cjs').main(process.argv.slice(cliIndex+1),{vault});
    vault.close();vault=null;app.exit(code);
  }).catch(()=>{console.error('Could not open the local profile store.');vault?.close();app.exit(1);});
}else if(!app.requestSingleInstanceLock()){app.quit();}else{
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
  app.whenReady().then(async()=>{
    const token=randomBytes(32).toString('hex');
    vault=createVault();
    const {createApi}=require('../backend/dist/backend/src/main.js');
    api=await createApi({token,vault,port:0,staticDirectory:path.join(__dirname,'../frontend/dist/browser')});
    origin='http://127.0.0.1:'+api.getHttpServer().address().port;
    window=new BrowserWindow({width:1240,height:1080,minWidth:540,minHeight:640,show:false,backgroundColor:'#090c19',autoHideMenuBar:true,
      webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    function trusted(event){if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Untrusted IPC sender.');}
    ipcMain.handle('desktop:session',event=>{trusted(event);return {token};});
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
    window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    window.once('ready-to-show',()=>{if(!smoke)window.show();});
    await window.loadURL(origin);
  }).catch(()=>{if(smoke){console.error('FAIL: desktop initialization.');app.exit(1);return;}dialog.showErrorBox('Sophos OTP','The application could not start. Check the local data directory and try again.');app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>{vault?.close();void api?.close();});
}
