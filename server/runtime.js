import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const devHeader = 'X-CricDrona-Dev';
const projectId = createHash('sha256').update(process.platform === 'win32' ? projectRoot.toLowerCase() : projectRoot).digest('hex').slice(0, 16);
export const devIdentity = kind => `${kind}:${projectId}`;

export function loadProjectEnvironment(root = projectRoot, env = process.env) {
  const values = {};
  for (const name of ['.env', '.env.local']) {
    const file = resolve(root, name);
    if (existsSync(file)) Object.assign(values, parseEnv(readFileSync(file, 'utf8')));
  }
  // Shell values take precedence; local configuration overrides .env defaults.
  for (const [name, value] of Object.entries(values)) if (env[name] === undefined) env[name] = value;
}

export function environmentPort(name, fallback, env = process.env) {
  const value = env[name] || String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`${name} must be a whole-number port between 1 and 65535.`);
  }
  return Number(value);
}

export function portConflict(kind, port, variable) {
  return new Error(`Port ${port} is already used by another service. CricDrona ${kind} was not started. Set ${variable} to an unused port or stop that service yourself, then retry.`);
}

async function probe(url) {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    return { status: response.status, identity: response.headers.get(devHeader), contentType: response.headers.get('content-type') || '', text: await response.text() };
  } catch { return null; }
}

export async function isCricDronaApi(url) {
  const health = await probe(`${url}/api/health`);
  if (!health || health.status !== 200) return false;
  try {
    const value = JSON.parse(health.text).data;
    if (typeof value?.configured !== 'boolean' || value.mode !== (value.configured ? 'connected' : 'demo')) return false;
    if (health.identity) return health.identity === devIdentity('api');
    // Older local servers have no identity header. Check a second app-specific
    // response so an unrelated generic health endpoint is not mistaken for ours.
    const profile = await probe(`${url}/api/profile`);
    const expectedStatus = value.configured ? 401 : 503;
    const expectedError = value.configured ? 'Sign in to continue.' : 'Connect Supabase to use accounts, registrations and academy management.';
    return profile?.status === expectedStatus && JSON.parse(profile.text).error === expectedError;
  } catch { return false; }
}

export async function isCricDronaClient(url) {
  const page = await probe(url);
  if (!page || page.status !== 200) return false;
  if (page.identity && page.identity !== devIdentity('client')) return false;
  // Support a Vite process started before the combined launcher was installed.
  if (!page.identity && !(/<title>[^<]*CricDrona[^<]*<\/title>/i.test(page.text)
    && page.text.includes('/@vite/client') && page.text.includes('/src/main.jsx'))) return false;
  // HTML alone can look healthy while Vite cannot transform the entry module,
  // or while an older frontend is still proxying a stopped API on another port.
  const [entry, apiReady] = await Promise.all([probe(`${url}/src/main.jsx`), isCricDronaApi(url)]);
  return entry?.status === 200 && /(?:java|ecma)script/i.test(entry.contentType) && apiReady;
}

export async function websiteUrl(port) {
  const localhost = `http://localhost:${port}`;
  // localhost may resolve to IPv6 while an existing dev server binds only IPv4.
  // Advertise it only after verifying the same application is reachable there.
  return await isCricDronaClient(localhost) ? localhost : `http://127.0.0.1:${port}`;
}

export async function startApi({ port = environmentPort('API_PORT', 4001), log = console.log } = {}) {
  const url = `http://127.0.0.1:${port}`;
  const { default: handler } = await import('./handler.js');
  const server = createServer((req, res) => {
    res.setHeader(devHeader, devIdentity('api'));
    return handler(req, res);
  });
  try {
    await new Promise((resolveReady, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolveReady();
      });
    });
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    if (!(await isCricDronaApi(url))) throw portConflict('API', port, 'API_PORT');
    log(`CricDrona API already running at ${url}; reusing it. Restart that process to apply API configuration or code changes.`);
    return { server: null, url, reused: true };
  }
  log(`CricDrona API listening on ${url}`);
  return { server, url, reused: false };
}

export async function closeApi(server) {
  if (!server) return;
  await new Promise(resolveClosed => {
    server.close(resolveClosed);
    server.closeAllConnections();
  });
}
