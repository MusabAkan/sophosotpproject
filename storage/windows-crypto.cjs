const {execFile}=require('node:child_process');
const path=require('node:path');
const MAGIC=Buffer.from('SOTP2\0');
// This fixed script never contains a credential. Values travel through stdin/stdout pipes.
const SCRIPT=`$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$request=[Console]::In.ReadToEnd() | ConvertFrom-Json
$entropy=[Text.Encoding]::UTF8.GetBytes('io.sophosotp.profiles.v2')
$result=@()
foreach ($item in $request.data) {
  try {
    $bytes=[Convert]::FromBase64String($item)
    if ($request.mode -eq 'protect') {
      $output=[Security.Cryptography.ProtectedData]::Protect($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    } elseif ($request.mode -eq 'unprotect') {
      $output=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    } else { throw 'Invalid operation' }
    $result+=,[Convert]::ToBase64String($output)
  } catch { $result+=,$null }
}
ConvertTo-Json -Compress -InputObject @($result)`;
function createWindowsCrypto({runner=execFile,platform=process.platform}={}){
  async function transform(mode,values){
    if(platform!=='win32')throw Error('Windows account encryption is unavailable.');
    const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    return new Promise((resolve,reject)=>{
      const child=runner(executable,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(SCRIPT,'utf16le').toString('base64')],
        {windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:4*1024*1024},(error,stdout)=>{
          if(error){reject(Error('Windows account encryption is unavailable.'));return;}
          try{const result=JSON.parse(stdout.trim());if(!Array.isArray(result)||result.length!==values.length||result.some(value=>value!==null&&(typeof value!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))))throw Error();resolve(result);}
          catch{reject(Error('Windows account encryption returned an invalid response.'));}
        });
      child.stdin.on('error',()=>{});
      child.stdin.end(JSON.stringify({mode,data:values.map(value=>value.toString('base64'))}));
    });
  }
  return {
    available:async()=>platform==='win32',
    async encrypt(text){const [result]=await transform('protect',[Buffer.from(text,'utf8')]);if(!result)throw Error('Windows account encryption is unavailable.');return Buffer.concat([MAGIC,Buffer.from(result,'base64')]);},
    async decryptMany(values){
      const valid=values.map(value=>value.subarray(0,MAGIC.length).equals(MAGIC));
      const inputs=values.map((value,index)=>valid[index]?value.subarray(MAGIC.length):Buffer.alloc(0));
      const result=await transform('unprotect',inputs);
      return result.map((value,index)=>valid[index]&&value?Buffer.from(value,'base64').toString('utf8'):null);
    },
    async decrypt(value){const [result]=await this.decryptMany([value]);if(result===null)throw Error('Profile decryption failed.');return result;}
  };
}
module.exports={createWindowsCrypto};
