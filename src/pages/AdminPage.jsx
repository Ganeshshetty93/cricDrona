import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Check, ChevronRight, CircleDot, Layers3, Mail, Plus, Search, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../App';
import { api } from '../lib/api';
import './AdminPage.css';

const AGES = ['Under 10', 'Under 12', 'Under 14', 'Under 16', 'Under 19', 'Adults', 'Open'];
const BALLS = ['Tennis ball', 'Hard ball'];
const TITLES = {
  overview: ['Academy overview', 'A clear view of your cricket community.'],
  events: ['Events & classes', 'Create opportunities for players to take the field.'],
  registrations: ['Player registrations', 'Review bookings and organise coaching groups.'],
  batches: ['Coaching batches', 'Manage training groups, schedules and coaching assignments.'],
  messages: ['Contact messages', 'Questions and enquiries from your community.'],
  team: ['Academy team', 'Manage access for existing CricDrona accounts.'],
};

function useAdminData(section, canManage) {
  const endpointKey = ({
    overview: `events,batches,registrations${canManage ? ',messages' : ''}`,
    events: 'events',
    registrations: 'registrations,batches',
    batches: `batches${canManage ? ',team' : ''}`,
    messages: canManage ? 'messages' : '',
    team: canManage ? 'team' : '',
  })[section] ?? 'events,batches,registrations';
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const request = useRef(0);
  const reload = useCallback(async () => {
    const current = ++request.current;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const names = endpointKey.split(',').filter(Boolean);
      const values = await Promise.all(names.map(name => api(`/admin/${name}`)));
      if (current === request.current) {
        setState({ data: Object.fromEntries(names.map((name, index) => [name, values[index]])), loading: false, error: '' });
      }
    } catch (error) {
      if (current === request.current) setState(previous => ({ ...previous, loading: false, error: error.message || 'Unable to load academy data.' }));
    }
  }, [endpointKey]);
  useEffect(() => {
    setState({ data: null, loading: true, error: '' });
    reload();
    return () => { request.current += 1; };
  }, [reload]);
  return { ...state, reload };
}

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
function eventDate(event) {
  if (!event?.date) return 'Date to be announced';
  const date = new Date(`${event.date}T${String(event.time || '00:00').slice(0, 5)}:00+05:30`);
  if (Number.isNaN(date.getTime())) return `${event.date} · ${event.time || ''} IST`;
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date) + ' IST';
}

