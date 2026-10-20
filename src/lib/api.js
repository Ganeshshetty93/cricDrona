import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** Send requests to our same-origin Node API. An explicit token avoids auth locks in consumers. */
export async function api(path, { method = 'GET', body, token, signal, headers = {} } = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('API requests must use a local path.');
  }
  let accessToken = token;
  if (accessToken === undefined && supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    accessToken = data.session?.access_token;
  }
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (accessToken) requestHeaders.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(path === '/api' || path.startsWith('/api/') ? path : `/api${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach CricDrona. Check your connection and try again.', 0);
  }
  if (response.status === 204) return null;
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('The API returned an unexpected response. Check that the Node API is running.', response.status);
  }
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : payload?.error?.message;
    throw new ApiError(message || 'The request could not be completed.', response.status, payload?.details);
  }
  return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

export default api;
