const {DatabaseSync}=require('node:sqlite');
const {randomUUID,createHash}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const LANGUAGES=['tr','en','de','fr','es'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class VaultError extends Error{constructor(code,message){super(message);this.code=code;}}
function invalid(){return new VaultError('INVALID_PROFILE','Invalid profile. Check its name, fields and OTP settings.');}
function validId(id){if(typeof id!=='string'||!UUID.test(id))throw invalid();return id;}
function validateProfile(value){
  if(!value||value.version!==2||value.provider!=='sophos'||!LANGUAGES.includes(value.language))throw invalid();
  if(typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>80||/[\x00-\x1f\x7f]/.test(value.name))throw invalid();
  if(value.id!==undefined){validId(value.id);if(!Number.isInteger(value.revision)||value.revision<1)throw invalid();}
  for(const [name,limit] of [['profile',256],['username',256],['password',1024]])
    if(typeof value[name]!=='string'||value[name].length>limit||/[\0\r\n]/.test(value[name]))throw invalid();
  let otp=null;
  if(value.otp!==null){
    const input=value.otp;
    if(!input||typeof input.secret!=='string'||input.secret.length>4096||!['SHA1','SHA256','SHA512'].includes(input.algorithm)||![6,8].includes(input.digits)||!Number.isInteger(input.period)||input.period<10||input.period>300)throw invalid();
    const normalized=input.secret.replace(/\s/g,'').toUpperCase(),secret=normalized.replace(/=+$/,'');
    if(!/^[A-Z2-7]+={0,6}$/.test(normalized)||[1,3,6].includes(secret.length%8)||(normalized.includes('=')&&normalized.length%8!==0))throw invalid();
    const bits=(secret.length*5)%8;
    if(secret.length<2||(bits&&('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(secret.at(-1))&((1<<bits)-1))))throw invalid();
    otp={secret,algorithm:input.algorithm,period:input.period,digits:input.digits};
  }
  return {version:2,...(value.id?{id:value.id,revision:value.revision}:{}),name:value.name.trim(),provider:'sophos',language:value.language,profile:value.profile,username:value.username,password:value.password,otp};
}
class ProfileVault{
  constructor(filename,crypto,options={}){
    this.crypto=crypto;this.filename=filename;this.options=options;this.legacyPending=false;
    this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE;
      CREATE TABLE IF NOT EXISTS vault_profiles(id TEXT PRIMARY KEY,payload BLOB NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS vault_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  }
  setting(key){return this.db.prepare('SELECT value FROM vault_settings WHERE key=?').get(key)?.value??null;}
  setSetting(key,value){if(value===null)this.db.prepare('DELETE FROM vault_settings WHERE key=?').run(key);else this.db.prepare('INSERT INTO vault_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value);}
  transaction(action){this.db.exec('BEGIN IMMEDIATE');try{const result=action();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  initialize(){return this.initialization??=(async()=>{
    for(const filename of new Set([this.filename,...(this.options.legacyFiles||[])])){
      let source=this.db,external=false;
      try{
        if(filename!==this.filename){if(!fs.existsSync(filename))continue;source=new DatabaseSync(filename,{readOnly:true});external=true;}
        if(!source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'").get())continue;
        const row=source.prepare('SELECT payload FROM profiles WHERE id=1').get();if(!row)continue;
        const key='legacy:'+createHash('sha256').update(path.resolve(filename)).update(Buffer.from(row.payload)).digest('hex');
        if(this.setting(key))continue;
        if(!this.options.legacyCrypto){this.legacyPending=true;continue;}
        const decoded=await this.options.legacyCrypto.decrypt(Buffer.from(row.payload));
        const old=JSON.parse(typeof decoded==='string'?decoded:decoded.result);
        if(old.version!==1)throw invalid();
        const value=validateProfile({...old,version:2,provider:'sophos',name:(old.profile||old.username||'Imported profile').slice(0,80)});
        const id=randomUUID(),saved={...value,id,revision:1},encrypted=await this.encrypt(saved);
        this.transaction(()=>{
          if(this.setting(key))return;
          this.db.prepare('INSERT INTO vault_profiles VALUES(?,?,?,?)').run(id,encrypted,1,new Date().toISOString());
          if(!this.setting('selected'))this.setSetting('selected',id);
          this.setSetting(key,'done');
          if(!external)this.db.prepare('DELETE FROM profiles WHERE id=1').run();
        });
      }catch{this.legacyPending=true;}finally{if(external)source.close();}
    }
  })();}
  async encrypt(value){
    try{if(!await this.crypto.available())throw Error();const result=await this.crypto.encrypt(JSON.stringify(value));if(!Buffer.isBuffer(result)||!result.length)throw Error();return result;}
    catch{throw new VaultError('ENCRYPTION_UNAVAILABLE','Windows account encryption is unavailable. No credentials were saved.');}
  }
  decode(text,row){const decoded=typeof text==='string'?text:text?.result;if(!decoded)throw Error();const value=validateProfile(JSON.parse(decoded));if(value.id!==row.id||value.revision!==row.revision)throw Error();return value;}
  async list(){
    await this.initialize();
    const rows=this.db.prepare('SELECT * FROM vault_profiles ORDER BY updated_at DESC,id').all();
    let values=[];
    try{values=rows.length?(this.crypto.decryptMany?await this.crypto.decryptMany(rows.map(row=>Buffer.from(row.payload))):await Promise.all(rows.map(row=>this.crypto.decrypt(Buffer.from(row.payload)).catch(()=>null)))):[];}catch{values=rows.map(()=>null);}
    const profiles=rows.map((row,index)=>{try{const value=this.decode(values[index],row);return {id:row.id,name:value.name,provider:value.provider,updatedAt:row.updated_at,readable:true};}catch{return {id:row.id,name:'',provider:'sophos',updatedAt:row.updated_at,readable:false};}});
    const selectedId=this.setting('selected');
    return {profiles,selectedId:profiles.some(profile=>profile.id===selectedId)?selectedId:null,legacyPending:this.legacyPending};
  }
  async load(id){
    await this.initialize();validId(id);
    const row=this.db.prepare('SELECT * FROM vault_profiles WHERE id=?').get(id);
    if(!row)throw new VaultError('PROFILE_NOT_FOUND','The saved profile no longer exists.');
    try{return this.decode(await this.crypto.decrypt(Buffer.from(row.payload)),row);}
    catch{throw new VaultError('DECRYPTION_FAILED','The saved profile could not be decrypted. Use the original Windows account.');}
  }
  async select(id){await this.initialize();if(id!==null){validId(id);if(!this.db.prepare('SELECT id FROM vault_profiles WHERE id=?').get(id))throw new VaultError('PROFILE_NOT_FOUND','The saved profile no longer exists.');}this.setSetting('selected',id);}
  async save(input){
    await this.initialize();const value=validateProfile(input),id=value.id||randomUUID();
    const saved={...value,id,revision:value.id?value.revision+1:1};
    const encrypted=await this.encrypt(saved);
    this.transaction(()=>{
      if(value.id){
        const changed=this.db.prepare('UPDATE vault_profiles SET payload=?,revision=?,updated_at=? WHERE id=? AND revision=?').run(encrypted,saved.revision,new Date().toISOString(),id,value.revision).changes;
        if(!changed){if(!this.db.prepare('SELECT id FROM vault_profiles WHERE id=?').get(id))throw new VaultError('PROFILE_NOT_FOUND','The saved profile no longer exists.');throw new VaultError('PROFILE_CONFLICT','This profile changed in another window. Reload it before saving.');}
      }else this.db.prepare('INSERT INTO vault_profiles VALUES(?,?,?,?)').run(id,encrypted,1,new Date().toISOString());
      this.setSetting('selected',id);
    });
    return saved;
  }
  async remove(id){
    await this.initialize();validId(id);
    this.transaction(()=>{if(!this.db.prepare('DELETE FROM vault_profiles WHERE id=?').run(id).changes)throw new VaultError('PROFILE_NOT_FOUND','The saved profile no longer exists.');if(this.setting('selected')===id)this.setSetting('selected',null);});
  }
  close(){this.db.close();}
}
module.exports={ProfileVault,VaultError,validateProfile};
