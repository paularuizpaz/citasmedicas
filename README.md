# DentalCare+

Sistema de citas médicas para odontólogos con registro de pacientes, disponibilidad por doctor y día, selección de horario, y notificación por correo y dentro de la aplicación.

## Características

- Registro de usuarios con cédula de identidad y contraseña.
- Registro de odontólogos con formulario profesional.
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

## Acceso inicial

- Registro de paciente: `/register`
- Inicio de sesión: `/login`
- Registro de odontólogo: `/doctor/register`
- Nueva cita: `/appointments/new`

## Observación

Para probar envíos reales de correo, configura una cuenta de Gmail con contraseña de aplicación.
