const { promisify } = require("util")
const { getDB } = require("../db")
const crypto = require("crypto")

// Create a new user with hashed password
async function createUser(userData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { name, email, password, role, status } = userData
    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex")
    const userStatus = status || 'active'

    const sql = "INSERT INTO users (name, email, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    const result = await run(sql, [name, email, hashedPassword, role, userStatus])
    return result.lastID // last inserted row ID
  } catch (err) {
    console.error("Database error creating user:", err)
    throw err
  }
}

// Find a user by their email address
async function findUserByEmail(email) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const row = await get("SELECT * FROM users WHERE email = ?", [email])
    return row // row can be undefined if not found
  } catch (err) {
    console.error("Database error finding user by email:", err)
    throw err
  }
}

// Find a user by their ID
async function findUserById(id) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const row = await get("SELECT * FROM users WHERE id = ?", [id])
    return row
  } catch (err) {
    console.error("Database error finding user by ID:", err)
    throw err
  }
}

// Verify if the plain password matches the stored hashed password
function verifyPassword(plainPassword, hashedPassword) {
  const inputHash = crypto.createHash("sha256").update(plainPassword).digest("hex")
  return inputHash === hashedPassword
}

// Update user profile details
async function updateUserProfile(userId, profileData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const get = promisify(db.get).bind(db)

    const {
      name, phone, address, date_of_birth, gender,
      blood_group, emergency_contact, emergency_contact_name,
      city, state, zip_code, bio
    } = profileData

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
      WHERE id = ?`

    const result = await run(sql, [
      name, phone, address, date_of_birth, gender,
      blood_group, emergency_contact, emergency_contact_name,
      city, state, zip_code, bio, userId
    ])

    const changesCount = result.changes

    // Sync changes to patients/doctors tables depending on role
    try {
      const user = await get("SELECT role FROM users WHERE id = ?", [userId])
      if (user && user.role === 'patient') {
        // Calculate age
        let age = 30 // fallback default
        if (date_of_birth) {
          const birthDate = new Date(date_of_birth)
          const difference = Date.now() - birthDate.getTime()
          const ageDate = new Date(difference)
          age = Math.abs(ageDate.getUTCFullYear() - 1970)
        }

        await run(
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
          [name, age, gender || 'Unspecified', phone, address || 'Not specified', emergency_contact || '', blood_group || '', userId]
        )
      } else if (user && user.role === 'doctor') {
        await run(
          `UPDATE doctors SET 
             name = COALESCE(?, name),
             contact = ?,
             updated_at = datetime('now')
           WHERE user_id = ?`,
          [name, phone, userId]
        )
      }
    } catch (syncErr) {
      console.error("Error syncing profile updates:", syncErr)
    }

    return changesCount
  } catch (err) {
    console.error("Database error updating user profile:", err)
    throw err
  }
}

// Update user password
async function updateUserPassword(userId, newPassword) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const hashedPassword = crypto.createHash("sha256").update(newPassword).digest("hex")
    const sql = "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?"
    const result = await run(sql, [hashedPassword, userId])
    return result.changes
  } catch (err) {
    console.error("Database error updating password:", err)
    throw err
  }
}

// Get all users for admin
async function getAllUsers() {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const rows = await all("SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC", [])
    return rows
  } catch (err) {
    console.error("Database error getting all users:", err)
    throw err
  }
}

// Delete user by ID
async function deleteUser(id) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const result = await run("DELETE FROM users WHERE id = ?", [id])
    return result.changes > 0
  } catch (err) {
    console.error("Database error deleting user:", err)
    throw err
  }
}

// Update user status
async function updateUserStatus(id, status) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const result = await run("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id])
    return result.changes > 0
  } catch (err) {
    console.error("Database error updating user status:", err)
    throw err
  }
}

// Update user profile by Admin
async function updateUserByAdmin(id, userData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { name, email, role, status } = userData
    const result = await run(
      "UPDATE users SET name = ?, email = ?, role = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
      [name, email, role, status, id]
    )
    return result.changes > 0
  } catch (err) {
    console.error("Database error updating user by admin:", err)
    throw err
  }
}

// Find a user by their email address or phone number
async function findUserByEmailOrPhone(identifier) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const row = await get(
      "SELECT * FROM users WHERE email = ? OR phone = ?",
      [identifier, identifier]
    )
    return row
  } catch (err) {
    console.error("Database error finding user by email or phone:", err)
    throw err
  }
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
}
