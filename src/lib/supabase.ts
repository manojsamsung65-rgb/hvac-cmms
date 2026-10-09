import { createClient } from '@supabase/supabase-js';

// Only the publishable/anon key is used in the browser. The service-role key
// must never appear in frontend code. The client is created lazily and is null
// until the environment is configured, so the shell runs without a backend.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
