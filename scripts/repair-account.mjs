// One-time administrator CLI. Never imported by the website or public API.
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { loadProjectEnvironment } from '../server/runtime.js';
loadProjectEnvironment();
const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'player' }, 'role-only': { type: 'boolean', default: false } } });
if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || !['player','admin'].includes(values.role)) {
  throw new Error('Usage: npm run account:repair -- --email EMAIL --name NAME --role player|admin [--role-only]');
}
const email = values.email.trim().toLowerCase();
const name = (values.name || 'Player').trim();
if (name.length < 2 || name.length > 100) throw new Error('Name must contain 2–100 characters.');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !publicKey) throw new Error('Configure the Supabase project in .env.local first.');

async function hiddenPrompt(label) {
  if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal for hidden credential entry.');
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  let value = '';
  return new Promise(resolve => {
    function receive(chunk) {
      for (const char of chunk) {
        if (char === '\u0003') { process.stdin.setRawMode(false); process.exit(130); }
        if (char === '\r' || char === '\n') {
          process.stdin.removeListener('data', receive);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0,-1);
        else if (char >= ' ') value += char;
      }
    }
    process.stdin.on('data',receive);
  });
}
function checked(result) { if (result.error) throw new Error(result.error.message); return result.data; }
try {
  console.log(`Project: ${new URL(url).hostname}\nAccount: ${email}\nRequested role: ${values.role}`);
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || await hiddenPrompt('Project secret/service-role key (hidden, not saved): ');
  let privileged = secret.startsWith('sb_secret_');
  try { privileged ||= JSON.parse(Buffer.from(secret.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch { /* not a legacy JWT */ }
  if (!privileged) throw new Error('A publishable/anon key cannot repair accounts. Use the project secret key.');
  const options = { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } };
  const admin = createClient(url,secret,options);
  let existing;
  for (let page=1; ;page++) {
    const list = checked(await admin.auth.admin.listUsers({page,perPage:200}));
    existing = list.users.find(user => user.email?.toLowerCase() === email);
    if (existing || list.users.length < 200) break;
  }
  if(values['role-only']){
    if(!existing)throw new Error('Account does not exist. Role-only mode cannot create users.');
    checked(await admin.from('profiles').select('id').eq('id',existing.id).single());
    const previous=checked(await admin.from('user_roles').select('role').eq('user_id',existing.id).single());
    const role=previous.role==='owner'?'owner':values.role;
    if(previous.role!==role){
      checked(await admin.from('user_roles').update({role}).eq('user_id',existing.id).eq('role',previous.role).select('user_id,role').single());
    }
    const verified=checked(await admin.from('user_roles').select('role').eq('user_id',existing.id).single());
    if(verified.role!==role)throw new Error('Role verification failed.');
    console.log(JSON.stringify({email,role:verified.role,status:'role_verified',passwordChanged:false,profileChanged:false}));
  }else{
  const password = await hiddenPrompt('New account password (hidden, not saved): ');
  if (password.length < 8) throw new Error('Use at least 8 password characters.');
  const { user } = checked(existing
    ? await admin.auth.admin.updateUserById(existing.id,{password,email_confirm:true})
    : await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name,full_name:name}}));
  checked(await admin.from('profiles').upsert({id:user.id,email:user.email,name},{onConflict:'id'}));
  const previous = checked(await admin.from('user_roles').select('role').eq('user_id',user.id).maybeSingle());
  const role = previous?.role === 'owner' ? 'owner' : values.role;
  checked(await admin.from('user_roles').upsert({user_id:user.id,role},{onConflict:'user_id'}));
  const player = createClient(url,publicKey,options);
  checked(await player.auth.signInWithPassword({email,password}));
  checked(await player.from('profiles').select('id').eq('id',user.id).single());
  console.log(JSON.stringify({email,role,status:'login_and_profile_verified',emailVerificationRequired:false}));
  await player.auth.signOut({scope:'local'});
  }
} catch (error) {
  console.error(`Account repair failed: ${error.message}`);
  process.exitCode=1;
}
