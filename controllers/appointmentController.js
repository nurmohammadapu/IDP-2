const {
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
} = require("../models/appointmentModel")

async function getAll(req, res) {
  try {
    const appointments = await getAllAppointments()
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(appointments))
  } catch (error) {
    console.error("Get appointments error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function getById(req, res, id) {
  try {
    const appointment = await getAppointmentById(id)
    if (!appointment) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Appointment not found" }))
      return
    }
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(appointment))
  } catch (error) {
    console.error("Get appointment error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function create(req, res) {
  try {
    const { patient_id, doctor_id, appointment_date, appointment_time, notes } = req.body

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Patient, doctor, date, and time are required" }))
      return
    }

    const appointmentId = await createAppointment({
      patient_id,
      doctor_id,
      appointment_date,
      appointment_time,
      notes,
    })

    res.writeHead(201, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Appointment created successfully", appointmentId }))
  } catch (error) {
    console.error("Create appointment error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function update(req, res, id) {
  try {
    const { patient_id, doctor_id, appointment_date, appointment_time, status, notes } = req.body

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Patient, doctor, date, and time are required" }))
      return
    }

    await updateAppointment(id, {
      patient_id,
      doctor_id,
      appointment_date,
      appointment_time,
      status,
      notes,
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Appointment updated successfully" }))
  } catch (error) {
    console.error("Update appointment error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function deleteAppointmentById(req, res, id) {
  try {
    await deleteAppointment(id)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Appointment deleted successfully" }))
  } catch (error) {
    console.error("Delete appointment error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteAppointmentById,
}
