const { promisify } = require("util")
const { getDB } = require("../db")

async function createAppointment(appointmentData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { patient_id, doctor_id, appointment_date, appointment_time, status, notes, serial_number } = appointmentData

    const sql = `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, notes, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?)`
    const result = await run(sql, [patient_id, doctor_id, appointment_date, appointment_time, status || "pending", notes || "", serial_number || 0])
    return result.lastID
  } catch (err) {
    console.error("createAppointment database error:", err)
    throw err
  }
}

async function getAllAppointments() {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const sql = `
      SELECT a.*, p.name as patient_name, d.name as doctor_name, d.specialty 
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `
    const rows = await all(sql, [])
    return rows
  } catch (err) {
    console.error("getAllAppointments database error:", err)
    throw err
  }
}

async function getAppointmentById(id) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const sql = `
      SELECT a.*, p.name as patient_name, d.name as doctor_name, d.specialty 
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = ?
    `
    const row = await get(sql, [id])
    return row
  } catch (err) {
    console.error("getAppointmentById database error:", err)
    throw err
  }
}

async function updateAppointment(id, appointmentData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { patient_id, doctor_id, appointment_date, appointment_time, status, notes, serial_number } = appointmentData

    const sql = `
      UPDATE appointments
      SET patient_id = ?, doctor_id = ?, appointment_date = ?, appointment_time = ?, status = ?, notes = ?, serial_number = ?
      WHERE id = ?
    `
    const result = await run(sql, [patient_id, doctor_id, appointment_date, appointment_time, status, notes, serial_number || 0, id])
    return result.changes > 0
  } catch (err) {
    console.error("updateAppointment database error:", err)
    throw err
  }
}

async function deleteAppointment(id) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const sql = `DELETE FROM appointments WHERE id = ?`
    const result = await run(sql, [id])
    return result.changes > 0
  } catch (err) {
    console.error("deleteAppointment database error:", err)
    throw err
  }
}

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
}
