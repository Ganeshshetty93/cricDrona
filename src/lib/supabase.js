import { createClient } from '@supabase/supabase-js';
import { validSupabaseConfiguration } from './auth-utils';
export { safeNext } from './auth-utils';

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const publicKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = validSupabaseConfiguration(url, publicKey);
export const configured = isSupabaseConfigured;

// Capture callback information before Supabase consumes and clears the URL hash.
const location = typeof window === 'undefined' ? null : window.location;
const hash = new URLSearchParams(location?.hash.slice(1) || '');
const query = new URLSearchParams(location?.search || '');
export const authRedirectInfo = {
  recovery: (hash.get('type') || query.get('type')) === 'recovery',
  accessToken: hash.get('access_token'),
  error: hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error'),
};

export const supabase = isSupabaseConfigured ? createClient(url, publicKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
}) : null;

export default supabase;
