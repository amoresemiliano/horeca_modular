import { createClient } from '@supabase/supabase-js';
import { getAppConfig } from '../shared/config/env';

const { url: supabaseUrl, publishableKey: supabaseKey } = getAppConfig().supabase;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});