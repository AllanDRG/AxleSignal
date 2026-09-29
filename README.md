# AxleSignal

**Cada carga, una decisión trazable.**

Una compra en subasta no termina cuando cae el martillo: falta mover el vehículo.
AxleSignal recibe una solicitud, explica si puede procesarse y la lleva a un tablero
para que un transportista tome la carga. Implementación del proyecto Global Dispatch / NewCron.

## Ejecutar en Windows

Requisitos: Node.js 24+, npm, un broker Solace y sus credenciales de mensajería.
Desde la carpeta que contiene este README:

```powershell
npm.cmd install
Copy-Item .env.example .env
code .env
```

Completa `SOLACE_HOST`, `SOLACE_VPN`, `SOLACE_USERNAME` y `SOLACE_PASSWORD`.
En Solace Cloud abre tu servicio → **Connect** y consulta la conexión de mensajería
para Node.js / Solace JavaScript. Usa el endpoint seguro Web Messaging `wss://host:puerto`
completo. No uses la URL de administración, el hostname DMR ni la contraseña del clúster.
El Message VPN de la instancia creada para este proyecto es `axlesignal-dev`.

Si la contraseña contiene `#`, espacios o caracteres especiales, escríbela entre comillas
en `.env`. No publiques ese archivo ni captures su contenido.

```powershell
npm.cmd test
npm.cmd start
```

Abre **http://localhost:3000**. Deja la terminal abierta. Ctrl+C detiene el servidor.
Después de cambiar `.env`, reinicia el servidor. En macOS/Linux, usa `npm` y `cp`.
La aplicación escucha solo en la interfaz local del equipo.

## Tres espacios, un recorrido

| Pantalla | Función |
| --- | --- |
| Clientes | Enviar JSON, ver solicitudes y resultados recibidos desde Solace. |
| Transportistas | Ver las cargas recibidas de la cola y tomar una con un nombre. |
| Bitácora | Consultar recepción, decisión, confirmación del broker y asignación. |

Se actualizan cada dos segundos. `Accepted` significa que la solicitud pasó las reglas.
`Assigned` es un estado de transporte separado: un conductor tomó la carga.
No se cambia el contrato de resultados del PDF.

## Solace: dos colas reales

Al conectar, la aplicación intenta crear colas durables y suscripciones si no existen.
El usuario de mensajería necesita permiso para crear endpoints, modificar suscripciones,
publicar mensajes garantizados y consumir. Si el perfil no lo permite, sigue
[la configuración manual](docs/solace-setup.md).

| Cola | Suscripción a tópico | Contenido |
| --- | --- | --- |
| `axlesignal.dispatch.ready.v1` | `axlesignal/v1/dispatch/ready` | Payload original válido |
| `axlesignal.dispatch.results.v1` | `axlesignal/v1/dispatch/result` | shipperOrderId, status y notes |

Los nombres de colas son configurables; los tópicos están definidos en el adaptador.
Ambas colas deben estar listas antes de publicar. Se envían mensajes **persistentes**;
la confirmación del broker marca la publicación y el consumidor hace ACK solo después
de guardar el mensaje. No hay un broker simulado en el modo normal de ejecución.

## Decisiones que se pueden explicar

- Recogida anterior a hoy: `Cancelled`.
- Recogida hoy después de las 15:00:00: `Cancelled`; exactamente a las 15:00:00 se permite.
- Entrega anterior a la recogida o el mismo día: `Cancelled`.
- Fecha imposible, precio no positivo, paradas incompletas o vehículos incompletos: `Cancelled`.
- Solicitud válida: `Accepted`, conservando la nota requerida por el PDF.

La zona operativa se configura con `DISPATCH_TIME_ZONE`; por defecto, `America/New_York`.
No se deduce a partir de la región del servidor ni del navegador. La entrega se compara
por días calendario, también durante cambios de horario de verano.

## Resistencia a fallos