function Notice({ notice }) {
  return notice ? <div className={`admin-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div> : null;
}

function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

function Status({ value }) {
  return <span className={`admin-status admin-status-${value || 'unknown'}`}><i aria-hidden="true" />{value || 'Unavailable'}</span>;
}

function Occupancy({ count = 0, capacity = 0, label = 'places filled' }) {
  const total = Number(capacity) || 0;
  const used = Number(count) || 0;
  const percent = total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : 0;
  return <div className="admin-occupancy"><div><span><b>{used}</b> / {total}</span><small>{label}</small></div><progress max="100" value={percent} aria-label={`${used} of ${total} ${label}`} /></div>;
}

function SearchField({ label, value, onChange, placeholder }) {
  return <label className="admin-search"><span>{label}</span><span className="admin-search-input"><Search size={16} aria-hidden="true" /><input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></span></label>;
}

function ResultCount({ count, total, noun }) {
  return <p className="admin-result-count" aria-live="polite">{count} of {total} {noun}</p>;
}

function Initials({ name = 'Player' }) {
  return <span className="admin-initials" aria-hidden="true">{name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span>;
}

function SelectField({ label, value, onChange, options, ...props }) {
  return <label>{label}<select value={value} onChange={onChange} {...props}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function EventForm({ event, pending, onSave, onCancel }) {
  const [values, setValues] = useState(() => ({
    title: event?.title || '', type: event?.type || 'Class', ball: event?.ball || 'Tennis ball',
    age: event?.age || 'Open', date: event?.date || '', time: String(event?.time || '18:00').slice(0, 5),
    place: event?.place || '', fee: event?.fee ?? 0, seats: event?.seats ?? 20,
    description: event?.description || '', status: event?.status || 'draft',
  }));
  const [error, setError] = useState('');
  const hasBookings = Number(event?.registered_count || 0) > 0;
  const change = name => input => setValues(previous => ({ ...previous, [name]: input.target.value }));
  async function submit(input) {
    input.preventDefault();
    setError('');
    const fee = Number(values.fee);
    const seats = Number(values.seats);
    if (values.title.trim().length < 3 || values.place.trim().length < 3) return setError('The title and venue must each contain at least 3 characters.');
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000000) return setError('Fee must be between ₹0 and ₹1,000,000.');
    if (!Number.isInteger(seats) || seats < Math.max(1, Number(event?.registered_count || 0)) || seats > 10000) return setError('Seats must be a whole number from 1 to 10,000 and cannot be lower than confirmed bookings.');
    const payload = { ...values, title: values.title.trim(), place: values.place.trim(), description: values.description.trim(), fee, seats };
    if (hasBookings) for (const field of ['type', 'age', 'ball', 'date']) delete payload[field];
    await onSave(payload);
  }
  return <form className="panel admin-editor" onSubmit={submit} aria-label={event ? 'Edit event' : 'Create event'}>
    <div className="sectionhead"><div><span className="eyebrow">EVENT DETAILS</span><h2>{event ? 'Edit event' : 'Create an event'}</h2></div><Status value={values.status} /></div>
    <p className="admin-hint">All event dates and times use India Standard Time (Asia/Kolkata). Fees are displayed in INR; online payment is not collected.</p>
    <fieldset className="formgrid" disabled={pending}>
      <label className="admin-span">Event title<input required minLength={3} maxLength={120} autoFocus value={values.title} onChange={change('title')} /></label>
      <SelectField label="Event type" value={values.type} onChange={change('type')} options={['Match', 'Class']} disabled={hasBookings} />
      <SelectField label="Ball type" value={values.ball} onChange={change('ball')} options={BALLS} disabled={hasBookings} />
      <SelectField label="Age group" value={values.age} onChange={change('age')} options={AGES} disabled={hasBookings} />
      <SelectField label="Visibility" value={values.status} onChange={change('status')} options={['draft', 'published', 'cancelled']} />
      <label>Date (IST)<input type="date" required value={values.date} onChange={change('date')} disabled={hasBookings} /></label>
      <label>Start time (IST)<input type="time" required value={values.time} onChange={change('time')} /></label>
      <label className="admin-span">Venue<input required minLength={3} maxLength={200} value={values.place} onChange={change('place')} /></label>
      <label>Fee (₹)<input type="number" required min="0" max="1000000" step="0.01" value={values.fee} onChange={change('fee')} /></label>
      <label>Total seats<input type="number" required min={Math.max(1, Number(event?.registered_count || 0))} max="10000" step="1" value={values.seats} onChange={change('seats')} /></label>
      <label className="admin-span">Description<textarea rows={4} maxLength={5000} value={values.description} onChange={change('description')} /></label>
    </fieldset>
    {hasBookings && <p className="admin-hint">This event has confirmed registrations. Its type, ball, age group and date are locked to preserve player eligibility.</p>}
    {values.status === 'cancelled' && <div className="admin-notice warning">Cancelling this event stops new bookings and cancels its confirmed registrations. Publishing it again does not restore cancelled registrations.</div>}
    <Notice notice={error ? { kind: 'error', text: error } : null} />
    <div className="admin-actions"><button className="btn" disabled={pending} type="submit">{pending ? 'Saving…' : event ? 'Save event' : 'Create event'}</button><button className="btn light" type="button" disabled={pending} onClick={onCancel}>Cancel editing</button></div>
  </form>;
}

function BatchForm({ batch, team, pending, onSave, onCancel }) {
  const [values, setValues] = useState(() => ({
    name: batch?.name || '', coach: batch?.coach || '', coach_id: batch?.coach_id || '',
    age: batch?.age || 'Open', ball: batch?.ball || 'Tennis ball', schedule: batch?.schedule || '', capacity: batch?.capacity ?? 20,
  }));
  const [error, setError] = useState('');
  const hasAssignments = Number(batch?.registered_count || 0) > 0;
  const change = name => input => setValues(previous => ({ ...previous, [name]: input.target.value }));
  async function submit(input) {
    input.preventDefault();
    setError('');
    const capacity = Number(values.capacity);
    if (values.name.trim().length < 3 || values.coach.trim().length < 2 || values.schedule.trim().length < 3) return setError('Enter a batch name and schedule of at least 3 characters, and a coach name of at least 2 characters.');
    if (!Number.isInteger(capacity) || capacity < Math.max(1, Number(batch?.registered_count || 0)) || capacity > 1000) return setError('Capacity must be a whole number from 1 to 1,000 and accommodate current assignments.');
    const payload = { ...values, name: values.name.trim(), coach: values.coach.trim(), schedule: values.schedule.trim(), capacity, coach_id: values.coach_id || null };
    if (hasAssignments) for (const field of ['age', 'ball']) delete payload[field];
    await onSave(payload);
  }
  const staff = team.filter(member => ['owner', 'admin', 'coach'].includes(member.role));
  return <form className="panel admin-editor" onSubmit={submit} aria-label={batch ? 'Edit batch' : 'Create batch'}>
    <div className="sectionhead"><div><span className="eyebrow">COACHING GROUP</span><h2>{batch ? 'Edit batch' : 'Create a coaching batch'}</h2></div><Layers3 className="admin-heading-icon" size={25} /></div>
    <fieldset className="formgrid" disabled={pending}>
      <label className="admin-span">Batch name<input required minLength={3} maxLength={120} autoFocus value={values.name} onChange={change('name')} /></label>
      <label>Coach display name<input required minLength={2} maxLength={100} value={values.coach} onChange={change('coach')} /></label>
      <label>Linked coach account<select value={values.coach_id} onChange={change('coach_id')}><option value="">No account linked</option>{values.coach_id && !staff.some(member => member.id === values.coach_id) && <option value={values.coach_id}>Previous coach — choose a current staff account</option>}{staff.map(member => <option key={member.id} value={member.id}>{member.name || member.email} ({member.role})</option>)}</select></label>
      <SelectField label="Age group" value={values.age} onChange={change('age')} options={AGES} disabled={hasAssignments} />
      <SelectField label="Ball type" value={values.ball} onChange={change('ball')} options={BALLS} disabled={hasAssignments} />
      <label>Schedule (IST)<input required minLength={3} maxLength={250} placeholder="Tue & Thu, 6:00–7:30 PM" value={values.schedule} onChange={change('schedule')} /></label>
      <label>Capacity<input type="number" required min={Math.max(1, Number(batch?.registered_count || 0))} max="1000" step="1" value={values.capacity} onChange={change('capacity')} /></label>
    </fieldset>
    {hasAssignments && <p className="admin-hint">Players are assigned to this batch. Its age group and ball type are locked to preserve their eligibility.</p>}
    <p className="admin-hint">A linked coach can view this batch and its assigned registrations. The display name alone does not grant account access.</p>
    <Notice notice={error ? { kind: 'error', text: error } : null} />
    <div className="admin-actions"><button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : batch ? 'Save batch' : 'Create batch'}</button><button className="btn light" type="button" disabled={pending} onClick={onCancel}>Cancel editing</button></div>
  </form>;
}

function Overview({ data, canManage, onCreate }) {
  const events = data.events || [];
  const batches = data.batches || [];
  const registrations = data.registrations || [];
  const messages = data.messages || [];
  const confirmed = registrations.filter(registration => registration.status === 'confirmed');
  const upcoming = events.filter(event => event.status === 'published' && new Date(`${event.date}T${String(event.time || '00:00').slice(0, 5)}:00+05:30`) >= new Date()).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const unread = messages.filter(message => message.status !== 'read').length;
  const waiting = confirmed.filter(registration => registration.event?.type === 'Class' && registration.event?.status === 'published' && !registration.batch_id).length;
  const assigned = batches.reduce((total, batch) => total + Number(batch.registered_count || 0), 0);
  const capacity = batches.reduce((total, batch) => total + Number(batch.capacity || 0), 0);
  const recent = [...registrations].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 5);
  const stats = [
    ['Upcoming events', upcoming.length, '/admin/events', CalendarDays, 'Published and ready to play'],
    ['Confirmed registrations', confirmed.length, '/admin/registrations', Users, 'Across academy events'],
    ['Coaching batches', batches.length, '/admin/batches', Layers3, `${assigned} assigned registrations`],
    canManage ? ['Unread enquiries', unread, '/admin/messages', Mail, unread ? 'Your community is waiting' : 'Your inbox is up to date'] : ['Assigned players', new Set(confirmed.map(registration => registration.user_id || registration.profile?.id || registration.profile?.email).filter(Boolean)).size, '/admin/registrations', ShieldCheck, 'In your coaching groups'],
  ];
  return <>
    <section className="admin-welcome"><div><span className="eyebrow">BEHIND EVERY GREAT INNINGS</span><h2>{canManage ? <>Build the game.<br/><em>Bring your community together.</em></> : <>Guide the next generation.<br/><em>One session at a time.</em></>}</h2><p>{canManage ? 'Your events, your players, your academy. Everything you need to keep cricket moving.' : 'Keep an eye on your coaching groups and prepare your players for their next innings.'}</p><div className="admin-actions">{canManage ? <button className="btn" onClick={onCreate}><Plus size={16}/> Create an event</button> : <Link className="btn" to="/admin/batches">View my batches <ArrowUpRight size={16}/></Link>}<Link className="admin-welcome-link" to="/admin/registrations">View registrations <ArrowUpRight size={15}/></Link></div></div><div className="admin-pitch-art" aria-hidden="true"><span className="admin-pitch-ring"/><span className="admin-pitch-inner"/><span className="admin-pitch-wicket"/><CircleDot/><span className="admin-pitch-caption">PLAY. LEARN. BELONG.</span></div></section>
    <div className="stats admin-stats">{stats.map(([title, value, href, Icon, detail]) => <Link key={title} to={href} className="stat"><div className="admin-stat-top"><span className="icon"><Icon size={19}/></span><ArrowUpRight size={15}/></div><strong>{value}</strong><small>{title}</small><span className="admin-stat-detail">{detail}</span></Link>)}</div>
    <div className="admin-overview-grid"><div className="admin-main-column">
      <section className="panel admin-calendar"><div className="sectionhead"><div><span className="eyebrow">COMING UP NEXT</span><h2>On the calendar</h2></div><Link to="/admin/events">All events <ArrowUpRight size={15}/></Link></div>
        {upcoming.length ? <div className="admin-summary-list">{upcoming.slice(0, 4).map(event => <div className="admin-calendar-row" key={event.id}><div className="admin-date-tile"><small>{new Date(`${event.date}T12:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</small><b>{event.date.slice(-2)}</b></div><div className="admin-calendar-details"><span className="admin-event-format">{event.type === 'Class' ? 'COACHING' : 'MATCH DAY'} · {event.ball}</span><h3>{event.title}</h3><p className="sub">{event.time?.slice(0, 5)} IST · {event.place}</p></div><Occupancy count={event.registered_count} capacity={event.seats} label="booked"/></div>)}</div> : <Empty>No upcoming events yet.{canManage && <><br/><button className="btn light small" onClick={onCreate}>Create your first event <Plus size={14}/></button></>}</Empty>}
      </section>
      <section className="panel"><div className="sectionhead"><div><span className="eyebrow">YOUR CRICKET COMMUNITY</span><h2>Recent registrations</h2></div><Link to="/admin/registrations">View all <ArrowUpRight size={15}/></Link></div>{recent.length ? <div className="admin-recent-list">{recent.map(registration => <div className="admin-recent-row" key={registration.id}><Initials name={registration.profile?.name || 'Player'}/><div><h3>{registration.profile?.name || 'Player'}</h3><p className="sub">{registration.event?.title || 'Event unavailable'}</p></div><Status value={registration.status}/></div>)}</div> : <Empty>New player registrations will appear here.</Empty>}</section>
    </div><div className="admin-side-column">
      <section className="panel admin-coaching-summary"><div className="sectionhead"><div><span className="eyebrow">ROOM TO GROW</span><h2>Coaching at a glance</h2></div><Layers3 size={23}/></div><Occupancy count={assigned} capacity={capacity} label="batch places filled"/>{batches.length > 0 && <div className="admin-mini-batches">{batches.slice(0, 3).map(batch => <Link key={batch.id} to="/admin/batches"><span><b>{batch.name}</b><small>{batch.coach || 'Coach to be assigned'} · {batch.age}</small></span><ChevronRight size={15}/></Link>)}</div>}{canManage && waiting > 0 && <Link to="/admin/registrations" className="admin-attention"><Users size={17}/><span><b>{waiting} {waiting === 1 ? 'registration needs' : 'registrations need'} a batch</b><small>Review coaching assignments</small></span><ChevronRight size={15}/></Link>}<Link className="btn light admin-full-width" to="/admin/batches">{canManage ? 'Manage coaching batches' : 'View my coaching batches'} <ArrowUpRight size={15}/></Link></section>
      {canManage && <section className="panel admin-inbox-card"><div className="admin-inbox-icon"><Mail size={23}/>{unread > 0 && <span/>}</div><span className="eyebrow">ACADEMY INBOX</span><h2>{unread ? `${unread} unread ${unread === 1 ? 'enquiry' : 'enquiries'}` : 'All caught up.'}</h2><p className="sub">{unread ? 'Players and families have questions. A little guidance can start a great cricket journey.' : 'New messages from your cricket community will appear here.'}</p><Link to="/admin/messages">Open enquiries <ArrowUpRight size={15}/></Link></section>}
      <div className="admin-note"><ShieldCheck size={18}/><p>{canManage ? 'Fees are payable directly to the academy. CricDrona records bookings and does not collect online payments.' : 'Your workspace shows the batches and player registrations assigned to your coach account.'}</p></div>
    </div></div>
  </>;
}

