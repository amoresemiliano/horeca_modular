import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('HORECA shared project boundary', () => {
  async function config(url: string, key = 'test-public-key-only', environment = 'development') {
    vi.resetModules();
    vi.stubEnv('VITE_APP_ENV', environment);
    vi.stubEnv('VITE_SUPABASE_URL', url);
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    return (await import('../../src/shared/config/env')).getAppConfig();
  }

  it('accepts only the canonical hosted DEV origin', async () => {
    const result = await config('https://vmxjqwlfwnphorthhcwu.supabase.co');
    expect(result.supabase.url).toBe('https://vmxjqwlfwnphorthhcwu.supabase.co');
  });

  it.each([
    'https://unrelated-project.supabase.co',
    'https://vmxjqwlfwnphorthhcwu.supabase.co.attacker.invalid',
  ])('rejects another project before creating a client: %s', async url => {
    await expect(config(url)).rejects.toThrow('HORECA DEV and PROD must use project');
  });

  it('rejects missing browser credentials instead of selecting a hardcoded key', async () => {
    await expect(config('https://vmxjqwlfwnphorthhcwu.supabase.co', '')).rejects.toThrow();
  });

  it('accepts the canonical shared backend in production', async () => {
    expect((await config('https://vmxjqwlfwnphorthhcwu.supabase.co', 'test-public-key-only', 'production')).isProduction).toBe(true);
  });

  it.each(['https://ourzapkjykzlwsjunzmd.supabase.co', 'https://unrelated-project.supabase.co'])('rejects foreign backends in production: %s', async url => {
    await expect(config(url, 'test-public-key-only', 'production')).rejects.toThrow('HORECA DEV and PROD must use project');
  });
});
