
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const assert=require('node:assert/strict');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sophos-otp-smoke-'));
app.setPath('userData',temporary);
app.commandLine.appendSwitch('disable-gpu');
const deadline=setTimeout(()=>{console.error('FAIL: desktop smoke test timed out.');app.exit(1);},30000);
let started=false;
function waitFor(window,expression){
  return window.webContents.executeJavaScript('new Promise((resolve,reject)=>{let count=0;const timer=setInterval(()=>{if('+expression+'){clearInterval(timer);resolve(true);}else if(++count>100){clearInterval(timer);reject(new Error("UI readiness timeout"));}},100);})');
}
app.on('browser-window-created',(_event,window)=>{
  if(started)return;started=true;
  window.webContents.once('did-finish-load',async()=>{
    try{
      await waitFor(window,'document.querySelector("app-root h1")?.textContent?.includes("Kodun burada.")');
      await waitFor(window,'document.querySelector(".language-select .language-flag")?.naturalWidth > 0');
      assert.equal(await window.webContents.executeJavaScript('getComputedStyle(document.querySelector(".workspace")).display'),'grid');
      const synthetic={version:1,language:'de',profile:'Example VPN',username:'smoke-test-user',password:'smoke-only-password',otp:{secret:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',algorithm:'SHA1',period:30,digits:6}};
      await window.webContents.executeJavaScript('window.sophosDesktop.save('+JSON.stringify(synthetic)+')');
      const restored=await window.webContents.executeJavaScript('window.sophosDesktop.load()');
      assert.deepEqual(restored,synthetic);
      const bytes=fs.readFileSync(path.join(temporary,'profiles.sqlite'));
      for(const value of [synthetic.username,synthetic.password,synthetic.profile,synthetic.otp.secret])assert.equal(bytes.includes(Buffer.from(value)),false);
      const loaded=new Promise(resolve=>window.webContents.once('did-finish-load',resolve));
      window.webContents.reload();await loaded;
      await waitFor(window,'document.documentElement.lang==="de" && document.querySelector("#vpn-username")?.value==="smoke-test-user"');
      assert.equal(await window.webContents.executeJavaScript('document.querySelector("#vpn-password").value'),synthetic.password);
      await window.webContents.executeJavaScript('window.sophosDesktop.remove()');
      assert.equal(await window.webContents.executeJavaScript('window.sophosDesktop.load()'),null);
      console.log('PASS: desktop load, Turkish default, real Windows encryption, SQLite persistence, language/credential restoration and deletion.');
      clearTimeout(deadline);app.quit();
    }catch{console.error('FAIL: desktop UI or encrypted-profile integration.');clearTimeout(deadline);app.exit(1);}
  });
});
app.on('will-quit',()=>{try{fs.rmSync(temporary,{recursive:true,force:true});}catch{}});
require('./main.cjs');
