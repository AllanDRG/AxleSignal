const DAY = 86_400_000;
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const n = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value ? n : NaN;
}
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

// Inject the receipt clock; never use the time at which a queued order is consumed.
export function validateDispatch(payload, { now = new Date(), timeZone = 'America/New_York' } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('Invalid receipt clock');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const p = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const result = (status, notes) => ({ shipperOrderId: typeof p.shipperOrderId === 'string' ? p.shipperOrderId : null, status, notes });
  const cancel = notes => result('Cancelled', notes);
  if (!nonempty(p.shipperOrderId)) return cancel('shipperOrderId is required.');
  const pickup = dateValue(p.pickupDate), delivery = dateValue(p.deliveryDate);
  if (!Number.isFinite(pickup) || !Number.isFinite(delivery)) return cancel('Pickup and delivery dates must be real dates in YYYY-MM-DD format.');
  if (pickup < dateValue(today)) return cancel('Pickup date cannot be earlier than the current date.');
  const milliseconds = ((Number(parts.hour) * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * 1000 + now.getUTCMilliseconds();
  if (p.pickupDate === today && milliseconds > 15 * 60 * 60 * 1000) return cancel('Same-day pickup requests cannot be received after 3:00 p.m.');
  if (delivery - pickup < DAY) return cancel('Delivery date must be at least one calendar day after pickup.');
  if (typeof p.price !== 'number' || !Number.isFinite(p.price) || p.price <= 0) return cancel('Price must be a positive number.');
  if (!Array.isArray(p.stops) || p.stops.length < 2 || !p.stops.every((s, i) => s && s.stopNumber === i + 1 && ['city', 'state', 'postalCode'].every(k => nonempty(s[k])))) return cancel('At least two sequential stops with city, state and postalCode are required.');
  if (!Array.isArray(p.vehicles) || p.vehicles.length === 0 || !p.vehicles.every(v => v && /^\d{4}$/.test(String(v.year)) && nonempty(v.make) && nonempty(v.model))) return cancel('At least one vehicle with a four-digit year, make and model is required.');
  if (p.transportationReleaseNotes !== undefined && typeof p.transportationReleaseNotes !== 'string') return cancel('transportationReleaseNotes must be a string.');
  return result('Accepted', 'You will receive an email when a carrier accepts this dispatch request');
}
