import { describe, expect, it, vi } from 'vitest';
import { requestEmailCode, verifyEmailCode } from '../../src/application/auth/emailOtp';

describe('Production email OTP authentication', () => {
  it('requests codes only for existing users without password or signup', async () => {
    const client = { auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }) } };
    await requestEmailCode(client, ' Owner@Example.com ');
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'owner@example.com', options: { shouldCreateUser: false } });
  });
  it('requires an actual Supabase email OTP session', async () => {
    const client = { auth: { verifyOtp: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'existing' } } }, error: null }) } };
    await verifyEmailCode(client, 'OWNER@example.com', '12345678');
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'owner@example.com', token: '12345678', type: 'email' });
    client.auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: null });
    await expect(verifyEmailCode(client, 'owner@example.com', '12345678')).rejects.toThrow('INVALID_CODE');
  });
  it('rejects invalid input and does not expose provider errors', async () => {
    const client = { auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: { message: 'private provider detail' } }), verifyOtp: vi.fn() } };
    await expect(requestEmailCode(client, 'bad')).rejects.toThrow('INVALID_EMAIL');
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
    await expect(requestEmailCode(client, 'owner@example.com')).rejects.toThrow('EMAIL_CODE_UNAVAILABLE');
    await expect(verifyEmailCode(client, 'owner@example.com', 'not-a-code')).rejects.toThrow('INVALID_CODE');
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
