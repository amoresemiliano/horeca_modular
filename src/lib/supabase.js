import { createClient } from '@supabase/supabase-js';
import { getAppConfig } from '../shared/config/env';
import { authFlowForLocation } from '../context/authCallback';

const { url: supabaseUrl, publishableKey: supabaseKey } = getAppConfig().supabase;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: authFlowForLocation(typeof window !== 'undefined' ? window.location : null),
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
