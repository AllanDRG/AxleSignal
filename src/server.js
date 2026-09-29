import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { Store } from './application/store.js';
import { SolaceBridge } from './messaging/solace.js';
const root=fileURLToPath(new URL('../',import.meta.url));
export function createApp(store,bridge,{port=3000}={}) {
  const assets={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
  return http.createServer(async(req,res)=>{
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    try {
      // Loopback-only demo. Restrict Host/Origin to prevent browser access from unrelated sites.
      const expected=new Set(['localhost:'+port,'127.0.0.1:'+port]);
      if(!expected.has(req.headers.host))return json(403,{error:'Host no permitido'});
      if(req.headers.origin && !['http://localhost:'+port,'http://127.0.0.1:'+port].includes(req.headers.origin))return json(403,{error:'Origen no permitido'});
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET' && assets[url.pathname]){const [name,type]=assets[url.pathname];res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});return res.end(readFileSync(resolve(root,'web',name)));}
      if(req.method==='GET' && url.pathname==='/api/state')return json(200,{broker:bridge.status(),timeZone:store.timeZone,counts:store.counts(),orders:store.list()});
      if(req.method==='POST') {
        const now=new Date();
        if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'Envía application/json'});
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>100000)return json(413,{error:'Máximo 100 KB por solicitud'});chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return json(400,{error:'JSON inválido'});}
        if(url.pathname==='/api/orders'){const result=store.submit(body,now);return json(result.duplicate?200:202,result);}
        const match=url.pathname.match(/^\/api\/orders\/([^/]+)\/assign$/);
        if(match)return json(200,store.assign(decodeURIComponent(match[1]),body?.carrier));
      }
      json(404,{error:'Ruta no encontrada'});
    }catch(e){json(e.status||500,{error:e.status?e.message:'Error interno; revisa el almacenamiento local.'});}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const timeZone=process.env.DISPATCH_TIME_ZONE||'America/New_York';new Intl.DateTimeFormat('en',{timeZone});
  const port=Number(process.env.PORT||3000);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT debe ser un entero entre 1024 y 65535');
  const db=resolve(root,'data','axlesignal.sqlite');mkdirSync(dirname(db),{recursive:true});
  const store=new Store(db,timeZone);
  const bridge=new SolaceBridge(store,{host:process.env.SOLACE_HOST,vpn:process.env.SOLACE_VPN,username:process.env.SOLACE_USERNAME,password:process.env.SOLACE_PASSWORD,dispatchQueue:process.env.SOLACE_DISPATCH_QUEUE||'axlesignal.dispatch.ready.v1',resultsQueue:process.env.SOLACE_RESULTS_QUEUE||'axlesignal.dispatch.results.v1'});
  const server=createApp(store,bridge,{port});
  server.listen(port,'127.0.0.1',()=>{console.log(`AxleSignal: http://localhost:${port} | Zona: ${timeZone}`);bridge.start();});
  server.on('error',e=>{console.error('No se pudo abrir el puerto:',e.code);bridge.stop();process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{bridge.stop();server.close(()=>process.exit(0));});
}
