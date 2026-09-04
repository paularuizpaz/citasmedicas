# Manual de usuario – Citas Médicas

## 1. Objetivo del sistema

Esta aplicación permite gestionar citas odontológicas desde un flujo sencillo de tres actores:

- Paciente: puede registrarse, iniciar sesión y reservar citas.
- Doctor: puede tener perfil profesional y recibir solicitudes de agenda.
- Administrador: crea perfiles de odontólogos y supervisa la operación inicial del sistema.

El flujo principal es:

1. El administrador registra a los odontólogos.
2. Un paciente crea su cuenta y accede al sistema.
3. El paciente selecciona doctor, fecha y horario disponible.
4. La cita queda registrada y el doctor recibe notificación por la app y por correo.

## 2. Requisitos previos

- Node.js 18 o superior
- npm
- Git
- Archivo `.env` con las credenciales de Gmail para enviar correos

En producción es obligatorio definir:

- `NODE_ENV=production`
- `SESSION_SECRET`
- `ADMIN_CI`
- `ADMIN_PASSWORD`
- `EMAIL_USER`
- `EMAIL_PASS`

Nunca compartas el archivo `.env` ni lo subas a repositorios públicos.

## 3. Instalación y arranque

1. Abre la terminal en la raíz del proyecto.
2. Instala las dependencias:

```bash
npm install
```

3. Crea el archivo `.env` a partir del ejemplo si existe:

```bash
cp .env.example .env
```

4. Configura las credenciales de Gmail:

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

## 4. Acceso inicial y usuario administrador

La primera vez que se ejecuta la app, se crea automáticamente un usuario administrador si no existe.

Credenciales por defecto de desarrollo:

- Usuario/Carnet: `admin`
- Contraseña: `admin123`

En producción es recomendable cambiar estas credenciales mediante variables de entorno:

- `ADMIN_CI`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`
- `ADMIN_EMAIL`

## 5. Registro de paciente

1. Abre la app en `/register`.
2. Completa los campos obligatorios:
   - Nombre
   - Apellido
   - Cédula de identidad
   - Celular
   - Correo electrónico
   - Contraseña
3. Pulsa "Registrarme".

Después del registro, el sistema crea automáticamente la cuenta del paciente y lo lleva al dashboard.

## 6. Inicio de sesión

1. Accede a `/login`.
2. Ingresa la cédula y la contraseña.
3. Presiona "Entrar".

Si los datos son correctos, se abre el dashboard según el rol del usuario.

## 7. Roles y permisos del sistema

### Paciente

Permite:

- registrarse y acceder al dashboard
- ver doctores disponibles
- solicitar nuevas citas
- consultar sus citas
- recibir notificaciones

### Doctor

Permite:

- gestionar su perfil profesional
- ver su agenda
- recibir citas asignadas
- cancelar citas si corresponde

### Administrador

Permite:

- registrar nuevos médicos
- mantener perfiles profesionales activos
- revisar la operación general del sistema

## 8. Registro de doctor por parte del administrador

El registro de profesionales no lo hace el paciente; lo hace el administrador desde la interfaz correspondiente.

Ruta:

```text
/doctor/register
```

Campos del formulario:

- Nombre
- Apellido
- Cédula
- Celular
- Correo
- Contraseña inicial
- Especialidad
- Años de experiencia
- Disponibilidad
- Biografía profesional

La disponibilidad se suele ingresar con texto descriptivo, por ejemplo:

```text
Lunes a viernes de 9:00 a 17:00.
```

El sistema usa esa información para calcular los horarios disponibles del doctor.

## 9. Dashboard

Una vez iniciado sesión, el usuario entra a `/dashboard`.

Desde allí puede ver:

- sus citas
- la lista de doctores
- notificaciones internas
- resumen general de la agenda
- accesos rápidos según el rol

El contenido del dashboard varía según si el usuario es paciente, doctor o administrador.

## 10. Solicitud de una cita

### Como paciente

1. Inicia sesión.
2. Dirígete a la ruta:

```text
/appointments/new
```

3. Selecciona:
   - odontólogo
   - fecha
   - horario disponible
   - tratamiento

4. Confirma la reserva.

El sistema valida que la hora elegida siga disponible y que no esté duplicada con otra cita del mismo doctor en la misma fecha.

## 11. Cómo se calculan los horarios disponibles

La disponibilidad del doctor se interpreta con base en su agenda y en las citas ya reservadas.

La aplicación toma en cuenta:

- horario del doctor
- duración estándar de la cita (30 minutos)
- días no laborables o no habilitados
- citas existentes en la misma fecha

Si el doctor tiene una agenda completa o un horario ya ocupado, ese espacio no aparece como disponible para elegir.

## 12. Pacientes registrados y pacientes nuevos

En la creación de citas, el sistema admite dos escenarios:

- Un paciente ya registrado en la base de datos.
- Un paciente nuevo que se registra al momento de agendar la cita.

Esto es útil cuando un doctor o administrador está reservando citas desde una cuenta de atención.

## 13. Notificaciones y correos

Cuando se agenda una cita, el sistema:

- crea una notificación interna para el doctor
- envía un correo al doctor con el detalle de la cita
- envía una confirmación al correo del paciente si está disponible

Los correos se habilitan solo si el archivo `.env` contiene datos válidos de Gmail:

```env
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicación
```

> Importante: la contraseña debe ser una contraseña de aplicación de Gmail, no la contraseña normal de la cuenta.

## 14. Cancelación de citas

Los médicos pueden cancelar citas desde la operación de la aplicación correspondiente a la agenda o a la vista de citas. Cuando se cancela:

- cambia el estado de la cita
- se registra una nota de motivo
- se envía notificación al paciente
- se envía correo de cancelación

## 15. Cerrar sesión

En la parte superior de la interfaz, el usuario puede cerrar sesión para salir del sistema.

Ruta:

```text
/logout
```

## 16. Rutas principales

```text
/
/login
/register
/logout
/dashboard
/doctor/register
/appointments/new
/doctors
/schedules
```

## 17. Flujo recomendado para probar la aplicación

1. Inicia la app con `npm start`.
2. Inicia sesión como administrador con `admin` / `admin123`.
3. Registra al menos un doctor desde `/doctor/register`.
4. Cierra sesión y crea una cuenta de paciente desde `/register`.
5. Inicia sesión como paciente.
6. Agenda una cita desde `/appointments/new`.
7. Verifica que la cita aparece en el dashboard y que el doctor recibe la notificación.

## 18. Solución de problemas comunes

### La aplicación no inicia

Revisa:

- que Node.js esté instalado
- que se haya ejecutado `npm install`
- que el archivo `.env` exista y contenga los valores necesarios

### Puerto ocupado

Si el puerto `3000` ya está en uso, cierra el proceso anterior o cambia el puerto en la configuración del entorno.

### No llegan correos

Verifica que:

- `EMAIL_USER` esté bien escrito
- `EMAIL_PASS` sea una contraseña de aplicación válida
- Gmail permita el envío desde la aplicación
- el archivo `.env` esté cargado correctamente

### El administrador no puede iniciar sesión

Comprueba que la base de datos se haya inicializado correctamente y que el usuario `admin` exista en la tabla de usuarios.

---

La idea central del sistema es simple: el administrador registra médicos, los pacientes reservan citas en la agenda disponible y el sistema coordina la operación con notificaciones internas y correos electrónicos.
