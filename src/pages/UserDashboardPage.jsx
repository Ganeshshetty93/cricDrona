import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, CircleUserRound, MapPin, Trophy, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../App';
import { api } from '../lib/api';
import { eventHasStarted } from '../lib/format';
import { EventCard, Loading, Notice } from '../components/UI';

export default function UserDashboardPage() {
  const { profile, user } = useAuth();
  const { events, loading: catalogLoading, error: catalogError } = useCatalog();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api('/registrations').then(data => { if (active) setRegistrations(data); })
      .catch(problem => { if (active) setError(problem.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);
  const confirmed = registrations.filter(r => r.status === 'confirmed' && r.event?.status === 'published');

  const stats = [
    { label: 'Active registrations', value: loading || error ? '—' : confirmed.length, icon: CheckCircle2 },
    { label: 'Matches booked', value: loading || error ? '—' : confirmed.filter(r => r.event.type === 'Match').length, icon: Trophy },
    { label: 'Classes joined', value: loading || error ? '—' : confirmed.filter(r => r.event.type === 'Class').length, icon: CalendarDays },
    { label: 'Cricket preference', value: profile?.interest || 'Both', icon: Users },
  ];

  const upcoming = confirmed.filter(r => !eventHasStarted(r.event)).sort((a,b) => `${a.event.date}${a.event.time}`.localeCompare(`${b.event.date}${b.event.time}`)).slice(0, 3).map(({ event }) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time || '18:00',
    place: event.place,
    type: event.type || 'Match',
  }));

  const profileStrength = [
    { title: 'Name', complete: Boolean(profile?.name) },
    { title: 'Phone', complete: Boolean(profile?.phone) },
    { title: 'DOB', complete: Boolean(profile?.dob) },
    { title: 'Interests', complete: Boolean(profile?.interest) },
  ];
  const myBatches = [...new Map(confirmed.filter(r => r.batch).map(r => [r.batch.id, r.batch])).values()];

  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow dashboard-eyebrow">Player clubhouse</span>
          <h1>Welcome back, {profile?.name?.split(' ')[0] || 'player'}.</h1>
        </div>
        <Link className="btn" to="/events">
          Explore matches <ArrowRight size={16} />
        </Link>
      </div>
      {error && <Notice error>{error}</Notice>}

      <section className="dashboard-grid dashboard-stats">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="dashboard-card metric-card">
            <span className="metric-icon"><Icon size={18} /></span>
            <div>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="dashboard-grid dashboard-hero-grid">
        <div className="dashboard-card dashboard-feature">
          <span className="eyebrow">THE GAME IS CALLING</span>
          <h2>Big dreams.<br/>Start with <em>one innings.</em></h2>
          <p>
            Keep your profile ready, choose your next match, and stay one step ahead of the competition.
          </p>
          <div className="dashboard-actions">
            <Link className="btn" to="/events">Find your next game</Link>
            <Link className="btn light" to="/profile">Update profile</Link>
          </div>
          <img className="dashboard-batter" src="/batter.svg" alt="Cricket batter playing a shot"/>
        </div>

        <div className="dashboard-card dashboard-mini-panel">
          <div className="mini-header">
            <span className="eyebrow">Club access</span>
            <CircleUserRound size={18} />
          </div>
          <div className="mini-details">
            <strong>{profile?.name || 'Player profile'}</strong>
            <span>{user?.email?.endsWith('@cricdrona.local') ? 'Legacy username account' : user?.email}</span>
          </div>
          <div className="profile-health">
            {profileStrength.map((item) => (
              <div key={item.title} className={`status-row ${item.complete ? 'done' : ''}`}>
                <span>{item.title}</span>
                <em>{item.complete ? 'Ready' : 'Add'}</em>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-grid dashboard-two-col">
        <div className="dashboard-card">
          <div className="section-head">
            <h3>Your upcoming innings</h3>
            <Link to="/registrations">View bookings</Link>
          </div>
          <div className="slot-list">
            {loading ? <Loading/> : upcoming.length ? upcoming.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className="slot-item">
                <div className="slot-date">
                  <strong>{new Date(`${event.date}T12:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</strong>
                  <span>{new Date(`${event.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric' })}</span>
                </div>
                <div className="slot-copy">
                  <h4>{event.title}</h4>
                  <small>{event.type} · {event.time.slice(0, 5)} IST</small>
                  <small><MapPin size={13} /> {event.place}</small>
                </div>
              </Link>
            )) : (
              <div className="empty-box">Your calendar is wide open. Book a match or class to plan your next innings.</div>
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="section-head">
            <h3>Quick actions</h3>
          </div>
          <div className="quick-actions">
            <Link className="quick-action" to="/events">
              <CalendarDays size={18} />
              <span>Browse matches</span>
            </Link>
            <Link className="quick-action" to="/registrations">
              <CheckCircle2 size={18} />
              <span>My bookings</span>
            </Link>
            <Link className="quick-action" to="/profile">
              <CircleUserRound size={18} />
              <span>Edit profile</span>
            </Link>
          </div>
        </div>
      </section>
      <section className="dashboard-grid dashboard-two-col">
        <div className="dashboard-card"><div className="section-head"><h3>Step onto the field</h3><Link to="/events">All events →</Link></div>{catalogError ? <Notice error>{catalogError}</Notice> : catalogLoading ? <Loading/> : <div className="cards">{events.filter(e => !eventHasStarted(e)).slice(0,2).map(e => <EventCard key={e.id} event={e}/>)}</div>}{!catalogLoading && !catalogError && !events.length && <div className="empty-box">New matches and classes will appear here.</div>}</div>
        <div className="dashboard-card"><div className="section-head"><h3>Your coaching groups</h3><Link to="/registrations">Manage →</Link></div>{myBatches.length ? myBatches.map(batch => <div className="player-batch" key={batch.id}><span className="pill">{batch.ball}</span><h4>{batch.name}</h4><p>{batch.coach}</p><p>{batch.schedule} · IST</p></div>) : <div className="empty-box">Once the academy assigns your coaching registration to a batch, your coach and schedule appear here.</div>}<Link className="text-link" to="/contact">Ask the academy →</Link></div>
      </section>
    </div>
  );
}
