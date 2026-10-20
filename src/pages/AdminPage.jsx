import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
    <div className="sectionhead"><h2>{event ? 'Edit event' : 'Create an event'}</h2></div>
    <p className="admin-hint">All event dates and times use India Standard Time (Asia/Kolkata). Fees are displayed in INR; online payment is not collected.</p>
    <div className="formgrid">
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
    </div>
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
    <div className="sectionhead"><h2>{batch ? 'Edit batch' : 'Create a coaching batch'}</h2></div>
    <div className="formgrid">
      <label className="admin-span">Batch name<input required minLength={3} maxLength={120} autoFocus value={values.name} onChange={change('name')} /></label>
      <label>Coach display name<input required minLength={2} maxLength={100} value={values.coach} onChange={change('coach')} /></label>
      <label>Linked coach account<select value={values.coach_id} onChange={change('coach_id')}><option value="">No account linked</option>{values.coach_id && !staff.some(member => member.id === values.coach_id) && <option value={values.coach_id}>Previous coach — choose a current staff account</option>}{staff.map(member => <option key={member.id} value={member.id}>{member.name || member.email} ({member.role})</option>)}</select></label>
      <SelectField label="Age group" value={values.age} onChange={change('age')} options={AGES} disabled={hasAssignments} />
      <SelectField label="Ball type" value={values.ball} onChange={change('ball')} options={BALLS} disabled={hasAssignments} />
      <label>Schedule (IST)<input required minLength={3} maxLength={250} placeholder="Tue & Thu, 6:00–7:30 PM" value={values.schedule} onChange={change('schedule')} /></label>
      <label>Capacity<input type="number" required min={Math.max(1, Number(batch?.registered_count || 0))} max="1000" step="1" value={values.capacity} onChange={change('capacity')} /></label>
    </div>
    {hasAssignments && <p className="admin-hint">Players are assigned to this batch. Its age group and ball type are locked to preserve their eligibility.</p>}
    <p className="admin-hint">A linked coach can view this batch and its assigned registrations. The display name alone does not grant account access.</p>
    <Notice notice={error ? { kind: 'error', text: error } : null} />
    <div className="admin-actions"><button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : batch ? 'Save batch' : 'Create batch'}</button><button className="btn light" type="button" disabled={pending} onClick={onCancel}>Cancel editing</button></div>
  </form>;
}

function Overview({ data, canManage }) {
  const events = data.events || [];
  const batches = data.batches || [];
  const registrations = data.registrations || [];
  const messages = data.messages || [];
  const confirmed = registrations.filter(registration => registration.status === 'confirmed');
  const upcoming = events.filter(event => event.status === 'published' && new Date(`${event.date}T${String(event.time || '00:00').slice(0, 5)}:00+05:30`) >= new Date()).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const stats = [
    ['Published events', events.filter(event => event.status === 'published').length, '/admin/events', '◈'],
    ['Confirmed registrations', confirmed.length, '/admin/registrations', '↗'],
    ['Coaching batches', batches.length, '/admin/batches', '◎'],
    canManage ? ['Unread messages', messages.filter(message => message.status !== 'read').length, '/admin/messages', '✉'] : ['Assigned players', new Set(confirmed.map(registration => registration.user_id || registration.profile?.id || registration.profile?.email).filter(Boolean)).size, '/admin/registrations', '○'],
  ];
  return <>
    <div className="stats">{stats.map(([title, value, href, icon]) => <Link key={title} to={href} className="stat"><span className="icon" aria-hidden="true">{icon}</span><div><strong>{value}</strong><small>{title}</small></div></Link>)}</div>
    <div className="panel">
      <div className="sectionhead"><h2>Next on the calendar</h2><Link to="/admin/events">View all events →</Link></div>
      {upcoming.length ? <div className="admin-summary-list">{upcoming.slice(0, 5).map(event => <div className="admin-summary-item" key={event.id}><div><h3>{event.title}</h3><p className="sub">{eventDate(event)} · {event.place}</p></div><span className="pill">{event.registered_count || 0} / {event.seats} booked</span></div>)}</div> : <Empty>No upcoming published events.</Empty>}
    </div>
    <div className="panel"><h3>{canManage ? 'Keep your academy moving' : 'Your coaching workspace'}</h3><p className="admin-hint">{canManage ? 'Publish an event, review player bookings, and assign confirmed registrations to suitable coaching batches.' : 'Review published events and the batches and player registrations assigned to your account. Academy administrators manage bookings and batch assignments.'}</p><div className="admin-actions"><Link className="btn light" to="/admin/registrations">View registrations</Link><Link className="btn light" to="/admin/batches">View batches</Link></div></div>
  </>;
}

function Events({ events, canManage, onEdit }) {
  const [filter, setFilter] = useState('all');
  const visible = events.filter(event => filter === 'all' || event.status === filter);
  return <div className="panel"><div className="sectionhead"><h2>Event schedule</h2><label className="admin-filter">Show<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="cancelled">Cancelled</option></select></label></div>
    {visible.length ? <div className="tablewrap"><table><caption className="admin-sr-only">Academy events and available seats</caption><thead><tr><th>Event</th><th>Date & venue</th><th>Bookings</th><th>Fee</th><th>Status</th>{canManage && <th>Action</th>}</tr></thead><tbody>{visible.map(event => <tr key={event.id}><td><strong>{event.title}</strong><p className="sub">{event.type} · {event.ball} · {event.age}</p></td><td>{eventDate(event)}<p className="sub">{event.place}</p></td><td>{event.registered_count || 0} / {event.seats}</td><td>{money(event.fee)}</td><td><span className="pill">{event.status}</span></td>{canManage && <td><button className="btn light small" onClick={() => onEdit(event)} aria-label={`Edit ${event.title}`}>Edit</button></td>}</tr>)}</tbody></table></div> : <Empty>{filter === 'all' ? 'No events yet. Create the first event to get started.' : `No ${filter} events.`}</Empty>}
  </div>;
}

function Batches({ batches, canManage, onEdit }) {
  return batches.length ? <div className="cards admin-batch-grid">{batches.map(batch => <article className="panel" key={batch.id}><div className="sectionhead"><h2>{batch.name}</h2><span className="pill">{batch.ball}</span></div><dl className="admin-facts"><div><dt>Coach</dt><dd>{batch.coach || 'To be assigned'}</dd></div><div><dt>Age group</dt><dd>{batch.age}</dd></div><div><dt>Schedule</dt><dd>{batch.schedule} (IST)</dd></div><div><dt>Assigned</dt><dd>{batch.registered_count || 0} / {batch.capacity} places</dd></div></dl>{canManage && <button className="btn light small" onClick={() => onEdit(batch)} aria-label={`Edit ${batch.name}`}>Edit batch</button>}</article>)}</div> : <div className="panel"><Empty>{canManage ? 'No coaching batches yet. Create one to organise your players.' : 'No batches are assigned to your coach account yet.'}</Empty></div>;
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
      await reload();
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
