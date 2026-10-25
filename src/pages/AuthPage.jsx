import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authLandingPath, normalizeAccountKey } from '../lib/auth-utils';
import { authRedirectInfo, safeNext, supabase } from '../lib/supabase';

const content = {
  login: { eyebrow: 'Back to your game', title: 'Welcome back.', intro: 'Sign in to manage your registrations and make your next innings count.', button: 'Sign in' },
  register: { eyebrow: 'Your cricket journey', title: 'Join the squad.', intro: 'Create your player account and discover events, trials, and coaching near you.', button: 'Create account' },
  forgot: { eyebrow: 'Account recovery', title: 'Back in the game.', intro: 'Enter your account email and we’ll send a link to choose a new password.', button: 'Send reset link' },
  reset: { eyebrow: 'A fresh start', title: 'Choose a password.', intro: 'Set a strong new password to secure your CricDrona account.', button: 'Update password' },
};

function SetupNotice() {
  return <div className="notice" role="status"><strong>Account setup is pending.</strong><p>Connect Supabase to enable secure registration, sign-in, and password recovery.</p><Link to="/setup">Open the setup guide →</Link></div>;
}

export default function AuthPage({ mode = 'login' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedNext = safeNext(params.get('next'), '');
  const next = authLandingPath(requestedNext, auth.profile?.role);
  const nextQuery = requestedNext ? `?next=${encodeURIComponent(requestedNext)}` : '';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const copy = content[mode] || content.login;
  const hasPassword = ['login', 'register', 'reset'].includes(mode);
  const callbackError = authRedirectInfo.error;

  useEffect(() => {
    setError('');
    setSuccess('');
    setPending(false);
    setShowPassword(false);
    setResetComplete(false);
  }, [mode]);

  useEffect(() => {
    if (!auth.loading && auth.user && ['login', 'register'].includes(mode)) {
      navigate(auth.recovery ? '/reset-password' : next, { replace: true });
    }
  }, [auth.loading, auth.user, auth.recovery, mode, navigate, next]);

  async function submit(event) {
    event.preventDefault();
    if (pending || !supabase || !auth.configured) return;
    setPending(true);
    setError('');
    setSuccess('');
    const fields = new FormData(event.currentTarget);
    const rawIdentifier = String(fields.get('email') || '').trim();
    const email = mode === 'login' ? normalizeAccountKey(rawIdentifier) : rawIdentifier.toLowerCase();
    const password = String(fields.get('password') || '');
    try {
      if (['register', 'reset'].includes(mode)) {
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        if (password !== fields.get('confirmPassword')) throw new Error('Your passwords do not match.');
      }
      if (mode === 'login') {
        if (!rawIdentifier) throw new Error('Enter your email address or existing username.');
        const attempts = [...new Set([
          rawIdentifier.toLowerCase(),
          normalizeAccountKey(rawIdentifier),
        ].filter(Boolean))];
        let lastError = null;
        for (const candidate of attempts) {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email: candidate, password });
          if (!signInError) {
            // AuthProvider loads the server-backed role before the redirect effect runs.
            return;
          }
          if (signInError.code === 'email_not_confirmed') {
            throw signInError;
          }
          lastError = signInError;
        }
        if (lastError) throw lastError;
      } else if (mode === 'register') {
        const name = String(fields.get('name') || '').trim();
        const phone = String(fields.get('phone') || '').trim();
        if (name.length < 2) throw new Error('Enter your full name (at least 2 characters).');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('@cricdrona.local')) throw new Error('Use a real email address for your CricDrona account.');
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, name, phone },
          },
        });
        if (signupError) throw signupError;
        if (data.session) {
          navigate(next, { replace: true });
          return;
        }
        const autoSignIn = await supabase.auth.signInWithPassword({ email, password });
        if (autoSignIn.error) throw autoSignIn.error;
        navigate(next, { replace: true });
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setSuccess('If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.');
      } else if (mode === 'reset') {
        if (!auth.user || !auth.recoveryReady || callbackError) throw new Error('This password reset link is invalid or has expired. Request a new link.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        auth.completeRecovery();
        setResetComplete(true);
        try {
          await auth.signOut();
          setSuccess('Your password has been updated. Sign in with your new password.');
        } catch {
          setSuccess('Your password has been updated. Your current session is still signed in; you can continue to your dashboard.');
        }
      }
    } catch (submitError) {
      const code = submitError.code;
      const message = submitError.message || '';
      setError(code === 'email_not_confirmed'
        ? 'Email confirmation is disabled for this project. Please use the direct email/password login flow.'
        : code === 'invalid_credentials' || /^invalid login credentials$/i.test(message)
          ? 'The email or username and password do not match. Try again, or reset your password.'
          : /fetch|network/i.test(message)
            ? 'Could not reach Supabase. Check your internet connection and try again.'
            : message || 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function leaveRecovery() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await auth.signOut();
      navigate('/login', { replace: true });
    } catch (signOutError) {
      setError(signOutError.message || 'Could not end the recovery session. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const resetUnavailable = mode === 'reset' && !auth.loading && (!auth.recoveryReady || callbackError) && !resetComplete;
  const showForm = !resetComplete && (mode !== 'reset' || (!resetUnavailable && !auth.loading));

  return <div className="auth-page">
    <div className="auth-layout">
      <section className="auth-intro public-title">
        <span className="night-label"><i aria-hidden="true" /> EVERY INNINGS STARTS HERE</span>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <div className="auth-benefits"><p>Find your next opportunity.</p><p>Build your player profile.</p><p>Keep every registration in one place.</p></div>
        <Link className="sub" to="/events">← Explore cricket events</Link>
      </section>
      <section className="panel auth-card" aria-labelledby="auth-form-heading">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h2 id="auth-form-heading">{mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Your new password' : 'Sign in to CricDrona'}</h2>
        {!auth.configured && <SetupNotice />}
        {error && <p className="notice error" id="auth-error" role="alert">{error}</p>}
        {success && <p className="notice success" role="status">{success}</p>}
        {auth.user && auth.loading && ['login', 'register'].includes(mode) && <p className="notice" role="status">Opening your workspace…</p>}
        {mode === 'reset' && auth.loading && <p className="notice" role="status">Checking your password reset link…</p>}
        {resetUnavailable && <div className="notice error" role="alert"><p>{callbackError ? 'This reset link has expired or is invalid.' : 'Open the password reset link from your email to choose a new password.'}</p><Link to="/forgot-password">Request a new reset link →</Link></div>}
        {showForm && <form onSubmit={submit} aria-busy={pending} aria-describedby={error ? 'auth-error' : undefined}>
          <div className="auth-fields">
            {mode === 'register' && <label htmlFor="auth-name">Full name<input id="auth-name" name="name" autoComplete="name" placeholder="Your full name" required minLength={2} maxLength={100} disabled={pending || !auth.configured} /></label>}
            {mode === 'register' && <label htmlFor="auth-phone">Phone number (optional)<input id="auth-phone" name="phone" type="tel" autoComplete="tel" maxLength={25} disabled={pending || !auth.configured}/></label>}
            {mode !== 'reset' && <label htmlFor="auth-email">{mode === 'login' ? 'Email or existing username' : 'Email address'}<input id="auth-email" name="email" type={mode === 'login' ? 'text' : 'email'} autoComplete={mode === 'login' ? 'username' : 'email'} placeholder={mode === 'login' ? 'Email address or existing username' : 'you@example.com'} required maxLength={254} disabled={pending || !auth.configured} /></label>}
            {hasPassword && <label htmlFor="auth-password">{mode === 'reset' ? 'New password' : 'Password'}<input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'} minLength={mode === 'login' ? undefined : 8} maxLength={128} required disabled={pending || !auth.configured} /></label>}
            {['register', 'reset'].includes(mode) && <label htmlFor="auth-confirm">Confirm password<input id="auth-confirm" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat your password" minLength={8} maxLength={128} required disabled={pending || !auth.configured} /></label>}
          </div>
          {hasPassword && <div className="auth-options"><button className="text-button" type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide password' : 'Show password'}</button>{mode === 'login' && <Link to="/forgot-password">Forgot password?</Link>}</div>}
          <button className="btn auth-submit" type="submit" disabled={pending || !auth.configured}>{pending ? 'Please wait…' : copy.button}<span aria-hidden="true"> →</span></button>
        </form>}
        <div className="auth-footer">
          {mode === 'login' && <p>New to CricDrona? <Link to={`/register${nextQuery}`}>Create an account</Link></p>}
          {mode === 'register' && <p>Already part of the squad? <Link to={`/login${nextQuery}`}>Sign in</Link></p>}
          {mode === 'reset' && auth.recovery && !resetComplete ? <button className="text-button" type="button" disabled={pending} onClick={leaveRecovery}>Cancel and return to sign in</button> : ['forgot', 'reset'].includes(mode) && <Link to={resetComplete && auth.user ? '/dashboard' : '/login'}>{resetComplete && auth.user ? 'Go to dashboard →' : '← Back to sign in'}</Link>}
        </div>
      </section>
    </div>
  </div>;
}

export function AuthCallback() {
  const { loading, user, profile, configured, recovery } = useAuth();
  const [params] = useSearchParams();
  const next = authLandingPath(params.get('next'), profile?.role);
  if (authRedirectInfo.error) return <section className="public-title"><h1>Let’s try that again.</h1><p role="alert">This account link is invalid or has expired. Sign in to your account or request a new password reset link.</p><Link className="btn" to="/login">Sign in</Link> <Link className="btn light" to="/forgot-password">Reset password</Link></section>;
  if (!configured) return <section className="public-title"><h1>Connect your account.</h1><SetupNotice /></section>;
  if (loading) return <section className="public-title" role="status"><h1>Checking your link…</h1><p>Finishing your secure account connection.</p></section>;
  if (recovery || authRedirectInfo.recovery) return <Navigate to="/reset-password" replace />;
  if (user) return <Navigate to={next} replace />;
  return <section className="public-title"><h1>Sign in to continue.</h1><p>This link did not establish an active session. Sign in, or register again to request a fresh confirmation email if your link expired.</p><Link className="btn" to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></section>;
}
