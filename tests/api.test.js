import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../server/handler.js';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT = '11111111-1111-4111-8111-111111111111';
const REG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BATCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-test-key' };

function database({ role = 'player', authError = false, rpcResults = {}, tables = {}, throwAuth = false } = {}) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async token => {
      calls.push(['auth', token]);
      if (throwAuth) throw new Error('SECRET connection string');
      return { data: { user: authError ? null : { id: USER, email: 'verified@example.com' } }, error: authError ? { message: 'invalid JWT' } : null };
    } },
    rpc: async (name, args) => {
      calls.push(['rpc', name, args]);
      return rpcResults[name] || { data: name === 'current_app_role' ? role : [], error: null };
    },
    from(table) {
      const chain = {};
      for (const method of ['select', 'eq', 'order', 'limit', 'single', 'insert', 'update']) chain[method] = (...args) => { calls.push([table, method, ...args]); return chain; };
      chain.then = (resolve, reject) => Promise.resolve(tables[table] || { data: [], error: null }).then(resolve, reject);
      return chain;
    },
  };
}
async function request(path, { method = 'GET', body, token, env = ENV, db = database(), headers = {} } = {}) {
  const usedSettings = [];
  const handler = createHandler({ env, clientFactory: settings => { usedSettings.push(settings); return db; } });
  const req = { url: `/api${path}`, method, body, headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(token && { authorization: `Bearer ${token}` }), ...headers } };
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(text) { this.json = JSON.parse(text); } };
  await handler(req, response);
  return { status: response.statusCode, body: response.json, headers: response.headers, settings: usedSettings, calls: db.calls };
}

test('unconfigured health and original demo data are explicit and read only', async () => {
  const health = await request('/health', { env: {} });
  assert.deepEqual(health.body, { data: { configured: false, mode: 'demo' } });
  assert.equal(health.settings.length, 0);
  const events = await request('/events', { env: {} });
  assert.equal(events.body.mode, 'demo');
  assert.equal(events.body.data.length, 4);
  assert.equal(events.body.data[0].title, 'Weekend Warriors Cup');
  assert.equal((await request('/registrations', { env: {}, method: 'POST', body: { event_id: EVENT, consent: true } })).status, 503);
});

test('server refuses secret keys and legacy service-role credentials', async () => {
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  for (const key of ['sb_secret_do_not_use', jwt]) {
    const result = await request('/health', { env: { SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_ANON_KEY: key } });
    assert.equal(result.body.data.configured, false);
    assert.equal(result.settings.length, 0);
  }
});

test('public list uses aggregate RPC without trusting a client token or exposing private rows', async () => {
  const db = database({ rpcResults: { list_events: { data: [{ id: EVENT, registered_count: 3 }], error: null } } });
  const result = await request('/events', { db, token: 'unverified' });
  assert.equal(result.status, 200);
  assert.equal(result.settings[0].token, undefined);
  assert.deepEqual(result.calls, [['rpc', 'list_events', { p_include_drafts: false }]]);
  assert.equal(result.body.data[0].registered_count, 3);
});

test('invalid public event ID is rejected and missing published event returns 404', async () => {
  assert.equal((await request('/events/not-a-uuid')).status, 400);
  assert.equal((await request(`/events/${EVENT}`)).status, 404);
});

test('public event lookup accepts uppercase UUIDs and returns the canonical event', async () => {
  const eventId = 'abcdefab-abcd-4abc-8abc-abcdefabcdef';
  const db = database({ rpcResults: { list_events: { data: [{ id: eventId, title: 'Evening cricket' }], error: null } } });
  const result = await request(`/events/${eventId.toUpperCase()}`, { db });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.id, eventId);
});

test('protected endpoints reject missing and invalid sessions before private data access', async () => {
  const missing = await request('/profile');
  assert.equal(missing.status, 401);
  assert.equal(missing.settings.length, 0);
  const invalid = await request('/profile', { token: 'expired', db: database({ authError: true }) });
  assert.equal(invalid.status, 401);
  assert.deepEqual(invalid.calls, [['auth', 'expired']]);
});

