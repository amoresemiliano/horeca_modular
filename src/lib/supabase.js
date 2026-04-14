import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'TU_URL_DE_SUPABASE'
const supabaseAnonKey = 'TU_ANON_KEY_DE_SUPABASE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)