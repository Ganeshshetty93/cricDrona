import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, UserRound, Ticket, Layers3, Users, Mail, Shield, LogOut, Menu, X, Pause, Play } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage, { AuthCallback } from './pages/AuthPage';
import AdminPage from './pages/AdminPage';
import { api } from './lib/api';
import { Brand, Notice, Loading, Arrow } from './components/UI';
import { Home, About, Events, EventDetail, Contact, Setup, NotFound } from './pages/PublicPages';
import { Dashboard, Registrations, Profile } from './pages/PlayerPages';

const CatalogContext = createContext(null);
export const useCatalog = () => useContext(CatalogContext);
function CatalogProvider({ children }) {
  const [events, setEvents] = useState([]), [health, setHealth] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  async function reload() { setLoading(true); setError(''); try { const [items, status] = await Promise.all([api('/events'), api('/health')]); setEvents(items); setHealth(status); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { reload(); }, []);
  return <CatalogContext.Provider value={{ events, health, error, loading, reload }}>{children}</CatalogContext.Provider>;
}
function ScrollReset() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); document.title = `CricDrona — ${pathname === '/' ? 'Find your next innings' : pathname.split('/')[1].replaceAll('-', ' ')}`; }, [pathname]); return null; }
function Header() {
  const { user, profile, signOut } = useAuth(); const [open, setOpen] = useState(false), [error, setError] = useState(''); const { pathname } = useLocation(); const navigate = useNavigate();
  useEffect(() => setOpen(false), [pathname]);
  async function logout() { try { await signOut(); navigate('/'); } catch (e) { setError(e.message); } }
  return <><header className="public-header"><Brand/><button className="icon-button menu-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open}>{open ? <X/> : <Menu/>}</button><nav aria-label="Main navigation" className={open ? 'nav-open' : ''}>{[['/', 'Home'], ['/about', 'About us'], ['/events', 'Events'], ['/contact', 'Contact']].map(([to, name]) => <NavLink key={to} to={to} end>{name}</NavLink>)}</nav><div className="top-actions">{user ? <><Link className="btn light" to="/dashboard">My clubhouse</Link><button className="icon-button" onClick={logout} aria-label="Log out"><LogOut size={19}/></button><Link to="/profile" className="avatar" aria-label="My profile">{(profile?.name || user.email || 'P')[0].toUpperCase()}</Link></> : <><Link className="btn light" to="/login">Log in</Link><Link className="btn" to="/register">Join the club <Arrow/></Link></>}</div></header>{error && <Notice error>{error}</Notice>}</>;
}
function ModeBanner() { const { health } = useCatalog(); return health?.mode === 'demo' ? <div className="mode-banner"><span className="status-dot"/> Preview mode · Sample events. Accounts and bookings need setup.<Link to="/setup">Setup guide <Arrow/></Link></div> : null; }
function Footer() { return <div className="public-footer"><div className="footer-inner"><div><Brand/><p>A place to play. A space to grow.<br/>For the love of the game.</p></div><div className="links"><Link to="/about">About us</Link><Link to="/events">Matches & classes</Link><Link to="/contact">Contact</Link><Link to="/dashboard">Player clubhouse</Link></div></div><footer><span>© {new Date().getFullYear()} CricDrona.</span><span>PLAY. LEARN. BELONG.</span></footer></div>; }
function MotionControl() { const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches); useEffect(() => { document.body.classList.toggle('motion-paused', paused); }, [paused]); return <button className="motion-control" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? <Play size={12}/> : <Pause size={12}/>} {paused ? 'Play animation' : 'Pause animation'}</button>; }
function PublicLayout() { return <><Header/><ModeBanner/><main className="public-main" id="main"><Outlet/></main><Footer/><MotionControl/></>; }
function ClubLayout({ admin = false }) {
  const { profile } = useAuth(); const canManage = ['admin', 'owner', 'coach'].includes(profile?.role); const coach = profile?.role === 'coach';
  const links = admin ? [['/admin', LayoutDashboard, 'Overview'], ['/admin/events', CalendarDays, 'Matches & classes'], ['/admin/registrations', Users, 'Registrations'], ['/admin/batches', Layers3, 'Batches'], ...(!coach ? [['/admin/messages', Mail, 'Enquiries'], ['/admin/team', Shield, 'Team access']] : [])] : [['/dashboard', LayoutDashboard, 'My dashboard'], ['/events', CalendarDays, 'Explore events'], ['/registrations', Ticket, 'My registrations'], ['/profile', UserRound, 'My profile']];
  return <><Header/><ModeBanner/><div className="shell"><aside><div className="label">{admin ? 'ACADEMY MANAGEMENT' : 'PLAYER CLUBHOUSE'}</div><nav aria-label="Clubhouse navigation">{links.map(([to, Icon, name]) => <NavLink key={to} to={to} end><Icon size={18}/><span>{name}</span></NavLink>)}</nav><div className="bottom">{canManage && <Link className="btn light small" to={admin ? '/dashboard' : '/admin'}>{admin ? 'Player clubhouse' : 'Manage academy'} <Arrow/></Link>}<div className="help"><b>Your next innings<br/>starts here.</b>A little practice. A lot of passion.<Link to="/events">Find your game →</Link></div></div></aside><main id="main"><Outlet/><footer><span>© {new Date().getFullYear()} CricDrona.</span><span>PLAY. LEARN. BELONG.</span></footer></main></div></>;
}
function RecoveryRedirect() { const { recovery } = useAuth(); const { pathname } = useLocation(); return recovery && !['/reset-password', '/auth/callback'].includes(pathname) ? <Navigate to="/reset-password" replace/> : null; }
export default function App() { return <CatalogProvider><a className="skip-link" href="#main">Skip to content</a><ScrollReset/><RecoveryRedirect/><Routes><Route element={<PublicLayout/>}><Route index element={<Home/>}/><Route path="about" element={<About/>}/><Route path="events" element={<Events/>}/><Route path="events/:id" element={<EventDetail/>}/><Route path="contact" element={<Contact/>}/><Route path="setup" element={<Setup/>}/><Route path="login" element={<AuthPage mode="login"/>}/><Route path="register" element={<AuthPage mode="register"/>}/><Route path="forgot-password" element={<AuthPage mode="forgot"/>}/><Route path="reset-password" element={<AuthPage mode="reset"/>}/><Route path="auth/callback" element={<AuthCallback/>}/><Route path="*" element={<NotFound/>}/></Route><Route element={<ProtectedRoute><ClubLayout/></ProtectedRoute>}><Route path="dashboard" element={<Dashboard/>}/><Route path="registrations" element={<Registrations/>}/><Route path="profile" element={<Profile/>}/></Route><Route element={<ProtectedRoute roles={['admin', 'owner', 'coach']}><ClubLayout admin/></ProtectedRoute>}>{['overview', 'events', 'registrations', 'batches', 'messages', 'team'].map(section => <Route key={section} path={section === 'overview' ? '/admin' : `/admin/${section}`} element={<AdminPage section={section}/>}/>)}</Route></Routes></CatalogProvider>; }
