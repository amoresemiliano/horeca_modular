import { callerClient, configuration, rpc, secureRequest, secretToken, tokenHash, Request, Response } from '../server/personnel/runtime.js';
import { generatePin, hashPin, pinLookup, UUID } from '../server/personnel/security.js';

export default async function handler(req: Request, res: Response) {
  try {
    secureRequest(req, res);
    const body = req.body || {}, org = String(body.organizationId || ''), unit = body.unitId ? String(body.unitId) : null;
    if (!UUID.test(org) || (unit && !UUID.test(unit))) throw new Error('INVALID_INPUT');
    const client = await callerClient(req), action = String(body.action || '');
    const allowed = await client.rpc('personnel_admin_allowed', { org, unit });
    if (allowed.error || allowed.data !== true) throw new Error('ACCESS_DENIED');
    const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload as Record<string, unknown> : {};
    if (action === 'pin.reset') {
      if (!UUID.test(String(payload.employeeId))) throw new Error('INVALID_INPUT');
      for (let i = 0; i < 20; i++) {
        const pin = generatePin(), c = configuration();
        try {
          await rpc(client, 'personnel_admin_command', { p_org: org, p_unit: unit, p_action: action, p_body: { employeeId: payload.employeeId, lookup: pinLookup(org, pin, c.pepper), hash: await hashPin(pin, c.pepper) } });
          res.status(200).json({ pin }); return;
        } catch (error) { if (!(error instanceof Error) || error.message !== 'PIN_COLLISION') throw error; }
      }
      throw new Error('OPERATION_UNAVAILABLE');
    }
    if (action === 'device.activate') {
      const token = secretToken();
      await rpc(client, 'personnel_admin_command', { p_org: org, p_unit: unit, p_action: action, p_body: { label: payload.label, tokenHash: tokenHash(token) } });
      res.status(200).json({ activationUrl: `${configuration().origin}/personal/fichaje/#activate=${token}`, expiresIn: 600 }); return;
    }
    if (!['snapshot', 'employee.save', 'schedule.save', 'schedule.cancel', 'device.revoke', 'attendance.correct'].includes(action)) throw new Error('INVALID_INPUT');
    const result = await rpc(client, 'personnel_admin_command', { p_org: org, p_unit: unit, p_action: action, p_body: payload });
    res.status(200).json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const safe = ['ACCESS_DENIED', 'DENIED', 'INVALID_INPUT', 'STALE_REVISION', 'HISTORICAL_SCHEDULE', 'OVERLAPPING_SCHEDULE', 'SERVER_NOT_CONFIGURED', 'METHOD_NOT_ALLOWED'];
    res.status(code === 'METHOD_NOT_ALLOWED' ? 405 : ['ACCESS_DENIED', 'DENIED'].includes(code) ? 403 : code === 'SERVER_NOT_CONFIGURED' ? 503 : 400).json({ error: safe.includes(code) ? code : 'OPERATION_UNAVAILABLE' });
  }
}
