import { pathToFileURL } from 'node:url';

// Public, read-only checks: no account, token or database writes are needed.
export async function checkDeployment(baseUrl) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Use an HTTP(S) deployment URL without credentials.');
  }
  const results = [];
  async function check(path, verify) {
    try {
      const response = await fetch(new URL(path, base.origin), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      });
      const text = await response.text();
      let body;
      try { body = JSON.parse(text); } catch { /* HTML is expected for SPA routes. */ }
      results.push({ path, status: response.status, ok: Boolean(verify(response, body, text)) });
      return body;
    } catch (error) {
      results.push({ path, ok: false, error: error.message });
      return undefined;
    }
  }

  await check('/api/health', (response, body) => response.status === 200 && body?.data?.configured === true);
  const catalog = await check('/api/events', (response, body) => response.status === 200 && Array.isArray(body?.data));
  const eventId = catalog?.data?.find(event => /^[0-9a-f-]{36}$/i.test(event.id))?.id;
  if (eventId) {
    await check(`/api/events/${eventId}`, (response, body) => response.status === 200 && body?.data?.id === eventId);
    await check(`/events/${eventId}`, (response, body, text) => response.status === 200 && response.headers.get('content-type')?.includes('text/html') && /<div\b[^>]*id=["']root["']/.test(text));
  } else {
    results.push({ path: '/api/events/:id', ok: false, error: 'No published event available to verify the event-details route.' });
  }
  for (const path of ['/api/profile', '/api/admin/team', '/api/admin/events', '/api/admin/batches', '/api/admin/registrations/00000000-0000-4000-8000-000000000000']) {
    await check(path, (response, body) => response.status === 401 && body?.error === 'Sign in to continue.');
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: npm run test:deployment -- https://your-deployment.example');
    const results = await checkDeployment(process.argv[2]);
    for (const result of results) {
      console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.path} — ${result.status ?? result.error}`);
    }
    if (results.some(result => !result.ok)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
