import { createClient } from '@supabase/supabase-js';
import { demoEvents } from './demo.js';
import { HttpError, uuid, validateEvent, validateBatch, validateProfile, validateContact, validateTeam, validateRegistration, validateAssignment, validateMessageStatus } from './validation.js';

const ERRORS = {
  CD_AUTH_REQUIRED: [401, 'Sign in to continue.'],
  CD_FORBIDDEN: [403, 'You do not have permission to perform this action.'],
  CD_EVENT_NOT_FOUND: [404, 'Event not found.'],
  CD_REGISTRATION_NOT_FOUND: [404, 'Registration not found.'],
  CD_BATCH_NOT_FOUND: [404, 'Batch not found.'],
  CD_EVENT_UNAVAILABLE: [409, 'This event is not open for registration.'],
  CD_EVENT_STARTED: [409, 'Registration closes when the event starts.'],
  CD_CANCELLATION_CLOSED: [409, 'Online cancellation closes when the event starts. Contact the academy for help.'],
  CD_EVENT_FULL: [409, 'This event is full.'],
  CD_ALREADY_REGISTERED: [409, 'You are already registered for this event.'],
  CD_PROFILE_INCOMPLETE: [400, 'Save your name and date of birth in your player profile first.'],
  CD_AGE_INELIGIBLE: [400, 'Your date of birth does not meet this age category.'],
  CD_CONSENT_REQUIRED: [400, 'Participation consent is required.'],
  CD_BATCH_FULL: [409, 'This coaching batch is full.'],
  CD_BATCH_MISMATCH: [400, 'The batch must match the class ball type and the player age.'],
  CD_BATCH_COACH: [400, 'Choose an existing coach, admin or owner account.'],
  CD_CLASS_REQUIRED: [400, 'Only confirmed coaching class registrations can be assigned to a batch.'],
  CD_CAPACITY_TOO_SMALL: [409, 'Capacity cannot be lower than the number of confirmed registrations.'],
  CD_EVENT_LOCKED: [409, 'Date, age category, ball format and type cannot change after players register.'],
  CD_BATCH_LOCKED: [409, 'Age category and ball format cannot change while players are assigned.'],
  CD_USER_NOT_FOUND: [404, 'No registered player has that email address. Ask them to create an account first.'],
  CD_OWNER_PROTECTED: [403, 'Owner roles and your own role cannot be changed here.'],
  CD_CONTACT_LIMIT: [429, 'You have sent several enquiries recently. Please try again in an hour.'],
};
function checked(result) {
  if (!result.error) return result.data;
  const message = String(result.error.message || '');
  for (const [code, [status, description]] of Object.entries(ERRORS)) if (message.includes(code)) throw new HttpError(status, description);
  if (result.error.code === 'PGRST116') throw new HttpError(404, 'Record not found.');
  if (result.error.code === '42501') throw new HttpError(403, 'You do not have permission to perform this action.');
  if (result.error.code === '23505') throw new HttpError(409, 'This record already exists.');
  if (['23514', '23502', '22P02', '22007', '22008', '23503'].includes(result.error.code)) throw new HttpError(400, 'Please check the submitted values.');
  throw new HttpError(503, 'The data service is unavailable. Check the Supabase configuration and database migration.');
}

function config(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  // Never accept a secret/service-role key here: all requests must run under RLS.
  let serviceKey = key?.startsWith('sb_secret_');
  if (key?.split('.').length === 3) {
    try { serviceKey ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch { /* invalid keys fail at Supabase */ }
  }
  return { url, key, configured: Boolean(url && /^https?:\/\//.test(url) && key && !serviceKey) };
}
function defaultClientFactory({ url, key, token }) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
}
async function readBody(req) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Use application/json for request bodies.');
  if (Number(req.headers['content-length']) > 16384) throw new HttpError(413, 'Request body is too large.');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 16384) throw new HttpError(413, 'Request body is too large.'); chunks.push(Buffer.from(chunk)); }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 16384) throw new HttpError(413, 'Request body is too large.');
    try { body = JSON.parse(body); } catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
  }
  if (Buffer.byteLength(JSON.stringify(body ?? {})) > 16384) throw new HttpError(413, 'Request body is too large.');
  return body;
}
const requireRole = (role, allowed) => { if (!allowed.includes(role)) throw new HttpError(403, 'You do not have permission to perform this action.'); };
const REG_SELECT = '*,event:events(*),batch:batches(*),profile:profiles(name,email,phone)';

