import { readFileSync } from 'node:fs';
import { validateDispatch } from '../src/domain/validate-dispatch.js';
const request = JSON.parse(readFileSync(new URL('./request.json', import.meta.url)));
const cases = [
  ['Antes del corte', {}, '2026-09-22T18:59:00Z'],
  ['Después del corte', {}, '2026-09-22T19:00:01Z'],
  ['Recogida ayer', { pickupDate: '2026-09-21' }, '2026-09-22T14:00:00Z'],
  ['Entrega el mismo día', { deliveryDate: '2026-09-22' }, '2026-09-22T14:00:00Z'],
  ['UTC ya es mañana; Nueva York aún es hoy', { pickupDate: '2026-09-23', deliveryDate: '2026-09-24' }, '2026-09-23T01:00:00Z'],
];
for (const [scenario, changes, clock] of cases) {
  console.log(JSON.stringify({ scenario, receivedAt: clock, ...validateDispatch({ ...request, ...changes }, { now: new Date(clock) }) }, null, 2));
}
