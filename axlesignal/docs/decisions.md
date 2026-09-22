# Decisiones de diseño

| Decisión | Motivo | Límite |
| --- | --- | --- |
| Un lenguaje: JavaScript | Facilitar ejecución, revisión y mantenimiento. | Integración Solace pendiente. |
| Dominio sin dependencias | Probar reglas sin red ni credenciales. | No prueba entrega de mensajes. |
| Reloj inyectable | Reproducir exactamente el corte de las 15:00. | La API futura debe capturarlo al recibir. |
| Zona configurable | Estados Unidos tiene varias zonas. | Confirmar el criterio esperado con el evaluador. |
| Corte estrictamente posterior | El enunciado dice después de las 15:00. | 15:00:00 permitido; 15:00:00.001 rechazado. |
| Calendario para entrega | Un día de diferencia entre fechas. | No calcula duración de conducción. |
| Precio positivo y paradas consecutivas | Política adicional de integridad del payload. | No son reglas explícitas del PDF; pueden ajustarse. |
| Outbox y deduplicación | Recuperarse de interrupciones sin perder intención de envío. | Diseño pendiente, no garantía actual. |

## Casos por resolver al integrar

- Mismo shipperOrderId y mismo contenido: devolver decisión existente sin duplicar eventos.
- Mismo identificador con contenido distinto: conflicto explícito.
- Solicitud sin identificador: rechazo HTTP; no inventar un identificador de negocio.
- JSON ilegible: error HTTP de entrada, no mensaje de pedido válido.
- Broker caído: conservar publicación pendiente y mostrar estado técnico separado.
- Mensaje imposible de procesar: política de reintentos y cuarentena documentada.
