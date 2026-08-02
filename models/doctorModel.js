const { promisify } = require("util")
const { getDB } = require("../db")

// Create a new doctor record in the database
async function createDoctor(doctorData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { unique_id, name, specialty, contact, room_number, visit_fee, schedule } = doctorData
    const sql = `INSERT INTO doctors (unique_id, name, specialty, contact, room_number, visit_fee, schedule, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    const result = await run(sql, [unique_id || null, name, specialty, contact, room_number || "", visit_fee || 0, schedule || ""])
    return result.lastID
  } catch (err) {
    console.error("createDoctor database error:", err)
    throw err
  }
}

// Retrieve all doctors ordered by creation date descending
async function getAllDoctors() {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const rows = await all("SELECT * FROM doctors ORDER BY created_at DESC", [])
    return rows
  } catch (err) {
    console.error("getAllDoctors database error:", err)
    throw err
  }
}

// Retrieve a single doctor by their ID
async function getDoctorById(id) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const row = await get("SELECT * FROM doctors WHERE id = ?", [id])
    return row
  } catch (err) {
    console.error("getDoctorById database error:", err)
    throw err
  }
}

// Update an existing doctor's details by ID
async function updateDoctor(id, doctorData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { unique_id, name, specialty, contact, room_number, visit_fee, schedule } = doctorData
    const sql = `UPDATE doctors SET unique_id = ?, name = ?, specialty = ?, contact = ?, room_number = ?, visit_fee = ?, schedule = ?, updated_at = datetime('now') WHERE id = ?`
    const result = await run(sql, [unique_id || null, name, specialty, contact, room_number, visit_fee, schedule, id])
    return result.changes > 0
  } catch (err) {
    console.error("updateDoctor database error:", err)
    throw err
  }
}

// Delete a doctor record by ID
async function deleteDoctor(id) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const run = promisify(db.run).bind(db)

    const row = await get("SELECT user_id FROM doctors WHERE id = ?", [id])
    const userId = row ? row.user_id : null

    const result = await run("DELETE FROM doctors WHERE id = ?", [id])

    if (userId) {
      try {
        await run("DELETE FROM users WHERE id = ?", [userId])
      } catch (err3) {
        console.error("Error deleting linked doctor user:", err3)
      }
    }

    return result.changes > 0
  } catch (err) {
    console.error("deleteDoctor database error:", err)
    throw err
  }
}

async function searchDoctors(query) {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const searchTerm = `%${query}%`
    const rows = await all(
      "SELECT * FROM doctors WHERE name LIKE ? OR contact LIKE ? ORDER BY created_at DESC",
      [searchTerm, searchTerm]
    )
    return rows
  } catch (err) {
    console.error("searchDoctors database error:", err)
    throw err
  }
}

module.exports = {
  createDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
  searchDoctors,
}
