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

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'https://vmxjqwlfwnphorthhcwu.supabase.co');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteGpxd2xmd25waG9ydGhoY3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNDc0MzMsImV4cCI6MjA5ODgyMzQzM30.hjkQiKsn-eOzuUEkR1UDPp7P5hK88CZUePSVVxkXFtM');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);