function Events({ events, canManage, onEdit }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const visible = events.filter(event => (filter === 'all' || event.status === filter) && (type === 'all' || event.type === type) && `${event.title} ${event.place} ${event.ball} ${event.age}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="panel"><div className="sectionhead"><div><span className="eyebrow">MAKE SPACE FOR THE GAME</span><h2>Event schedule</h2></div><span className="admin-count">{events.length} events</span></div><div className="admin-filters"><SearchField label="Search events" value={query} onChange={setQuery} placeholder="Event, venue or age group"/><label>Event type<select value={type} onChange={event => setType(event.target.value)}><option value="all">All types</option><option value="Match">Matches</option><option value="Class">Classes</option></select></label><label>Status<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="cancelled">Cancelled</option></select></label></div><ResultCount count={visible.length} total={events.length} noun="events"/>
    {visible.length ? <div className="tablewrap"><table><caption className="admin-sr-only">Academy events and available seats</caption><thead><tr><th>Event</th><th>Date & venue</th><th>Bookings</th><th>Fee</th><th>Status</th>{canManage && <th>Action</th>}</tr></thead><tbody>{visible.map(event => <tr key={event.id}><td><strong>{event.title}</strong><p className="sub">{event.type} · {event.ball} · {event.age}</p></td><td>{eventDate(event)}<p className="sub">{event.place}</p></td><td><Occupancy count={event.registered_count} capacity={event.seats} label="booked"/></td><td className="admin-fee">{money(event.fee)}</td><td><Status value={event.status}/></td>{canManage && <td><button className="btn light small" onClick={() => onEdit(event)} aria-label={`Edit ${event.title}`}>Edit</button></td>}</tr>)}</tbody></table></div> : <Empty>{events.length ? 'No events match your filters.' : canManage ? 'No events yet. Create the first event to get started.' : 'No published events to show yet.'}</Empty>}
  </div>;
}

function Batches({ batches, canManage, onEdit }) {
  const [query, setQuery] = useState('');
  const [ball, setBall] = useState('all');
  const visible = batches.filter(batch => (ball === 'all' || batch.ball === ball) && `${batch.name} ${batch.coach} ${batch.age} ${batch.schedule}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <><div className="panel admin-filter-panel"><div className="admin-filters"><SearchField label="Search coaching batches" value={query} onChange={setQuery} placeholder="Batch, coach or age group"/><label>Ball format<select value={ball} onChange={event => setBall(event.target.value)}><option value="all">All formats</option>{BALLS.map(value => <option key={value}>{value}</option>)}</select></label></div><ResultCount count={visible.length} total={batches.length} noun="coaching batches"/></div>{visible.length ? <div className="cards admin-batch-grid">{visible.map(batch => <article className="panel admin-batch-card" key={batch.id}><div className="admin-batch-top"><span className="admin-batch-icon"><Layers3 size={21}/></span><span className="pill">{batch.ball}</span></div><h2>{batch.name}</h2><p className="admin-batch-age">{batch.age} · Coaching group</p><dl className="admin-facts"><div><dt>Coach</dt><dd>{batch.coach || 'To be assigned'}</dd></div><div><dt>Schedule</dt><dd>{batch.schedule} (IST)</dd></div></dl><Occupancy count={batch.registered_count} capacity={batch.capacity} label="places assigned"/>{canManage && <button className="btn light admin-full-width" onClick={() => onEdit(batch)} aria-label={`Edit ${batch.name}`}>Edit batch <ArrowUpRight size={14}/></button>}</article>)}</div> : <div className="panel"><Empty>{batches.length ? 'No coaching batches match your search.' : canManage ? 'No coaching batches yet. Create one to organise your players.' : 'No batches are assigned to your coach account yet.'}</Empty></div>}</>;
}

function BatchAssignment({ registration, batches, pending, onAssign }) {
  const initial = registration.batch_id || registration.batch?.id || '';
  const [selected, setSelected] = useState(initial);
  useEffect(() => { setSelected(initial); }, [initial]);
  // Eligibility depends on the player's birth date, which is checked by the API.
  // An event's age group alone cannot determine all valid batch age groups.
  const eligible = batches.filter(batch => batch.ball === registration.event?.ball);
  const currentMissing = initial && !eligible.some(batch => batch.id === initial);
  if (registration.event?.type !== 'Class') return <span className="sub">For coaching classes only</span>;
  if (registration.status !== 'confirmed' || registration.event.status !== 'published') return <span className="sub">{registration.batch?.name || 'Not assigned'}</span>;
  return <form className="admin-assignment" onSubmit={event => { event.preventDefault(); onAssign(registration.id, selected || null); }}><label className="admin-sr-only" htmlFor={`batch-${registration.id}`}>Batch for {registration.profile?.name || 'player'}: {registration.event?.title || 'event'}</label><select id={`batch-${registration.id}`} value={selected} onChange={event => setSelected(event.target.value)} disabled={pending}><option value="">Unassigned</option>{currentMissing && <option value={initial}>{registration.batch?.name || 'Current batch'}</option>}{eligible.map(batch => <option key={batch.id} value={batch.id} disabled={batch.id !== initial && Number(batch.registered_count || 0) >= Number(batch.capacity)}>{batch.name} · {batch.age} ({batch.registered_count || 0}/{batch.capacity})</option>)}</select><button className="btn light small" type="submit" disabled={pending || selected === initial}>Save</button></form>;
}

function Registrations({ registrations, batches, canManage, pending, onAssign }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const visible = registrations.filter(registration => (status === 'all' || registration.status === status) && `${registration.profile?.name || ''} ${registration.profile?.email || ''} ${registration.event?.title || ''}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="panel"><div className="admin-filters"><label>Search players or events<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Player name, email or event" /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All registrations</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></label></div>
    {canManage && <p className="admin-hint">Assign confirmed coaching class registrations to a suitable batch. Matching ball formats are shown; the server checks the player's birth date against the batch age group and checks capacity before saving.</p>}
    {visible.length ? <div className="tablewrap"><table><caption className="admin-sr-only">Player registrations and coaching batch assignments</caption><thead><tr><th>Player</th><th>Event</th><th>Status</th><th>Coaching batch</th></tr></thead><tbody>{visible.map(registration => <tr key={registration.id}><td><strong>{registration.profile?.name || 'Player'}</strong>{registration.profile?.email && <p className="sub">{registration.profile.email}</p>}{registration.profile?.phone && <p className="sub">{registration.profile.phone}</p>}</td><td><strong>{registration.event?.title || 'Event unavailable'}</strong>{registration.event && <p className="sub">{eventDate(registration.event)}</p>}</td><td><span className="pill">{registration.status}</span></td><td>{canManage ? <BatchAssignment registration={registration} batches={batches} pending={pending} onAssign={onAssign} /> : registration.batch?.name || 'Unassigned'}</td></tr>)}</tbody></table></div> : <Empty>{registrations.length ? 'No registrations match your search.' : 'No player registrations to show yet.'}</Empty>}
  </div>;
}

function Messages({ messages, pending, onRead }) {
  const [filter, setFilter] = useState('all');
  const visible = messages.filter(message => filter === 'all' || (filter === 'read' ? message.status === 'read' : message.status !== 'read'));
  return <><div className="tabs" aria-label="Filter contact messages">{['all', 'unread', 'read'].map(value => <button key={value} className={`chip ${filter === value ? 'active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All messages' : value === 'unread' ? 'Unread' : 'Read'}</button>)}</div>{visible.length ? visible.map(message => <article className="panel" key={message.id}><div className="sectionhead"><div><h2>{message.topic || 'General enquiry'}</h2><p className="sub">{message.name} · {message.email}</p></div><span className="pill">{message.status === 'read' ? 'Read' : 'Unread'}</span></div><p className="admin-message">{message.message}</p>{message.status !== 'read' && <button className="btn light small" disabled={pending} onClick={() => onRead(message.id)}>Mark as read</button>}</article>) : <div className="panel"><Empty>No {filter === 'all' ? '' : `${filter} `}contact messages.</Empty></div>}</>;
}

