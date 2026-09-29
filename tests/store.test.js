import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/application/store.js';
import { createApp } from '../src/server.js';
const now=new Date('2026-09-22T14:00:00Z');
const payload=(id='A')=>({shipperOrderId:id,pickupDate:'2026-09-23',deliveryDate:'2026-09-24',price:900,stops:[{stopNumber:1,city:'Milford',state:'MA',postalCode:'01757'},{stopNumber:2,city:'Shippensburg',state:'PA',postalCode:'17257'}],vehicles:[{year:'2010',make:'Toyota',model:'Corolla'}]});
test('valid submission reaches both queue projections; assignment is exclusive',()=>{
 const s=new Store();s.submit(payload(),now);assert.equal(s.pending().length,2);assert.equal(s.get('A').ready,false);assert.equal(s.get('A').result,null);
 for(const row of s.pending()){s.consume(row.kind,row.id,row.body);s.consume(row.kind,row.id,row.body);s.sent(row.id);}
 assert.equal(s.get('A').result.status,'Accepted');assert.equal(s.get('A').ready,true);assert.equal(s.pending().length,0);
 assert.equal(s.assign('A','Allan').carrier,'Allan');assert.throws(()=>s.assign('A','Otro'),e=>e.status===409);assert.equal(s.get('A').timeline.filter(x=>x.label.includes('recibida desde')).length,1);s.close();
});
test('cancellation emits only a result and never becomes available',()=>{
 const s=new Store();s.submit({...payload(),pickupDate:'2026-09-21'},now);assert.equal(s.pending().length,1);const row=s.pending()[0];assert.equal(row.kind,'result');s.consume(row.kind,row.id,row.body);assert.equal(s.get('A').result.status,'Cancelled');assert.throws(()=>s.assign('A','Allan'));s.close();
});
test('idempotency ignores key ordering but rejects conflicting payload',()=>{
 const s=new Store();s.submit(payload(),now);const reordered=Object.fromEntries(Object.entries(payload()).reverse());assert.equal(s.submit(reordered,now).duplicate,true);assert.equal(s.pending().length,2);assert.throws(()=>s.submit({...payload(),price:901},now),e=>e.status===409);assert.equal(s.pending().length,2);s.close();
});
test('restart retains orders and unconfirmed events; redelivery does not undo assignment',()=>{
 const dir=mkdtempSync(join(tmpdir(),'axlesignal-'));let s=new Store(join(dir,'test.sqlite'));s.submit(payload(),now);const row=s.pending().find(x=>x.kind==='ready');s.consume(row.kind,row.id,row.body);s.assign('A','Allan');s.close();s=new Store(join(dir,'test.sqlite'));assert.equal(s.pending().length,2);s.consume(row.kind,row.id,row.body);assert.equal(s.get('A').carrier,'Allan');s.sent(row.id);s.close();rmSync(dir,{recursive:true});
});
test('untrusted and malformed events are quarantined durably',()=>{
 const s=new Store();s.submit(payload(),now);const row=s.pending()[0];s.consume('ready','foreign',JSON.stringify(payload()));s.consume('ready',row.id,'{');assert.equal(s.counts().quarantine,2);assert.equal(s.get('A').ready,false);s.close();
});
test('HTTP accepts orders while offline and protects malformed input and cross-origin writes',async()=>{
 const s=new Store();const bridge={status:()=>({ready:false,message:'Offline test'})};const server=createApp(s,bridge,{port:31987});await new Promise(resolve=>server.listen(31987,'127.0.0.1',resolve));
 try{
 const base='http://127.0.0.1:31987';const request={...payload(),pickupDate:'2099-01-01',deliveryDate:'2099-01-02'};
 let res=await fetch(base+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});assert.equal(res.status,202);assert.equal((await res.json()).order.ready,false);
 res=await fetch(base+'/api/state');const state=await res.json();assert.equal(state.counts.pending,2);assert.equal(state.orders[0].result,null);
 res=await fetch(base+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(res.status,400);
 res=await fetch(base+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.example'},body:JSON.stringify(request)});assert.equal(res.status,403);
 res=await fetch(base+'/');assert.equal(res.status,200);assert.match(await res.text(),/AXLE/);
 }finally{await new Promise(resolve=>server.close(resolve));s.close();}
});
