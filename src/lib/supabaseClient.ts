import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta.env.VITE_SUPABASE_URL as string) || '').trim();
const supabaseAnonKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

