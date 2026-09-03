const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dbDir, 'app.db'));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function initDatabase() {
  return Promise.all([
    run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        ci TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'patient',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `),
    run(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        specialty TEXT NOT NULL,
        bio TEXT,
        availability TEXT,
        experience_years INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `),
    run(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        patient_record_id INTEGER,
        doctor_id INTEGER NOT NULL,
        appointment_date TEXT NOT NULL,
        appointment_time TEXT NOT NULL,
        treatment TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES users(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
      )
    `),
    run(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        carnet TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `),
    run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `)
  ]).then(async () => {
    const appointmentColumns = await all('PRAGMA table_info(appointments)');
    if (!appointmentColumns.some(column => column.name === 'patient_record_id')) {
      await run('ALTER TABLE appointments ADD COLUMN patient_record_id INTEGER');
    }

    const patientUsers = await all(`
      SELECT u.* FROM users u
      LEFT JOIN patients p ON p.user_id = u.id
      WHERE u.role = 'patient' AND p.id IS NULL
    `);
    for (const user of patientUsers) {
      const nameParts = user.full_name.trim().split(/\s+/);
      const firstName = nameParts.shift() || user.full_name;
      const lastName = nameParts.join(' ') || firstName;
      await run(
        'INSERT OR IGNORE INTO patients (user_id, carnet, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)',
        [user.id, user.ci, firstName, lastName, user.phone || 'Sin celular']
      );
    }
  });
}

module.exports = {
  db,
  initDatabase,
  run,
  get,
  all
};
