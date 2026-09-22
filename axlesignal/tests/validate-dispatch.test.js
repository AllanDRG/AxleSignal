import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDispatch } from '../src/domain/validate-dispatch.js';
const base = JSON.parse(readFileSync(new URL('../examples/request.json', import.meta.url)));
const cases = [
 ['valid request', {}, '2026-09-22T18:59:59Z', 'Accepted'],
 ['exact cutoff', {}, '2026-09-22T19:00:00Z', 'Accepted'],
 ['millisecond after cutoff', {}, '2026-09-22T19:00:00.001Z', 'Cancelled'],
 ['past pickup', {pickupDate:'2026-09-21'}, '2026-09-22T14:00:00Z', 'Cancelled'],
 ['same-day delivery', {deliveryDate:'2026-09-22'}, '2026-09-22T14:00:00Z', 'Cancelled'],
 ['earlier delivery', {deliveryDate:'2026-09-21'}, '2026-09-22T14:00:00Z', 'Cancelled'],
 ['future pickup after cutoff', {pickupDate:'2026-09-23',deliveryDate:'2026-09-24'}, '2026-09-22T22:00:00Z', 'Accepted'],
 ['impossible date', {pickupDate:'2026-02-30'}, '2026-02-20T14:00:00Z', 'Cancelled'],
 ['leap day', {pickupDate:'2028-02-29',deliveryDate:'2028-03-01'}, '2028-02-28T14:00:00Z', 'Accepted'],
 ['non-leap day', {pickupDate:'2026-02-29'}, '2026-02-20T14:00:00Z', 'Cancelled'],
 ['DST calendar day', {pickupDate:'2026-03-08',deliveryDate:'2026-03-09'}, '2026-03-07T14:00:00Z', 'Accepted'],
 ['UTC tomorrow, local today', {pickupDate:'2026-09-23',deliveryDate:'2026-09-24'}, '2026-09-23T01:00:00Z', 'Accepted'],
 ['missing id', {shipperOrderId:''}, '2026-09-22T14:00:00Z', 'Cancelled'],
 ['invalid price', {price:-1}, '2026-09-22T14:00:00Z', 'Cancelled'],
 ['missing stops', {stops:[]}, '2026-09-22T14:00:00Z', 'Cancelled'],
 ['missing vehicles', {vehicles:[]}, '2026-09-22T14:00:00Z', 'Cancelled'],
];
for (const [name, changes, clock, expected] of cases) test(name, () => {
 const result = validateDispatch({...base,...changes}, {now:new Date(clock)});
 assert.equal(result.status, expected);
 assert.deepEqual(Object.keys(result), ['shipperOrderId','status','notes']);
 assert.ok(result.notes.length);
});
test('timezone changes same-day cutoff', () => {
 const now = new Date('2026-09-22T20:00:00Z');
 assert.equal(validateDispatch(base,{now,timeZone:'America/New_York'}).status,'Cancelled');
 assert.equal(validateDispatch(base,{now,timeZone:'America/Los_Angeles'}).status,'Accepted');
});
test('preserves required acceptance wording and input', () => {
 const copy = structuredClone(base);
 assert.deepEqual(validateDispatch(base,{now:new Date('2026-09-22T14:00:00Z')}),{
 shipperOrderId:base.shipperOrderId,status:'Accepted',notes:'You will receive an email when a carrier accepts this dispatch request'});
 assert.deepEqual(base,copy);
});
test('null payload becomes a controlled rejection', () => assert.equal(validateDispatch(null).status,'Cancelled'));
test('invalid configuration fails explicitly', () => assert.throws(() => validateDispatch(base,{timeZone:'Invalid/Zone'}),RangeError));
