const { promisify } = require("util")
const { getDB } = require("../db")

// Create a new patient record
async function createPatient(patientData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { name, age, gender, contact, address, medical_history } = patientData
    const sql = `INSERT INTO patients (name, age, gender, contact, address, medical_history, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    const result = await run(sql, [name, age, gender, contact, address, medical_history || ""])
    return result.lastID
  } catch (err) {
    console.error("createPatient database error:", err)
    throw err
  }
}

// Get all patients, ordered by newest first
async function getAllPatients() {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const rows = await all("SELECT * FROM patients ORDER BY created_at DESC", [])
    return rows
  } catch (err) {
    console.error("getAllPatients database error:", err)
    throw err
  }
}

// Get a patient by their ID
async function getPatientById(id) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const row = await get("SELECT * FROM patients WHERE id = ?", [id])
    return row
  } catch (err) {
    console.error("getPatientById database error:", err)
    throw err
  }
}

// Update an existing patient's information by ID
async function updatePatient(id, patientData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { name, age, gender, contact, address, medical_history } = patientData
    const sql = `UPDATE patients SET name = ?, age = ?, gender = ?, contact = ?, address = ?, medical_history = ?, updated_at = datetime('now') WHERE id = ?`
    const result = await run(sql, [name, age, gender, contact, address, medical_history, id])
    return result.changes > 0
  } catch (err) {
    console.error("updatePatient database error:", err)
    throw err
  }
}

// Delete a patient record by ID
async function deletePatient(id) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const result = await run("DELETE FROM patients WHERE id = ?", [id])
    return result.changes > 0
  } catch (err) {
    console.error("deletePatient database error:", err)
    throw err
  }
}

// Search patients by name or contact matching the query string
async function searchPatients(query) {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const searchTerm = `%${query}%`
    const rows = await all(
      "SELECT * FROM patients WHERE name LIKE ? OR contact LIKE ? ORDER BY created_at DESC",
      [searchTerm, searchTerm]
    )
    return rows
  } catch (err) {
    console.error("searchPatients database error:", err)
    throw err
  }
}

module.exports = {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  searchPatients,
}
