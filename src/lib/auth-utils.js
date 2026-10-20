// Validate return destinations independently of browser state and auth SDK loading.
export function safeNext(value, fallback = '/dashboard') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const resolved = new URL(value, 'https://cricdrona.local');
    const decodedPath = decodeURIComponent(resolved.pathname);
    if (resolved.origin !== 'https://cricdrona.local' || /[\\\u0000-\u001f\u007f]/.test(decodedPath) || decodedPath.startsWith('//')) return fallback;
    if (decodedPath === '/' || /^\/(dashboard|events|profile|registrations|admin|coach|owner)(\/|$)/.test(decodedPath)) {
      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
  } catch { /* Malformed URL escape sequences are never return destinations. */ }
  return fallback;
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
