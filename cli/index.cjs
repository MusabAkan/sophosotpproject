const {openVault}=require('@sophos-otp/storage');
const {runCli}=require('./commands.cjs');
async function main(args=process.argv.slice(2),options={}){
  const vault=options.vault||openVault();
  try{return await runCli(args,{vault,
    generateOtp:value=>require('../backend/dist/backend/src/otp.js').generateOtp(value),
    connect:value=>{const {SophosService}=require('../backend/dist/backend/src/sophos.js');return new SophosService().connect(value);},
    ...options});
  }finally{if(!options.vault)vault.close();}
}
if(require.main===module)main().then(code=>{process.exitCode=code;}).catch(()=>{console.error('Could not open the local profile store.');process.exitCode=1;});
module.exports={main};