function Team({ team, isOwner, pending, onSave }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('coach');
  async function submit(event) {
    event.preventDefault();
    if (await onSave({ email: email.trim().toLowerCase(), role })) setEmail('');
  }
  return <>
    {isOwner ? <form className="panel admin-editor" onSubmit={submit}><div className="sectionhead"><h2>Set account access</h2></div><p className="admin-hint">Enter the email of someone who has already registered. This changes their access immediately; it does not send an invitation. Owner accounts and your own role cannot be changed here.</p><div className="formgrid"><label>Registered email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label><label>Role<select value={role} onChange={event => setRole(event.target.value)}><option value="coach">Coach — assigned groups, read only</option><option value="admin">Admin — academy management</option><option value="player">Player — personal account only</option></select></label></div>{role === 'player' && <p className="admin-hint">The player role removes staff access while keeping the person's account and bookings.</p>}<div className="admin-actions"><button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Update access'}</button></div></form> : <div className="admin-notice">Only the academy owner can change account roles.</div>}
    <div className="panel"><div className="sectionhead"><h2>Registered accounts</h2></div>{team.length ? <div className="tablewrap"><table><caption className="admin-sr-only">Registered academy accounts and roles</caption><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{team.map(member => <tr key={member.id}><td>{member.name || 'Account holder'}</td><td>{member.email}</td><td><span className="pill">{member.role}</span></td></tr>)}</tbody></table></div> : <Empty>No registered accounts to show.</Empty>}</div>
  </>;
}

