import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createApi} from '../src/main';
test('desktop API requires its session token and checks host, origin and content type',async()=>{
  const app=await createApi({port:0,token:'test-session-token'});
  const address=app.getHttpServer().address();
  assert.ok(address && typeof address !== 'string');
  const base='http://127.0.0.1:'+address.port;
  const headers={'X-App-Token':'test-session-token'};
  try{
    assert.equal((await fetch(base+'/api/health')).status,401);
    const health=await fetch(base+'/api/health',{headers});assert.equal(health.status,200);assert.deepEqual(await health.json(),{status:'ok'});
    assert.equal((await fetch(base+'/api/health',{headers:{...headers,Origin:'https://example.invalid'}})).status,403);
    const spoofedHost = await new Promise<number>((resolve,reject)=>{const req=request(base+'/api/health',{headers:{...headers,Host:'attacker.invalid'}},res=>{res.resume();resolve(res.statusCode!);});req.on('error',reject);req.end();});assert.equal(spoofedHost,403);
    assert.equal((await fetch(base+'/api/otp/generate',{method:'POST',headers,body:'not json'})).status,415);
    const otp=await fetch(base+'/api/otp/generate',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({secret:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',algorithm:'SHA1',period:30,digits:6})});
    assert.equal(otp.status,201);assert.equal(otp.headers.get('cache-control'),'no-store');const body=await otp.json();assert.match(body.code,/^[0-9]{6}$/);assert.ok(body.validUntil>body.serverTime);
    const invalid=await fetch(base+'/api/otp/generate',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});assert.equal(invalid.status,400);assert.match((await invalid.json()).message,/secret is required/);
    const connect=await fetch(base+'/api/sophos/connect',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});assert.equal(connect.status,400);
  }finally{await app.close();}
});
