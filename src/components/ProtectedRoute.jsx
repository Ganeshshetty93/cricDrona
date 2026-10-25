import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading, configured, error, refreshProfile, recovery, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState('');
  const location = useLocation();
  if (!configured) return <main className="public-main"><section className="public-title"><span className="eyebrow">Account access</span><h1>Connect CricDrona.</h1><p>Secure accounts become available after Supabase is configured. Explore events or follow the setup guide to connect this project.</p><div className="actions"><Link className="btn" to="/setup">View setup guide</Link> <Link className="btn light" to="/events">Explore events</Link></div></section></main>;
  if (loading) return <main className="public-main"><div className="public-title" role="status" aria-live="polite"><h1>Getting ready…</h1><p>Loading your secure account.</p></div></main>;
  if (recovery) return <Navigate to="/reset-password" replace />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} state={{ from: location }} replace />;
  if (error || !profile) return <main className="public-main"><section className="public-title"><h1>Account unavailable.</h1><p role="alert">{signOutError || (error === 'Record not found.' ? 'You are signed in, but your player profile is missing. Ask the academy to restore your profile, then try again.' : error) || 'Your profile could not be loaded. Try again in a moment.'}</p><div className="actions"><button className="btn" onClick={refreshProfile}>Try again</button><button className="btn light" onClick={() => signOut().catch(problem => setSignOutError(problem.message || 'Could not sign out. Try again.'))}>Sign out</button><Link className="btn light" to="/">Go home</Link></div></section></main>;
  if (roles && !roles.includes(profile.role)) return <main className="public-main"><section className="public-title"><span className="eyebrow">Restricted area</span><h1>Access is limited.</h1><p>Your account does not have permission to open this page.</p><Link className="btn" to="/dashboard">Your dashboard</Link></section></main>;
  return children || <Outlet />;
}
