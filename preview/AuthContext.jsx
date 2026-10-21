import { createContext, useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { currentProfile, currentRole } from './data';
import './preview.css';

const Context = createContext(null);
export function AuthProvider({ children }) {
  const [role, setRole] = useState(currentRole);
  const [profile, setProfile] = useState(currentProfile);
  const navigate = useNavigate();
  function changeRole(nextRole) {
    sessionStorage.setItem('cricdrona-preview-role', nextRole);
    setRole(nextRole); setProfile(currentProfile());
    navigate(nextRole === 'guest' ? '/' : nextRole === 'player' ? '/dashboard' : '/admin');
  }
  const user = role === 'guest' ? null : { id: profile.id, email: profile.email };
  return <Context.Provider value={{ user, profile: user ? profile : null, session: null, loading: false, configured: true, error: null, recovery: false, recoveryReady: false, completeRecovery() {}, async signOut() { changeRole('guest'); }, async refreshProfile() { const next = currentProfile(); setProfile(next); return next; } }}>
    <div className="design-preview-bar"><div><b>DESIGN PREVIEW</b><span>Sample data · Changes reset on reload</span></div><nav aria-label="Preview screens"><Link to="/dashboard" onClick={() => changeRole('player')}>Player dashboard</Link><Link to="/admin" onClick={() => changeRole('owner')}>Admin panel</Link></nav><label>View as<select aria-label="Preview role" value={role} onChange={event => changeRole(event.target.value)}><option value="owner">Owner</option><option value="admin">Admin</option><option value="coach">Coach</option><option value="player">Player</option><option value="guest">Visitor</option></select></label></div>
    <div key={role}>{children}</div>
  </Context.Provider>;
}
export const useAuth = () => useContext(Context);
