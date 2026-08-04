const { createDoctor, getAllDoctors, getDoctorById, updateDoctor, deleteDoctor, searchDoctors  } = require("../models/doctorModel")
const { getAuthenticatedUser } = require("../middleware/authMiddleware")
const { getDB } = require("../db")

async function getDashboardData(req, res) {
  try {
    const user = await getAuthenticatedUser(req)
    if (!user || user.role !== "doctor") {
      return res.status(401).json({ error: "Access denied. Doctor access only." })
    }

    const db = getDB()
    
    // Find doctor record linking to this user
    let doctor = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM doctors WHERE user_id = ?", [user.id], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })

    if (!doctor) {
      console.log(`Self-healing: Creating default doctor record for user_id ${user.id}`);
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO doctors (user_id, unique_id, name, specialty, contact, room_number, visit_fee, schedule)
           VALUES (?, ?, ?, 'General Medicine', ?, 'Room 101', 500, 'Sat-Wed: 9AM-5PM')`,
          [user.id, 'DOC' + user.id, user.name, user.phone || ('018' + user.id + Math.floor(100000 + Math.random() * 900000))],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      // Fetch the newly created record
      doctor = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM doctors WHERE user_id = ?", [user.id], (err, row) => {
          if (err) reject(err)
          else resolve(row)
        })
      })
    }

    const doctorId = doctor.id

    // Today's appointments count
    const todayAppointmentsCount = await new Promise((resolve) => {
      db.get(
        "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date = date('now')",
        [doctorId],
        (err, row) => resolve(row ? row.count : 0)
      )
    })

    // Total unique patients count
    const totalPatientsCount = await new Promise((resolve) => {
      db.get(
        "SELECT COUNT(DISTINCT patient_id) as count FROM appointments WHERE doctor_id = ?",
        [doctorId],
        (err, row) => resolve(row ? row.count : 0)
      )
    })

    // Upcoming appointments count (pending or confirmed for today or future)
    const upcomingAppointmentsCount = await new Promise((resolve) => {
      db.get(
        "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status IN ('pending', 'confirmed') AND appointment_date >= date('now')",
        [doctorId],
        (err, row) => resolve(row ? row.count : 0)
      )
    })

    // Completed today count
    const completedTodayCount = await new Promise((resolve) => {
      db.get(
        "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status = 'completed' AND appointment_date = date('now')",
        [doctorId],
        (err, row) => resolve(row ? row.count : 0)
      )
    })

    // Today's appointments list
    const todayAppointmentsList = await new Promise((resolve, reject) => {
      db.all(
        `SELECT a.*, p.name as patient_name, p.contact as patient_contact
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND a.appointment_date = date('now')
         ORDER BY a.appointment_time ASC`,
        [doctorId],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        }
      )
    })

    // Upcoming appointments list
    const upcomingAppointmentsList = await new Promise((resolve, reject) => {
      db.all(
        `SELECT a.*, p.name as patient_name, p.contact as patient_contact
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ? AND a.appointment_date > date('now')
         ORDER BY a.appointment_date ASC, a.appointment_time ASC
         LIMIT 10`,
        [doctorId],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        }
      )
    })

    // All appointments list for filtering
    const allAppointmentsList = await new Promise((resolve, reject) => {
      db.all(
        `SELECT a.*, p.name as patient_name, p.contact as patient_contact
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.doctor_id = ?
         ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
        [doctorId],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        }
      )
    })

    return res.json({
      todayAppointments: todayAppointmentsCount,
      totalPatients: totalPatientsCount,
      upcomingAppointments: upcomingAppointmentsCount,
      completedToday: completedTodayCount,
      todayAppointmentsList,
      upcomingAppointmentsList,
      allAppointmentsList,
    })
  } catch (error) {
    console.error("Doctor dashboard error:", error)
    return res.status(500).json({ error: "Internal server error: " + error.message })
  }
}

async function getAll(req, res) {
  try {
    const doctors = await getAllDoctors()
    return res.json(doctors)
  } catch (error) {
    console.error("Get doctors error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params
    const doctor = await getDoctorById(id)
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" })
    }
    return res.json(doctor)
  } catch (error) {
    console.error("Get doctor error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function create(req, res) {
  try {
    const { unique_id, name, specialty, contact, room_number, visit_fee, schedule } = req.body

    if (!name || !specialty || !contact) {
      return res.status(400).json({ error: "Name, specialty, and contact are required" })
    }

    const doctorId = await createDoctor({
      unique_id,
      name,
      specialty,
      contact,
      room_number,
      visit_fee,
      schedule,
    })

    return res.status(201).json({ message: "Doctor created successfully", doctorId })
  } catch (error) {
    console.error("Create doctor error:", error)
    if (error.message && (error.message.includes("UNIQUE constraint failed: doctors.unique_id") || error.message.includes("doctors.unique_id"))) {
      return res.status(400).json({ error: "A doctor with this Unique ID already exists." })
    }
    if (error.message && (error.message.includes("UNIQUE constraint failed: doctors.contact") || error.message.includes("doctors.contact"))) {
      return res.status(400).json({ error: "A doctor with this contact number already exists." })
    }
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function update(req, res) {
  try {
    const { id } = req.params
    const { unique_id, name, specialty, contact, room_number, visit_fee, schedule } = req.body

    if (!name || !specialty || !contact) {
      return res.status(400).json({ error: "Name, specialty, and contact are required" })
    }

    await updateDoctor(id, {
      unique_id,
      name,
      specialty,
      contact,
      room_number,
      visit_fee,
      schedule,
    })

    return res.json({ message: "Doctor updated successfully" })
  } catch (error) {
    console.error("Update doctor error:", error)
    if (error.message && (error.message.includes("UNIQUE constraint failed: doctors.unique_id") || error.message.includes("doctors.unique_id"))) {
      return res.status(400).json({ error: "A doctor with this Unique ID already exists." })
    }
    if (error.message && (error.message.includes("UNIQUE constraint failed: doctors.contact") || error.message.includes("doctors.contact"))) {
      return res.status(400).json({ error: "A doctor with this contact number already exists." })
    }
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function deleteDoctorById(req, res) {
  try {
    const { id } = req.params
    await deleteDoctor(id)
    return res.json({ message: "Doctor deleted successfully" })
  } catch (error) {
    console.error("Delete doctor error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function search(req, res) {
  try {
    const { search: searchQuery } = req.query
    const results = await searchDoctors(searchQuery)
    return res.json(results)
  } catch (error) {
    console.error("Search doctors error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteDoctorById,
  search,
  getDashboardData
}
