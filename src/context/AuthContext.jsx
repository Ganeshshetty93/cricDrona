import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { authRedirectInfo, isSupabaseConfigured, supabase } from '../lib/supabase';

const AuthContext = createContext(null);
const RECOVERY_KEY = 'cricdrona.password-recovery-user';

function recoveryMarker(value) {
  try {
    if (value === undefined) return sessionStorage.getItem(RECOVERY_KEY);
    if (value) sessionStorage.setItem(RECOVERY_KEY, value);
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch { /* The current page still works if browser storage is unavailable. */ }
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileEpoch, setProfileEpoch] = useState(0);
  const [error, setError] = useState(null);
  const [recovery, setRecovery] = useState(authRedirectInfo.recovery);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryChecking, setRecoveryChecking] = useState(false);
  const currentSession = useRef(null);
  const profileRequest = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (!supabase) return () => { mounted.current = false; };
    let active = true;
    let eventRevision = 0;
    const acceptSession = (nextSession) => {
      if (!active) return;
      // Invalidate work immediately, before React renders the next token/session.
      profileRequest.current += 1;
      if (currentSession.current?.user?.id !== nextSession?.user?.id) {
        setProfile(null);
        setError(null);
      }
      currentSession.current = nextSession;
      setSession(nextSession);
      setAuthReady(true);
      setProfileLoading(Boolean(nextSession));
      setProfileEpoch((epoch) => epoch + 1);
      if (!nextSession) {
        recoveryMarker(null);
        setRecoveryReady(false);
      }
    };
    // Keep this callback synchronous. API calls run in effects after Supabase releases its auth lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      eventRevision += 1;
      if (event === 'PASSWORD_RECOVERY' && nextSession) {
        recoveryMarker(nextSession.user.id);
        setRecovery(true);
      }
      if (event === 'SIGNED_OUT') setRecovery(false);
      acceptSession(nextSession);
    });
    const revisionBeforeRead = eventRevision;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || eventRevision !== revisionBeforeRead) return;
      if (sessionError) setError(sessionError.message);
      acceptSession(data.session);
    }).catch((sessionError) => {
      if (!active || eventRevision !== revisionBeforeRead) return;
      setError(sessionError.message);
      setAuthReady(true);
    });
    return () => {
      active = false;
      mounted.current = false;
      profileRequest.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const snapshot = currentSession.current;
    const requestId = ++profileRequest.current;
    if (!snapshot) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }
    setProfileLoading(true);
    setError(null);
    try {
      const nextProfile = await api('/profile', { token: snapshot.access_token });
      if (mounted.current && requestId === profileRequest.current && currentSession.current?.access_token === snapshot.access_token) {
        setProfile(nextProfile);
      }
      return nextProfile;
    } catch (profileError) {
      if (mounted.current && requestId === profileRequest.current) {
        setProfile(null);
        setError(profileError.message);
      }
      return null;
    } finally {
      if (mounted.current && requestId === profileRequest.current) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    refreshProfile();
    return () => { profileRequest.current += 1; };
  }, [authReady, session?.access_token, profileEpoch, refreshProfile]);

  useEffect(() => {
    let cancelled = false;
    if (!authReady) return undefined;
    const incomingRecovery = authRedirectInfo.recovery && authRedirectInfo.accessToken === session?.access_token;
    const storedRecovery = session && recoveryMarker() === session.user.id;
    if (!session || (!incomingRecovery && !storedRecovery)) {
      setRecovery(false);
      setRecoveryReady(false);
      setRecoveryChecking(false);
      return undefined;
    }
    setRecovery(true);
    setRecoveryReady(false);
    setRecoveryChecking(true);
    supabase.auth.getUser(session.access_token).then(({ data, error: userError }) => {
      if (cancelled) return;
      const valid = !userError && data.user?.id === session.user.id;
      setRecovery(valid);
      setRecoveryReady(valid);
      if (valid) recoveryMarker(data.user.id);
      else recoveryMarker(null);
    }).catch(() => {
      if (!cancelled) {
        setRecovery(false);
        setRecoveryReady(false);
        recoveryMarker(null);
      }
    }).finally(() => { if (!cancelled) setRecoveryChecking(false); });
    return () => { cancelled = true; };
  }, [authReady, session?.access_token, session?.user?.id]);

  const completeRecovery = useCallback(() => {
    recoveryMarker(null);
    authRedirectInfo.recovery = false;
    authRedirectInfo.accessToken = null;
    setRecovery(false);
    setRecoveryReady(false);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) throw signOutError;
    completeRecovery();
  }, [completeRecovery]);

  const value = useMemo(() => ({
    user: session?.user || null,
    session,
    profile,
    // Keep forms mounted during token refresh and explicit profile saves. The server
    // authorizes every mutation; new identities still wait for their own profile.
    loading: !authReady || (profileLoading && !profile) || recoveryChecking,
    configured: isSupabaseConfigured,
    error,
    refreshProfile,
    signOut,
    recovery,
    recoveryReady,
    completeRecovery,
  }), [session, profile, authReady, profileLoading, recoveryChecking, error, refreshProfile, signOut, recovery, recoveryReady, completeRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
