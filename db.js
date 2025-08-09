const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

function connectDB() {
  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(__dirname, 'hospital_management.sqlite3');

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Database connection failed:", err);
        reject(err);
        return;
      }
      console.log("✅ Connected to SQLite database");

      db.serialize(() => {
        createTables()
          .then(() => runMigrations())
          .then(() => createDefaultUsers())
          .then(() => {
            console.log("✅ Database setup complete");
            resolve();
          })
          .catch((err) => {
            console.error("❌ Database setup failed:", err);
            reject(err);
          });
      });
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        contact TEXT NOT NULL,
        address TEXT NOT NULL,
        medical_history TEXT,
        emergency_contact TEXT,
        blood_group TEXT,
        allergies TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        contact TEXT NOT NULL,
        schedule TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Advanced billing tables
      `CREATE TABLE IF NOT EXISTS advanced_bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        billing_date DATE NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0,
        discount_type TEXT DEFAULT 'amount',
        discount_value REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        due_amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_price REAL NOT NULL,
        test_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES advanced_bills(id) ON DELETE CASCADE,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL
      )`,

      `CREATE TABLE IF NOT EXISTS bill_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES advanced_bills(id) ON DELETE CASCADE
      )`,

      // Notifications table
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,

      // Audit logs
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id INTEGER,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`
    ];

    let completed = 0;
    const total = tables.length;

    tables.forEach((sql) => {
      db.run(sql, (err) => {
        if (err) {
          console.error("Error creating table:", err);
          reject(err);
          return;
        }
        completed++;
        if (completed === total) {
          resolve();
        }
      });
    });
  });
}


function runMigrations() {
  return Promise.resolve();
}

function createDefaultUsers() {
  return new Promise((resolve, reject) => {
    const crypto = require("crypto");

    const defaultUsers = [
      {
        name: "System Administrator",
        email: "admin@hospital.com",
        password: crypto.createHash("sha256").update("admin123").digest("hex"),
        role: "admin",
      },
      {
        name: "Dr. John Smith",
        email: "doctor@hospital.com",
        password: crypto.createHash("sha256").update("doctor123").digest("hex"),
        role: "doctor",
      },
      {
        name: "Reception Staff",
        email: "reception@hospital.com",
        password: crypto.createHash("sha256").update("reception123").digest("hex"),
        role: "receptionist",
      },
      {
        name: "John Doe",
        email: "patient@hospital.com",
        password: crypto.createHash("sha256").update("patient123").digest("hex"),
        role: "patient",
      },
    ];

    let completed = 0;
    const total = defaultUsers.length;

    defaultUsers.forEach((user) => {
      const sql = `INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`;
      db.run(sql, [user.name, user.email, user.password, user.role], (err) => {
        if (err) {
          console.error("Error creating default user:", err);
          reject(err);
          return;
        }
        completed++;
        if (completed === total) {
          resolve();
        }
      });
    });
  });
}

function getDB() {
  return db;
}

module.exports = {
  connectDB,
  getDB,
};
