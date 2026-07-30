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
    const appointment = await getAppointmentById(id);
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

const { createPatient } = require("../models/patientModel")
const { getAuthenticatedUser } = require("../middleware/authMiddleware")
const { getDB } = require("../db")

async function create(req, res) {
  try {
    let { patient_id, doctor_id, appointment_date, appointment_time, notes, new_patient } = req.body

    const user = await getAuthenticatedUser(req)
    if (user && user.role === "patient") {
      const db = getDB()
      const patient = await new Promise((resolve) => {
        db.get("SELECT id FROM patients WHERE user_id = ?", [user.id], (err, row) => resolve(row))
      })
      if (patient) {
        patient_id = patient.id
      } else {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Patient profile not found for this account" }))
        return
      }
    } else if (!patient_id && new_patient) {
      const { name, age, gender, contact, address } = new_patient
      if (!name || !age || !gender || !contact || !address) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Missing required patient fields" }))
        return
      }
      patient_id = await createPatient({ name, age, gender, contact, address })
    }

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
    res.end(JSON.stringify({ message: "Appointment created successfully", appointmentId, patientId: patient_id }))
  } catch (error) {
    console.error("Create appointment error:", error)
    if (error.message && (error.message.includes("UNIQUE constraint failed: patients.contact") || error.message.includes("patients.contact"))) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "A patient with this contact number already exists." }))
      return
    }
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
