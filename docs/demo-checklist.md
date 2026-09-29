# Demostración integral

Ejecutar contra el broker real. Esta lista está pendiente de verificación en la cuenta del usuario.

1. `npm.cmd install`, completar `.env`, `npm.cmd test`, `npm.cmd start`.
2. Abrir http://localhost:3000 y esperar «Conectado · dos colas listas».
3. Confirmar las dos colas y suscripciones en Broker Manager.
4. En Clientes, pulsar Nuevo ejemplo válido y Enviar solicitud.
5. Esperar `Accepted`. En Bitácora deben aparecer recepción desde la cola de cargas y
   recepción desde la cola de resultados, además de confirmaciones de publicación.
6. En Transportistas, introducir un nombre y tomar la carga. Ver Assigned en Clientes.
7. Abrir otra pestaña y comprobar que la carga ya no está disponible. La API devuelve 409
   si una segunda asignación intenta tomarla.
8. Generar otro ejemplo con ID nuevo y pickupDate de ayer. Debe aparecer Cancelled con
   el motivo y nunca aparecer en Transportistas.
9. Repetir con deliveryDate igual a pickupDate: Cancelled.
10. Probar recogida hoy después del corte si la hora operativa lo permite. El límite exacto
    se demuestra de forma reproducible mediante `npm.cmd test`, sin cambiar el reloj del equipo.
11. Reenviar idéntico JSON: no aumenta el número de pedidos. Cambiar el precio manteniendo
    el mismo ID: HTTP 409, visible como mensaje en pantalla.
12. Detener el servidor y reiniciarlo: historial y asignación deben permanecer.
13. Prueba opcional de interrupción: detener app, configurar temporalmente host inválido,
    reiniciar, registrar un pedido y observar publicación pendiente. Restaurar `.env` y
    reiniciar; confirmar recepción posterior sin duplicados.

Guardar capturas de Clientes, Transportistas, Bitácora y las dos colas. No capturar claves.
Anotar fecha y resultado de esta prueba en el README antes de entregar.
