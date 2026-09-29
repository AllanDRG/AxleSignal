# Decisiones y límites

- Node.js 24 y SQLite integrado: evita compiladores nativos para el almacenamiento.
- Solo una dependencia externa: solclientjs 10.x. La interfaz usa HTML, CSS y JavaScript.
- Zona America/New_York configurable: el enunciado no define una única zona para EE. UU.
- Día calendario para entrega; corte estrictamente posterior a 15:00:00.
- Precio positivo y paradas consecutivas son políticas adicionales de integridad.
- Se prioriza la primera causa de rechazo; cada resultado conserva el contrato del PDF.
- La recepción HTTP captura el reloj antes de procesar el JSON; el consumidor no revalida
  la fecha al recibir después, pues un pedido válido puede permanecer en cola.
- Outbox transaccional y recibos evitan pérdida de intención y duplicación al reintentar.
- Solo eventos generados por esta aplicación alimentan las proyecciones. Eventos externos
  sin correlación, malformados o alterados se guardan en cuarentena local y se confirman.
- Demo local sin autenticación, correo ni despliegue público. Historial limitado a 200
  solicitudes recientes en la interfaz, con conservación completa en SQLite.
- La prueba real de Solace requiere instalación del SDK y credenciales en el equipo del usuario.
