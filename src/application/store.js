import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { validateDispatch } from '../domain/validate-dispatch.js';
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
export class Store {
  constructor(path = ':memory:', timeZone = 'America/New_York') {
    this.timeZone = timeZone;
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, decision TEXT NOT NULL, result TEXT, ready INTEGER NOT NULL DEFAULT 0, carrier TEXT, received TEXT NOT NULL, assigned TEXT);
      CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), kind TEXT NOT NULL, body TEXT NOT NULL, sent TEXT, attempts INTEGER NOT NULL DEFAULT 0, error TEXT);
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, received TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS timeline(seq INTEGER PRIMARY KEY, order_id TEXT NOT NULL, at TEXT NOT NULL, label TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS quarantine(id TEXT PRIMARY KEY, kind TEXT, body TEXT, reason TEXT, at TEXT);`);
  }
  tx(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result=fn(); this.db.exec('COMMIT'); return result; } catch(e) { this.db.exec('ROLLBACK'); throw e; } }
  event(id, label) { this.db.prepare('INSERT INTO timeline(order_id,at,label) VALUES(?,?,?)').run(id,new Date().toISOString(),label); }
  submit(payload, now=new Date()) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.shipperOrderId !== 'string' || !payload.shipperOrderId.trim() || payload.shipperOrderId.length>120) throw Object.assign(new Error('Se requiere shipperOrderId de 1 a 120 caracteres.'),{status:400});
    const id=payload.shipperOrderId;
    const fingerprint=createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
    return this.tx(() => {
      const old=this.db.prepare('SELECT fingerprint FROM orders WHERE id=?').get(id);
      if(old) { if(old.fingerprint!==fingerprint) throw Object.assign(new Error('Ese identificador ya existe con otro contenido. Usa uno nuevo.'),{status:409}); return {duplicate:true, order:this.get(id)}; }
      const decision=validateDispatch(payload,{now,timeZone:this.timeZone});
      this.db.prepare('INSERT INTO orders(id,fingerprint,payload,decision,received) VALUES(?,?,?,?,?)').run(id,fingerprint,JSON.stringify(payload),JSON.stringify(decision),now.toISOString());
      this.event(id,'Solicitud recibida'); this.event(id,decision.status+': '+decision.notes);
      const queue=(kind,body)=>this.db.prepare('INSERT INTO outbox(id,order_id,kind,body) VALUES(?,?,?,?)').run(randomUUID(),id,kind,JSON.stringify(body));
      if(decision.status==='Accepted') queue('ready',payload);
      queue('result',decision);
      return {duplicate:false,order:this.get(id)};
    });
  }
  get(id) {
    const row=this.db.prepare('SELECT * FROM orders WHERE id=?').get(id); if(!row) return null;
    return {id:row.id,payload:JSON.parse(row.payload),decision:JSON.parse(row.decision),result:row.result?JSON.parse(row.result):null,ready:!!row.ready,carrier:row.carrier,received:row.received,assigned:row.assigned,
      pending:this.db.prepare('SELECT count(*) n FROM outbox WHERE order_id=? AND sent IS NULL').get(id).n,
      timeline:this.db.prepare('SELECT at,label FROM timeline WHERE order_id=? ORDER BY seq').all(id)};
  }
  list() { return this.db.prepare('SELECT id FROM orders ORDER BY received DESC LIMIT 200').all().map(x=>this.get(x.id)); }
  pending() { return this.db.prepare('SELECT * FROM outbox WHERE sent IS NULL ORDER BY rowid LIMIT 50').all(); }
  sent(id) { this.tx(()=>{const x=this.db.prepare('SELECT * FROM outbox WHERE id=?').get(id); if(x&&!x.sent) {this.db.prepare('UPDATE outbox SET sent=?, error=NULL WHERE id=?').run(new Date().toISOString(),id);this.event(x.order_id,'Broker confirmó publicación: '+x.kind);}}); }
  failed(id) { this.db.prepare('UPDATE outbox SET attempts=attempts+1,error=? WHERE id=?').run('Publicación pendiente; se reintentará al conectar.',id); }
  consume(kind,eventId,raw) {
    return this.tx(()=>{
      const key=kind+':'+(eventId||createHash('sha256').update(raw).digest('hex'));
      if(this.db.prepare('SELECT id FROM receipts WHERE id=?').get(key)) return;
      let body,problem;
      try { body=JSON.parse(raw); } catch { problem='JSON ilegible'; }
      const expected=eventId&&this.db.prepare('SELECT * FROM outbox WHERE id=?').get(eventId);
      if(!problem && (!expected || expected.kind!==kind || JSON.stringify(canonical(JSON.parse(expected.body)))!==JSON.stringify(canonical(body)))) problem='Evento ajeno o contenido distinto del evento registrado';
      if(problem) { this.db.prepare('INSERT OR IGNORE INTO quarantine VALUES(?,?,?,?,?)').run(key,kind,raw.slice(0,100000),problem,new Date().toISOString()); }
      else {
        if(kind==='ready') this.db.prepare('UPDATE orders SET ready=1 WHERE id=?').run(expected.order_id);
        else this.db.prepare('UPDATE orders SET result=? WHERE id=?').run(JSON.stringify(body),expected.order_id);
        this.event(expected.order_id,kind==='ready'?'Carga recibida desde la cola Solace':'Resultado recibido desde la cola Solace');
      }
      this.db.prepare('INSERT INTO receipts VALUES(?,?)').run(key,new Date().toISOString());
    });
  }
  assign(id,carrier) {
    if(typeof carrier!=='string'||!carrier.trim()||carrier.trim().length>100) throw Object.assign(new Error('Escribe un nombre de transportista de 1 a 100 caracteres.'),{status:400});
    return this.tx(()=>{
      const changed=this.db.prepare('UPDATE orders SET carrier=?,assigned=? WHERE id=? AND ready=1 AND carrier IS NULL').run(carrier.trim(),new Date().toISOString(),id);
      if(!changed.changes) throw Object.assign(new Error('La carga no está disponible o ya fue tomada.'),{status:409});
      this.event(id,'Carga asignada a '+carrier.trim()); return this.get(id);
    });
  }
  counts() { return {pending:this.db.prepare('SELECT count(*) n FROM outbox WHERE sent IS NULL').get().n,quarantine:this.db.prepare('SELECT count(*) n FROM quarantine').get().n}; }
  close() { this.db.close(); }
}
