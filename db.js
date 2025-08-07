const mysql = require("mysql")

let connection = null

function connectDB() {
  return new Promise((resolve, reject) => {
    connection = mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "@Apu1234",
      database: "hospital_management",
      charset: "utf8mb4",
    })

    connection.connect((err) => {
      if (err) {
        console.error("Database connection failed:", err)
        reject(err)
        return
      }

      console.log("✅ Connected to MySQL database")

      // Create database schema
      createTables()
        .then(() => {
          console.log("✅ Database schema created/verified")
          return runMigrations()
        })
        .then(() => {
          console.log("✅ Database migrations completed")
          return createDefaultUsers()
        })
        .then(() => {
          console.log("✅ Default users created/verified")
          resolve()
        })
        .catch((error) => {
          console.error("❌ Database setup failed:", error)
          reject(error)
        })
    })
  })
}

function createTables() {
  return new Promise((resolve, reject) => {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'doctor', 'receptionist', 'patient') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Sessions table
      `CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Patients table
      `CREATE TABLE IF NOT EXISTS patients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL,
        gender ENUM('male', 'female', 'other') NOT NULL,
        contact VARCHAR(20) NOT NULL,
        address TEXT NOT NULL,
        medical_history TEXT,
        emergency_contact VARCHAR(20),
        blood_group VARCHAR(5),
        allergies TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Doctors table
      `CREATE TABLE IF NOT EXISTS doctors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        specialty VARCHAR(255) NOT NULL,
        contact VARCHAR(20) NOT NULL,
        schedule TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Appointments table
      `CREATE TABLE IF NOT EXISTS appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        doctor_id INT NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      )`,

      // Tests table
      `CREATE TABLE IF NOT EXISTS tests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Bills table
      `CREATE TABLE IF NOT EXISTS bills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        billing_date DATE NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount_type ENUM('amount', 'percentage') DEFAULT 'amount',
        discount_value DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        payment_method ENUM('cash', 'card', 'mobile_banking', 'bank_transfer') DEFAULT 'cash',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      )`,

      // Bill items table
      `CREATE TABLE IF NOT EXISTS bill_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        item_type ENUM('test', 'service') NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        item_price DECIMAL(10,2) NOT NULL,
        test_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL
      )`,

      // Payments table
      `CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method ENUM('cash', 'card', 'mobile_banking', 'bank_transfer') NOT NULL,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      )`,

      // Audit logs table
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(50) NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        record_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
    ]

    let completed = 0
    const total = tables.length

    tables.forEach((tableSQL) => {
      connection.query(tableSQL, (err) => {
        if (err) {
          console.error("Error creating table:", err)
          reject(err)
          return
        }

        completed++
        if (completed === total) {
          resolve()
        }
      })
    })
  })
}

function runMigrations() {
  return new Promise((resolve, reject) => {
    console.log("🔄 Running database migrations...")

    const migrations = [
      // Add user_id column to doctors table if it doesn't exist
      {
        description: "Add user_id column to doctors table",
        sql: "ALTER TABLE doctors ADD COLUMN user_id INT DEFAULT NULL",
        checkSql: "SHOW COLUMNS FROM doctors LIKE 'user_id'",
      },
      // Add user_id column to patients table if it doesn't exist
      {
        description: "Add user_id column to patients table",
        sql: "ALTER TABLE patients ADD COLUMN user_id INT DEFAULT NULL",
        checkSql: "SHOW COLUMNS FROM patients LIKE 'user_id'",
      },
    ]

    let completed = 0
    const total = migrations.length

    if (total === 0) {
      resolve()
      return
    }

    migrations.forEach((migration) => {
      // First check if the column already exists
      connection.query(migration.checkSql, (err, results) => {
        if (err) {
          console.error(`Error checking migration: ${migration.description}`, err)
          reject(err)
          return
        }

        // If column doesn't exist, run the migration
        if (results.length === 0) {
          console.log(`Running migration: ${migration.description}`)
          connection.query(migration.sql, (err) => {
            if (err) {
              console.error(`Error running migration: ${migration.description}`, err)
              reject(err)
              return
            }

            console.log(`✅ Migration completed: ${migration.description}`)
            completed++
            if (completed === total) {
              // Now add foreign key constraints
              addForeignKeyConstraints().then(resolve).catch(reject)
            }
          })
        } else {
          console.log(`⏭️  Migration skipped (already exists): ${migration.description}`)
          completed++
          if (completed === total) {
            // Now add foreign key constraints
            addForeignKeyConstraints().then(resolve).catch(reject)
          }
        }
      })
    })
  })
}

