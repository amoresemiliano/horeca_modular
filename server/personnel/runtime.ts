import { createClient } from '@supabase/supabase-js';
import { hashPin, pinLookup, secretToken, tokenHash } from './security.js';

export interface Request { method?: string; headers: Record<string, string | string[] | undefined>; body?: Record<string, unknown> }
export interface Response { status(code: number): Response; json(value: unknown): void; setHeader(name: string, value: string): void }
export function configuration() {
  if (process.env.PERSONNEL_BACKEND_ENABLED !== 'true' || process.env.SUPABASE_URL !== 'https://vmxjqwlfwnphorthhcwu.supabase.co' || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_ANON_KEY || !process.env.PERSONNEL_ORIGIN || (process.env.PERSONNEL_PIN_PEPPER || '').length < 32) throw new Error('SERVER_NOT_CONFIGURED');
  return { url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, anonKey: process.env.SUPABASE_ANON_KEY, origin: process.env.PERSONNEL_ORIGIN, pepper: process.env.PERSONNEL_PIN_PEPPER! };
}
export function secureRequest(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') throw new Error('METHOD_NOT_ALLOWED');
  const config = configuration();
  if (req.headers.origin !== config.origin || !config.origin.startsWith('https://')) throw new Error('DENIED');
  if (JSON.stringify(req.body || {}).length > 12000) throw new Error('INVALID_INPUT');
  return config;
}
export function trustedClient() {
  const c = configuration(); return createClient(c.url, c.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function callerClient(req: Request) {
  const c = configuration(), auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) throw new Error('DENIED');
  const client = createClient(c.url, c.anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
  const user = await client.auth.getUser(auth.slice(7)); if (user.error || !user.data.user) throw new Error('DENIED');
  return client;
}
export async function rpc(client: ReturnType<typeof trustedClient>, name: string, params: Record<string, unknown>) {
  const result = await client.rpc(name, params);
  if (result.error) {
    const message = result.error.message;
    throw new Error(['ACCESS_DENIED', 'STALE_REVISION', 'OVERLAPPING_SCHEDULE', 'HISTORICAL_SCHEDULE', 'PIN_COLLISION', 'INVALID_INPUT'].find(e => message.includes(e)) || 'OPERATION_UNAVAILABLE');
  }
  return result.data;
}
export function deviceCookie(req: Request) {
  const cookie = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  return cookie.split(';').map(p => p.trim()).find(p => p.startsWith('__Host-personnel-device='))?.slice('__Host-personnel-device='.length) || '';
}
export const cookieHeader = (token: string, seconds = 90 * 86400) => `__Host-personnel-device=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
export async function dummyHash() { return hashPin('0000', configuration().pepper); }
export function requestKey(req: Request) {
  const forwarded = typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : 'unknown';
  return pinLookup('request-ip', forwarded, configuration().pepper);
}
export { secretToken, tokenHash };
