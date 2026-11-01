const {DatabaseSync}=require('node:sqlite');
const languages=['tr','en','de','fr','es'];
function validateProfile(value){
  if(!value || value.version!==1 || !languages.includes(value.language))throw Error('Invalid saved profile.');
  for(const [name,limit] of [['profile',256],['username',256],['password',1024]])
    if(typeof value[name]!=='string'||value[name].length>limit||/[\0\r\n]/.test(value[name]))throw Error('Invalid profile field.');
  if(value.otp!==null){
    const otp=value.otp;
    if(!otp||typeof otp.secret!=='string'||otp.secret.length>4096||!otp.secret||!/^[A-Z2-7=\s]+$/i.test(otp.secret)
      ||!['SHA1','SHA256','SHA512'].includes(otp.algorithm)||![6,8].includes(otp.digits)
      ||!Number.isInteger(otp.period)||otp.period<10||otp.period>300)throw Error('Invalid saved OTP configuration.');
  }
  return {version:1,language:value.language,profile:value.profile,username:value.username,password:value.password,otp:value.otp===null?null:{secret:value.otp.secret,algorithm:value.otp.algorithm,digits:value.otp.digits,period:value.otp.period}};
}
class ProfileVault{
  constructor(filename,crypto){
    this.crypto=crypto;
    this.db=new DatabaseSync(filename);
    this.db.exec('PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE; CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY CHECK(id=1), payload BLOB NOT NULL);');
  }
  async available(){if(!await this.crypto.available())throw Error('OS encryption is unavailable. No credentials were saved.');}
  async save(value){
    const profile=validateProfile(value);await this.available();
    const encrypted=await this.crypto.encrypt(JSON.stringify(profile));
    if(!Buffer.isBuffer(encrypted)||encrypted.length===0)throw Error('Encryption failed.');
    this.db.prepare('INSERT INTO profiles(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(encrypted);
  }
  async load(){
    const row=this.db.prepare('SELECT payload FROM profiles WHERE id=1').get();
    if(!row)return null;
    await this.available();
    try{const decrypted=await this.crypto.decrypt(Buffer.from(row.payload)); const value=validateProfile(JSON.parse(typeof decrypted==='string'?decrypted:decrypted.result)); if(decrypted.shouldReEncrypt)await this.save(value);return value;}
    catch{throw Error('The saved profile could not be decrypted. Use the original Windows account or delete the saved profile.');}
  }
  remove(){this.db.prepare('DELETE FROM profiles').run();this.db.exec('VACUUM');}
  close(){this.db.close();}
}
module.exports={ProfileVault,validateProfile};
