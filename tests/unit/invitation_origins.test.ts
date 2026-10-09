import { describe, expect, it } from 'vitest';
import { invitationOrigin, trustedAppOrigins } from '../../supabase/functions/tenant-user-invite/origins';

describe('shared Auth invitation origins', () => {
  it.each(trustedAppOrigins)('returns the exact trusted caller origin: %s', origin => {
    expect(invitationOrigin(origin)).toBe(origin);
  });
  it.each([null, '', 'http://localhost:5173', 'https://horecamodular.vercel.app.attacker.invalid', 'https://horecamodular.vercel.app/', 'https://attacker.invalid'])('rejects untrusted or missing origins: %s', origin => {
    expect(invitationOrigin(origin)).toBeNull();
  });
});
