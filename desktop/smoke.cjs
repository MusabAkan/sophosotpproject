const {app}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sophos-otp-smoke-'));
process.env.SOPHOS_OTP_DATA_DIR=temporary;app.setPath('userData',path.join(temporary,'electron'));
app.commandLine.appendSwitch('disable-gpu');
const deadline=setTimeout(()=>{console.error('FAIL: desktop smoke test timed out.');app.exit(1);},60000);
function waitFor(window,expression){return window.webContents.executeJavaScript('new Promise((resolve,reject)=>{let count=0;const timer=setInterval(()=>{if('+expression+'){clearInterval(timer);resolve(true);}else if(++count>200){clearInterval(timer);reject(new Error("UI readiness timeout"));}},100);})');}
let started=false;
app.on('browser-window-created',(_event,window)=>{
  if(started)return;started=true;
  window.webContents.once('did-finish-load',async()=>{
    try{
      await waitFor(window,'document.querySelector("app-root h1")?.textContent?.includes("Kodun burada.")');
      await waitFor(window,'document.querySelector(".language-select .language-flag")?.naturalWidth > 0');
      assert.equal(await window.webContents.executeJavaScript('getComputedStyle(document.querySelector(".workspace")).display'),'grid');
      const token=(await window.webContents.executeJavaScript('window.sophosDesktop.session()')).token,base=new URL(window.webContents.getURL()).origin;
      const headers={'X-App-Token':token,'Content-Type':'application/json'};
      async function post(endpoint,value){const response=await fetch(base+'/api/profiles/'+endpoint,{method:'POST',headers,body:JSON.stringify(value)});assert.equal(response.status,201);return response.json();}
      const synthetic={version:2,name:'Smoke Work',provider:'sophos',language:'tr',profile:'Example VPN',username:'smoke-test-user',password:'smoke-only-password',otp:{secret:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',algorithm:'SHA1',period:30,digits:6}};
      const first=await post('save',synthetic),second=await post('save',{...synthetic,name:'Smoke Home',username:'smoke-second-user'});
      async function reload(){const loaded=new Promise(resolve=>window.webContents.once('did-finish-load',resolve));window.webContents.reload();await loaded;}
      await reload();await waitFor(window,'document.querySelector("#vpn-username")?.value==="smoke-second-user"');
      await post('load',{id:first.id});await reload();await waitFor(window,'document.querySelector("#vpn-username")?.value==="smoke-test-user"');
      assert.equal(await window.webContents.executeJavaScript('document.querySelector("#profile-name").value'),'Smoke Work');
      const bytes=fs.readFileSync(path.join(temporary,'profiles.sqlite'));
      for(const value of [synthetic.name,synthetic.username,synthetic.password,synthetic.otp.secret])assert.equal(bytes.includes(Buffer.from(value)),false);
      await post('remove',{id:second.id});const catalog=await (await fetch(base+'/api/profiles',{headers})).json();assert.equal(catalog.profiles.length,1);assert.equal(catalog.profiles[0].id,first.id);
      console.log('PASS: desktop rendering, real Windows encryption, multiple profiles, reload, selection and isolated deletion.');clearTimeout(deadline);app.quit();
    }catch{console.error('FAIL: desktop UI or Windows encrypted-profile integration.');clearTimeout(deadline);app.exit(1);}
  });
});
app.on('will-quit',()=>{if(path.resolve(temporary).startsWith(path.resolve(os.tmpdir())+path.sep)){try{fs.rmSync(temporary,{recursive:true,force:true});}catch{}}});
require('./main.cjs');
