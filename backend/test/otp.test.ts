import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOtp, decodeBase32 } from '../src/otp';
import type { OtpAlgorithm } from '../../shared/src';
function base32(buffer: Buffer): string { let value=0,bits=0,result=''; for(const byte of buffer){value=(value<<8)|byte;bits+=8;while(bits>=5){bits-=5;result+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[(value>>>bits)&31];}}if(bits)result+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[(value<<(5-bits))&31];return result; }
const times=[59,1111111109,1111111111,1234567890,2000000000,20000000000];
const vectors: [OtpAlgorithm,number,string[]][]=[['SHA1',20,['94287082','07081804','14050471','89005924','69279037','65353130']],['SHA256',32,['46119246','68084774','67062674','91819424','90698825','77737706']],['SHA512',64,['90693936','25091201','99943326','93441116','38618901','47863826']]];
const seed='1234567890123456789012345678901234567890123456789012345678901234';
for(const [algorithm,length,expected] of vectors) for(let i=0;i<times.length;i++) test('RFC 6238 '+algorithm+' '+times[i],()=>{const result=generateOtp({secret:base32(Buffer.from(seed.slice(0,length))),algorithm,period:30,digits:8},times[i]*1000);assert.equal(result.code,expected[i]);assert.ok(result.validUntil>result.serverTime);});
test('six digits and boundary rollover',()=>{const config={secret:base32(Buffer.from(seed.slice(0,20))),algorithm:'SHA1' as const,period:30,digits:6 as const};assert.equal(generateOtp(config,59000).code,'287082');assert.notEqual(generateOtp(config,59999).code,generateOtp(config,60000).code);});
test('reject malformed input',()=>{for(const secret of ['', 'A', 'AB', '12345678','MY==='])assert.throws(()=>decodeBase32(secret));assert.throws(()=>generateOtp({secret:'MY======',algorithm:'MD5' as OtpAlgorithm,period:30,digits:6}));assert.throws(()=>generateOtp({secret:'MY======',algorithm:'SHA1',period:0,digits:6}));});

