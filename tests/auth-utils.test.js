import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNext, validSupabaseConfiguration } from '../src/lib/auth-utils.js';

test('login return destinations preserve local application routes', () => {
  for (const value of ['/', '/dashboard', '/events/123?intent=register', '/profile#preferences', '/admin/events', '/registrations']) {
    assert.equal(safeNext(value), value);
  }
});

test('login return destinations reject external, malformed, and unknown routes', () => {
  for (const value of [null, '', '//evil.example', 'https://evil.example', '/\\evil.example', '/\tevil.example', '/events/../../login', '/events/%5cevil', '/%2fevil.example', '/events/%0aevil', '/events/%', '/login', '/forgot-password', 'javascript:alert(1)']) {
    assert.equal(safeNext(value), '/dashboard', String(value));
  }
});

test('Supabase accepts public publishable and legacy anon keys', () => {
  const jwt = `e30.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;
  assert.equal(validSupabaseConfiguration('https://cricdrona.supabase.co', 'sb_publishable_1234567890abcdefghijklmnop'), true);
  assert.equal(validSupabaseConfiguration('http://127.0.0.1:54321', jwt), true);
});

test('Supabase refuses server-only credentials and placeholder configuration', () => {
  const serviceRole = `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  for (const key of [serviceRole, 'sb_secret_1234567890abcdefghijklmnop', '', 'your_anon_key', 'unrecognised-credential-string']) {
    assert.equal(validSupabaseConfiguration('https://cricdrona.supabase.co', key), false);
  }
  assert.equal(validSupabaseConfiguration('https://your-project.supabase.co', 'sb_publishable_1234567890abcdefghijklmnop'), false);
  assert.equal(validSupabaseConfiguration('ftp://cricdrona.supabase.co', 'sb_publishable_1234567890abcdefghijklmnop'), false);
});
