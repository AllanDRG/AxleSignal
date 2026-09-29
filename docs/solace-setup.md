# Configuración de Solace

## Obtener conexión

Abre Cluster Manager → axlesignal-dev → Connect. Busca los parámetros de mensajería
para Solace JavaScript/Node.js: Web Messaging seguro (wss), Message VPN, Client Username,
Client Password. Copia estos cuatro valores únicamente a tu `.env` local.
No uses los datos de DMR ni el acceso SEMP administrativo.

## Creación automática

El adaptador utiliza `createIfMissing: true` y agrega la suscripción después del evento
UP de cada consumidor. Un perfil sin permisos suficientes impedirá esta operación.
La interfaz solo anuncia «dos colas listas» después de confirmar ambas suscripciones.

## Alternativa manual

Desde Open Broker Manager, abre el Message VPN y la sección Queues. Crea estas dos colas:

| Nombre | Topic Subscription |
| --- | --- |
| axlesignal.dispatch.ready.v1 | axlesignal/v1/dispatch/ready |
| axlesignal.dispatch.results.v1 | axlesignal/v1/dispatch/result |

Para la demo usa colas durables, acceso Exclusive, Incoming y Outgoing habilitados,
y una cuota de almacenamiento pequeña, por ejemplo 100 MB por cola. En cada cola,
agrega la suscripción exacta de la tabla. El usuario de `.env` debe poder consumir y
agregar suscripciones; usa ese usuario como propietario cuando corresponda.
No son dos servicios cloud: son dos colas dentro del servicio existente.

## Diagnóstico

- Falta instalar dependencias: ejecuta `npm.cmd install` dentro de la carpeta del proyecto.
- Error de conexión: verifica protocolo, host, puerto, VPN y credenciales de mensajería.
- Error preparando colas: revisa permisos, ingress/egress y que ningún otro consumidor
  exclusivo esté conectado. Detén copias anteriores con Ctrl+C.
- Resultado pendiente: consulta el indicador del broker y los eventos por enviar.
- Una cola vacía después de una prueba es normal si el consumidor ya guardó y confirmó
  el mensaje. La bitácora y los contadores de tráfico sirven para demostrar el tránsito.

Mantén `.env` fuera de GitHub. El backend nunca entrega credenciales al navegador.