export function createHandler({ env = process.env, clientFactory = defaultClientFactory } = {}) {
  return async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname.replace(/\/+$/, '') || '/';
      const segments = pathname.split('/').filter(Boolean);
      if (segments.shift() !== 'api') throw new HttpError(404, 'API endpoint not found.');
      const path = segments.join('/');
      const method = req.method.toUpperCase();
      const settings = config(env);
      if (path === 'health' && method === 'GET') return send(200, { data: { configured: settings.configured, mode: settings.configured ? 'connected' : 'demo' } });
      if (!settings.configured) {
        if (segments[0] === 'events' && segments.length <= 2 && method === 'GET') {
          const event = segments.length === 2 ? demoEvents.find(x => x.id === segments[1]) : demoEvents;
          if (!event) throw new HttpError(404, 'Event not found.');
          return send(200, { data: event, mode: 'demo' });
        }
        throw new HttpError(503, 'Connect Supabase to use accounts, registrations and academy management.');
      }
      if (segments[0] === 'events' && segments.length <= 2 && method === 'GET') {
        if (segments[1]) uuid(segments[1], 'event ID');
        const db = clientFactory(settings);
        const events = checked(await db.rpc('list_events', { p_include_drafts: false })) || [];
        const data = segments[1] ? events.find(event => event.id === segments[1]) : events;
        if (!data) throw new HttpError(404, 'Event not found.');
        return send(200, { data });
      }
      const authorization = req.headers.authorization || '';
      if (!/^Bearer \S+$/i.test(authorization)) throw new HttpError(401, 'Sign in to continue.');
      const token = authorization.slice(7);
      const db = clientFactory({ ...settings, token });
      const auth = await db.auth.getUser(token);
      if (auth.error || !auth.data?.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
      const user = auth.data.user;
      const role = checked(await db.rpc('current_app_role')) || 'player';
      const body = ['POST', 'PATCH'].includes(method) ? await readBody(req) : undefined;

      if (path === 'profile') {
        let data;
        if (method === 'GET') data = checked(await db.from('profiles').select('*').eq('id', user.id).single());
        else if (method === 'PATCH') data = checked(await db.from('profiles').update(validateProfile(body)).eq('id', user.id).select('*').single());
        else throw new HttpError(405, 'Method not allowed.');
        return send(200, { data: { ...data, email: user.email, role } });
      }
      if (path === 'registrations') {
        if (method === 'GET') return send(200, { data: checked(await db.from('registrations').select(REG_SELECT).eq('user_id', user.id).order('created_at', { ascending: false }).limit(1000)) });
        if (method === 'POST') {
          const data = validateRegistration(body);
          const id = checked(await db.rpc('register_for_event', { p_event_id: data.event_id, p_consent: data.consent }));
          return send(201, { data: checked(await db.from('registrations').select(REG_SELECT).eq('id', id).single()) });
        }
        throw new HttpError(405, 'Method not allowed.');
      }
      if (segments[0] === 'registrations' && segments.length === 2 && method === 'DELETE') {
        const id = uuid(segments[1], 'registration ID');
        checked(await db.rpc('cancel_registration', { p_registration_id: id }));
        return send(200, { data: checked(await db.from('registrations').select(REG_SELECT).eq('id', id).single()) });
      }
      if (path === 'contact' && method === 'POST') {
        const value = validateContact(body);
        const id = checked(await db.rpc('submit_contact', { p_name: value.name, p_email: value.email, p_topic: value.topic, p_message: value.message }));
        return send(201, { data: { id, status: 'unread', message: 'Your enquiry was saved for the academy team.' } });
      }
      if (segments[0] !== 'admin') throw new HttpError(404, 'API endpoint not found.');
      requireRole(role, ['owner', 'admin', 'coach']);
      const resource = segments[1];
      const id = segments[2] ? uuid(segments[2]) : null;
      if (segments.length > 3) throw new HttpError(404, 'API endpoint not found.');
      if (resource === 'events') {
        if (method === 'GET' && !id) return send(200, { data: checked(await db.rpc('list_events', { p_include_drafts: role !== 'coach' })) });
        requireRole(role, ['owner', 'admin']);
        if (method === 'POST' && !id) return send(201, { data: { ...checked(await db.from('events').insert(validateEvent(body)).select('*').single()), registered_count: 0 } });
        if (method === 'PATCH' && id) {
          checked(await db.from('events').update(validateEvent(body, true)).eq('id', id).select('id').single());
          const events = checked(await db.rpc('list_events', { p_include_drafts: true }));
          return send(200, { data: events.find(event => event.id === id) });
        }
      }
      if (resource === 'batches') {
        if (method === 'GET' && !id) return send(200, { data: checked(await db.rpc('list_batches')) });
        requireRole(role, ['owner', 'admin']);
        if (method === 'POST' && !id) return send(201, { data: { ...checked(await db.from('batches').insert(validateBatch(body)).select('*').single()), registered_count: 0 } });
        if (method === 'PATCH' && id) return send(200, { data: checked(await db.from('batches').update(validateBatch(body, true)).eq('id', id).select('*').single()) });
      }
      if (resource === 'registrations') {
        if (method === 'GET' && !id) return send(200, { data: checked(await db.from('registrations').select(REG_SELECT).order('created_at', { ascending: false }).limit(1000)) });
        requireRole(role, ['owner', 'admin']);
        if (method === 'PATCH' && id) {
          const data = validateAssignment(body);
          checked(await db.rpc('assign_registration_batch', { p_registration_id: id, p_batch_id: data.batch_id }));
          return send(200, { data: checked(await db.from('registrations').select(REG_SELECT).eq('id', id).single()) });
        }
      }
      if (resource === 'messages') {
        requireRole(role, ['owner', 'admin']);
        if (method === 'GET' && !id) return send(200, { data: checked(await db.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(1000)) });
        if (method === 'PATCH' && id) return send(200, { data: checked(await db.from('contact_messages').update(validateMessageStatus(body)).eq('id', id).select('*').single()) });
      }
      if (resource === 'team' && !id) {
        requireRole(role, ['owner', 'admin']);
        if (method === 'GET') return send(200, { data: checked(await db.rpc('list_team')) });
        if (method === 'POST') {
          requireRole(role, ['owner']);
          const value = validateTeam(body);
          return send(200, { data: checked(await db.rpc('set_user_role', { p_email: value.email, p_role: value.role })) });
        }
      }
      throw new HttpError(405, 'Method not allowed.');
    } catch (error) {
      send(error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'Something went wrong. Please try again.' });
    }
  };
}

export default createHandler();
