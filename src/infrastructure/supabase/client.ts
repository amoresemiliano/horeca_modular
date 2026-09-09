import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getAppConfig } from '../../shared/config/env';

let clientInstance: SupabaseClient | null = null;

/**
 * Returns the canonical singleton Supabase client configured with validated environment parameters.
 */
export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) {
    return clientInstance;
  }

  const config = getAppConfig();
  clientInstance = createClient(config.supabase.url, config.supabase.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return clientInstance;
}
