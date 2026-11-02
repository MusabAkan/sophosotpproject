const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {ProfileVault,VaultError,validateProfile}=require('./vault.cjs');
const {createWindowsCrypto}=require('./windows-crypto.cjs');
function dataDirectory(){return process.env.SOPHOS_OTP_DATA_DIR||path.join(process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'sophos-otp-project');}
function openVault(options={}){
  const directory=options.directory||dataDirectory();fs.mkdirSync(directory,{recursive:true});
  const legacyFiles=options.legacyFiles||(!options.directory&&!process.env.SOPHOS_OTP_DATA_DIR&&process.env.APPDATA?[path.join(process.env.APPDATA,'Sophos OTP','profiles.sqlite')]:[]);
  return new ProfileVault(path.join(directory,'profiles.sqlite'),options.crypto||createWindowsCrypto(),{...options,legacyFiles});
}
module.exports={ProfileVault,VaultError,validateProfile,createWindowsCrypto,openVault,dataDirectory};
