// Server-only role management. Never import this module from browser code.
import { createClient } from '@supabase/supabase-js';
import { HttpError, uuid, validateTeam } from './validation.js';

const managers = ['admin', 'owner'];
const editableRoles = ['player', 'coach', 'admin'];
const unavailable = () => new HttpError(503, 'Account access could not be updated. Please try again.');

export function createTeamClient({ url, secret }) {
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function isSecret(key) {
  if (typeof key !== 'string' || !key) return false;
  if (key.startsWith('sb_secret_')) return true;
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'; }
  catch { return false; }
}

function checked(result) {
  if (result.error) throw unavailable();
  return result.data;
}

export async function setTeamAccess({ actor, actorRole, value, env, clientFactory = createTeamClient }) {
  // actor and actorRole must come from getUser/current_app_role in the request handler.
  if (!actor?.id) throw new HttpError(401, 'Sign in to continue.');
  if (!managers.includes(actorRole)) throw new HttpError(403, 'You do not have permission to change account roles.');
  uuid(actor.id, 'account ID');
  const { email, role } = validateTeam(value);
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSecret(secret)) throw new HttpError(503, 'Team access is not configured. Ask the academy to configure its backend secret key.');
  const db = clientFactory({ url: env.SUPABASE_URL || env.VITE_SUPABASE_URL, secret });

  const readActorRole = async () => {
    const row = checked(await db.from('user_roles').select('role').eq('user_id', actor.id).maybeSingle());
    if (!managers.includes(row?.role)) throw new HttpError(403, 'Your account can no longer change roles. Refresh and try again.');
  };
  await readActorRole();
  // Equality, not a pattern, so email characters cannot match a different account.
  const profiles = checked(await db.from('profiles').select('id,email').eq('email', email).limit(2));
  if (!profiles?.length) throw new HttpError(404, 'No registered player has that email address. Ask them to create an account first.');
  if (profiles.length !== 1 || profiles[0].email !== email) throw new HttpError(409, 'This email does not identify a single account. Contact the academy owner.');
  const target = profiles[0];
  uuid(target.id, 'target account ID');
  if (target.id === actor.id) throw new HttpError(403, 'Your own role cannot be changed here.');
  const previous = checked(await db.from('user_roles').select('role').eq('user_id', target.id).maybeSingle());
  if (previous?.role === 'owner') throw new HttpError(403, 'Owner accounts cannot be changed here.');
  if (!editableRoles.includes(previous?.role)) throw new HttpError(409, 'This account needs its role restored by the academy before access can be changed.');

  // Recheck the actor immediately before the write. The conditional write also
  // prevents a concurrent owner promotion or another role edit being overwritten.
  await readActorRole();
  const updated = checked(await db.from('user_roles').update({ role })
    .eq('user_id', target.id).eq('role', previous.role).neq('role', 'owner')
    .select('user_id,role').maybeSingle());
  if (!updated || updated.user_id !== target.id || updated.role !== role) {
    throw new HttpError(409, 'Account access changed while you were editing. Refresh the team list and try again.');
  }
  return { id: target.id, email: target.email, role: updated.role };
}
