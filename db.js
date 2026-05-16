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
          .then(() => seedDatabase())
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
        unique_id TEXT,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        contact TEXT NOT NULL,
        room_number TEXT,
        visit_fee REAL DEFAULT 0,
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
  return new Promise((resolve, reject) => {
    const columnsToAdd = [
      { name: 'unique_id', type: 'TEXT' },
      { name: 'room_number', type: 'TEXT' },
      { name: 'visit_fee', type: 'REAL DEFAULT 0' }
    ];

    let processed = 0;
    if (columnsToAdd.length === 0) return resolve();

    columnsToAdd.forEach(col => {
      db.run(`ALTER TABLE doctors ADD COLUMN ${col.name} ${col.type}`, (err) => {
        // Ignore error if column already exists
        processed++;
        if (processed === columnsToAdd.length) {
          resolve();
        }
      });
    });
  });
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

function seedDatabase() {
  return new Promise((resolve, reject) => {
    // Check if doctors table is empty
    db.get("SELECT COUNT(*) as count FROM doctors", [], (err, row) => {
      if (err) return reject(err);
      if (row.count > 0) return resolve(); // Already seeded

      console.log("🌱 Seeding database with sample data...");

      const doctors = [
        ["DOC001", "Dr. Sarah Hasan", "Cardiology", "01711223344", "Room 302", 1000, "Sat-Thu: 4PM-9PM"],
        ["DOC002", "Dr. Kamal Ahmed", "Neurology", "01822334455", "Room 405", 1200, "Mon-Fri: 5PM-8PM"],
        ["DOC003", "Dr. Nusrat Jahan", "Gynecology", "01933445566", "Room 201", 800, "Sun-Wed: 10AM-2PM"],
        ["DOC004", "Dr. Sarah Hasan", "Pediatrics", "01544556677", "Room 105", 700, "Everyday: 3PM-6PM"],
        ["DOC005", "Dr. Rafiqul Islam", "Orthopedics", "01355667788", "Room 502", 1500, "Sat, Mon, Wed: 6PM-10PM"]
      ];

      const patients = [
        ["Abidur Rahman", 35, "male", "01700000001", "Dhaka, Bangladesh", "None"],
        ["Farhana Yeasmin", 28, "female", "01700000002", "Chittagong, Bangladesh", "Allergy to Dust"],
        ["Sabbir Hossain", 45, "male", "01700000003", "Sylhet, Bangladesh", "High Blood Pressure"],
        ["Mitu Akter", 22, "female", "01700000004", "Rajshahi, Bangladesh", "None"],
        ["Zakir Khan", 60, "male", "01700000005", "Khulna, Bangladesh", "Diabetes"]
      ];

      const tests = [
        ["CBC", "Blood", 500, "Complete Blood Count"],
        ["X-Ray Chest", "Radiology", 800, "Chest X-Ray PA View"],
        ["ECG", "Cardiology", 600, "Electrocardiogram"],
        ["Blood Sugar", "Blood", 200, "Fasting and PP Blood Sugar"],
        ["MRI Brain", "Radiology", 5000, "Magnetic Resonance Imaging of Brain"]
      ];

      db.serialize(() => {
        doctors.forEach(doc => {
          db.run(`INSERT INTO doctors (unique_id, name, specialty, contact, room_number, visit_fee, schedule) VALUES (?, ?, ?, ?, ?, ?, ?)`, doc);
        });

        patients.forEach(pat => {
          db.run(`INSERT INTO patients (name, age, gender, contact, address, medical_history) VALUES (?, ?, ?, ?, ?, ?)`, pat);
        });

        tests.forEach(test => {
          db.run(`INSERT INTO tests (name, category, price, description) VALUES (?, ?, ?, ?)`, test);
        });

        console.log("✅ Seeding complete");
        resolve();
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
