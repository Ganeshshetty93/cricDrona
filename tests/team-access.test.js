import test from 'node:test';
import assert from 'node:assert/strict';
import { setTeamAccess } from '../server/team-access.js';

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TARGET = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMAIL = 'player@example.com';
const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only' };

// In-memory query adapter models role state and concurrent changes, not Supabase authorization.
function fixture({ actorRole = 'admin', targetRole = 'player', profiles = [{ id: TARGET, email: EMAIL }], beforeWrite, dbError } = {}) {
  const roles = new Map([[ACTOR, actorRole], [TARGET, targetRole]]);
  const calls = [], updates = [];
  let actorReads = 0;
  const db = {
    from(table) {
      const filters = [];
      let patch;
      const query = {
        select() { return query; }, limit() { return query; }, maybeSingle() { return query; },
        eq(name, value) { filters.push([name, value, true]); return query; },
        neq(name, value) { filters.push([name, value, false]); return query; },
        update(value) { patch = value; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            calls.push({ table, patch, filters });
            if (dbError) return { data: null, error: { message: dbError } };
            if (table === 'profiles') return { data: profiles, error: null };
            const id = filters.find(([field]) => field === 'user_id')?.[1];
            if (id === ACTOR && !patch) {
              actorReads += 1;
              if (actorReads === 2) beforeWrite?.({ roles, phase: 'actor' });
            }
            if (!patch) return { data: roles.has(id) ? { role: roles.get(id) } : null, error: null };
            beforeWrite?.({ roles, phase: 'target' });
            const row = { user_id: id, role: roles.get(id) };
            const matches = filters.every(([field, value, equal]) => equal ? row[field] === value : row[field] !== value);
            if (!matches) return { data: null, error: null };
            roles.set(id, patch.role);
            updates.push({ id, ...patch });
            return { data: { user_id: id, role: patch.role }, error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { roles, calls, updates, db };
}

const change = (setup, overrides = {}) => setTeamAccess({ actor: { id: ACTOR }, actorRole: 'admin', value: { email: EMAIL, role: 'admin' }, env: ENV, clientFactory: () => setup.db, ...overrides });

test('admins and owners can assign each supported role to another registered account', async () => {
  for (const actorRole of ['admin', 'owner']) for (const role of ['admin', 'coach', 'player']) {
    const setup = fixture({ actorRole, targetRole: 'coach' });
    assert.deepEqual(await change(setup, { actorRole, value: { email: ' Player@Example.com ', role } }), { id: TARGET, email: EMAIL, role });
    assert.equal(setup.roles.get(TARGET), role);
    assert.equal(setup.roles.get(ACTOR), actorRole);
  }
});

test('self and owner accounts remain protected for either manager role', async () => {
  for (const actorRole of ['admin', 'owner']) {
    for (const setup of [fixture({ actorRole, targetRole: 'owner' }), fixture({ actorRole, profiles: [{ id: ACTOR, email: EMAIL }] })]) {
      await assert.rejects(change(setup, { actorRole }), { status: 403 });
      assert.equal(setup.updates.length, 0);
    }
  }
});

test('invalid desired roles and injected fields fail before privileged client creation', async () => {
  let created = 0;
  for (const value of [{ email: EMAIL, role: 'owner' }, { email: EMAIL, role: 'admin', user_id: TARGET }, { email: EMAIL, role: 'superadmin' }]) {
    await assert.rejects(change(fixture(), { value, clientFactory: () => { created++; } }), { status: 400 });
  }
  assert.equal(created, 0);
});

test('unprivileged callers and missing server secret fail closed', async () => {
  let created = 0;
  const clientFactory = () => { created++; };
  for (const actorRole of ['player', 'coach', null]) await assert.rejects(change(fixture(), { actorRole, clientFactory }), { status: 403 });
  await assert.rejects(change(fixture(), { actor: null, clientFactory }), { status: 401 });
  for (const key of [undefined, '', 'sb_publishable_not_a_secret']) {
    await assert.rejects(change(fixture(), { env: { ...ENV, SUPABASE_SECRET_KEY: key }, clientFactory }), { status: 503 });
  }
  assert.equal(created, 0);
});

test('email lookup requires an exact, unambiguous registered identity', async () => {
  for (const [profiles, status] of [[[], 404], [[{ id: TARGET, email: 'different@example.com' }], 409], [[{ id: TARGET, email: EMAIL }, { id: ACTOR, email: EMAIL }], 409]]) {
    const setup = fixture({ profiles });
    await assert.rejects(change(setup), { status });
    assert.equal(setup.updates.length, 0);
  }
  const setup = fixture({ profiles: [] });
  await assert.rejects(change(setup, { value: { email: '%_person@example.com', role: 'admin' } }), { status: 404 });
  assert.deepEqual(setup.calls.find(call => call.table === 'profiles').filters, [['email', '%_person@example.com', true]]);
});

test('revoked manager access is rechecked before saving', async () => {
  const revoked = fixture({ actorRole: 'player' });
  await assert.rejects(change(revoked), { status: 403 });
  assert.equal(revoked.updates.length, 0);
  const race = fixture({ beforeWrite: ({ roles, phase }) => { if (phase === 'actor') roles.set(ACTOR, 'player'); } });
  await assert.rejects(change(race), { status: 403 });
  assert.equal(race.updates.length, 0);
});

test('concurrent role edits, including owner promotion, are never overwritten', async () => {
  for (const newer of ['owner', 'coach']) {
    const setup = fixture({ beforeWrite: ({ roles, phase }) => { if (phase === 'target') roles.set(TARGET, newer); } });
    await assert.rejects(change(setup), { status: 409 });
    assert.equal(setup.roles.get(TARGET), newer);
    assert.equal(setup.updates.length, 0);
  }
});

test('database failures are redacted and missing role rows are not silently inserted', async () => {
  await assert.rejects(change(fixture({ dbError: 'PRIVATE database details' })), error => error.status === 503 && !error.message.includes('PRIVATE'));
  const setup = fixture();
  setup.roles.delete(TARGET);
  await assert.rejects(change(setup), { status: 409 });
  assert.equal(setup.updates.length, 0);
});
