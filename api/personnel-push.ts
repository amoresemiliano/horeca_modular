import { deviceCookie, requestKey, rpc, secureRequest, tokenHash, trustedClient, type Request, type Response } from '../server/personnel/runtime.js';
import { pinLookup, verifyPin } from '../server/personnel/security.js';
import { pushConfiguration, validateSubscription } from '../server/personnel/push.js';
import { randomUUID } from 'node:crypto';

export default async function handler(req: Request, res: Response) {
  try {
    const config = secureRequest(req, res), body = req.body || {}, action = String(body.action || '');
    const fields: Record<string, string[]> = { status: ['action'], subscribe: ['action', 'pin', 'subscription'], unsubscribe: ['action'] };
    if (!fields[action] || Object.keys(body).some(key => !fields[action].includes(key))) throw new Error('INVALID_INPUT');
    const token = deviceCookie(req);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('INVALID_DEVICE');
    const client = trustedClient(), hash = tokenHash(token);
    const call = (op: string, payload = {}) => rpc(client, 'personnel_push_command', { p_token_hash: hash, p_action: op, p_body: payload });
    const status = await call('status');
    if (status.error) throw new Error('INVALID_DEVICE');
    if (action === 'unsubscribe') { res.status(200).json(await call(action)); return; }
    const push = pushConfiguration();
    if (action === 'status') { res.status(200).json({ enabled: status.enabled, publicKey: push.publicKey }); return; }
    if (typeof body.pin !== 'string' || !/^\d{4}$/.test(body.pin)) throw new Error('PIN_REJECTED');
    const subscription = validateSubscription(body.subscription);
    const device = (op: string, payload = {}) => rpc(client, 'personnel_device_command', { p_action: op, p_token_hash: hash, p_ip_key: requestKey(req), p_body: payload });
    const context = await device('org');
    if (context.error) throw new Error('INVALID_DEVICE');
    const prepared = await device('prepare', { lookup: pinLookup(context.org, body.pin, config.pepper), requestId: randomUUID() });
    if (prepared.error) throw new Error('PIN_REJECTED');
    const dummy = `scrypt:32768:8:1:${'0'.repeat(32)}:${'0'.repeat(64)}`;
    const verified = await verifyPin(body.pin, prepared.hash || dummy, config.pepper);
    const result = await call('subscribe', { attemptId: prepared.attemptId, verified, subscription });
    if (result.error) throw new Error('PIN_REJECTED');
    res.status(200).json({ enabled: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const safe = ['PIN_REJECTED', 'INVALID_DEVICE', 'PUSH_UNAVAILABLE', 'SERVER_NOT_CONFIGURED', 'METHOD_NOT_ALLOWED', 'DENIED', 'INVALID_INPUT'];
    res.status(code === 'METHOD_NOT_ALLOWED' ? 405 : code === 'DENIED' ? 403 : ['PUSH_UNAVAILABLE', 'SERVER_NOT_CONFIGURED'].includes(code) ? 503 : 400).json({ error: safe.includes(code) ? code : 'OPERATION_UNAVAILABLE' });
  }
}
