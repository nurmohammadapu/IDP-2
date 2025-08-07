const { getConnection } = require("../db")

function createPatient(patientData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { name, age, gender, contact, address, medical_history } = patientData

    connection.query(
      "INSERT INTO patients (name, age, gender, contact, address, medical_history) VALUES (?, ?, ?, ?, ?, ?)",
      [name, age, gender, contact, address, medical_history || ""],
      (err, result) => {
        if (err) {
          reject(err)
          return
        }
        resolve(result.insertId)
      },
    )
  })
}

function getAllPatients() {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("SELECT * FROM patients ORDER BY created_at DESC", (err, results) => {
      if (err) {
        reject(err)
        return
      }
      resolve(results)
    })
  })
}

function getPatientById(id) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("SELECT * FROM patients WHERE id = ?", [id], (err, results) => {
      if (err) {
        reject(err)
        return
      }
      resolve(results[0])
    })
  })
}

function updatePatient(id, patientData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { name, age, gender, contact, address, medical_history } = patientData

    connection.query(
      "UPDATE patients SET name = ?, age = ?, gender = ?, contact = ?, address = ?, medical_history = ? WHERE id = ?",
      [name, age, gender, contact, address, medical_history, id],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(true)
      },
    )
  })
}

function deletePatient(id) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("DELETE FROM patients WHERE id = ?", [id], (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve(true)
    })
  })
}

function searchPatients(query) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const searchTerm = `%${query}%`
    connection.query(
      "SELECT * FROM patients WHERE name LIKE ? OR contact LIKE ? ORDER BY created_at DESC",
      [searchTerm, searchTerm],
      (err, results) => {
        if (err) {
          reject(err)
          return
        }
        resolve(results)
      },
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
