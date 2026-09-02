import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key, fallback) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return fallback;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'https://ourzapkjykzlwsjunzmd.supabase.co');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91cnphcGtqeWt6bHdzanVuem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjU5MzcsImV4cCI6MjEwMTk0MTkzN30.dIM97yl4282i_K3AqyOMgp51qZt4GqJRQg5tTKSCPrM');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);