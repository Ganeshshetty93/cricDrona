import { createClient } from '@supabase/supabase-js';
import { loadProjectEnvironment } from '../server/runtime.js';

loadProjectEnvironment();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Configure the Supabase project first.');

// Credentials arrive through hidden stdin; never store or print passwords/tokens.
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
console.log('Ready for account JSON on stdin (input hidden).');
const input = await new Promise((resolve, reject) => {
  let text = '';
  const receive = chunk => {
    if (chunk.includes('\u0003')) { process.exit(130); }
    text += chunk;
    if (text.includes('\n') || text.includes('\r')) { process.stdin.removeListener('data', receive); process.stdin.pause(); resolve(text.trim()); }
  };
  process.stdin.on('data', receive);
  process.stdin.once('error', reject);
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
const accounts = JSON.parse(input);
for (const { email, password, name } of accounts) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    let { data, error } = await client.auth.signInWithPassword({ email, password });
    let created = false;
    if (error?.code === 'invalid_credentials' && !process.argv.includes('--login-only')) {
      ({ data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: name, name }, emailRedirectTo: 'http://localhost:5173/auth/callback' } }));
      created = !error && Boolean(data.user?.identities?.length);
    }
    if (error) { console.log(JSON.stringify({ email, status: 'failed', code: error.code, message: error.message })); continue; }
    if (!data.session) { console.log(JSON.stringify({ email, status: created ? 'confirmation_required' : 'signup_accepted_no_session', created })); continue; }
    const { data: role, error: roleError } = await client.rpc('current_app_role');
    const profile = await client.from('profiles').select('id,name,email').eq('id', data.user.id).single();
    console.log(JSON.stringify({ email, status: 'login_verified', created, id: data.user.id, role, roleError: roleError?.code, profileReady: Boolean(profile.data), profileError: profile.error?.code }));
  } catch (error) { console.log(JSON.stringify({ email, status: 'failed', message: error.message })); }
}
