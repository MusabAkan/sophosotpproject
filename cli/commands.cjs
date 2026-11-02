const {VaultError}=require('@sophos-otp/storage');
const HELP=`Sophos OTP CLI

  profiles             List saved profile IDs and names
  use <id>             Select a saved profile
  code [id]            Print the current OTP (selected profile by default)
  connect [id]         Submit a Sophos sign-in request for the saved profile
  delete <id>          Delete only the specified saved profile
  help                 Show this help

Create and edit profiles in the application. Passwords and OTP secrets are never command-line arguments.
`;
async function runCli(args,{vault,generateOtp,connect,write=message=>process.stdout.write(message+'\n'),writeError=message=>process.stderr.write(message+'\n')}){
  const [command='help',id,...extra]=args;
  if(['help','--help','-h'].includes(command)){write(HELP);return 0;}
  if(extra.length||!['profiles','use','code','connect','delete'].includes(command)||(command==='profiles'&&id)||(['use','delete'].includes(command)&&!id)){
    writeError('Invalid command. Run help for usage.');return 2;
  }
  try{
    if(command==='profiles'){
      const catalog=await vault.list();
      if(!catalog.profiles.length)write('No saved profiles. Create one in the application.');
      for(const profile of catalog.profiles)write((catalog.selectedId===profile.id?'* ':'  ')+profile.id+'  '+(profile.readable?profile.name:'[Unreadable profile]'));
      if(catalog.legacyPending)write('A legacy profile needs import in the desktop application.');
      return 0;
    }
    if(command==='delete'){await vault.remove(id);write('Profile deleted.');return 0;}
    const selected=id||(await vault.list()).selectedId;
    if(!selected){writeError('No selected profile. Run profiles, then use <id>.');return 1;}
    const profile=await vault.load(selected);
    if(command==='use'){await vault.select(profile.id);write('Selected: '+profile.name);return 0;}
    if(!profile.otp){writeError('This profile has no OTP secret. Add one in the application.');return 1;}
    if(command==='code'){write(generateOtp(profile.otp).code);return 0;}
    if(!profile.profile||!profile.username||!profile.password){writeError('Complete the connection name, username and password in the application.');return 1;}
    await connect({profile:profile.profile,username:profile.username,password:profile.password,otp:profile.otp});
    write('Sign-in request submitted. Check the connection status in Sophos Connect.');return 0;
  }catch(error){
    if(error instanceof VaultError)writeError(error.message);
    else writeError('The operation failed. Check Windows encryption, the saved profile and Sophos Connect; if a code is expiring, retry in a few seconds.');
    return 1;
  }
}
module.exports={runCli,HELP};
