# Actualizar GitHub

Reemplaza los archivos del paquete inicial por los de esta versión en la raíz del repositorio.
Incluye `.github/workflows/test.yml`: ahora utiliza Node.js 24. No subas `.env`, `data/`
ni `node_modules/`. Después de instalar dependencias, sí sube `package-lock.json`.

Ejecuta `npm.cmd test` antes de subir. Conserva los archivos bajo sus carpetas, sin introducir
un nivel adicional `axlesignal/` dentro del repositorio. GitHub Actions prueba reglas y API;
no contiene credenciales y no comprueba el broker de la cuenta del usuario.
