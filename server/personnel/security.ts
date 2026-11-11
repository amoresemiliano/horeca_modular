import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
export const secretToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function pinLookup(org: string, pin: string, pepper: string) {
  if (pepper.length < 32) throw new Error('SERVER_NOT_CONFIGURED');
  return createHmac('sha256', pepper).update(`${org}:${pin}`).digest('hex');
}
export async function hashPin(pin: string, pepper: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('INVALID_INPUT');
  const salt = randomBytes(16).toString('hex');
  const key = await derive(pin + pepper, salt);
  return `scrypt:32768:8:1:${salt}:${key.toString('hex')}`;
}
export async function verifyPin(pin: string, stored: string, pepper: string) {
  if (!/^\d{4}$/.test(pin)) return false;
  const parts = stored.split(':');
  if (parts.length !== 6 || parts.slice(0, 4).join(':') !== 'scrypt:32768:8:1' || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{64}$/.test(parts[5])) return false;
  const expected = Buffer.from(parts[5], 'hex');
  const actual = await derive(pin + pepper, parts[4]);
  return timingSafeEqual(actual, expected);
}
export const generatePin = () => randomInt(0, 10000).toString().padStart(4, '0');
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
