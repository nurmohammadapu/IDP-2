const { getDB } = require("../db");
const crypto = require("crypto");

// Create a new user with hashed password
function createUser(userData) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const { name, email, password, role } = userData;
    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");

    const sql = "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))";
    db.run(sql, [name, email, hashedPassword, role], function(err) {
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

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
};
