const { getDB } = require("../db");
const crypto = require("crypto");

// Create a new user with hashed password
function createUser(userData) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const { name, email, password, role, status } = userData;
    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
    const userStatus = status || 'active';

    const sql = "INSERT INTO users (name, email, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))";
    db.run(sql, [name, email, hashedPassword, role, userStatus], function(err) {
      if (err) {
        console.error("Database error creating user:", err);
        reject(err);
        return;
      }
      resolve(this.lastID); // last inserted row ID
    });
  });
}

// Find a user by their email address
function findUserByEmail(email) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
      if (err) {
        console.error("Database error finding user by email:", err);
        reject(err);
        return;
      }
      resolve(row); // row can be undefined if not found
    });
  });
}

// Find a user by their ID
function findUserById(id) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
      if (err) {
        console.error("Database error finding user by ID:", err);
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

// Verify if the plain password matches the stored hashed password
function verifyPassword(plainPassword, hashedPassword) {
  const inputHash = crypto.createHash("sha256").update(plainPassword).digest("hex");
  return inputHash === hashedPassword;
}

// Update user profile details
function updateUserProfile(userId, profileData) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const {
      name, phone, address, date_of_birth, gender,
      blood_group, emergency_contact, emergency_contact_name,
      city, state, zip_code, bio
    } = profileData;

    const sql = `UPDATE users SET
      name = COALESCE(?, name),
      phone = ?,
      address = ?,
      date_of_birth = ?,
      gender = ?,
      blood_group = ?,
      emergency_contact = ?,
      emergency_contact_name = ?,
      city = ?,
      state = ?,
      zip_code = ?,
      bio = ?,
      updated_at = datetime('now')
      WHERE id = ?`;

    db.run(sql, [
      name, phone, address, date_of_birth, gender,
      blood_group, emergency_contact, emergency_contact_name,
      city, state, zip_code, bio, userId
    ], function(err) {
      if (err) {
        console.error("Database error updating user profile:", err);
        reject(err);
        return;
      }
      
      const changesCount = this.changes;

      // Sync changes to patients/doctors tables depending on role
      db.get("SELECT role FROM users WHERE id = ?", [userId], (err, user) => {
        if (!err && user && user.role === 'patient') {
          // Calculate age
          let age = 30; // fallback default
          if (date_of_birth) {
            const birthDate = new Date(date_of_birth);
            const difference = Date.now() - birthDate.getTime();
            const ageDate = new Date(difference);
            age = Math.abs(ageDate.getUTCFullYear() - 1970);
          }
          
          db.run(
            `UPDATE patients SET 
               name = COALESCE(?, name),
               age = ?,
               gender = ?,
               contact = ?,
               address = ?,
               emergency_contact = ?,
               blood_group = ?,
               updated_at = datetime('now')
             WHERE user_id = ?`,
            [name, age, gender || 'Unspecified', phone, address || 'Not specified', emergency_contact || '', blood_group || '', userId],
            (err2) => {
              if (err2) {
                console.error("Error syncing to patients table:", err2);
              }
              resolve(changesCount);
            }
          );
        } else if (!err && user && user.role === 'doctor') {
          db.run(
            `UPDATE doctors SET 
               name = COALESCE(?, name),
               contact = ?,
               updated_at = datetime('now')
             WHERE user_id = ?`,
            [name, phone, userId],
            (err2) => {
              if (err2) {
                console.error("Error syncing to doctors table:", err2);
              }
              resolve(changesCount);
            }
          );
        } else {
          resolve(changesCount);
        }
      });
    });
  });
}

// Update user password
function updateUserPassword(userId, newPassword) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const hashedPassword = crypto.createHash("sha256").update(newPassword).digest("hex");
    const sql = "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?";
    db.run(sql, [hashedPassword, userId], function(err) {
      if (err) {
        console.error("Database error updating password:", err);
        reject(err);
        return;
      }
      resolve(this.changes);
    });
  });
}

// Get all users for admin
function getAllUsers() {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.all("SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        console.error("Database error getting all users:", err);
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// Delete user by ID
function deleteUser(id) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
      if (err) {
        console.error("Database error deleting user:", err);
        reject(err);
        return;
      }
      resolve(this.changes > 0);
    });
  });
}

// Update user status
function updateUserStatus(id, status) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.run("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id], function(err) {
      if (err) {
        console.error("Database error updating user status:", err);
        reject(err);
        return;
      }
      resolve(this.changes > 0);
    });
  });
}

// Update user profile by Admin
function updateUserByAdmin(id, userData) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const { name, email, role, status } = userData;
    db.run(
      "UPDATE users SET name = ?, email = ?, role = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
      [name, email, role, status, id],
      function(err) {
        if (err) {
          console.error("Database error updating user by admin:", err);
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      }
    );
  });
}

// Find a user by their email address or phone number
function findUserByEmailOrPhone(identifier) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM users WHERE email = ? OR phone = ?",
      [identifier, identifier],
      (err, row) => {
        if (err) {
          console.error("Database error finding user by email or phone:", err);
          reject(err);
          return;
        }
        resolve(row);
      }
    );
  });
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserByEmailOrPhone,
  findUserById,
  verifyPassword,
  updateUserProfile,
  updateUserPassword,
  getAllUsers,
  deleteUser,
  updateUserStatus,
  updateUserByAdmin,
};
