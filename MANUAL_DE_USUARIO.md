# Manual de usuario – Citas Médicas

## 1. Objetivo del sistema

La aplicación está pensada para dos tipos de usuarios:

- Pacientes: pueden registrarse, iniciar sesión y solicitar citas médicas.
- Doctores: pueden registrarse como profesionales y dejar su perfil disponible para que los pacientes agenden con ellos.

El flujo principal es:

1. Un paciente crea su cuenta.
2. Un doctor registra su perfil profesional.
3. El paciente solicita una cita.
4. El sistema valida disponibilidad y confirma la solicitud.

## 2. Requisitos

- Node.js 18 o superior
- npm
- Git
- Archivo `.env` con las credenciales de Gmail para los correos

En producción también son obligatorios `NODE_ENV=production`, `SESSION_SECRET`, `ADMIN_CI` y `ADMIN_PASSWORD`. Usa HTTPS y no compartas el archivo `.env`.

## 3. Instalación

1. Abre la terminal en la raíz del proyecto.
2. Instala dependencias:

```bash
npm install
```

3. Crea el archivo `.env`:

```bash
cp .env.example .env
```

4. Completa los datos de Gmail:

```env
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicación
```

5. Inicia la aplicación:

```bash
npm start
```

La aplicación quedará disponible en:

```text
http://localhost:3000
```

## 4. Registro de paciente

1. Abre la app.
2. Haz clic en "Crear cuenta".
3. Completa los siguientes campos:
   - nombre completo
   - cédula
   - correo electrónico
   - teléfono
   - contraseña
4. Pulsa "Registrarme".

Con eso ya queda registrado como paciente y puede entrar al sistema.

## 5. Inicio de sesión

1. Ingresa a la pantalla de login.
2. Escribe tu cédula y contraseña.
3. Haz clic en "Entrar".

Si los datos son correctos, el sistema te lleva al dashboard.

## 6. Panel principal del paciente

Desde el dashboard el paciente puede ver:

- su perfil
- citas programadas
- lista de doctores disponibles
- notificaciones
- resumen general de la actividad

## 7. Registro de doctor

La parte del doctor no la hace el paciente, sino que un usuario se registra como profesional desde su propia cuenta.

### Paso a paso

1. Inicia sesión con la cuenta que va a actuar como doctor.
2. Entra a la ruta de registro profesional.
3. Completa:
   - especialidad
   - años de experiencia
   - disponibilidad
   - biografía profesional
4. Guarda el perfil.

Cuando se registra correctamente:

- se crea el perfil de doctor
- el usuario cambia su rol a doctor
- queda visible para que los pacientes puedan solicitar citas con él

## 8. Solicitud de cita por parte del paciente

1. Inicia sesión como paciente.
2. Ve a la opción de nueva cita.
3. Elige:
   - doctor
   - fecha
   - horario disponible
   - tratamiento
4. Confirmas la reserva.

El sistema valida que el horario está disponible y registra la cita.

## 9. Cómo funciona la disponibilidad

La aplicación calcula horarios disponibles según:

- horario laboral del doctor
- duración de cada cita
- pausas de comida
- citas ya reservadas

Esto evita que dos pacientes agenden la misma hora.

## 10. Notificaciones y correos

Cuando el paciente solicita una cita, el sistema:

- crea una notificación para el doctor
- envía un aviso al correo del doctor
- envía una confirmación al correo del paciente

Los correos solo se enviarán si `.env` tiene configurados `EMAIL_USER` y `EMAIL_PASS` con una cuenta de Gmail y una contraseña de aplicación válida.

## 11. Cerrar sesión

En la parte superior de la interfaz, usa el botón de cierre de sesión para salir del sistema.

## 12. Roles del sistema

- Paciente: puede registrarse y solicitar citas.
- Doctor: puede registrarse como profesional y recibir solicitudes de citas.

## 13. Rutas principales

```text
/login
/register
/dashboard
/doctor/register
/appointments/new
/logout
```

## 14. Flujo recomendado para probar la app

1. Registra un paciente.
2. Registra una cuenta para doctor y completa su perfil profesional.
3. Inicia sesión como paciente.
4. Solicita una cita.
5. Verifica la cita en el dashboard y confirma que el doctor recibió la notificación.

## 15. Problemas comunes

### La app no inicia

Revisa:

- que Node.js y npm estén instalados
- que se haya ejecutado `npm install`
- que el archivo `.env` exista y tenga los valores correctos

### Puerto ocupado

Si el puerto 3000 ya está en uso, debes cerrar el proceso anterior o cambiar el puerto en `.env`.

### No llegan los correos

Verifica que:

- `EMAIL_USER` esté bien escrito
- `EMAIL_PASS` sea la contraseña de aplicación correcta
- tu configuración de Gmail permita el envío desde la app

---

La idea central es esta: los pacientes solicitan citas y los doctores se registran y quedan disponibles para recibir esas solicitudes.
