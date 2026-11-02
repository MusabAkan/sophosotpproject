import type {AddressInfo} from 'node:net';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ProfileVault} from '@sophos-otp/storage';
import {createApi} from '../src/main';
const {fixture,profile,crypto}=require('@sophos-otp/storage/test/helpers.cjs');

test('browser sessions require a custom bootstrap header and authenticate every profile route',async t=>{
  const {vault}=fixture(t),app=await createApi({vault,port:0});
  const base='http://127.0.0.1:'+(app.getHttpServer().address() as AddressInfo).port;
  try{
    assert.equal((await fetch(base+'/api/session')).status,403);
    assert.equal((await fetch(base+'/api/session',{headers:{'X-OTP-Client':'sophos-otp',Origin:'https://attacker.invalid'}})).status,403);
    assert.equal((await fetch(base+'/api/session',{method:'OPTIONS',headers:{Origin:'https://attacker.invalid','Access-Control-Request-Headers':'x-otp-client'}})).status,403);
    const session=await fetch(base+'/api/session',{headers:{'X-OTP-Client':'sophos-otp'}});assert.equal(session.status,200);assert.equal(session.headers.get('cache-control'),'no-store');
    const {token}=await session.json();assert.match(token,/^[0-9a-f]{64}$/);
    assert.equal((await fetch(base+'/api/profiles')).status,401);
    const headers={'X-App-Token':token,'Content-Type':'application/json'};
    const saved=await fetch(base+'/api/profiles/save',{method:'POST',headers,body:JSON.stringify(profile())});assert.equal(saved.status,201);
    const value=await saved.json();
    for(const endpoint of ['load','save','remove','select'])assert.equal((await fetch(base+'/api/profiles/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...profile(),id:value.id,revision:1})})).status,401);
    const crossOrigin=await fetch(base+'/api/profiles/remove',{method:'POST',headers:{...headers,Origin:'https://attacker.invalid'},body:JSON.stringify({id:value.id})});assert.equal(crossOrigin.status,403);
    const list=await fetch(base+'/api/profiles',{headers});const body=await list.text();assert.ok(!body.includes(profile().password));assert.ok(!body.includes(profile().otp.secret));assert.equal(JSON.parse(body).profiles.length,1);
  }finally{await app.close();}
});

test('browser API creates, edits, switches and restores multiple profiles after server restart',async t=>{
  const {vault,file}=fixture(t);let app=await createApi({vault,port:0,token:'test-token'});
  let base='http://127.0.0.1:'+(app.getHttpServer().address() as AddressInfo).port;
  const headers={'X-App-Token':'test-token','Content-Type':'application/json'};
  const post=async(endpoint:string,body:unknown)=>fetch(base+'/api/profiles/'+endpoint,{method:'POST',headers,body:JSON.stringify(body)});
  let reopened:ProfileVault|undefined;
  try{
    const a=await (await post('save',profile('Work'))).json();
    const b=await (await post('save',{...profile('Home'),otp:null,password:'home-test-password'})).json();
    assert.notEqual(a.id,b.id);
    const edited=await (await post('save',{...a,name:'Edited work',username:'edited-test-user'})).json();assert.equal(edited.revision,2);
    const stale=await post('save',a);assert.equal(stale.status,409);assert.equal((await stale.json()).code,'PROFILE_CONFLICT');
    assert.deepEqual(await (await post('load',{id:b.id})).json(),b);
    await app.close();vault.close();reopened=new ProfileVault(file,crypto);app=await createApi({vault:reopened,port:0,token:'test-token'});base='http://127.0.0.1:'+(app.getHttpServer().address() as AddressInfo).port;
    const catalog=await (await fetch(base+'/api/profiles',{headers})).json();assert.equal(catalog.profiles.length,2);assert.equal(catalog.selectedId,b.id);
    assert.deepEqual(await (await post('load',{id:a.id})).json(),edited);
    assert.equal((await post('remove',{id:b.id})).status,201);
    assert.equal((await post('load',{id:b.id})).status,404);
    assert.deepEqual(await (await post('load',{id:a.id})).json(),edited);
  }finally{await app.close();reopened?.close();}
});

test('profile API reports encryption failures without echoing supplied credentials',async t=>{
  const {vault}=fixture(t,{...crypto,encrypt:async()=>{throw Error('private-test-password');}}),app=await createApi({vault,port:0,token:'test-token'});
  try{
    const base='http://127.0.0.1:'+(app.getHttpServer().address() as AddressInfo).port,headers={'X-App-Token':'test-token','Content-Type':'application/json'};
    const response=await fetch(base+'/api/profiles/save',{method:'POST',headers,body:JSON.stringify({...profile(),password:'private-test-password'})});assert.equal(response.status,503);const body=await response.text();assert.ok(body.includes('ENCRYPTION_UNAVAILABLE'));assert.ok(!body.includes('private-test-password'));
    assert.equal((await vault.list()).profiles.length,0);
  }finally{await app.close();}
});