function addForeignKeyConstraints() {
  return new Promise((resolve, reject) => {
    const constraints = [
      // Add foreign key constraint for doctors.user_id if it doesn't exist
      {
        description: "Add foreign key constraint for doctors.user_id",
        sql: "ALTER TABLE doctors ADD CONSTRAINT fk_doctors_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL",
        checkSql:
          "SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'doctors' AND CONSTRAINT_NAME = 'fk_doctors_user_id'",
      },
      // Add foreign key constraint for patients.user_id if it doesn't exist
      {
        description: "Add foreign key constraint for patients.user_id",
        sql: "ALTER TABLE patients ADD CONSTRAINT fk_patients_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL",
        checkSql:
          "SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'patients' AND CONSTRAINT_NAME = 'fk_patients_user_id'",
      },
    ]

    let completed = 0
    const total = constraints.length

    if (total === 0) {
      resolve()
      return
    }

    constraints.forEach((constraint) => {
      // Check if the foreign key constraint already exists
      connection.query(constraint.checkSql, (err, results) => {
        if (err) {
          console.error(`Error checking foreign key constraint: ${constraint.description}`, err)
          // Don't reject on foreign key check errors, continue
          completed++
          if (completed === total) {
            resolve()
          }
          return
        }

        // If constraint doesn't exist, add it
        if (results.length === 0) {
          console.log(`Adding foreign key constraint: ${constraint.description}`)
          connection.query(constraint.sql, (err) => {
            if (err) {
              console.log(
                `⚠️  Foreign key constraint creation failed (this is normal if data exists): ${constraint.description}`,
              )
              // Don't reject on foreign key errors, just log and continue
            } else {
              console.log(`✅ Foreign key constraint added: ${constraint.description}`)
            }

            completed++
            if (completed === total) {
              resolve()
            }
          })
        } else {
          console.log(`⏭️  Foreign key constraint skipped (already exists): ${constraint.description}`)
          completed++
          if (completed === total) {
            resolve()
          }
        }
      })
    })
  })
}

function createDefaultUsers() {
  return new Promise((resolve, reject) => {
    const crypto = require("crypto")

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
    ]

    let completed = 0
    const total = defaultUsers.length

    defaultUsers.forEach((user) => {
      connection.query(
        "INSERT IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [user.name, user.email, user.password, user.role],
        (err) => {
          if (err) {
            console.error("Error creating default user:", err)
            reject(err)
            return
          }

          completed++
          if (completed === total) {
            // Create default data
            createDefaultData().then(resolve).catch(reject)
          }
        },
      )
    })
  })
}

function createDefaultData() {
  return new Promise((resolve, reject) => {
    // First check if user_id column exists in doctors table
    connection.query("SHOW COLUMNS FROM doctors LIKE 'user_id'", (err, results) => {
      if (err) {
        console.error("Error checking doctors table structure:", err)
        reject(err)
        return
      }

      const hasUserIdColumn = results.length > 0

      // Create default doctor record
      const doctorQuery = hasUserIdColumn
        ? `INSERT IGNORE INTO doctors (name, specialty, contact, user_id) 
           SELECT 'Dr. John Smith', 'General Medicine', '+8801234567890', id 
           FROM users WHERE email = 'doctor@hospital.com' LIMIT 1`
        : `INSERT IGNORE INTO doctors (name, specialty, contact) 
           VALUES ('Dr. John Smith', 'General Medicine', '+8801234567890')`

      connection.query(doctorQuery, (err) => {
        if (err) {
          console.error("Error creating default doctor:", err)
          reject(err)
          return
        }

        // Check if user_id column exists in patients table
        connection.query("SHOW COLUMNS FROM patients LIKE 'user_id'", (err, results) => {
          if (err) {
            console.error("Error checking patients table structure:", err)
            reject(err)
            return
          }

          const patientHasUserIdColumn = results.length > 0

          // Create default patient record
          const patientQuery = patientHasUserIdColumn
            ? `INSERT IGNORE INTO patients (name, age, gender, contact, address, user_id) 
               SELECT 'John Doe', 30, 'male', '+8801234567891', '123 Main St, Dhaka', id 
               FROM users WHERE email = 'patient@hospital.com' LIMIT 1`
            : `INSERT IGNORE INTO patients (name, age, gender, contact, address) 
               VALUES ('John Doe', 30, 'male', '+8801234567891', '123 Main St, Dhaka')`

          connection.query(patientQuery, (err) => {
            if (err) {
              console.error("Error creating default patient:", err)
              reject(err)
              return
            }

            // Create default tests
            const defaultTests = [
              ["Blood Test", "Laboratory", 500.0, "Complete blood count"],
              ["X-Ray", "Radiology", 800.0, "Chest X-ray"],
              ["ECG", "Cardiology", 300.0, "Electrocardiogram"],
              ["Ultrasound", "Radiology", 1200.0, "Abdominal ultrasound"],
              ["MRI", "Radiology", 5000.0, "Magnetic resonance imaging"],
            ]

            let testCompleted = 0
            const testTotal = defaultTests.length

            defaultTests.forEach((test) => {
              connection.query(
                "INSERT IGNORE INTO tests (name, category, price, description) VALUES (?, ?, ?, ?)",
                test,
                (err) => {
                  if (err) {
                    console.error("Error creating default test:", err)
                    reject(err)
                    return
                  }

                  testCompleted++
                  if (testCompleted === testTotal) {
                    console.log("✅ Default data created successfully")
                    resolve()
                  }
                },
              )
            })
          })
        })
      })
    })
  })
}

function getConnection() {
  return connection
}

module.exports = {
  connectDB,
  getConnection,
}
