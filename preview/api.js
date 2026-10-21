import { batches, countedBatches, countedEvents, currentProfile, currentRole, events, joinedRegistrations, messages, playerId, profiles, registrations } from './data';

export class ApiError extends Error { constructor(message, status = 400) { super(message); this.name = 'ApiError'; this.status = status; } }
// In-memory interaction fixtures for the isolated design server; no fetch calls.
export async function api(path, { method = 'GET', body } = {}) {
  const role = currentRole();
  const parts = path.replace(/^\/api/, '').split('/').filter(Boolean);
  const [resource, id, recordId] = parts;
  const copy = data => structuredClone(data);
  if (resource === 'health') return { configured: true, mode: 'design-preview' };
  if (resource === 'events' && method === 'GET') {
    const result = countedEvents().filter(event => event.status === 'published');
    if (id && !result.some(event => event.id === id)) throw new ApiError('Event not found.', 404);
    return copy(id ? result.find(event => event.id === id) : result);
  }
  if (role === 'guest') throw new ApiError('Sign in to continue.', 401);
  if (resource === 'profile') {
    if (method === 'PATCH') Object.assign(profiles[0], body);
    return copy(currentProfile());
  }
  if (resource === 'registrations') {
    if (method === 'GET') return copy(joinedRegistrations().filter(r => r.user_id === playerId));
    if (method === 'DELETE') {
      const item = registrations.find(r => r.id === id && r.user_id === playerId);
      if (!item) throw new ApiError('Registration not found.', 404);
      item.status = 'cancelled'; item.batch_id = null;
      return copy(item);
    }
    if (method === 'POST') {
      if (registrations.some(r => r.user_id === playerId && r.event_id === body.event_id && r.status === 'confirmed')) throw new ApiError('You are already registered for this event.', 409);
      const item = { id: crypto.randomUUID(), user_id: playerId, event_id: body.event_id, status: 'confirmed', batch_id: null, created_at: new Date().toISOString() };
      registrations.unshift(item);
      return copy(joinedRegistrations().find(r => r.id === item.id));
    }
  }
  if (resource === 'contact') { const item = { ...body, id: crypto.randomUUID(), status: 'unread', created_at: new Date().toISOString() }; messages.unshift(item); return copy(item); }
  if (resource === 'admin') {
    if (!['owner', 'admin', 'coach'].includes(role) || (role === 'coach' && (method !== 'GET' || ['team', 'messages'].includes(id)))) throw new ApiError('You do not have permission to perform this action.', 403);
    if (method === 'GET') {
      const result = { events: countedEvents(), batches: countedBatches(), registrations: joinedRegistrations(), messages, team: profiles }[id];
      if (!result) throw new ApiError('Not found.', 404);
      return copy(role === 'coach' ? (id === 'events' ? result.filter(e => e.status === 'published') : id === 'registrations' ? result.filter(r => r.batch?.coach_id === currentProfile().id) : result.filter(b => b.coach_id === currentProfile().id)) : result);
    }
    if (id === 'team') {
      if (role !== 'owner') throw new ApiError('Only the academy owner can change account roles.', 403);
      const person = profiles.find(p => p.email === body.email);
      if (!person) throw new ApiError('No registered player has that email address.');
      if (person.id === playerId) throw new ApiError('Your own role cannot be changed here.');
      person.role = body.role; return copy(person);
    }
    const collection = { events, batches, registrations, messages }[id];
    if (collection && method === 'POST') { const item = { ...body, id: crypto.randomUUID(), registered_count: 0 }; collection.unshift(item); return copy(item); }
    if (collection && method === 'PATCH') {
      const item = collection.find(item => item.id === recordId);
      if (!item) throw new ApiError('Record not found.', 404);
      Object.assign(item, body);
      if (id === 'events' && body.status === 'cancelled') registrations.filter(r => r.event_id === recordId).forEach(r => { r.status = 'cancelled'; r.batch_id = null; });
      return copy(item);
    }
  }
  throw new ApiError('This action is unavailable in the design preview.', 405);
}
export default api;
