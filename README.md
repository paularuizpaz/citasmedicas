# DentalCare+

Sistema de citas médicas para odontólogos con registro de pacientes, disponibilidad por doctor y día, selección de horario, y notificación por correo y dentro de la aplicación.

## Características

- Registro de usuarios con cédula de identidad y contraseña.
- Registro de doctores realizado exclusivamente por el administrador.
- Registro de pacientes con carnet, nombre, apellido y celular.
- Selección de odontólogo y fecha para ver horarios disponibles.
- Reserva de citas con tratamiento y hora concreta.
- Notificación interna para el doctor en la aplicación.
- Envío de correo electrónico al odontólogo cuando se agenda una cita.
- Base de datos SQLite local.

## Requisitos

- Node.js 18+
- npm

## Instalación

1. Instala Node.js 18+ desde https://nodejs.org/
2. Abre la carpeta del proyecto.
3. Ejecuta:
   npm install
4. Crea un archivo `.env` basado en `.env.example` y configura tu Gmail de aplicación:
   EMAIL_USER=tu-correo@gmail.com
   EMAIL_PASS=tu-password-de-aplicacion
5. Inicia la app:
   npm start

La aplicación estará disponible en http://localhost:3000

## Configuración en otra máquina

1. Copia toda la carpeta del proyecto.
2. Instala Node.js LTS en la nueva máquina.
3. En PowerShell, ejecuta:
   ./setup.ps1
4. Si no quieres usar el script, haz lo siguiente:
   npm install
   copy .env.example .env
   # editar .env con tus credenciales de Gmail
   npm start

> Importante: el archivo `.env` nunca debe subirse a GitHub ni compartirse.

## Preparación para producción

Antes de publicar la aplicación:

1. Usa Node.js LTS y ejecuta `npm ci --omit=dev`.
2. Define `NODE_ENV=production` en `.env`.
3. Configura un `SESSION_SECRET` largo y aleatorio. La aplicación no inicia en producción sin él.
4. Configura `ADMIN_CI`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `EMAIL_USER` y `EMAIL_PASS`. No uses los valores de desarrollo.
5. Sirve la aplicación detrás de HTTPS mediante un proxy inverso. Las cookies de sesión se marcan como `secure` en producción.
6. Mantén `data/app.db` y `data/sessions.db` en un volumen persistente y realiza copias de seguridad de la base de datos.
7. Ejecuta `npm audit` y corrige las vulnerabilidades antes de publicar.

La aplicación incorpora cabeceras HTTP seguras, protección CSRF, límite de solicitudes, límite reforzado para login, cookies `httpOnly`/`sameSite` y sesiones persistentes en SQLite. Para una instalación con varios servidores se debe migrar la sesión y la base de datos a servicios compartidos.

## Acceso inicial

- Registro de paciente: `/register`
- Inicio de sesión: `/login`
- Registro de doctor (solo administrador): `/doctor/register`
- Nueva cita: `/appointments/new`

## Administrador inicial

Al iniciar por primera vez se crea automáticamente el administrador si no existe:

- Carnet/usuario: `admin`
- Contraseña de desarrollo: `admin123`

En producción define `ADMIN_CI`, `ADMIN_PASSWORD`, `ADMIN_NAME` y `ADMIN_EMAIL` en `.env` antes del primer arranque.

## Observación

Para probar envíos reales de correo, configura una cuenta de Gmail con contraseña de aplicación.