test('verified token is forwarded under RLS, profile email and role are trusted sources', async () => {
  const db = database({ role: 'coach', tables: { profiles: { data: { id: USER, name: 'Arjun', email: 'stale@example.com', role: 'owner' }, error: null } } });
  const result = await request('/profile', { token: 'verified-token', db });
  assert.equal(result.settings[0].token, 'verified-token');
  assert.equal(result.body.data.email, 'verified@example.com');
  assert.equal(result.body.data.role, 'coach');
  assert.ok(result.calls.some(call => call[0] === 'profiles' && call[1] === 'eq' && call[2] === 'id' && call[3] === USER));
});

test('profile writes reject role, ownership and email injection as well as impossible dates', async () => {
  for (const body of [{ role: 'owner' }, { id: REG }, { email: 'attacker@example.com' }, { dob: '2026-02-30' }, { dob: '3000-01-01' }, { constructor: 'unexpected' }]) {
    const db = database();
    const result = await request('/profile', { token: 'valid', method: 'PATCH', body, db });
    assert.equal(result.status, 400);
    assert.ok(!db.calls.some(call => call[1] === 'update'));
  }
});

test('players cannot read or mutate academy endpoints', async () => {
  for (const [path, method, body] of [['/admin/events', 'GET'], ['/admin/events', 'POST', {}], ['/admin/messages', 'GET'], ['/admin/team', 'POST', { email: 'x@example.com', role: 'admin' }]]) {
    const result = await request(path, { token: 'valid', method, body });
    assert.equal(result.status, 403);
    assert.equal(result.calls.filter(call => call[0] === 'rpc').length, 1);
  }
});

test('coach can read assigned batches but cannot read team/messages or change events', async () => {
  const db = database({ role: 'coach', rpcResults: { list_batches: { data: [{ id: BATCH, coach_id: USER }], error: null } } });
  assert.equal((await request('/admin/batches', { token: 'valid', db })).status, 200);
  for (const [path, method, body] of [['/admin/events', 'POST', {}], ['/admin/messages', 'GET'], ['/admin/team', 'GET'], [`/admin/registrations/${REG}`, 'PATCH', { batch_id: BATCH }]]) {
    assert.equal((await request(path, { token: 'valid', method, body, db: database({ role: 'coach' }) })).status, 403);
  }
});

test('owner alone can assign an existing account role; owner role cannot be granted', async () => {
  const payload = { email: 'Coach@Example.com', role: 'coach' };
  assert.equal((await request('/admin/team', { token: 'valid', method: 'POST', body: payload, db: database({ role: 'admin' }) })).status, 403);
  const db = database({ role: 'owner', rpcResults: { set_user_role: { data: { id: USER, role: 'coach' }, error: null } } });
  const result = await request('/admin/team', { token: 'valid', method: 'POST', body: payload, db });
  assert.equal(result.status, 200);
  assert.ok(result.calls.some(call => call[1] === 'set_user_role' && call[2].p_email === 'coach@example.com'));
  assert.equal((await request('/admin/team', { token: 'valid', method: 'POST', body: { ...payload, role: 'owner' }, db: database({ role: 'owner' }) })).status, 400);
});

test('registration requires explicit consent and never accepts a user ID from the browser', async () => {
  for (const body of [{ event_id: EVENT }, { event_id: EVENT, consent: 'true' }, { event_id: EVENT, consent: true, user_id: REG }]) {
    const result = await request('/registrations', { token: 'valid', method: 'POST', body });
    assert.equal(result.status, 400);
    assert.ok(!result.calls.some(call => call[1] === 'register_for_event'));
  }
});

test('registration creation uses the atomic DB RPC and fetches the resulting nested record', async () => {
  const db = database({ rpcResults: { register_for_event: { data: REG, error: null } }, tables: { registrations: { data: { id: REG, event: { id: EVENT }, status: 'confirmed' }, error: null } } });
  const result = await request('/registrations', { token: 'valid', method: 'POST', body: { event_id: EVENT, consent: true }, db });
  assert.equal(result.status, 201);
  assert.deepEqual(result.calls.find(call => call[1] === 'register_for_event'), ['rpc', 'register_for_event', { p_event_id: EVENT, p_consent: true }]);
  assert.equal(result.body.data.id, REG);
});

test('DB eligibility/capacity errors return useful conflict messages without raw database details', async () => {
  for (const [code, status] of [['CD_EVENT_FULL', 409], ['CD_AGE_INELIGIBLE', 400], ['CD_ALREADY_REGISTERED', 409]]) {
    const db = database({ rpcResults: { register_for_event: { data: null, error: { message: `${code}: SECRET SQL detail` } } } });
    const result = await request('/registrations', { token: 'valid', method: 'POST', body: { event_id: EVENT, consent: true }, db });
    assert.equal(result.status, status);
    assert.ok(!result.body.error.includes('SECRET'));
  }
});

