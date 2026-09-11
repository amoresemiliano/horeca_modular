import { createClient } from '@supabase/supabase-js';

const CANONICAL_DEV_URL = 'https://ourzapkjykzlwsjunzmd.supabase.co';
const CANONICAL_DEV_PUBKEY = 'sb_publishable_CS0gCapefFxuRrw-gG2svw_lSmhggsu';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || CANONICAL_DEV_URL;
let supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || CANONICAL_DEV_PUBKEY;

// If URL points to ourzapkjykzlwsjunzmd and key is clearly invalid, use the verified canonical key
if (supabaseUrl.includes('ourzapkjykzlwsjunzmd') && (!supabaseKey || supabaseKey.length < 30 || supabaseKey.includes('placeholder'))) {
  supabaseKey = CANONICAL_DEV_PUBKEY;
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment configuration: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) are required.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});