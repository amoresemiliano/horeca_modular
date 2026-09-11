import { createClient } from '@supabase/supabase-js';

const CANONICAL_DEV_URL = 'https://ourzapkjykzlwsjunzmd.supabase.co';
const CANONICAL_DEV_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91cnphcGtqeWt6bHdzanVuem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjU5MzcsImV4cCI6MjEwMTk0MTkzN30.dIM97yl4282i_K3AqyOMgp51qZt4GqJRQg5tTKSCPrM';
const CANONICAL_DEV_PUBKEY = 'sb_publishable_CS0gCapefFxuRrw-gG2svw_lSmhggsu';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || CANONICAL_DEV_URL;
let supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Unconditionally use the valid verified key for ourzapkjykzlwsjunzmd in DEV environment
if (!supabaseKey || supabaseUrl.includes('ourzapkjykzlwsjunzmd')) {
  supabaseKey = CANONICAL_DEV_ANON_KEY;
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