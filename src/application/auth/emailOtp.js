export async function requestEmailCode(client, email) {
  const address = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('INVALID_EMAIL');
  const { error } = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
  if (error) throw new Error('EMAIL_CODE_UNAVAILABLE');
}

export async function verifyEmailCode(client, email, token) {
  if (!/^\d{6,10}$/.test(String(token))) throw new Error('INVALID_CODE');
  const { data, error } = await client.auth.verifyOtp({ email: String(email).trim().toLowerCase(), token: String(token), type: 'email' });
  if (error || !data.session) throw new Error('INVALID_CODE');
  return data;
}
