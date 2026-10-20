export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const AGES = ['Under 10', 'Under 12', 'Under 14', 'Under 16', 'Under 19', 'Adults', 'Open'];
export const BALLS = ['Tennis ball', 'Hard ball'];
export function uuid(value, label = 'ID') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, `Invalid ${label}.`);
  return value;
}
function text(value, label, min = 1, max = 200) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new HttpError(400, `${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
function choice(value, values, label) {
  if (!values.includes(value)) throw new HttpError(400, `Invalid ${label}.`);
  return value;
}
function numeric(value, label, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new HttpError(400, `Invalid ${label}.`);
  return value;
}
function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new HttpError(400, `Invalid ${label}.`);
  return value;
}
function email(value) {
  const result = text(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, 'Enter a valid email address.');
  return result;
}
function fields(body, schema, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'A JSON object is required.');
  for (const key of Object.keys(body)) if (!Object.hasOwn(schema, key)) throw new HttpError(400, `Unsupported field: ${key}.`);
  const result = {};
  for (const [key, validate] of Object.entries(schema)) {
    if (partial && !Object.hasOwn(body, key)) continue;
    result[key] = validate(body[key]);
  }
  if (partial && !Object.keys(result).length) throw new HttpError(400, 'Provide at least one field to update.');
  return result;
}

export const validateEvent = (body, partial = false) => fields(body, {
  title: v => text(v, 'Title', 3, 120), type: v => choice(v, ['Match', 'Class'], 'event type'),
  ball: v => choice(v, BALLS, 'ball type'), age: v => choice(v, AGES, 'age category'),
  date: v => date(v, 'event date'), time: v => {
    if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new HttpError(400, 'Invalid event time.');
    return v;
  },
  place: v => text(v, 'Venue', 3, 200), fee: v => numeric(v, 'fee', 0, 1000000),
  seats: v => numeric(v, 'capacity', 1, 10000, true),
  description: v => v === undefined ? '' : text(v, 'Description', 0, 5000),
  status: v => v === undefined ? 'published' : choice(v, ['published', 'draft', 'cancelled'], 'status'),
}, partial);

export const validateBatch = (body, partial = false) => fields(body, {
  name: v => text(v, 'Batch name', 3, 120), coach: v => text(v, 'Coach name', 2, 100),
  coach_id: v => v === undefined || v === null || v === '' ? null : uuid(v, 'coach ID'),
  age: v => choice(v, AGES, 'age category'), ball: v => choice(v, BALLS, 'ball type'),
  schedule: v => text(v, 'Schedule', 3, 250), capacity: v => numeric(v, 'capacity', 1, 1000, true),
}, partial);

export const validateProfile = body => fields(body, {
  name: v => text(v, 'Name', 2, 100),
  phone: v => {
    const value = text(v, 'Phone', 0, 30);
    if (value && !/^[+\d\s().-]{7,30}$/.test(value)) throw new HttpError(400, 'Enter a valid phone number.');
    return value;
  },
  dob: v => {
    if (v === null || v === '') return null;
    const value = date(v, 'date of birth');
    if (value > new Date().toISOString().slice(0, 10) || value < '1900-01-01') throw new HttpError(400, 'Enter a valid date of birth.');
    return value;
  },
  playing_role: v => text(v, 'Playing role', 0, 80), interest: v => text(v, 'Interest', 0, 80),
}, true);

export const validateContact = body => fields(body, {
  name: v => text(v, 'Name', 2, 100), email,
  topic: v => text(v, 'Topic', 3, 100), message: v => text(v, 'Message', 10, 5000),
});
export const validateTeam = body => fields(body, { email, role: v => choice(v, ['admin', 'coach', 'player'], 'role') });
export const validateRegistration = body => fields(body, {
  event_id: v => uuid(v, 'event ID'),
  consent: v => { if (v !== true) throw new HttpError(400, 'Participation consent is required.'); return true; },
});
export const validateAssignment = body => fields(body, { batch_id: v => v === null || v === '' ? null : uuid(v, 'batch ID') });
export const validateMessageStatus = body => fields(body, { status: v => choice(v, ['read'], 'message status') });
