import { z } from 'zod';
import { AppError } from '../errors/AppError';

export const AppEnvironment = {
  DEVELOPMENT: 'development',
  UAT: 'uat',
  PRODUCTION: 'production',
} as const;

export type AppEnvironment = (typeof AppEnvironment)[keyof typeof AppEnvironment];

const envSchema = z.object({
  VITE_APP_ENV: z.enum(['development', 'uat', 'production']).default('development'),
  VITE_RELEASE_SHA: z.string().default('a90724d'),
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(10, 'VITE_SUPABASE_PUBLISHABLE_KEY is required'),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface AppConfig {
  readonly environment: AppEnvironment;
  readonly releaseSha: string;
  readonly isProduction: boolean;
  readonly isUat: boolean;
  readonly isDevelopment: boolean;
  readonly supabase: {
    readonly url: string;
    readonly publishableKey: string;
  };
}

function resolveEnv(): RawEnv {
  const raw = {
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV || 'development',
    VITE_RELEASE_SHA: import.meta.env.VITE_RELEASE_SHA || 'a90724d',
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://ourzapkjykzlwsjunzmd.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY:
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      'sb_publishable_placeholder_for_verification',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  const parseResult = envSchema.safeParse(raw);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw AppError.validation(`Invalid application environment configuration: ${errorDetails}`);
  }

  return parseResult.data;
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = resolveEnv();
  const environment = env.VITE_APP_ENV as AppEnvironment;

  cachedConfig = {
    environment,
    releaseSha: env.VITE_RELEASE_SHA,
    isProduction: environment === AppEnvironment.PRODUCTION,
    isUat: environment === AppEnvironment.UAT,
    isDevelopment: environment === AppEnvironment.DEVELOPMENT,
    supabase: {
      url: env.VITE_SUPABASE_URL,
      publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  };

  return cachedConfig;
}

export function getSafeDiagnosticConfig(): Record<string, unknown> {
  const config = getAppConfig();
  return {
    environment: config.environment,
    releaseSha: config.releaseSha,
    isProduction: config.isProduction,
    supabaseUrl: config.supabase.url,
    supabaseKeyFingerprint: `${config.supabase.publishableKey.substring(0, 12)}...${config.supabase.publishableKey.substring(config.supabase.publishableKey.length - 6)}`,
  };
}
