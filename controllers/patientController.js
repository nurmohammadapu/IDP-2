const { createPatient, getAllPatients, getPatientById, updatePatient, deletePatient, searchPatients } = require("../models/patientModel")
const { auditAction } = require("../middleware/auditMiddleware")
const { getAuthenticatedUser } = require("../middleware/authMiddleware")
const { getDB } = require("../db")

async function getDashboardData(req, res) {
  try {
    const user = await getAuthenticatedUser(req)
    if (!user || user.role !== "patient") {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Access denied. Patient access only." }))
      return
    }

    const db = getDB()

    // Find patient record linking to this user
    let patient = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM patients WHERE user_id = ?", [user.id], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })

    if (!patient) {
      console.log(`Self-healing: Creating default patient record for user_id ${user.id}`);
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO patients (user_id, name, age, gender, contact, address, medical_history)
           VALUES (?, ?, 30, 'male', ?, ?, 'None')`,
          [user.id, user.name, user.phone || ('017' + user.id + Math.floor(100000 + Math.random() * 900000)), user.address || 'Not specified'],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      // Fetch the newly created record
      patient = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM patients WHERE user_id = ?", [user.id], (err, row) => {
          if (err) reject(err)
          else resolve(row)
        })
      })
    }

    const patientId = patient.id

    // Total appointments count
    const totalAppointmentsCount = await new Promise((resolve) => {
      db.get(
        "SELECT COUNT(*) as count FROM appointments WHERE patient_id = ?",
        [patientId],
        (err, row) => resolve(row ? row.count : 0)
      )
    })

    // Upcoming appointments count
    const upcomingAppointmentsCount = await new Promise((resolve) => {
      db.get(
        "SELECT COUNT(*) as count FROM appointments WHERE patient_id = ? AND status IN ('pending', 'confirmed') AND appointment_date >= date('now')",
        [patientId],
        (err, row) => resolve(row ? row.count : 0)
      )
    })

    // Total bills and pending bills
    const billStats = await new Promise((resolve) => {
      db.get(
        `SELECT SUM(total_amount) as total_amount, SUM(total_amount - paid_amount) as due_amount 
         FROM advanced_bills 
         WHERE patient_id = ?`,
        [patientId],
        (err, row) => {
          resolve({
            totalBills: row ? (row.total_amount || 0) : 0,
            pendingBills: row ? (row.due_amount || 0) : 0
          })
        }
      )
    })

    // Appointments list (upcoming and current today/future)
    const appointmentsList = await new Promise((resolve, reject) => {
      db.all(
        `SELECT a.*, d.name as doctor_name, d.specialty as doctor_specialty
         FROM appointments a
         JOIN doctors d ON a.doctor_id = d.id
         WHERE a.patient_id = ? AND a.appointment_date >= date('now')
         ORDER BY a.appointment_date ASC, a.appointment_time ASC
         LIMIT 10`,
        [patientId],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        }
      )
    })

    // Bills list
    const billsList = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM advanced_bills WHERE patient_id = ? ORDER BY billing_date DESC LIMIT 5`,
        [patientId],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        }
      )
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        totalAppointments: totalAppointmentsCount,
        upcomingAppointments: upcomingAppointmentsCount,
        totalBills: billStats.totalBills,
        pendingBills: billStats.pendingBills,
        appointments: appointmentsList,
        bills: billsList
      })
    )
  } catch (error) {
    console.error("Patient dashboard error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error: " + error.message }))
  }
}

async function getAll(req, res) {
  try {
    const patients = await getAllPatients()
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(patients))
  } catch (error) {
    console.error("Get patients error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function create(req, res) {
  try {
    const { name, age, gender, contact, address, medical_history, emergency_contact, blood_group, allergies } = req.body

    if (!name || !age || !gender || !contact || !address) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, age, gender, contact, and address are required" }))
      return
    }

    const patientId = await createPatient({
      name,
      age,
      gender,
      contact,
      address,
      medical_history,
      emergency_contact,
      blood_group,
      allergies,
    })

    // Log audit activity
    await auditAction(req, "CREATE", "patients", patientId, null, {
      name,
      age,
      gender,
      contact,
    })

    res.writeHead(201, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Patient created successfully", patientId }))
  } catch (error) {
    console.error("Create patient error:", error)
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
    const { name, age, gender, contact, address, medical_history, emergency_contact, blood_group, allergies } = req.body

    if (!name || !age || !gender || !contact || !address) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, age, gender, contact, and address are required" }))
      return
    }

    // Get old patient data for audit
    const patients = await getAllPatients()
    const oldPatient = patients.find((p) => p.id == id)

    await updatePatient(id, {
      name,
      age,
      gender,
      contact,
      address,
      medical_history,
      emergency_contact,
      blood_group,
      allergies,
    })

    // Log audit activity
    await auditAction(
      req,
      "UPDATE",
      "patients",
      id,
      { name: oldPatient?.name, contact: oldPatient?.contact },
      { name, contact },
    )

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Patient updated successfully" }))
  } catch (error) {
    console.error("Update patient error:", error)
    if (error.message && (error.message.includes("UNIQUE constraint failed: patients.contact") || error.message.includes("patients.contact"))) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "A patient with this contact number already exists." }))
      return
    }
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function getById(req, res, id) {
  try {
    const patient = await getPatientById(id)
    if (!patient) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Patient not found" }))
      return
    }
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(patient))
  } catch (error) {
    console.error("Get patient error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function deletePatientById(req, res, id) {
  try {
    // Get patient data for audit before deletion
    const patients = await getAllPatients()
    const patient = patients.find((p) => p.id == id)

    await deletePatient(id)

    // Log audit activity
    await auditAction(req, "DELETE", "patients", id, { name: patient?.name, contact: patient?.contact }, null)

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Patient deleted successfully" }))
  } catch (error) {
    console.error("Delete patient error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function search(req, res, query) {
  try {
    const results = await searchPatients(query)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(results))
  } catch (error) {
    console.error("Search patients error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deletePatientById,
  search,
  getDashboardData,
}
