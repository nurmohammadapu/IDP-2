const { createPatient, getAllPatients, getPatientById, updatePatient, deletePatient, searchPatients  } = require("../models/patientModel")
const { auditAction } = require("../middleware/auditMiddleware")
const { getAuthenticatedUser } = require("../middleware/authMiddleware")
const { getDB } = require("../db")

async function getDashboardData(req, res) {
  try {
    const user = await getAuthenticatedUser(req)
    if (!user || user.role !== "patient") {
      return res.status(401).json({ error: "Access denied. Patient access only." })
    }

    const db = getDB()

    // Find patient record linking to this user by user_id or phone contact
    let patient = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM patients WHERE user_id = ? OR contact = ? OR REPLACE(contact, ' ', '') = ?",
        [user.id, user.phone, user.phone ? user.phone.replace(/\s+/g, '') : ''],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    if (patient && !patient.user_id) {
      // Link user_id if missing
      await new Promise((resolve) => db.run("UPDATE patients SET user_id = ? WHERE id = ?", [user.id, patient.id], () => resolve()))
    }

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

    return res.json({
      totalAppointments: totalAppointmentsCount,
      upcomingAppointments: upcomingAppointmentsCount,
      totalBills: billStats.totalBills,
      pendingBills: billStats.pendingBills,
      appointments: appointmentsList,
      bills: billsList
    })
  } catch (error) {
    console.error("Patient dashboard error:", error)
    return res.status(500).json({ error: "Internal server error: " + error.message })
  }
}

async function getAll(req, res) {
  try {
    const patients = await getAllPatients()
    return res.json(patients)
  } catch (error) {
    console.error("Get patients error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function create(req, res) {
  try {
    const { name, age, gender, contact, address, medical_history, emergency_contact, blood_group, allergies } = req.body

    if (!name || !age || !gender || !contact || !address) {
      return res.status(400).json({ error: "Name, age, gender, contact, and address are required" })
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

    return res.status(201).json({ message: "Patient created successfully", patientId })
  } catch (error) {
    console.error("Create patient error:", error)
    if (error.message && (error.message.includes("UNIQUE constraint failed: patients.contact") || error.message.includes("patients.contact"))) {
      return res.status(400).json({ error: "A patient with this contact number already exists." })
    }
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function update(req, res) {
  try {
    const { id } = req.params
    const { name, age, gender, contact, address, medical_history, emergency_contact, blood_group, allergies } = req.body

    if (!name || !age || !gender || !contact || !address) {
      return res.status(400).json({ error: "Name, age, gender, contact, and address are required" })
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

    return res.json({ message: "Patient updated successfully" })
  } catch (error) {
    console.error("Update patient error:", error)
    if (error.message && (error.message.includes("UNIQUE constraint failed: patients.contact") || error.message.includes("patients.contact"))) {
      return res.status(400).json({ error: "A patient with this contact number already exists." })
    }
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params
    const patient = await getPatientById(id)
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" })
    }
    return res.json(patient)
  } catch (error) {
    console.error("Get patient error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function deletePatientById(req, res) {
  try {
    const { id } = req.params
    // Get patient data for audit before deletion
    const patients = await getAllPatients()
    const patient = patients.find((p) => p.id == id)

    await deletePatient(id)

    // Log audit activity
    await auditAction(req, "DELETE", "patients", id, { name: patient?.name, contact: patient?.contact }, null)

    return res.json({ message: "Patient deleted successfully" })
  } catch (error) {
    console.error("Delete patient error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function search(req, res) {
  try {
    const { search: searchQuery } = req.query
    const results = await searchPatients(searchQuery)
    return res.json(results)
  } catch (error) {
    console.error("Search patients error:", error)
    return res.status(500).json({ error: "Internal server error" })
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
