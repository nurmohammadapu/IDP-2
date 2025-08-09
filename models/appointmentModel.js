const { getDB } = require("../db")

function createAppointment(appointmentData) {
  return new Promise((resolve, reject) => {
    const db = getDB()
    const { patient_id, doctor_id, appointment_date, appointment_time, notes } = appointmentData

    const sql = `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, notes) VALUES (?, ?, ?, ?, ?)`
    db.run(sql, [patient_id, doctor_id, appointment_date, appointment_time, notes || ""], function(err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.lastID)  // last inserted row id
    })
  })
}

function getAllAppointments() {
  return new Promise((resolve, reject) => {
    const db = getDB()
    const sql = `
      SELECT a.*, p.name as patient_name, d.name as doctor_name, d.specialty 
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      resolve(rows)
    })
  })
}

function getAppointmentById(id) {
  return new Promise((resolve, reject) => {
    const db = getDB()
    const sql = `
      SELECT a.*, p.name as patient_name, d.name as doctor_name, d.specialty 
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = ?
    `
    db.get(sql, [id], (err, row) => {
      if (err) {
        reject(err)
        return
      }
      resolve(row)
    })
  })
}

function updateAppointment(id, appointmentData) {
  return new Promise((resolve, reject) => {
    const db = getDB()
    const { patient_id, doctor_id, appointment_date, appointment_time, status, notes } = appointmentData

    const sql = `
      UPDATE appointments
      SET patient_id = ?, doctor_id = ?, appointment_date = ?, appointment_time = ?, status = ?, notes = ?
      WHERE id = ?
    `
    db.run(sql, [patient_id, doctor_id, appointment_date, appointment_time, status, notes, id], function(err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.changes > 0)
    })
  })
}

function deleteAppointment(id) {
  return new Promise((resolve, reject) => {
    const db = getDB()
    const sql = `DELETE FROM appointments WHERE id = ?`
    db.run(sql, [id], function(err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.changes > 0)
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
