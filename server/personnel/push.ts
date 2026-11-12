import { createPublicKey } from 'node:crypto';
import type { PushSubscription } from 'web-push';

// Prevent user-supplied subscriptions from becoming an SSRF primitive. Only
// browser push providers are permitted; never follow arbitrary endpoint hosts.
export function validateSubscription(value: unknown): PushSubscription {
  if (!value || typeof value !== 'object') throw new Error('INVALID_INPUT');
  const sub = value as PushSubscription;
  const url = new URL(sub.endpoint);
  const provider = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname)
    || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || !provider || sub.endpoint.length > 2048) throw new Error('INVALID_INPUT');
  if (!sub.keys || !/^[A-Za-z0-9_-]{87}$/.test(sub.keys.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(sub.keys.auth)) throw new Error('INVALID_INPUT');
  const key = Buffer.from(sub.keys.p256dh, 'base64url');
  if (key.length !== 65 || key[0] !== 4) throw new Error('INVALID_INPUT');
  createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: key.subarray(1, 33).toString('base64url'), y: key.subarray(33).toString('base64url') }, format: 'jwk' });
  return { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
}
export function pushConfiguration() {
  const publicKey = process.env.PERSONNEL_VAPID_PUBLIC_KEY, privateKey = process.env.PERSONNEL_VAPID_PRIVATE_KEY, subject = process.env.PERSONNEL_VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject || !/^(mailto:|https:\/\/)/.test(subject)) throw new Error('PUSH_UNAVAILABLE');
  return { publicKey, privateKey, subject };
}
export function reminderBody(kind: string, start: string) {
  if (kind === 'ENTRY') return `Tu turno empieza a las ${start}. Recuerda registrar tu entrada.`;
  if (kind === 'START') return 'Tu turno ha comenzado y todavía no registramos tu entrada.';
  if (kind === 'EXIT') return 'Tu turno termina ahora. Recuerda registrar tu salida.';
  throw new Error('INVALID_INPUT');
}
