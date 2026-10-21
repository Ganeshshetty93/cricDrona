import { existsSync } from 'node:fs';

for (const file of ['.env', '.env.local']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Set the Supabase project URL and public key in .env.local first.');
  process.exit(1);
}

// Read-only checks: never create accounts, send email, or change database records.
const checks = [
  ['auth', '/auth/v1/settings', {}],
  ['catalog', '/rest/v1/rpc/list_events', {
    method: 'POST', body: JSON.stringify({ p_include_drafts: false }),
  }],
];

for (const [name, path, options] of checks) {
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: { apikey: key, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    console.log(JSON.stringify({
      check: name,
      status: response.status,
      ...(response.ok
        ? (name === 'catalog' ? { events: data.length } : { emailAuth: data.external?.email })
        : { code: data.code || data.error_code || 'request_failed', message: data.message || data.msg || data.error }),
    }));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ check: name, error: error.cause?.code || error.name, message: 'Could not reach Supabase.' }));
    process.exitCode = 1;
  }
}
