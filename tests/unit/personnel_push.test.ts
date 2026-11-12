import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { reminderBody, validateSubscription } from '../../server/personnel/push';
import reminders from '../../api/personnel-reminders';
import { isLateArrival } from '../../src/modules/personal/domain';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';

const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' });
const keys = { p256dh: Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x!, 'base64url'), Buffer.from(jwk.y!, 'base64url')]).toString('base64url'), auth: randomBytes(16).toString('base64url') };
describe('Personnel push trust boundary', () => {
  it('loads the installed Web Push transport in native Node ESM', () => {
    expect(execFileSync(process.execPath, ['--input-type=module', '-e', "import * as push from 'web-push'; if(typeof push.sendNotification!=='function'||typeof push.generateVAPIDKeys!=='function')process.exit(1); process.stdout.write('PASS')"], { encoding: 'utf8', windowsHide: true })).toBe('PASS');
  });
  it('shows push messages and opens only the standalone punch route', async () => {
    const handlers: Record<string, (event: any) => void> = {}, shown: unknown[] = [], opened: string[] = [];
    const self = { location: { origin: 'https://personnel.example.invalid' }, addEventListener(name: string, handler: (event: any) => void) { handlers[name] = handler; }, registration: { async showNotification(...args: unknown[]) { shown.push(args); } }, clients: { async matchAll() { return []; }, async openWindow(url: string) { opened.push(url); } } };
    runInNewContext(readFileSync('public/personal/fichaje/sw.js', 'utf8'), { self, URL });
    const pending: Promise<unknown>[] = [];
    handlers.push({ data: { json: () => ({ body: 'Synthetic reminder', url: 'https://attacker.invalid/admin', tag: 'delivery' }) }, waitUntil(promise: Promise<unknown>) { pending.push(promise); } });
    handlers.notificationclick({ notification: { close() {} }, waitUntil(promise: Promise<unknown>) { pending.push(promise); } });
    await Promise.all(pending);
    expect(shown).toHaveLength(1);
    expect(opened).toEqual(['https://personnel.example.invalid/personal/fichaje/']);
  });
  it('accepts browser provider keys while rejecting arbitrary hosts and malformed keys', () => {
    expect(validateSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic', keys }).keys).toEqual(keys);
    for (const endpoint of ['http://fcm.googleapis.com/fcm/send/x', 'https://127.0.0.1/private', 'https://fcm.googleapis.com.attacker.invalid/x', 'https://user:password@fcm.googleapis.com/x', 'https://fcm.googleapis.com:444/x']) expect(() => validateSubscription({ endpoint, keys })).toThrow();
    expect(() => validateSubscription({ endpoint: 'https://web.push.apple.com/x', keys: { ...keys, p256dh: 'A'.repeat(87) } })).toThrow();
  });
  it('has a strict instant policy with future grace configuration independent of JSX', () => {
    expect(isLateArrival('2026-11-11T09:00:01Z', '2026-11-11T09:00:00Z')).toBe(true);
    expect(isLateArrival('2026-11-11T09:00:00Z', '2026-11-11T09:00:00Z')).toBe(false);
    expect(isLateArrival('2026-11-11T09:02:00Z', '2026-11-11T09:00:00Z', { arrivalGraceMinutes: 3 })).toBe(false);
  });
  it('rejects unauthenticated scheduler invocation before accessing the database', async () => {
    const response = { code: 0, status(code: number) { this.code = code; return this; }, json() {}, setHeader() {} };
    await reminders({ method: 'GET', headers: {} }, response);
    expect(response.code).toBe(403);
  });
  it('uses concise messages without employee data and rejects unknown reminder kinds', () => {
    expect(reminderBody('ENTRY', '10:00')).toContain('10:00');
    expect(reminderBody('START', '')).toContain('entrada');
    expect(reminderBody('EXIT', '')).toContain('salida');
    expect(() => reminderBody('UNKNOWN', '')).toThrow('INVALID_INPUT');
  });
});
