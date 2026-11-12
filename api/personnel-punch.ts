import { cookieHeader, deviceCookie, requestKey, rpc, secureRequest, secretToken, tokenHash, trustedClient, Request, Response } from '../server/personnel/runtime.js';
import { pinLookup, UUID, verifyPin } from '../server/personnel/security.js';

const dummy = `scrypt:32768:8:1:${'0'.repeat(32)}:${'0'.repeat(64)}`;
export default async function handler(req: Request, res: Response) {
  try {
    const config = secureRequest(req, res), body = req.body || {}, action = body.action;
    const fields: Record<string, string[]> = { activate: ['action', 'token'], session: ['action'], punch: ['action', 'pin', 'requestId'], observe: ['action', 'punchId', 'observation'] };
    if (typeof action !== 'string' || !fields[action] || Object.keys(body).some(key => !fields[action].includes(key))) throw new Error('INVALID_INPUT');
    const client = trustedClient(), ip = requestKey(req);
    if (action === 'activate') {
      if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) throw new Error('INVALID_DEVICE');
      const token = secretToken();
      const previous = deviceCookie(req);
      const result = await rpc(client, 'personnel_activate_device', { p_activation_hash: tokenHash(body.token), p_device_hash: tokenHash(token), p_previous_hash: /^[A-Za-z0-9_-]{43}$/.test(previous) ? tokenHash(previous) : null, p_ip_key: ip });
      if (result.error) throw new Error('INVALID_DEVICE');
      res.setHeader('Set-Cookie', cookieHeader(token)); res.status(200).json({ ok: true }); return;
    }
    const token = deviceCookie(req);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('INVALID_DEVICE');
    const call = (operation: string, payload: Record<string, unknown> = {}) => rpc(client, 'personnel_device_command', { p_action: operation, p_token_hash: tokenHash(token), p_ip_key: ip, p_body: payload });
    if (action === 'session') {
      const result = await call('session'); if (result.error) throw new Error('INVALID_DEVICE');
      res.status(200).json(result); return;
    }
    if (action === 'observe') {
      if (!UUID.test(String(body.punchId)) || typeof body.observation !== 'string' || !body.observation.trim() || body.observation.length > 500) throw new Error('INVALID_INPUT');
      const result = await call('observe', { punchId: body.punchId, observation: body.observation.trim() });
      if (result.error) throw new Error('INVALID_DEVICE'); res.status(200).json({ ok: true }); return;
    }
    if (!UUID.test(String(body.requestId)) || typeof body.pin !== 'string' || !/^\d{4}$/.test(body.pin)) throw new Error('PIN_REJECTED');
    const context = await call('org'); if (context.error) throw new Error('INVALID_DEVICE');
    const prepared = await call('prepare', { lookup: pinLookup(context.org, body.pin, config.pepper), requestId: body.requestId });
    if (prepared.error) throw new Error('PIN_REJECTED');
    const verified = await verifyPin(body.pin, prepared.hash || dummy, config.pepper);
    const result = await call('execute', { attemptId: prepared.attemptId, verified });
    if (result.error) throw new Error(result.error === 'DUPLICATE_PUNCH' ? 'DUPLICATE_PUNCH' : 'PIN_REJECTED');
    // The trusted RPC already projects a minimal envelope. Never return prepare/hash.
    res.status(200).json({ id: result.id, kind: result.kind, occurredAt: result.occurredAt, firstName: result.firstName });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const safe = ['PIN_REJECTED', 'INVALID_DEVICE', 'DUPLICATE_PUNCH', 'SERVER_NOT_CONFIGURED', 'METHOD_NOT_ALLOWED', 'DENIED', 'INVALID_INPUT'];
    if (code === 'INVALID_DEVICE') res.setHeader('Set-Cookie', cookieHeader('', 0));
    res.status(code === 'METHOD_NOT_ALLOWED' ? 405 : code === 'SERVER_NOT_CONFIGURED' ? 503 : 400).json({ error: safe.includes(code) ? code : 'OPERATION_UNAVAILABLE' });
  }
}
