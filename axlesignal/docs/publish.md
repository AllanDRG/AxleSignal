# Publicar AxleSignal en tu cuenta

Esta carpeta aún no tiene un repositorio remoto asociado. El nombre es una propuesta;
comprueba su disponibilidad dentro de tu cuenta al crear el repositorio.

1. En GitHub, elige New repository y usa `axlesignal` o `axlesignal-dispatch`.
2. Descripción sugerida: `Cada carga, una decisión trazable. Global Dispatch con Solace, validaciones explicables y seguimiento de solicitudes.`
3. Elige la visibilidad. Si el evaluador necesita acceso sin invitación, usa Public.
4. Crea el repositorio vacío, sin README, licencia ni .gitignore generados por GitHub.
5. Descomprime este paquete y abre una terminal dentro de la carpeta `axlesignal`.
6. Ejecuta estos comandos, sustituyendo TU_USUARIO y el nombre si lo cambiaste:

```bash
npm test
git init -b main
git add .
git commit -m "Initialize AxleSignal: dispatch rules, tests and architecture"
git remote add origin https://github.com/TU_USUARIO/axlesignal.git
git push -u origin main
```

No incluyas contraseñas. `.env.example` es una plantilla sin secretos; `.env` queda excluido.

## Siguiente hito

Conectar un broker Solace real, implementar persistencia y completar las dos pantallas.
La base puede publicarse como avance, pero no cumple todavía la entrega completa del PDF.
