const { getDB } = require("../db")

// Create a new patient record
function createPatient(patientData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const { name, age, gender, contact, address, medical_history } = patientData
    const sql = `INSERT INTO patients (name, age, gender, contact, address, medical_history, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    db.run(sql, [name, age, gender, contact, address, medical_history || ""], function(err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.lastID)  // last inserted row id
    })
  })
}

// Get all patients, ordered by newest first
function getAllPatients() {
  const db = getDB()
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM patients ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      resolve(rows)
    })
  })
}

// Get a patient by their ID
function getPatientById(id) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM patients WHERE id = ?", [id], (err, row) => {
      if (err) {
        reject(err)
        return
      }
      resolve(row) // single object or undefined if not found
    })
  })
}

// Update an existing patient's information by ID
function updatePatient(id, patientData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const { name, age, gender, contact, address, medical_history } = patientData
    const sql = `UPDATE patients SET name = ?, age = ?, gender = ?, contact = ?, address = ?, medical_history = ?, updated_at = datetime('now') WHERE id = ?`
    db.run(sql, [name, age, gender, contact, address, medical_history, id], function(err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.changes > 0)  // true if row updated
    })
  })
}

// Delete a patient record by ID
function deletePatient(id) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM patients WHERE id = ?", [id], function(err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.changes > 0) // true if row deleted
    })
  })
}

// Search patients by name or contact matching the query string
function searchPatients(query) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const searchTerm = `%${query}%`
    db.all(
      "SELECT * FROM patients WHERE name LIKE ? OR contact LIKE ? ORDER BY created_at DESC",
      [searchTerm, searchTerm],
      (err, rows) => {
        if (err) {
          reject(err)
          return
        }
        resolve(rows)
      }
    )
  })
}

module.exports = {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  searchPatients,
}
