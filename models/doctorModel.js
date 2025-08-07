const { getConnection } = require("../db")

function createDoctor(doctorData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { name, specialty, contact, schedule } = doctorData

    connection.query(
      "INSERT INTO doctors (name, specialty, contact, schedule) VALUES (?, ?, ?, ?)",
      [name, specialty, contact, schedule || ""],
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

function getAllDoctors() {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("SELECT * FROM doctors ORDER BY created_at DESC", (err, results) => {
      if (err) {
        reject(err)
        return
      }
      resolve(results)
    })
  })
}

function getDoctorById(id) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("SELECT * FROM doctors WHERE id = ?", [id], (err, results) => {
      if (err) {
        reject(err)
        return
      }
      resolve(results[0])
    })
  })
}

function updateDoctor(id, doctorData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { name, specialty, contact, schedule } = doctorData

    connection.query(
      "UPDATE doctors SET name = ?, specialty = ?, contact = ?, schedule = ? WHERE id = ?",
      [name, specialty, contact, schedule, id],
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

function deleteDoctor(id) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("DELETE FROM doctors WHERE id = ?", [id], (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve(true)
    })
  })
}

module.exports = {
  createDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
}
