const { createDoctor, getAllDoctors, getDoctorById, updateDoctor, deleteDoctor, searchDoctors  } = require("../models/doctorModel")

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
  search
}
