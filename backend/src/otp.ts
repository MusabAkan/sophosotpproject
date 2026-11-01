import { createHmac } from 'node:crypto';
import type { GenerateOtpRequest, GenerateOtpResponse } from '../../shared/src';

export function decodeBase32(input: string): Buffer {
  const normalized = input.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z2-7]+={0,6}$/.test(normalized)) throw new Error('Enter a valid Base32 secret.');
  const value = normalized.replace(/=+$/, '');
  if ([1,3,6].includes(value.length % 8)) throw new Error('Invalid Base32 secret length.');
  if (normalized.includes('=') && normalized.length % 8 !== 0) throw new Error('Invalid Base32 padding.');
  let buffer = 0, bits = 0;
  const bytes: number[] = [];
  for (const character of value) {
    buffer = (buffer << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(character);
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >>> bits) & 255); }
  }
  if (!bytes.length || (bits && (buffer & ((1 << bits) - 1)))) throw new Error('Invalid Base32 secret.');
  return Buffer.from(bytes);
}

export function generateOtp(request: GenerateOtpRequest, now = Date.now()): GenerateOtpResponse {
  if (!request || typeof request.secret !== 'string' || request.secret.length > 4096)
    throw new Error('A secret is required (maximum 4096 characters).');
  if (!['SHA1','SHA256','SHA512'].includes(request.algorithm)) throw new Error('Unsupported algorithm.');
  if (![6,8].includes(request.digits)) throw new Error('The code must have 6 or 8 digits.');
  if (!Number.isInteger(request.period) || request.period < 10 || request.period > 300)
    throw new Error('The period must be between 10 and 300 seconds.');
  const key = decodeBase32(request.secret);
  try {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / request.period)));
    const hash = createHmac(request.algorithm.toLowerCase(), key).update(counter).digest();
    const offset = hash[hash.length - 1] & 15;
    const binary = hash.readUInt32BE(offset) & 0x7fffffff;
    return { code: String(binary % 10 ** request.digits).padStart(request.digits, '0'), serverTime: now,
      validUntil: (Math.floor(now / 1000 / request.period) + 1) * request.period * 1000, period: request.period };
  } finally { key.fill(0); }
}