test('personal registration query explicitly filters authenticated user', async () => {
  const result = await request('/registrations', { token: 'valid' });
  assert.equal(result.status, 200);
  assert.ok(result.calls.some(call => call[0] === 'registrations' && call[1] === 'eq' && call[2] === 'user_id' && call[3] === USER));
});

test('cancellation uses owner-checked RPC and surfaces start-time restriction', async () => {
  const db = database({ rpcResults: { cancel_registration: { data: null, error: { message: 'CD_CANCELLATION_CLOSED' } } } });
  const result = await request(`/registrations/${REG}`, { token: 'valid', method: 'DELETE', db });
  assert.equal(result.status, 409);
  assert.match(result.body.error, /cancellation closes/);
  assert.deepEqual(result.calls.find(call => call[1] === 'cancel_registration'), ['rpc', 'cancel_registration', { p_registration_id: REG }]);
});

test('batch assignment uses locking RPC rather than direct registration update', async () => {
  const result = await request(`/admin/registrations/${REG}`, { token: 'valid', method: 'PATCH', body: { batch_id: BATCH }, db: database({ role: 'admin' }) });
  assert.equal(result.status, 200);
  assert.ok(result.calls.some(call => call[1] === 'assign_registration_batch' && call[2].p_batch_id === BATCH));
  assert.ok(!result.calls.some(call => call[0] === 'registrations' && call[1] === 'update'));
});

test('event validation rejects negative fees, fractional seats and unknown privileged fields', async () => {
  const valid = { title: 'Evening cricket', type: 'Match', ball: 'Hard ball', age: 'Open', date: '2099-11-01', time: '18:30', place: 'Drona Cricket Ground', fee: 100, seats: 20 };
  for (const body of [{ ...valid, seats: 1.5 }, { ...valid, fee: -1 }, { ...valid, registered_count: 0 }, { ...valid, time: '25:00' }]) {
    assert.equal((await request('/admin/events', { token: 'valid', method: 'POST', body, db: database({ role: 'admin' }) })).status, 400);
  }
});

test('contact saves an enquiry with a DB rate limit and does not claim an email was sent', async () => {
  const body = { name: 'Arjun Sharma', email: 'arjun@example.com', topic: 'Coaching classes', message: 'Please tell me about weekend coaching.' };
  const success = await request('/contact', { token: 'valid', method: 'POST', body, db: database({ rpcResults: { submit_contact: { data: REG, error: null } } }) });
  assert.equal(success.status, 201);
  assert.match(success.body.data.message, /saved/);
  const limited = await request('/contact', { token: 'valid', method: 'POST', body, db: database({ rpcResults: { submit_contact: { data: null, error: { message: 'CD_CONTACT_LIMIT' } } } }) });
  assert.equal(limited.status, 429);
});

test('malformed, oversized or non-JSON request bodies are rejected', async () => {
  assert.equal((await request('/profile', { token: 'valid', method: 'PATCH', body: '{invalid' })).status, 400);
  assert.equal((await request('/profile', { token: 'valid', method: 'PATCH', body: { name: 'A'.repeat(17000) } })).status, 413);
  assert.equal((await request('/profile', { token: 'valid', method: 'PATCH', body: { name: 'Arjun' }, headers: { 'content-type': 'text/plain' } })).status, 415);
});

test('JSON media-type parameters are accepted but prefix lookalikes cannot trigger writes', async () => {
  const options = { token: 'valid', method: 'PATCH', body: { name: 'Arjun' } };
  assert.equal((await request('/profile', { ...options, headers: { 'content-type': 'Application/JSON; charset=utf-8' } })).status, 200);
  for (const contentType of ['application/jsonp', 'application/json-patch+json']) {
    const db = database();
    const result = await request('/profile', { ...options, db, headers: { 'content-type': contentType } });
    assert.equal(result.status, 415);
    assert.ok(!db.calls.some(call => call[1] === 'update'));
  }
});

test('unexpected errors are redacted and account responses disable caching', async () => {
  const result = await request('/profile', { token: 'valid', db: database({ throwAuth: true }) });
  assert.equal(result.status, 500);
  assert.equal(result.body.error, 'Something went wrong. Please try again.');
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
});
