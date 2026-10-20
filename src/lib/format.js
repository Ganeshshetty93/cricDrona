export const ages = ['Under 10', 'Under 12', 'Under 14', 'Under 16', 'Under 19', 'Adults', 'Open'];
export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
export const eventDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date to be announced';
export function eventHasStarted(event) { return Date.parse(`${event.date}T${event.time?.slice(0, 5) || '00:00'}:00+05:30`) <= Date.now(); }
export function filterEvents(events, { category = 'All events', search = '', age = '' } = {}) {
  return events.filter(e => (category === 'All events' || category === 'Matches' && e.type === 'Match' || category === 'Classes' && e.type === 'Class' || category === e.ball) && (!age || e.age === age) && `${e.title} ${e.place}`.toLowerCase().includes(search.toLowerCase().trim()));
}
