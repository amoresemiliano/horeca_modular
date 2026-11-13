import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { appOrigin, checkSupabaseKey, deploymentEnvironment, supabaseTarget } from './environmentBoundary';

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
  VITE_SUPABASE_PROJECT_REF: z.string().optional(),
  VITE_APP_ORIGIN: z.string().optional(),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface AppConfig {
  readonly environment: AppEnvironment;
  readonly releaseSha: string;
  readonly isProduction: boolean;
  readonly isUat: boolean;
  readonly isDevelopment: boolean;
  readonly origin?: string;
  readonly supabase: {
    readonly url: string;
    readonly publishableKey: string;
  };
}

function resolveEnv(): RawEnv {
  const raw = {
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV || 'development',
    VITE_RELEASE_SHA: import.meta.env.VITE_RELEASE_SHA || 'a90724d',
    VITE_SUPABASE_URL: supabaseTarget(
      deploymentEnvironment(import.meta.env.VITE_APP_ENV || 'development', import.meta.env.VITE_DEPLOYMENT_ENV),
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PROJECT_REF,
    ).url,
    VITE_SUPABASE_PUBLISHABLE_KEY:
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_PROJECT_REF: import.meta.env.VITE_SUPABASE_PROJECT_REF,
    VITE_APP_ORIGIN: import.meta.env.VITE_APP_ORIGIN,
  };

  const parseResult = envSchema.safeParse(raw);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw AppError.validation(`Invalid application environment configuration: ${errorDetails}`);
  }

  const target = supabaseTarget(parseResult.data.VITE_APP_ENV, parseResult.data.VITE_SUPABASE_URL, parseResult.data.VITE_SUPABASE_PROJECT_REF);
  checkSupabaseKey(parseResult.data.VITE_SUPABASE_PUBLISHABLE_KEY, target.projectRef, 'anon');
  const origin = appOrigin(parseResult.data.VITE_APP_ENV, parseResult.data.VITE_APP_ORIGIN);
  if (parseResult.data.VITE_APP_ENV === 'production' && typeof window !== 'undefined' && window.location.origin !== origin) throw AppError.validation('Production application origin mismatch');

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
    origin: env.VITE_APP_ORIGIN,
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
