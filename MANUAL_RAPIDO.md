# Manual rápido – Citas Médicas

## 1. Acceder al sistema

- Inicio de sesión: `/login`
- Registro de paciente: `/register`
- Registro de doctor (admin): `/doctor/register`
- Dashboard: `/dashboard`

## 2. Usuario administrador

La primera vez que se inicia la app, se crea el administrador por defecto:

- usuario: `admin`
- contraseña: `admin123`

Desde ahí se registran los odontólogos.

## 3. Registrar paciente

1. Ir a `/register`.
2. Completar nombre, apellido, cédula, teléfono, correo y contraseña.
3. Guardar.

## 4. Registrar doctor

1. Iniciar sesión como administrador.
2. Entrar a `/doctor/register`.
3. Completar datos del doctor y su especialidad.
4. Guardar perfil.

## 5. Reservar una cita

1. Iniciar sesión como paciente.
2. Ir a `/appointments/new`.
3. Elegir doctor, fecha y horario disponible.
4. Escribir el tratamiento.
5. Confirmar.

## 6. Disponibilidad

El sistema solo muestra horarios libres del doctor. Si una hora ya está ocupada, no aparece como opción.

## 7. Notificaciones

Cuando se agenda una cita:

- el doctor recibe una notificación en la app
- se envía correo al doctor
- se confirma al paciente si está configurado el correo

## 8. Cancelación

El doctor puede cancelar una cita desde la aplicación. El paciente recibe notificación y correo de cancelación.

## 9. Solución rápida

- Si no inicia: revisar `npm install` y `.env`
- Si no llegan correos: verificar `EMAIL_USER` y `EMAIL_PASS`
- Si no funciona la app: abrir en `http://localhost:3000`

## 10. Recomendación

Para probar la app:

1. entrar como admin
2. registrar doctor
3. registrar paciente
4. crear cita
5. revisar el dashboard
