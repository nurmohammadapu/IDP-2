const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require("util");

// Enable node.js utility promisify compatibility for database run calls
sqlite3.Database.prototype.run[promisify.custom] = function (sql, params) {
  return new Promise((resolve, reject) => {
    this.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

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
      db.run("PRAGMA foreign_keys = ON;");

      db.serialize(() => {
        createTables()
          .then(() => runMigrations())
          .then(() => createDefaultUsers())
          .then(() => seedDatabase())
          .then(() => syncUserTables())
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
        status TEXT DEFAULT 'active',
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
        user_id INTEGER UNIQUE,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        contact TEXT UNIQUE NOT NULL,
        address TEXT NOT NULL,
        medical_history TEXT,
        emergency_contact TEXT,
        blood_group TEXT,
        allergies TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        unique_id TEXT UNIQUE,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        contact TEXT UNIQUE NOT NULL,
        room_number TEXT,
        visit_fee REAL DEFAULT 0,
        schedule TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        serial_number INTEGER DEFAULT 0,
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
        doctor_id INTEGER,
        created_by INTEGER,
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
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
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
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES advanced_bills(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
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
    const doctorColumns = [
      { table: 'doctors', name: 'unique_id', type: 'TEXT' },
      { table: 'doctors', name: 'room_number', type: 'TEXT' },
      { table: 'doctors', name: 'visit_fee', type: 'REAL DEFAULT 0' }
    ];

    const userProfileColumns = [
      { table: 'users', name: 'phone', type: 'TEXT' },
      { table: 'users', name: 'address', type: 'TEXT' },
      { table: 'users', name: 'date_of_birth', type: 'TEXT' },
      { table: 'users', name: 'gender', type: 'TEXT' },
      { table: 'users', name: 'blood_group', type: 'TEXT' },
      { table: 'users', name: 'emergency_contact', type: 'TEXT' },
      { table: 'users', name: 'emergency_contact_name', type: 'TEXT' },
      { table: 'users', name: 'city', type: 'TEXT' },
      { table: 'users', name: 'state', type: 'TEXT' },
      { table: 'users', name: 'zip_code', type: 'TEXT' },
      { table: 'users', name: 'bio', type: 'TEXT' }
    ];

    const extraColumns = [
      { table: 'users', name: 'status', type: "TEXT DEFAULT 'active'" },
      { table: 'patients', name: 'user_id', type: 'INTEGER' },
      { table: 'doctors', name: 'user_id', type: 'INTEGER' },
      { table: 'appointments', name: 'serial_number', type: 'INTEGER DEFAULT 0' },
      { table: 'advanced_bills', name: 'created_by', type: 'INTEGER' },
      { table: 'advanced_bills', name: 'doctor_id', type: 'INTEGER' },
      { table: 'bill_payments', name: 'created_by', type: 'INTEGER' },
      { table: 'advanced_bills', name: 'appointment_id', type: 'INTEGER' }
    ];

    const allColumns = [...doctorColumns, ...userProfileColumns, ...extraColumns];

    let processed = 0;
    const checkCompletion = () => {
      processed++;
      if (processed === allColumns.length) {
        createUniqueIndexes().then(resolve).catch(reject);
      }
    };

    if (allColumns.length === 0) {
      createUniqueIndexes().then(resolve).catch(reject);
      return;
    }

    allColumns.forEach(col => {
      db.run(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.type}`, (err) => {
        // Ignore error if column already exists
        checkCompletion();
      });
    });
  });
}

function createUniqueIndexes() {
  return new Promise((resolve) => {
    // First, clean up any duplicate phone numbers in users table to prevent UNIQUE constraint failures during migration
    db.run(`
      UPDATE users
      SET phone = phone || '-' || id
      WHERE id IN (
        SELECT u1.id
        FROM users u1
        JOIN users u2 ON u1.phone = u2.phone AND u1.id > u2.id
        WHERE u1.phone IS NOT NULL AND u1.phone != ''
      )
    `, (cleanupErr) => {
      if (cleanupErr) {
        console.error("Warning: Error cleaning up duplicate user phone numbers:", cleanupErr);
      }

      const indexes = [
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_contact ON patients(contact)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_unique_id ON doctors(unique_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_contact ON doctors(contact)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL AND phone != ''"
      ];

      let completed = 0;
      if (indexes.length === 0) return resolve();

      indexes.forEach(sql => {
        db.run(sql, (err) => {
          if (err) {
            console.warn("Migration warning (index creation):", err.message);
          }
          completed++;
          if (completed === indexes.length) {
            resolve();
          }
        });
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
        status: "active"
      },
      {
        name: "Dr. John Smith",
        email: "doctor@hospital.com",
        password: crypto.createHash("sha256").update("doctor123").digest("hex"),
        role: "doctor",
        status: "active"
      },
      {
        name: "Reception Staff",
        email: "reception@hospital.com",
        password: crypto.createHash("sha256").update("reception123").digest("hex"),
        role: "receptionist",
        status: "active"
      },
      {
        name: "John Doe",
        email: "patient@hospital.com",
        password: crypto.createHash("sha256").update("patient123").digest("hex"),
        role: "patient",
        status: "active"
      },
      {
        name: "Accountant Staff",
        email: "accountant@hospital.com",
        password: crypto.createHash("sha256").update("accountant123").digest("hex"),
        role: "accountant",
        status: "active",
        phone: "01700000222"
      }
    ];

    let completed = 0;
    const total = defaultUsers.length;

    const setupLinks = () => {
      db.get("SELECT id FROM users WHERE email = 'doctor@hospital.com'", [], (err, doctorUser) => {
        if (doctorUser) {
          db.run(
            `INSERT OR IGNORE INTO doctors (user_id, unique_id, name, specialty, contact, room_number, visit_fee, schedule)
             VALUES (?, 'DOC999', 'Dr. John Smith', 'General Medicine', '01700000000', 'Room 101', 500, 'Sat-Wed: 9AM-5PM')`,
            [doctorUser.id],
            (err) => {
              if (err) console.error("Error creating default doctor link:", err);
              db.run("UPDATE doctors SET user_id = ? WHERE contact = '01700000000' AND user_id IS NULL", [doctorUser.id]);
            }
          );
        }

        db.get("SELECT id FROM users WHERE email = 'patient@hospital.com'", [], (err, patientUser) => {
          if (patientUser) {
            db.run(
              `INSERT OR IGNORE INTO patients (user_id, name, age, gender, contact, address, medical_history)
               VALUES (?, 'John Doe', 30, 'male', '01700000111', 'Dhaka, Bangladesh', 'None')`,
              [patientUser.id],
              (err) => {
                if (err) console.error("Error creating default patient link:", err);
                db.run("UPDATE patients SET user_id = ? WHERE contact = '01700000111' AND user_id IS NULL", [patientUser.id]);
              }
            );
          }
          resolve();
        });
      });
    };

    defaultUsers.forEach((user) => {
      const sql = `INSERT OR IGNORE INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)`;
      db.run(sql, [user.name, user.email, user.password, user.role, user.status], (err) => {
        if (err) {
          console.error("Error creating default user:", err);
          reject(err);
          return;
        }
        completed++;
        if (completed === total) {
          setupLinks();
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

function syncUserTables() {
  return new Promise((resolve) => {
    db.serialize(() => {
      // Back-sync phone from patients/doctors to users if null
      db.run(`
        UPDATE users
        SET phone = (SELECT contact FROM patients WHERE patients.user_id = users.id)
        WHERE (phone IS NULL OR phone = '') AND EXISTS (SELECT 1 FROM patients WHERE patients.user_id = users.id AND contact IS NOT NULL AND contact != '')
      `, (err) => {
        if (err) console.error("Error back-syncing patient contacts to users:", err);
      });

      db.run(`
        UPDATE users
        SET phone = (SELECT contact FROM doctors WHERE doctors.user_id = users.id)
        WHERE (phone IS NULL OR phone = '') AND EXISTS (SELECT 1 FROM doctors WHERE doctors.user_id = users.id AND contact IS NOT NULL AND contact != '')
      `, (err) => {
        if (err) console.error("Error back-syncing doctor contacts to users:", err);
      });

      // Sync patient records with user profile updates
      db.run(`
        UPDATE patients
        SET 
          name = COALESCE((SELECT name FROM users WHERE users.id = patients.user_id), name),
          gender = COALESCE((SELECT gender FROM users WHERE users.id = patients.user_id), gender),
          address = COALESCE((SELECT address FROM users WHERE users.id = patients.user_id), address),
          emergency_contact = COALESCE((SELECT emergency_contact FROM users WHERE users.id = patients.user_id), emergency_contact),
          blood_group = COALESCE((SELECT blood_group FROM users WHERE users.id = patients.user_id), blood_group)
        WHERE user_id IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE users.id = patients.user_id)
      `, (err) => {
        if (err) console.error("Error syncing patient records on startup:", err);
      });

      // Sync doctor records with user profile updates
      db.run(`
        UPDATE doctors
        SET
          name = COALESCE((SELECT name FROM users WHERE users.id = doctors.user_id), name),
          contact = COALESCE((SELECT phone FROM users WHERE users.id = doctors.user_id), contact)
        WHERE user_id IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE users.id = doctors.user_id)
      `, (err) => {
        if (err) console.error("Error syncing doctor records on startup:", err);
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