SQLite guarda solicitudes, eventos pendientes de publicación (outbox), recibos y bitácora
en `data/axlesignal.sqlite`. La solicitud y sus eventos se escriben en una transacción.
Si el broker está caído, la API guarda la solicitud y la interfaz informa que el resultado
sigue pendiente. El publicador reintenta cada tres segundos cuando puede reconectar.

Las reentregas se deduplican por identificador de evento. Repetir un shipperOrderId con
el mismo contenido devuelve el pedido existente; cambiar su contenido devuelve HTTP 409.
Solo una actualización atómica puede asignar la misma carga. Los eventos ajenos a esta
instancia o ilegibles se guardan en cuarentena local antes de hacer ACK; no se convierten
en pedidos. Si falla el almacenamiento, no se confirma la recepción.

No borrar la base de datos con eventos pendientes en el broker: contiene las correlaciones.
Este diseño admite una instancia de servidor con varios navegadores, no varios servidores
independientes consumiendo las mismas colas con bases distintas.

## API

| Método y ruta | Resultado |
| --- | --- |
| `POST /api/orders` | 202 al registrar; 200 si es repetición idéntica; 409 si el ID tiene otro contenido. |
| `GET /api/state` | Estado del broker, hasta 200 solicitudes recientes y contadores. |
| `POST /api/orders/:id/assign` | Recibe `{ "carrier": "Transportes Ralón" }`; 409 si ya no está disponible. |

Una cancelación de negocio se registra y pasa por la cola de resultados. Un JSON ilegible,
un identificador ausente o un cuerpo de más de 100 KB se rechaza a nivel HTTP; no se
inventa un identificador para asociar resultados.

## Validación realizada y pendiente

**26 pruebas automatizadas aprobadas**: reglas, límites horarios, persistencia, duplicados,
asignación exclusiva, cuarentena y API HTTP. Las pruebas de almacenamiento invocan el
consumidor localmente; no certifican por sí solas el transporte del broker.

La integración está implementada contra la API oficial `solclientjs` 10.x. La descarga
del SDK estaba bloqueada en el entorno de construcción y no se dispuso de credenciales.
La revisión visual en navegador también queda pendiente: este entorno no dispone de Chromium.
**Falta ejecutar y confirmar la prueba integral contra la instancia real de Solace**,
siguiendo [la guía de demostración](docs/demo-checklist.md). No afirmar esa prueba como
aprobada hasta observar las dos recepciones en la bitácora.

`npm install` genera `package-lock.json`: consérvalo y súbelo al repositorio para fijar
las versiones instaladas. Las pruebas de dominio y HTTP no requieren descargar el SDK.

## Alcance

Demo educativa local, sin autenticación ni separación de clientes por cuenta. Las dos
vistas representan roles y comparten el historial. No exponer a Internet como producto.
El correo real no se envía; la nota de aceptación conserva el texto del enunciado.
El formulario genera fechas futuras para que el ejemplo no caduque.

## Estructura

- `src/domain/`: reglas puras con reloj inyectable.
- `src/application/`: SQLite, idempotencia, outbox y asignación.
- `src/messaging/`: sesiones, colas, suscripciones, publicación y ACK de Solace.
- `src/server.js`: HTTP local y arranque.
- `web/`: interfaz sin herramientas de compilación.
- `tests/`: reglas y comportamiento de la aplicación.
- `docs/`: configuración y demostración.

## Referencias y procedencia

La demo [MigueMat4/solace-demo](https://github.com/MigueMat4/solace-demo) se revisó
como referencia educativa; esta implementación se escribió desde cero.
Documentación primaria utilizada:

- [Colas y suscripciones](https://tutorials.solace.dev/nodejs/topic-to-queue-mapping/)
- [Entrega confirmada](https://tutorials.solace.dev/nodejs/confirmed-delivery/)
- [API Message](https://docs.solace.com/API-Developer-Online-Ref-Documentation/nodejs/solace.Message.html)

No se ha elegido una licencia para este proyecto.
