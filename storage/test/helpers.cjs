const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createCipheriv,createDecipheriv,randomBytes}=require('node:crypto');
const {ProfileVault}=require('..');
// Test-only adapter. Production always uses Windows account encryption.
const key=Buffer.alloc(32,7);
const crypto={available:async()=>true,
  encrypt:async text=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);},
  decrypt:async bytes=>{const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');}
};
const profile=(name='Test account')=>({version:2,name,provider:'sophos',language:'tr',profile:'Example VPN',username:'test-user',password:'test-only-password!',otp:{secret:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',algorithm:'SHA1',period:30,digits:6}});
function fixture(t,codec=crypto,options={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'otp-vault-test-')),file=path.join(dir,'test.sqlite'),vault=new ProfileVault(file,codec,options);
  t.after(()=>{try{vault.close();}catch{}if(!path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unexpected test directory');fs.rmSync(dir,{recursive:true,force:true});});
  return {vault,file,dir};
}
module.exports={crypto,profile,fixture};
