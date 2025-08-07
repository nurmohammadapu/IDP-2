const { createDoctor, getAllDoctors, getDoctorById, updateDoctor, deleteDoctor } = require("../models/doctorModel")

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
    const { name, specialty, contact, schedule } = req.body

    if (!name || !specialty || !contact) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, specialty, and contact are required" }))
      return
    }

    const doctorId = await createDoctor({
      name,
      specialty,
      contact,
      schedule,
    })

    res.writeHead(201, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Doctor created successfully", doctorId }))
  } catch (error) {
    console.error("Create doctor error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function update(req, res, id) {
  try {
    const { name, specialty, contact, schedule } = req.body

    if (!name || !specialty || !contact) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, specialty, and contact are required" }))
      return
    }

    await updateDoctor(id, {
      name,
      specialty,
      contact,
      schedule,
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Doctor updated successfully" }))
  } catch (error) {
    console.error("Update doctor error:", error)
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

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteDoctorById,
}
