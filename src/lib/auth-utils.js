// Validate return destinations independently of browser state and auth SDK loading.
export function safeNext(value, fallback = '/dashboard') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const resolved = new URL(value, 'https://cricdrona.local');
    const decodedPath = decodeURIComponent(resolved.pathname);
    if (resolved.origin !== 'https://cricdrona.local' || /[\\\u0000-\u001f\u007f]/.test(decodedPath) || decodedPath.startsWith('//')) return fallback;
    if (decodedPath === '/' || /^\/contact\/?$/.test(decodedPath) || /^\/(dashboard|events|profile|registrations|admin|coach|owner)(\/|$)/.test(decodedPath)) {
      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
  } catch { /* Malformed URL escape sequences are never return destinations. */ }
  return fallback;
}

// The caller supplies the role from the authenticated profile API, never signup metadata.
export function authLandingPath(next, role) {
  const workspace = ['owner', 'admin', 'coach'].includes(role) ? '/admin' : '/dashboard';
  return safeNext(next, workspace);
}

export function normalizeAccountKey(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';

  if (raw.includes('@')) {
    const [left, ...right] = raw.split('@');
    const domain = right.join('@');
    if (!left || !domain) return '';

    const validEmailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9.!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
    if (domain === 'cricdrona.local') {
      const local = left.replace(/[^a-z0-9._+-]+/g, '').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
      return local ? `${local}@cricdrona.local` : '';
    }
    if (validEmailPattern.test(raw)) return raw;

    const local = left.replace(/[^a-z0-9._+-]+/g, '').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
    return local ? `${local}@cricdrona.local` : '';
  }

  const candidate = raw
    .replace(/[^a-z0-9._+-]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  if (!candidate) return '';

  const segments = candidate.split('.');
  const looksLikeDomainSuffix = segments.length >= 3 && /^(com|in|co|org|net|io|app|dev|me|ai|edu|gov|info|biz|shop|online)$/i.test(segments.at(-1)) && segments.at(-2).length >= 2;
  const normalizedBase = looksLikeDomainSuffix ? segments.slice(0, -2).join('.') : candidate;
  const finalLocal = normalizedBase || candidate;

  return finalLocal.includes('@') ? finalLocal : `${finalLocal}@cricdrona.local`;
}

export function validSupabaseConfiguration(url, publicKey) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password
      || /your[-_ ]|example|placeholder/i.test(url) || publicKey.length <= 20) return false;
    if (publicKey.startsWith('sb_publishable_')) return true;
    // Old Supabase public keys are JWTs. A service_role key must never enter a browser client.
    const parts = publicKey.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replaceAll('-', '+').replaceAll('_', '/')));
    return payload.role === 'anon';
  } catch {
    return false;
  }
}
