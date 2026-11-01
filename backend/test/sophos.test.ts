import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SophosService, parseProfiles, type CliRunner } from '../src/sophos';
import type { ConnectVpnRequest } from '../../shared/src';

const request = (): ConnectVpnRequest => ({ profile: 'Office VPN', username: 'domain\\alice', password: 'example!! $ &',
  otp: { secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', algorithm: 'SHA1', digits: 6, period: 30 } });
const output = 'Connections:\r\n  Office VPN\r\n  Second profile\r\n';
test('parse installed CLI profile format', () => { assert.deepEqual(parseProfiles(output), ['Office VPN','Second profile']); assert.deepEqual(parseProfiles('unrecognized'), []); });
test('pass username and password plus fresh OTP as separate arguments', async () => {
  const calls: string[][] = [];
  const service = new SophosService(async (_file,args) => { calls.push(args); return args[0] === 'list' ? output : ''; }, 'mock-sccli.exe', () => 45000);
  const response = await service.connect(request());
  assert.equal(response.submitted, true);
  assert.deepEqual(calls, [['list'], ['enable','-n','Office VPN','-u','domain\\alice','-p','example!! $ &287082']]);
  assert.ok(!JSON.stringify(response).includes(request().password));
});
test('reject unknown profile without attempting connection', async () => {
  const calls: string[][] = [];
  const service = new SophosService(async (_file,args) => { calls.push(args); return output; }, 'mock-sccli.exe', () => 45000);
  await assert.rejects(service.connect({...request(),profile:'not-installed'}), /bulunamadı/);
  assert.deepEqual(calls,[['list']]);
});
test('validate credentials and OTP before invoking CLI', async () => {
  let calls = 0;
  const service = new SophosService(async () => { calls++; return output; },'mock-sccli.exe',()=>45000);
  await assert.rejects(service.connect({...request(),password:''}));
  await assert.rejects(service.connect({...request(),username:'name\nnew-line'}));
  await assert.rejects(service.connect({...request(),otp:{...request().otp,secret:'invalid123'}}));
  assert.equal(calls,0);
});
test('do not submit an almost expired token', async () => {
  const calls: string[][] = [];
  const service = new SophosService(async (_file,args) => { calls.push(args); return output; },'mock-sccli.exe',()=>59000);
  await assert.rejects(service.connect(request()), /bitmek üzere/);
  assert.deepEqual(calls,[['list']]);
});
test('never return process errors containing password arguments', async () => {
  const service = new SophosService(async (_file,args) => { if(args[0] === 'list')return output; throw new Error('execFile failed: '+args.join(' ')); },'mock-sccli.exe',()=>45000);
  await assert.rejects(service.connect(request()), error => { assert.ok(error instanceof Error); assert.ok(!error.message.includes(request().password)); return true; });
});
test('do not issue concurrent connect commands and release lock after failure', async () => {
  let release!: (value: string) => void;
  let enables = 0;
  const run: CliRunner = async (_file,args) => { if(args[0] === 'list')return output; enables++; return new Promise(resolve => { release = resolve; }); };
  const service = new SophosService(run,'mock-sccli.exe',()=>45000);
  const first = service.connect(request());
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(service.connect(request()),/zaten/);
  release(''); await first;
  assert.equal(enables,1);
});
