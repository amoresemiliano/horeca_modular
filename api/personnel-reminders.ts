import * as webpush from 'web-push';
import { timingSafeEqual } from 'node:crypto';
import { rpc, trustedClient, type Request, type Response } from '../server/personnel/runtime.js';
import { pushConfiguration, reminderBody, validateSubscription } from '../server/personnel/push.js';

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  const expected = Buffer.from(`Bearer ${process.env.PERSONNEL_CRON_SECRET || ''}`), actual = Buffer.from(String(req.headers.authorization || ''));
  if (req.method !== 'GET' || !process.env.PERSONNEL_CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(actual, expected)) { res.status(403).json({ error: 'DENIED' }); return; }
  try {
    const config = pushConfiguration(), client = trustedClient();
    const job = (action: string, body = {}) => rpc(client, 'personnel_reminder_job', { p_action: action, p_body: body });
    const ids: string[] = await job('claim');
    let sent = 0;
    await Promise.all(ids.map(async id => {
      let status = 'SKIPPED', httpStatus: number | null = null;
      try {
        const item = await job('prepare', { id });
        if (item.subscription) {
          await webpush.sendNotification(validateSubscription(item.subscription), JSON.stringify({ title: 'HORECA Personal', body: reminderBody(item.kind, item.start), tag: id }), { vapidDetails: config, TTL: 60, timeout: 8000 });
          status = 'SENT'; sent++;
        }
      } catch (error) { status = 'FAILED'; httpStatus = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : null; }
      await job('complete', { id, status, httpStatus });
    }));
    res.status(200).json({ evaluated: ids.length, sent });
  } catch { res.status(503).json({ error: 'REMINDERS_UNAVAILABLE' }); }
}
