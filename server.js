const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { initDatabase, run, get, all } = require('./src/db');
const { generateDoctorSlots, calculateEndTime } = require('./src/schedule');
const { sendAppointmentEmail } = require('./src/mailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'citas-medicas-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

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

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { error: '', title: 'Iniciar sesión' });
});

app.post('/login', async (req, res) => {
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
  const { full_name, ci, email, phone, password } = req.body;

  if (!full_name || !ci || !email || !password) {
    return res.render('register', { error: 'Todos los campos obligatorios deben llenarse.', title: 'Registro' });
  }

  const existing = await get('SELECT id FROM users WHERE ci = ? OR email = ?', [ci, email]);
  if (existing) {
    return res.render('register', { error: 'La cédula o el correo ya están registrados.', title: 'Registro' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = await run(
    'INSERT INTO users (full_name, ci, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)',
    [full_name, ci, email, phone, passwordHash, 'patient']
  );

  req.session.user = {
    id: newUser.id,
    full_name,
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
  const doctors = await all('SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON u.id = d.user_id ORDER BY u.full_name');
  const appointments = await all(`
    SELECT a.*, p.full_name AS patient_name, d.full_name AS doctor_name
    FROM appointments a
    JOIN users p ON p.id = a.patient_id
    JOIN doctors doc ON doc.id = a.doctor_id
    JOIN users d ON d.id = doc.user_id
    WHERE a.patient_id = ? OR doc.user_id = ?
    ORDER BY a.appointment_date, a.appointment_time
  `, [user.id, user.id]);

  const notifications = await all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [user.id]);

  res.render('dashboard', {
    user,
    doctors,
    appointments,
    notifications,
    title: 'Dashboard'
  });
});

app.get('/doctor/register', requireAuth, async (req, res) => {
  res.render('doctor-register', { error: '', success: '', title: 'Registro de odontólogo' });
});

app.post('/doctor/register', requireAuth, async (req, res) => {
  const { specialty, bio, experience_years, availability } = req.body;
  const user = req.session.user;

  const existing = await get('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
  if (existing) {
    return res.render('doctor-register', {
      error: 'Ya estás registrado como odontólogo en el sistema.',
      success: '',
      title: 'Registro de odontólogo'
    });
  }

  const doctor = await run(
    'INSERT INTO doctors (user_id, specialty, bio, availability, experience_years) VALUES (?, ?, ?, ?, ?)',
    [user.id, specialty, bio, availability, Number(experience_years || 0)]
  );

  await run('UPDATE users SET role = ? WHERE id = ?', ['doctor', user.id]);
  req.session.user.role = 'doctor';

  res.render('doctor-register', {
    error: '',
    success: 'Perfil de odontólogo registrado correctamente.',
    title: 'Registro de odontólogo'
  });
});

app.get('/appointments/new', requireAuth, async (req, res) => {
  const doctors = await all('SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON u.id = d.user_id ORDER BY u.full_name');
  res.render('appointments-new', { doctors, error: '', success: '', title: 'Nueva cita' });
});

app.post('/appointments/new', requireAuth, async (req, res) => {
  const { doctor_id, appointment_date, appointment_time, treatment } = req.body;
  const user = req.session.user;

  if (!doctor_id || !appointment_date || !appointment_time || !treatment) {
    const doctors = await all('SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON u.id = d.user_id ORDER BY u.full_name');
    return res.render('appointments-new', { doctors, error: 'Todos los campos son obligatorios, incluyendo el horario disponible.', success: '', title: 'Nueva cita' });
  }

  const doctor = await get(`
    SELECT d.*, u.full_name AS doctor_name, u.email AS doctor_email
    FROM doctors d
    JOIN users u ON u.id = d.user_id
    WHERE d.id = ?
  `, [doctor_id]);

  if (!doctor) {
    const doctors = await all('SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON u.id = d.user_id ORDER BY u.full_name');
    return res.render('appointments-new', { doctors, error: 'El odontólogo seleccionado no existe.', success: '', title: 'Nueva cita' });
  }

  const existingAppointments = await all(
    'SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ?',
    [doctor_id, appointment_date]
  );

  const existingTimes = existingAppointments.map(item => item.appointment_time);
  const slots = generateDoctorSlots({
    startHour: 9,
    endHour: 17,
    duration: 30,
    lunchStart: 13,
    lunchEnd: 14,
    existing: existingTimes
  });

  if (!slots.includes(appointment_time)) {
    const doctors = await all('SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON u.id = d.user_id ORDER BY u.full_name');
    return res.render('appointments-new', { doctors, error: 'El horario seleccionado ya no está disponible o no pertenece a la agenda del odontólogo.', success: '', title: 'Nueva cita' });
  }

  await run(
    'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, treatment, status) VALUES (?, ?, ?, ?, ?, ?)',
    [user.id, doctor_id, appointment_date, appointment_time, treatment, 'pending']
  );

  await run('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [doctor.user_id, 'appointment', `Nueva cita para ${user.full_name} el ${appointment_date} a las ${appointment_time}.`]);

  await sendAppointmentEmail({
    doctorEmail: doctor.doctor_email,
    doctorName: doctor.doctor_name,
    patientName: user.full_name,
    date: appointment_date,
    time: appointment_time,
    treatment
  });

  const doctorsList = await all('SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON u.id = d.user_id ORDER BY u.full_name');
  res.render('appointments-new', {
    doctors: doctorsList,
    error: '',
    success: `Cita agendada exitosamente para el ${appointment_date} a las ${appointment_time}.`,
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

  const existingAppointments = await all(
    'SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ?',
    [id, date]
  );

  const existingTimes = existingAppointments.map(item => item.appointment_time);
  const slots = generateDoctorSlots({
    startHour: 9,
    endHour: 17,
    duration: 30,
    lunchStart: 13,
    lunchEnd: 14,
    existing: existingTimes
  });

  res.json({ slots });
});

app.get('/api/doctors', requireAuth, async (req, res) => {
  const doctors = await all('SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON u.id = d.user_id');
  res.json(doctors);
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('Error al inicializar la base de datos:', error);
  process.exit(1);
});
