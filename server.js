require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const { initDatabase, run, get, all } = require('./src/db');
const { generateDoctorSlots, calculateEndTime, parseAvailability, isAvailableDate } = require('./src/schedule');
const { sendAppointmentEmail, sendAppointmentCancellationEmail, verifyMailer } = require('./src/mailer');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET es obligatorio en producción.');
}
if (isProduction && (!process.env.ADMIN_CI || !process.env.ADMIN_PASSWORD || !process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
  throw new Error('En producción define ADMIN_CI, ADMIN_PASSWORD, EMAIL_USER y EMAIL_PASS.');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.'
}));
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.'
});

app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-this-secret',
  store: new SQLiteStore({ db: 'sessions.db', dir: dataDir }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sentToken = req.body && req.body._csrf;
  const expectedToken = req.session.csrfToken;
  if (!sentToken || !expectedToken || sentToken.length !== expectedToken.length ||
      !crypto.timingSafeEqual(Buffer.from(sentToken), Buffer.from(expectedToken))) {
    return res.status(403).send('Solicitud no válida. Actualiza la página e inténtalo nuevamente.');
  }
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.redirect('/dashboard');
    }
    next();
  };
}

async function ensureAdmin() {
  const adminCi = process.env.ADMIN_CI || 'admin';
  const existing = await get('SELECT id FROM users WHERE ci = ?', [adminCi]);
  if (existing) return;

  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);
  await run(
    'INSERT INTO users (full_name, ci, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)',
    [process.env.ADMIN_NAME || 'Administrador', adminCi, process.env.ADMIN_EMAIL || 'admin@citas.local', '', passwordHash, 'admin']
  );
}

async function getDoctors() {
  return all('SELECT d.*, u.full_name, u.email, u.ci, u.phone FROM doctors d JOIN users u ON u.id = d.user_id ORDER BY u.full_name');
}

async function getDoctorsForUser(user) {
  if (user && user.role === 'doctor') {
    return all('SELECT d.*, u.full_name, u.email, u.ci, u.phone FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.user_id = ? ORDER BY u.full_name', [user.id]);
  }
  return getDoctors();
}

function canEditDoctor(user, doctor) {
  return user && doctor && (user.role === 'admin' || (user.role === 'doctor' && doctor.user_id === user.id));
}

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('home', { title: 'Cuidado dental sin esperas' });
});

app.get('/login', (req, res) => {
  res.render('login', { error: '', title: 'Iniciar sesión' });
});

