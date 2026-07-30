const { createDoctor, getAllDoctors, getDoctorById, updateDoctor, deleteDoctor, searchDoctors  } = require("../models/doctorModel")
const { getAuthenticatedUser } = require("../middleware/authMiddleware")
const { getDB } = require("../db")

async function getDashboardData(req, res) {
  try {
    const user = await getAuthenticatedUser(req)
    if (!user || user.role !== "doctor") {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Access denied. Doctor access only." }))
      return
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

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        todayAppointments: todayAppointmentsCount,
        totalPatients: totalPatientsCount,
        upcomingAppointments: upcomingAppointmentsCount,
        completedToday: completedTodayCount,
        todayAppointmentsList,
        upcomingAppointmentsList,
      })
    )
  } catch (error) {
    console.error("Doctor dashboard error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error: " + error.message }))
  }
}

async function getAll(req, res) {
  try {
    const doctors = await getAllDoctors()
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(doctors))
  } catch (error) {
    console.error("Get doctors error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function getById(req, res, id) {
  try {
    const doctor = await getDoctorById(id)
    if (!doctor) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Doctor not found" }))
      return
    }
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(doctor))
  } catch (error) {
    console.error("Get doctor error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function create(req, res) {
  try {
    const { unique_id, name, specialty, contact, room_number, visit_fee, schedule } = req.body

    if (!name || !specialty || !contact) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, specialty, and contact are required" }))
      return
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

    res.writeHead(201, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Doctor created successfully", doctorId }))
  } catch (error) {
    console.error("Create doctor error:", error)
    if (error.message && (error.message.includes("UNIQUE constraint failed: doctors.unique_id") || error.message.includes("doctors.unique_id"))) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "A doctor with this Unique ID already exists." }))
      return
    }
    if (error.message && (error.message.includes("UNIQUE constraint failed: doctors.contact") || error.message.includes("doctors.contact"))) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "A doctor with this contact number already exists." }))
      return
    }
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function update(req, res, id) {
  try {
    const { unique_id, name, specialty, contact, room_number, visit_fee, schedule } = req.body

    if (!name || !specialty || !contact) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, specialty, and contact are required" }))
      return
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

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Doctor updated successfully" }))
  } catch (error) {
    console.error("Update doctor error:", error)
    if (error.message && (error.message.includes("UNIQUE constraint failed: doctors.unique_id") || error.message.includes("doctors.unique_id"))) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "A doctor with this Unique ID already exists." }))
      return
    }
    if (error.message && (error.message.includes("UNIQUE constraint failed: doctors.contact") || error.message.includes("doctors.contact"))) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "A doctor with this contact number already exists." }))
      return
    }
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function deleteDoctorById(req, res, id) {
  try {
    await deleteDoctor(id)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Doctor deleted successfully" }))
  } catch (error) {
    console.error("Delete doctor error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function search(req, res, query) {
  try {
    const results = await searchDoctors(query)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(results))
  } catch (error) {
    console.error("Search doctors error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
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
