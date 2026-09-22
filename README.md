# AxleSignal

**Cada carga, una decisión trazable.**

Una compra en subasta no termina cuando cae el martillo: falta mover el vehículo.
AxleSignal propone convertir esa solicitud en una decisión comprensible y, después,
en una carga que un transportista pueda tomar.

Proyecto basado en el enunciado **Global Dispatch / NewCron**.
El nombre combina *axle* (eje de un vehículo) con *signal* (el evento que pone el flujo en marcha).

> Estado: base inicial ejecutable. Incluye validación, pruebas y una demostración local.
> La conexión real con Solace, el almacenamiento y las pantallas están pendientes.
> No presentar esta versión como la entrega completa.

## Probar en un minuto

Requisito: Node.js 22 o superior. Esta base no necesita paquetes externos.

```bash
npm test
npm run demo
```

La demo utiliza un reloj fijo para que los casos no caduquen. No publica mensajes en un broker.

## Tres preguntas, tres espacios

| Espacio propuesto | Pregunta que responde | Estado |
| --- | --- | --- |
| Solicitudes | ¿Puede procesarse mi pedido y por qué? | Reglas implementadas; pantalla pendiente |
| Cargas disponibles | ¿Qué viaje puedo aceptar? | Pendiente |
| Bitácora | ¿Qué ocurrió con esta solicitud? | Diseño documentado; implementación pendiente |

La distinción principal es explícita: `Accepted` indica validación por el sistema;
`Assigned` será un estado interno posterior cuando un transportista tome la carga.
El contrato de resultados del enunciado conserva `Accepted` y `Cancelled`.

## Reglas que se pueden demostrar

- Fechas reales en formato `YYYY-MM-DD`.
- Recogida nunca anterior al día actual de la zona configurada.
- Si se recoge hoy, se rechaza después de las 15:00:00; exactamente a esa hora se permite.
- Entrega al menos un día calendario después de la recogida.
- Identificador, precio, paradas y vehículos con estructura válida.

La zona predeterminada de la función es `America/New_York`: es una decisión explícita
para esta base, no una zona universal de Estados Unidos. Se puede pasar otra zona.
Un día significa un día calendario, no 24 horas transcurridas; así se evita confundir
la regla con los cambios de horario de verano.

## Estructura con propósito

| Ruta | Responsabilidad |
| --- | --- |
| `src/domain/` | Reglas puras; no conocen HTTP ni Solace. |
| `src/application/` | Diseño de los casos de uso y su coordinación. |
| `src/messaging/` | Contratos y diseño de las dos colas de Solace. |
| `web/` | Especificación de las pantallas propuestas. |
| `tests/` | Casos de frontera y contratos del resultado. |
| `examples/` | Solicitud de muestra y demo reproducible. |
| `docs/` | Arquitectura, decisiones y guía para subir el repositorio. |

## Qué hará que destaque

1. **Explicar la decisión.** Cada rechazo devuelve un motivo concreto.
2. **Mostrar el recorrido.** La bitácora propuesta distinguirá recepción, validación,
   publicación y asignación; no mostrará éxito antes de la confirmación correspondiente.
3. **Demostrar los límites.** La demo compara ayer, hoy antes y después del corte,
   entrega el mismo día y cambio de fecha entre UTC y la zona operativa.
4. **Evitar dobles asignaciones.** El diseño prevé una operación atómica en almacenamiento;
   confirmar un mensaje de Solace no equivale a que un conductor haya tomado la carga.

## Antes de entregar

- [x] Reglas de dominio y pruebas sin broker.
- [x] Demo con reloj controlado y documentación inicial.
- [ ] Configurar un broker real y las dos colas con sus suscripciones.
- [ ] Implementar publicación persistente y confirmaciones del broker.
- [ ] Implementar almacenamiento, consumidores e idempotencia.
- [ ] Implementar pantallas y aceptación atómica de cargas.
- [ ] Probar el flujo real, reinicios y reentregas.
- [ ] Añadir capturas y pasos de reproducción al README.

Consulta [la arquitectura](docs/architecture.md), [las decisiones](docs/decisions.md)
y [la guía de publicación](docs/publish.md).

## Procedencia

La demo educativa [MigueMat4/solace-demo](https://github.com/MigueMat4/solace-demo)
fue revisada como referencia de publicador y consumidor. Esta base se escribió desde cero
sin copiar sus archivos de implementación. No se ha elegido todavía una licencia para este proyecto.