export default function AdminPage({ section = 'overview' }) {
  const { profile } = useAuth();
  const { reload: reloadCatalog } = useCatalog();
  const canManage = ['admin', 'owner'].includes(profile?.role);
  const isOwner = profile?.role === 'owner';
  const { data, loading, error, reload } = useAdminData(section, canManage);
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState('');
  const editorRef = useRef(null);
  useEffect(() => { setEditor(null); setNotice(null); }, [section]);
  useEffect(() => {
    if (editor) editorRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [editor]);
  async function mutate(path, method, body, success) {
    setPending(path);
    setNotice(null);
    try {
      await api(path, { method, body });
      setNotice({ kind: 'success', text: success });
      await Promise.all([reload(), path.startsWith('/admin/events') ? reloadCatalog() : Promise.resolve()]);
      return true;
    } catch (problem) {
      setNotice({ kind: 'error', text: problem.message || 'Unable to save this change. Please try again.' });
      return false;
    } finally { setPending(''); }
  }
  async function saveEvent(values) {
    const event = editor?.item;
    if (await mutate(`/admin/events${event ? `/${event.id}` : ''}`, event ? 'PATCH' : 'POST', values, event ? 'Event updated.' : 'Event created.')) setEditor(null);
  }
  async function saveBatch(values) {
    const batch = editor?.item;
    if (await mutate(`/admin/batches${batch ? `/${batch.id}` : ''}`, batch ? 'PATCH' : 'POST', values, batch ? 'Coaching batch updated.' : 'Coaching batch created.')) setEditor(null);
  }
  const [title, subtitle] = TITLES[section] || TITLES.overview;
  if (['messages', 'team'].includes(section) && !canManage) return <div className="panel"><h1>Administrator access required</h1><p className="admin-hint">This section is available to academy administrators and the owner.</p><Link className="btn" to="/admin">Return to overview</Link></div>;
  return <div className="admin-page">
    <div className="pagehead"><div><span className="eyebrow">{isOwner ? 'Owner workspace' : canManage ? 'Academy management' : 'Coach workspace'}</span><h1>{title}</h1><p className="sub">{subtitle}</p></div><div className="admin-actions"><button className="btn light small" disabled={loading || Boolean(pending)} onClick={reload} aria-label="Refresh academy data">{loading ? 'Refreshing…' : 'Refresh'}</button>{canManage && ['events', 'batches'].includes(section) && !editor && <button className="btn" onClick={() => setEditor({ type: section, item: null })}>+ {section === 'events' ? 'Create event' : 'Create batch'}</button>}</div></div>
    <Notice notice={notice} />
    {error && <div className="admin-notice error" role="alert"><p>{error}</p>{data && <p>Previously loaded information is shown below.</p>}<button className="btn light small" onClick={reload} disabled={loading}>Try again</button></div>}
    {!canManage && <p className="admin-hint">Coach access is read only. Batches and registrations are limited to your assigned groups.</p>}
    {editor && <div ref={editorRef}>{editor.type === 'events' ? <EventForm key={editor.item?.id || 'new-event'} event={editor.item} pending={Boolean(pending)} onSave={saveEvent} onCancel={() => setEditor(null)} /> : <BatchForm key={editor.item?.id || 'new-batch'} batch={editor.item} team={data?.team || []} pending={Boolean(pending)} onSave={saveBatch} onCancel={() => setEditor(null)} />}</div>}
    {loading && !data && <div className="panel admin-loading" role="status">Loading academy data…</div>}
    {data && <>
      {section === 'overview' && <Overview data={data} canManage={canManage} />}
      {section === 'events' && <Events events={data.events || []} canManage={canManage} onEdit={item => setEditor({ type: 'events', item })} />}
      {section === 'batches' && <Batches batches={data.batches || []} canManage={canManage} onEdit={item => setEditor({ type: 'batches', item })} />}
      {section === 'registrations' && <Registrations registrations={data.registrations || []} batches={data.batches || []} canManage={canManage} pending={Boolean(pending)} onAssign={(id, batch_id) => mutate(`/admin/registrations/${id}`, 'PATCH', { batch_id }, 'Batch assignment updated.')} />}
      {section === 'messages' && <Messages messages={data.messages || []} pending={Boolean(pending)} onRead={id => mutate(`/admin/messages/${id}`, 'PATCH', { status: 'read' }, 'Message marked as read.')} />}
      {section === 'team' && <Team team={data.team || []} isOwner={isOwner} pending={Boolean(pending)} onSave={values => mutate('/admin/team', 'POST', values, 'Account access updated.')} />}
    </>}
  </div>;
}
