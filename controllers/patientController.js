const { createPatient, getAllPatients, updatePatient, deletePatient, searchPatients } = require("../models/patientModel")
const { auditAction } = require("../middleware/auditMiddleware")

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
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function remove(req, res, id) {
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
  create,
  update,
  remove,
  search,
}