app.post('/login', loginLimiter, async (req, res) => {
  const { ci, password } = req.body;

  const user = await get('SELECT * FROM users WHERE ci = ?', [ci]);
  if (!user) {
    return res.render('login', { error: 'Cédula no registrada.', title: 'Iniciar sesión' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.render('login', { error: 'Credenciales incorrectas.', title: 'Iniciar sesión' });
  }

  req.session.user = {
    id: user.id,
    full_name: user.full_name,
    ci: user.ci,
    email: user.email,
    role: user.role
  };

  res.redirect('/dashboard');
});

app.get('/register', (req, res) => {
  res.render('register', { error: '', title: 'Registro' });
});

app.post('/register', async (req, res) => {
  const { first_name, last_name, ci, email, phone, password } = req.body;

  if (!first_name || !last_name || !ci || !email || !phone || !password) {
    return res.render('register', { error: 'Todos los campos obligatorios deben llenarse.', title: 'Registro' });
  }

  const existing = await get('SELECT id FROM users WHERE ci = ? OR email = ?', [ci, email]);
  if (existing) {
    return res.render('register', { error: 'La cédula o el correo ya están registrados.', title: 'Registro' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = await run(
    'INSERT INTO users (full_name, ci, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)',
    [`${first_name} ${last_name}`, ci, email, phone, passwordHash, 'patient']
  );

  await run(
    'INSERT INTO patients (user_id, carnet, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)',
    [newUser.id, ci, first_name, last_name, phone]
  );

  req.session.user = {
    id: newUser.id,
    full_name: `${first_name} ${last_name}`,
    ci,
    email,
    role: 'patient'
  };

  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const user = req.session.user;
  const doctors = await getDoctorsForUser(user);
  const appointments = await all(`
    SELECT a.*, COALESCE(pr.first_name || ' ' || pr.last_name, p.full_name) AS patient_name, d.full_name AS doctor_name
    FROM appointments a
    JOIN users p ON p.id = a.patient_id
    LEFT JOIN patients pr ON pr.id = a.patient_record_id
    JOIN doctors doc ON doc.id = a.doctor_id
    JOIN users d ON d.id = doc.user_id
    WHERE pr.user_id = ? OR a.patient_id = ? OR doc.user_id = ?
    ORDER BY a.appointment_date, a.appointment_time
  `, [user.id, user.id, user.id]);

  const notifications = await all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [user.id]);

  let analytics = null;
  if (user.role === 'admin') {
    const appointmentsByDay = await all(`
      SELECT appointment_date, COUNT(*) AS total
      FROM appointments
      GROUP BY appointment_date
      ORDER BY appointment_date DESC
      LIMIT 14
    `);
    const appointmentsByDoctor = await all(`
      SELECT d.full_name AS doctor_name, COUNT(a.id) AS total
      FROM appointments a
      JOIN doctors doc ON doc.id = a.doctor_id
      JOIN users d ON d.id = doc.user_id
      GROUP BY a.doctor_id
      ORDER BY total DESC, doctor_name ASC
    `);
    const appointmentsByHour = await all(`
      SELECT appointment_time, COUNT(*) AS total
      FROM appointments
      GROUP BY appointment_time
      ORDER BY total DESC, appointment_time ASC
    `);
    const totalAppointments = await get('SELECT COUNT(*) AS total FROM appointments');
    const topDoctor = appointmentsByDoctor[0] || null;

    analytics = {
      appointmentsByDay: appointmentsByDay.reverse(),
      appointmentsByDoctor,
      appointmentsByHour,
      totalAppointments: totalAppointments.total,
      topDoctor
    };
  }

  res.render('dashboard', {
    user,
    doctors,
    appointments,
    notifications,
    analytics,
    title: 'Dashboard'
  });
});

app.get('/doctors', async (req, res) => {
  const doctors = await getDoctorsForUser(req.session.user);
  res.render('doctors', { doctors, user: req.session.user, title: 'Doctores' });
});

app.get('/schedules', async (req, res) => {
  const doctors = await getDoctorsForUser(req.session.user);
  const selectedDoctorId = req.query.doctor_id || (doctors[0] && String(doctors[0].id));
  const selectedDate = req.query.date || new Date().toISOString().slice(0, 10);
  const selectedDoctor = doctors.find(doctor => String(doctor.id) === String(selectedDoctorId));
  let slots = [];

  if (selectedDoctor) {
    const appointments = await all(
      'SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ?',
      [selectedDoctor.id, selectedDate]
    );
    const availability = parseAvailability(selectedDoctor.availability);
    slots = isAvailableDate(selectedDate, availability)
      ? generateDoctorSlots({ ...availability, duration: 30, existing: appointments.map(appointment => appointment.appointment_time) })
      : [];
  }

  res.render('schedules', {
    doctors,
    selectedDoctor,
    selectedDoctorId,
    selectedDate,
    slots,
    user: req.session.user,
    title: 'Horarios'
  });
});

app.get('/doctor/register', requireRole('admin'), async (req, res) => {
  res.render('doctor-register', { error: '', success: '', title: 'Registro de odontólogo' });
});

app.post('/doctor/register', requireRole('admin'), async (req, res) => {
  const { first_name, last_name, ci, email, phone, password, specialty, bio, experience_years, availability } = req.body;

  if (!first_name || !last_name || !ci || !email || !password || !specialty) {
    return res.render('doctor-register', { error: 'Completa los datos de acceso y la especialidad.', success: '', title: 'Registro de odontólogo' });
  }

  const existing = await get('SELECT id FROM users WHERE ci = ? OR email = ?', [ci, email]);
  if (existing) {
    return res.render('doctor-register', {
      error: 'La cédula o el correo ya están registrados.',
      success: '',
      title: 'Registro de odontólogo'
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const doctorUser = await run(
    'INSERT INTO users (full_name, ci, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)',
    [`${first_name} ${last_name}`, ci, email, phone || '', passwordHash, 'doctor']
  );

  await run(
    'INSERT INTO doctors (user_id, specialty, bio, availability, experience_years) VALUES (?, ?, ?, ?, ?)',
    [doctorUser.id, specialty, bio || '', availability || '', Number(experience_years || 0)]
  );

  res.render('doctor-register', {
    error: '',
    success: 'Perfil de odontólogo registrado correctamente.',
    title: 'Registro de odontólogo'
  });
});

app.get('/doctors/:id/edit', requireAuth, async (req, res) => {
  const doctor = await get(`
    SELECT d.*, u.full_name, u.email, u.ci, u.phone
    FROM doctors d
    JOIN users u ON u.id = d.user_id
    WHERE d.id = ?
  `, [req.params.id]);

  if (!canEditDoctor(req.session.user, doctor)) {
    return res.redirect('/doctors');
  }

  res.render('doctor-edit', { doctor, user: req.session.user, error: '', success: '', title: 'Editar doctor' });
});

app.post('/doctors/:id/edit', requireAuth, async (req, res) => {
  const doctor = await get('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
  const { full_name, email, phone, specialty, bio, experience_years, availability, password } = req.body;

  if (!canEditDoctor(req.session.user, doctor)) {
    return res.redirect('/doctors');
  }

  if (!full_name || !email || !specialty) {
    const currentDoctor = await get(`
      SELECT d.*, u.full_name, u.email, u.ci, u.phone
      FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?
    `, [req.params.id]);
    return res.render('doctor-edit', { doctor: currentDoctor, user: req.session.user, error: 'Nombre, correo y especialidad son obligatorios.', success: '', title: 'Editar doctor' });
  }

  await run('UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?', [full_name, email, phone || '', doctor.user_id]);
  await run(
    'UPDATE doctors SET specialty = ?, bio = ?, availability = ?, experience_years = ? WHERE id = ?',
    [specialty, bio || '', availability || '', Number(experience_years || 0), doctor.id]
  );

  if (password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await run('UPDATE users SET password = ? WHERE id = ?', [passwordHash, doctor.user_id]);
  }

  if (req.session.user.id === doctor.user_id) {
    req.session.user.full_name = full_name;
    req.session.user.email = email;
  }

  const updatedDoctor = await get(`
    SELECT d.*, u.full_name, u.email, u.ci, u.phone
    FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?
  `, [doctor.id]);
  res.render('doctor-edit', { doctor: updatedDoctor, user: req.session.user, error: '', success: 'Datos del doctor actualizados correctamente.', title: 'Editar doctor' });
});

app.get('/appointments/new', requireAuth, async (req, res) => {
  const doctors = await getDoctorsForUser(req.session.user);
  const patients = await all('SELECT * FROM patients ORDER BY last_name, first_name');
  res.render('appointments-new', { doctors, patients, user: req.session.user, error: '', success: '', title: 'Nueva cita' });
});

app.post('/appointments/:id/cancel', requireRole('doctor'), async (req, res) => {
  const appointment = await get(`
    SELECT a.*, d.user_id AS doctor_user_id, du.full_name AS doctor_name,
      p.full_name AS patient_name, p.email AS patient_email
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    JOIN users du ON du.id = d.user_id
    JOIN users p ON p.id = a.patient_id
    WHERE a.id = ?
  `, [req.params.id]);

  if (!appointment || appointment.doctor_user_id !== req.session.user.id) {
    return res.redirect('/dashboard');
  }
  if (appointment.status === 'cancelled') {
    return res.redirect('/dashboard');
  }

  const reason = String(req.body.reason || '').trim().slice(0, 300);
  await run('UPDATE appointments SET status = ?, notes = ? WHERE id = ?', ['cancelled', reason || 'Cancelada por el doctor.', appointment.id]);
  await run(
    'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
    [appointment.patient_id, 'appointment_cancelled', `El doctor ${appointment.doctor_name} canceló tu cita del ${appointment.appointment_date} a las ${appointment.appointment_time}.${reason ? ` Motivo: ${reason}` : ''}`]
  );
  await sendAppointmentCancellationEmail({
    patientEmail: appointment.patient_email,
    patientName: appointment.patient_name,
    doctorName: appointment.doctor_name,
    date: appointment.appointment_date,
    time: appointment.appointment_time,
    treatment: appointment.treatment,
    reason
  });

  res.redirect('/dashboard');
});

app.post('/appointments/new', requireAuth, async (req, res) => {
  const { doctor_id, patient_id, patient_carnet, first_name, last_name, phone, patient_email, appointment_date, appointment_time, treatment } = req.body;
  const user = req.session.user;

  const doctors = await getDoctorsForUser(user);
  const renderForm = (error, success = '') => all('SELECT * FROM patients ORDER BY last_name, first_name')
    .then(patients => res.render('appointments-new', { doctors, patients, user, error, success, title: 'Nueva cita' }));

  if (!doctor_id || !appointment_date || !appointment_time || !treatment) {
    return renderForm('Completa el doctor, paciente, fecha, hora y motivo de la cita.');
  }

  const doctor = await get(`
    SELECT d.*, u.full_name AS doctor_name, u.email AS doctor_email
    FROM doctors d
    JOIN users u ON u.id = d.user_id
    WHERE d.id = ?
  `, [doctor_id]);

  if (!doctor) {
    return renderForm('El doctor seleccionado no existe.');
  }

  if (user.role === 'doctor' && doctor.user_id !== user.id) {
    return renderForm('Solo puedes registrar citas en tu propia agenda.');
  }

  let patient;
  if (patient_id) {
    patient = await get('SELECT * FROM patients WHERE id = ?', [patient_id]);
    if (user.role === 'patient' && (!patient || patient.user_id !== user.id)) {
      return renderForm('Solo puedes agendar una cita para tu propia ficha.');
    }
  } else if (user.role === 'patient') {
    patient = await get('SELECT * FROM patients WHERE user_id = ?', [user.id]);
  } else if (patient_carnet && first_name && last_name && phone && patient_email) {
    patient = await get('SELECT * FROM patients WHERE carnet = ?', [patient_carnet]);
    if (!patient) {
      const generatedPassword = await bcrypt.hash(`${patient_carnet}-${Date.now()}`, 10);
      const patientUser = await run(
        'INSERT INTO users (full_name, ci, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)',
        [`${first_name} ${last_name}`, patient_carnet, patient_email, phone, generatedPassword, 'patient']
      );
      const newPatient = await run(
        'INSERT INTO patients (user_id, carnet, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)',
        [patientUser.id, patient_carnet, first_name, last_name, phone]
      );
      patient = await get('SELECT * FROM patients WHERE id = ?', [newPatient.id]);
    }
  }

  if (!patient) {
    return renderForm('Selecciona un paciente o registra carnet, nombre, apellido, celular y correo.');
  }

  const patientAccount = patient.user_id
    ? await get('SELECT email FROM users WHERE id = ?', [patient.user_id])
    : null;

  const existingAppointments = await all(
    'SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ?',
    [doctor_id, appointment_date]
  );

  const existingTimes = existingAppointments.map(item => item.appointment_time);
  const availability = parseAvailability(doctor.availability);
  const slots = isAvailableDate(date, availability)
    ? generateDoctorSlots({ ...availability, duration: 30, existing: existingTimes })
    : [];

  if (!slots.includes(appointment_time)) {
    return renderForm('El horario seleccionado ya no está disponible o no pertenece a la agenda del doctor.');
  }

  await run(
    'INSERT INTO appointments (patient_id, patient_record_id, doctor_id, appointment_date, appointment_time, treatment, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [patient.user_id || user.id, patient.id, doctor_id, appointment_date, appointment_time, treatment, 'pending']
  );

  await run('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [doctor.user_id, 'appointment', `Nueva cita para ${patient.first_name} ${patient.last_name} el ${appointment_date} a las ${appointment_time}.`]);

  const emailSent = await sendAppointmentEmail({
    doctorEmail: doctor.doctor_email,
    doctorName: doctor.doctor_name,
    patientEmail: patientAccount && patientAccount.email,
    patientName: `${patient.first_name} ${patient.last_name}`,
    date: appointment_date,
    time: appointment_time,
    treatment
  });

  const doctorsList = doctors;
  const patients = await all('SELECT * FROM patients ORDER BY last_name, first_name');
  res.render('appointments-new', {
    doctors: doctorsList,
    patients,
    user,
    error: '',
    success: emailSent
      ? `Cita agendada y notificaciones enviadas al doctor y al paciente.`
      : `Cita agendada, pero no se pudieron enviar todas las notificaciones. Revisa la configuración de correo.`,
    title: 'Nueva cita'
  });
});

app.get('/api/doctors/:id/availability', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.json({ slots: [] });
  }

  const doctor = await get('SELECT * FROM doctors WHERE id = ?', [id]);
  if (!doctor) {
    return res.json({ slots: [] });
  }

  if (req.session.user.role === 'doctor' && doctor.user_id !== req.session.user.id) {
    return res.status(403).json({ slots: [], error: 'No puedes consultar la agenda de otro doctor.' });
  }

  const existingAppointments = await all(
    'SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ?',
    [id, date]
  );

  const existingTimes = existingAppointments.map(item => item.appointment_time);
  const availability = parseAvailability(doctor.availability);
  const slots = isAvailableDate(date, availability)
    ? generateDoctorSlots({ ...availability, duration: 30, existing: existingTimes })
    : [];

  res.json({ slots });
});

app.get('/api/doctors', requireAuth, async (req, res) => {
  const doctors = await all('SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON u.id = d.user_id');
  res.json(doctors);
});

app.use((error, req, res, next) => {
  console.error('Error de servidor:', error.message);
  if (res.headersSent) return next(error);
  res.status(500).send(isProduction ? 'Ocurrió un error interno.' : `Error interno: ${error.message}`);
});

initDatabase().then(ensureAdmin).then(async () => {
  await verifyMailer();
  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('Error al inicializar la base de datos:', error);
  process.exit(1);
});
