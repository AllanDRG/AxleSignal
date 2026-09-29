import { randomUUID } from 'node:crypto';
export class SolaceBridge {
  constructor(store,config) {this.store=store;this.config=config;this.ready=false;this.busy=false;this.closed=false;this.state='Sin conectar';this.pending=new Map();this.consumers=[];}
  status() {return {ready:this.ready,message:this.state};}
  start() {this.tick();this.timer=setInterval(()=>this.tick(),3000);}
  reset() {
    this.ready=false;
    for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Conexión interrumpida'));}this.pending.clear();
    for(const c of this.consumers) {try{c.dispose();}catch{}}this.consumers=[];
    if(this.session){try{this.session.dispose();}catch{}}this.session=null;
  }
  async connect() {
    const {host,vpn,username,password}=this.config;
    if(!host||!vpn||!username||!password||host.includes('TU_HOST')) {this.state='Completa SOLACE_HOST, SOLACE_VPN, SOLACE_USERNAME y SOLACE_PASSWORD en .env; luego reinicia.';return;}
    if(!this.s){const imported=await import('solclientjs');const module=imported.default||imported;this.s=module.debug||module;const props=new this.s.SolclientFactoryProperties();props.profile=this.s.SolclientFactoryProfiles.version10;this.s.SolclientFactory.init(props);this.s.SolclientFactory.setLogLevel(this.s.LogLevel.ERROR);}
    const s=this.s;
    const session=s.SolclientFactory.createSession({url:host,vpnName:vpn,userName:username,password,
      reconnectRetries:0,connectRetries:0,connectTimeoutInMsecs:12000,readTimeoutInMsecs:12000,
      ignoreDuplicateSubscriptionError:true,publisherProperties:{acknowledgeTimeoutInMsecs:10000}});
    this.session=session;this.state='Conectando y preparando las dos colas…';
    session.on(s.SessionEventCode.ACKNOWLEDGED_MESSAGE,e=>this.settle(e.correlationKey));
    session.on(s.SessionEventCode.REJECTED_MESSAGE_ERROR,e=>this.settle(e.correlationKey,new Error('El broker rechazó la publicación')));
    session.on(s.SessionEventCode.DISCONNECTED,()=>{this.ready=false;this.state='Desconectado; reintentando. Los pedidos permanecen guardados.';});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Tiempo de conexión agotado')),15000);
      session.on(s.SessionEventCode.UP_NOTICE,()=>{clearTimeout(timer);resolve();});
      session.on(s.SessionEventCode.CONNECT_FAILED_ERROR,()=>{clearTimeout(timer);reject(new Error('No se pudo conectar: verifica host, VPN, usuario y contraseña'));});
      session.connect();
    });
    await Promise.all([this.consumer('ready',this.config.dispatchQueue),this.consumer('result',this.config.resultsQueue)]);
    this.ready=true;this.state='Conectado · dos colas listas';
  }
  consumer(kind,name) {
    const s=this.s;
    return new Promise((resolve,reject)=>{
      const c=this.session.createMessageConsumer({queueDescriptor:{name,type:s.QueueType.QUEUE,durable:true},acknowledgeMode:s.MessageConsumerAcknowledgeMode.CLIENT,createIfMissing:true});
      this.consumers.push(c);
      const timer=setTimeout(()=>reject(new Error('No se pudo preparar la cola '+name)),18000);
      const fail=()=>{clearTimeout(timer);this.ready=false;reject(new Error('Revisa permisos y existencia de la cola '+name));};
      c.on(s.MessageConsumerEventName.UP,()=>{try{c.addSubscription(s.SolclientFactory.createTopicDestination('axlesignal/v1/dispatch/'+kind),kind,12000);}catch{fail();}});
      c.on(s.MessageConsumerEventName.SUBSCRIPTION_OK,()=>{clearTimeout(timer);resolve();});
      c.on(s.MessageConsumerEventName.SUBSCRIPTION_ERROR,fail);
      c.on(s.MessageConsumerEventName.CONNECT_FAILED_ERROR,fail);
      c.on(s.MessageConsumerEventName.DOWN_ERROR,()=>{this.ready=false;this.state='Una cola se desconectó; reintentando.';fail();});
      c.on(s.MessageConsumerEventName.DOWN,()=>{this.ready=false;});
      c.on(s.MessageConsumerEventName.MESSAGE,message=>{
        try {const data=message.getBinaryAttachment();const raw=data==null?'':typeof data==='string'?Buffer.from(data,'latin1').toString('utf8'):Buffer.from(data).toString('utf8');this.store.consume(kind,message.getApplicationMessageId(),raw);message.acknowledge();}
        catch {this.ready=false;this.state='No se pudo guardar un mensaje; sin ACK para permitir su reentrega.';}
      });
      c.connect();
    });
  }
  settle(key,error) {const p=this.pending.get(key);if(!p)return;this.pending.delete(key);clearTimeout(p.timer);error?p.reject(error):p.resolve();}
  publish(row) {
    const s=this.s;return new Promise((resolve,reject)=>{
      const key=randomUUID();const timer=setTimeout(()=>this.settle(key,new Error('Confirmación pendiente')),15000);this.pending.set(key,{resolve,reject,timer});
      try {const m=s.SolclientFactory.createMessage();m.setDestination(s.SolclientFactory.createTopicDestination('axlesignal/v1/dispatch/'+row.kind));m.setBinaryAttachment(Buffer.from(row.body,'utf8'));m.setDeliveryMode(s.MessageDeliveryModeType.PERSISTENT);m.setApplicationMessageId(row.id);m.setCorrelationId(row.order_id);m.setCorrelationKey(key);this.session.send(m);}catch(e){this.settle(key,e);}
    });
  }
  async tick() {
    if(this.busy||this.closed)return;this.busy=true;
    try {
      if(!this.ready){this.reset();await this.connect();}
      if(!this.ready||this.closed)return;
      for(const row of this.store.pending()) {if(!this.ready||this.closed)break;try{await this.publish(row);this.store.sent(row.id);}catch{this.store.failed(row.id);this.ready=false;this.state='Sin confirmación del broker; se reintentará sin perder el pedido.';break;}}
    } catch(e) {this.ready=false;this.state=e.code==='ERR_MODULE_NOT_FOUND'?'Falta instalar dependencias: ejecuta npm.cmd install.':'No se pudo conectar o preparar las colas. Revisa .env y los permisos de mensajería en Solace.';this.reset();}
    finally{this.busy=false;}
  }
  stop(){this.closed=true;clearInterval(this.timer);this.reset();}
}
