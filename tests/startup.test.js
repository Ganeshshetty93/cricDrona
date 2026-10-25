import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectRoot, loadProjectEnvironment, devHeader, devIdentity, isCricDronaClient } from '../server/runtime.js';

const demoEnvironment = Object.fromEntries([
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY',
].map(name => [name, '']));

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function close(server) {
  await new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  });
}

async function unusedPort() {
  const server = createServer();
  const port = await listen(server);
  await close(server);
  return port;
}

function start(script, env, t) {
  const child = spawn(process.execPath, [join(projectRoot, script)], {
    // Entry points must work even when launched outside the repository.
    cwd: tmpdir(), env: { ...process.env, ...demoEnvironment, ...env },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, output }));
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await done;
  });
  return { child, done, output: () => output };
}

async function finish(processHandle) {
  let timer;
  try {
    return await Promise.race([
      processHandle.done,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Startup did not finish: ${processHandle.output()}`)), 10000); }),
    ]);
  } finally { clearTimeout(timer); }
}

async function waitForApi(port, processHandle) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (processHandle.child.exitCode !== null) assert.fail(processHandle.output());
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(300) });
      if (response.ok) return response.json();
    } catch { /* The subprocess is still loading. */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`API did not become ready: ${processHandle.output()}`);
}

test('project environment uses its supplied root and local overrides without replacing shell values', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cricdrona-env-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, '.env'), 'API_PORT=3010\nCLIENT_PORT=5180\nBASE_ONLY=yes\n');
  await writeFile(join(root, '.env.local'), 'API_PORT=3011\nCLIENT_PORT=5181\nLOCAL_ONLY=yes\n');
  const env = { CLIENT_PORT: '5190', SUPABASE_URL: '' };
  loadProjectEnvironment(root, env);
  assert.deepEqual(env, { CLIENT_PORT: '5190', SUPABASE_URL: '', API_PORT: '3011', BASE_ONLY: 'yes', LOCAL_ONLY: 'yes' });
});

test('duplicate standalone and combined startup reuse CricDrona without stopping the original services', { timeout: 25000 }, async t => {
  const port = await unusedPort();
  const first = start('server/dev.js', { API_PORT: String(port) }, t);
  assert.deepEqual(await waitForApi(port, first), { data: { configured: false, mode: 'demo' } });

  const duplicate = await finish(start('server/dev.js', { API_PORT: String(port) }, t));
  assert.equal(duplicate.code, 0, duplicate.output);
  assert.match(duplicate.output, /API already running.*reusing it/);
  assert.doesNotMatch(duplicate.output, /EADDRINUSE|Unhandled/);
  assert.equal(first.child.exitCode, null);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/events`)).status, 200);

  // A legacy Vite response has no new development identity header.
  const client = createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = req.url === '/api/health' ? 200 : 503;
      return res.end(JSON.stringify(req.url === '/api/health' ? { data: { configured: false, mode: 'demo' } } : { error: 'Connect Supabase to use accounts, registrations and academy management.' }));
    }
    if (req.url === '/src/main.jsx') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end('export const ready = true;');
    }
    res.end('<title>CricDrona</title><script src="/@vite/client"></script><script src="/src/main.jsx"></script>');
  });
  const clientPort = await listen(client);
  t.after(() => close(client));
  const combined = await finish(start('scripts/dev.mjs', { API_PORT: String(port), CLIENT_PORT: String(clientPort) }, t));
  assert.equal(combined.code, 0, combined.output);
  assert.match(combined.output, /website already running.*reusing it/);
  assert.match(combined.output, /CricDrona is ready\./);
  assert.match(combined.output, new RegExp(`Open the website in your browser: http://(?:localhost|127\\.0\\.0\\.1):${clientPort}`));
  assert.match(combined.output, /This command can finish; the website stays available/);
  assert.equal(first.child.exitCode, null);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${clientPort}`)).status, 200);
});

test('a matching website identity is not considered ready when its entry module or API proxy fails', async t => {
  let failedPart = 'entry';
  const client = createServer((req, res) => {
    res.setHeader(devHeader, req.url.startsWith('/api/') ? devIdentity('api') : devIdentity('client'));
    if (req.url === '/api/health') {
      res.statusCode = failedPart === 'api' ? 502 : 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ data: { configured: false, mode: 'demo' } }));
    }
    if (req.url === '/src/main.jsx') {
      res.statusCode = failedPart === 'entry' ? 500 : 200;
      res.setHeader('Content-Type', 'application/javascript');
      return res.end('export const ready = true;');
    }
    res.end('<title>CricDrona</title>');
  });
  const port = await listen(client);
  t.after(() => close(client));
  const url = `http://127.0.0.1:${port}`;
  assert.equal(await isCricDronaClient(url), false);
  failedPart = 'api';
  assert.equal(await isCricDronaClient(url), false);
  failedPart = null;
  assert.equal(await isCricDronaClient(url), true);
});

test('a fresh combined launch serves the real website and API on custom ports and prints a verified browser URL', { timeout: 45000 }, async t => {
  const apiPort = await unusedPort();
  let clientPort = await unusedPort();
  while (clientPort === apiPort) clientPort = await unusedPort();
  const combined = start('scripts/dev.mjs', { API_PORT: String(apiPort), CLIENT_PORT: String(clientPort) }, t);
  for (let attempt = 0; attempt < 600 && !combined.output().includes('CricDrona is ready.'); attempt += 1) {
    if (combined.child.exitCode !== null) assert.fail(combined.output());
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.match(combined.output(), /CricDrona is ready\./);
  assert.match(combined.output(), /Keep this terminal open while using the website/);
  const browserUrl = combined.output().match(/Open the website in your browser: (http:\/\/\S+)/)?.[1];
  assert.ok(browserUrl, combined.output());
  assert.equal(await isCricDronaClient(browserUrl), true);
  const health = await (await fetch(`${browserUrl}/api/health`)).json();
  assert.deepEqual(health, { data: { configured: false, mode: 'demo' } });
});

test('an unrelated service with a generic health response is preserved and produces actionable guidance', { timeout: 15000 }, async t => {
  const other = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/api/health' ? { data: { configured: false, mode: 'demo' } } : { service: 'unrelated' }));
  });
  const port = await listen(other);
  t.after(() => close(other));
  const result = await finish(start('server/dev.js', { API_PORT: String(port) }, t));
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /already used by another service/);
  assert.match(result.output, /Set API_PORT to an unused port/);
  assert.doesNotMatch(result.output, /EADDRINUSE|Unhandled/);
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${port}/`)).json(), { service: 'unrelated' });
});
