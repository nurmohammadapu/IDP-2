const { getConnection } = require("../db")

function createAppointment(appointmentData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { patient_id, doctor_id, appointment_date, appointment_time, notes } = appointmentData

    connection.query(
      "INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, notes) VALUES (?, ?, ?, ?, ?)",
      [patient_id, doctor_id, appointment_date, appointment_time, notes || ""],
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

function getAllAppointments() {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query(
      `SELECT a.*, p.name as patient_name, d.name as doctor_name, d.specialty 
       FROM appointments a 
       JOIN patients p ON a.patient_id = p.id 
       JOIN doctors d ON a.doctor_id = d.id 
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
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

function getAppointmentById(id) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query(
      `SELECT a.*, p.name as patient_name, d.name as doctor_name, d.specialty 
       FROM appointments a 
       JOIN patients p ON a.patient_id = p.id 
       JOIN doctors d ON a.doctor_id = d.id 
       WHERE a.id = ?`,
      [id],
      (err, results) => {
        if (err) {
          reject(err)
          return
        }
        resolve(results[0])
      },
    )
  })
}

function updateAppointment(id, appointmentData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { patient_id, doctor_id, appointment_date, appointment_time, status, notes } = appointmentData

    connection.query(
      "UPDATE appointments SET patient_id = ?, doctor_id = ?, appointment_date = ?, appointment_time = ?, status = ?, notes = ? WHERE id = ?",
      [patient_id, doctor_id, appointment_date, appointment_time, status, notes, id],
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

function deleteAppointment(id) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("DELETE FROM appointments WHERE id = ?", [id], (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve(true)
    })
  })
}

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
}
