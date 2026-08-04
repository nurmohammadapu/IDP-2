const {
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
} = require("../models/appointmentModel")
const { createAdvancedBill } = require("../models/billingModel")

async function getAll(req, res) {
  try {
    const appointments = await getAllAppointments()
    return res.json(appointments)
  } catch (error) {
    console.error("Get appointments error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params
    const appointment = await getAppointmentById(id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" })
    }
    return res.json(appointment)
  } catch (error) {
    console.error("Get appointment error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

const { createPatient } = require("../models/patientModel")
const { getAuthenticatedUser } = require("../middleware/authMiddleware")
const { getDB } = require("../db")

function parseTimeStr(timeStr, ampm) {
  let parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10);
  let minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  
  if (ampm.toUpperCase() === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  return { hours, minutes };
}

function parseScheduleTimes(scheduleStr) {
  if (!scheduleStr || scheduleStr.includes("Not scheduled yet")) {
    return { start: { hours: 9, minutes: 0 }, end: { hours: 17, minutes: 0 } };
  }
  
  // Sanitize the schedule string: replace 'o'/'O' in decimals/minutes
  let str = scheduleStr.replace(/(\d+[\.:])[oO]{2}/g, '$100')
                       .replace(/(\d+[\.:])[oO]/g, '$10')
                       .replace(/\./g, ':'); // convert decimal dots to colons
  
  // Find all times in the format "7:00", "7", "9PM", "9:00 PM"
  const regex = /(\d+(?::\d+)?)\s*(AM|PM|P\.M|A\.M)?/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(str)) !== null) {
    matches.push({
      time: match[1],
      ampm: match[2] ? match[2].replace(/\./g, '').toUpperCase() : null
    });
  }
  
  if (matches.length < 2) {
    return { start: { hours: 9, minutes: 0 }, end: { hours: 17, minutes: 0 } };
  }
  
  let start = matches[0];
  let end = matches[1];
  
  // If start time does not have AM/PM, but end time does, inherit it
  if (!start.ampm && end.ampm) {
    const startVal = parseFloat(start.time.replace(':', '.'));
    const endVal = parseFloat(end.time.replace(':', '.'));
    if (end.ampm === 'PM') {
      if (startVal > endVal && startVal < 12) {
        start.ampm = 'AM';
      } else {
        start.ampm = 'PM';
      }
    } else {
      start.ampm = 'AM';
    }
  }
  
  // Default if missing
  if (!start.ampm) start.ampm = 'AM';
  if (!end.ampm) end.ampm = 'PM';
  
  const startObj = parseTimeStr(start.time, start.ampm);
  const endObj = parseTimeStr(end.time, end.ampm);
  return { start: startObj, end: endObj };
}

function generateSlots(scheduleStr) {
  const { start, end } = parseScheduleTimes(scheduleStr);
  const slots = [];
  let currentHour = start.hours;
  let currentMinute = start.minutes;
  
  const endTotalMinutes = end.hours * 60 + end.minutes;
  
  while (true) {
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    if (currentTotalMinutes >= endTotalMinutes) {
      break;
    }
    
    const hh = String(currentHour).padStart(2, '0');
    const mm = String(currentMinute).padStart(2, '0');
    const time24 = `${hh}:${mm}`;
    
    const displayHour = currentHour % 12 === 0 ? 12 : currentHour % 12;
    const ampm = currentHour >= 12 ? 'PM' : 'AM';
    const displayTime = `${String(displayHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')} ${ampm}`;
    
    slots.push({
      time: time24,
      display: displayTime
    });
    
    currentMinute += 10;
    if (currentMinute >= 60) {
      currentHour += Math.floor(currentMinute / 60);
      currentMinute = currentMinute % 60;
    }
  }
  return slots;
}

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
        return res.status(400).json({ error: "Patient profile not found for this account" })
      }
    } else if (!patient_id && new_patient) {
      const { name, age, gender, contact, address } = new_patient
      if (!name || !age || !gender || !contact || !address) {
        return res.status(400).json({ error: "Missing required patient fields" })
      }
      patient_id = await createPatient({ name, age, gender, contact, address })
    }

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ error: "Patient, doctor, date, and time are required" })
    }

    const db = getDB()

    // 1. Check if the slot is already booked for this doctor on this date
    const alreadyBooked = await new Promise((resolve, reject) => {
      db.get(
        "SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelled'",
        [doctor_id, appointment_date, appointment_time],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    if (alreadyBooked) {
      return res.status(400).json({ error: "This time slot is already booked for this doctor." })
    }

    // 2. Fetch doctor's schedule to compute serial number
    const doctor = await new Promise((resolve) => {
      db.get("SELECT schedule FROM doctors WHERE id = ?", [doctor_id], (err, row) => resolve(row))
    })

    let serialNumber = 0
    if (doctor) {
      const slots = generateSlots(doctor.schedule)
      const index = slots.findIndex(s => s.time === appointment_time)
      if (index !== -1) {
        serialNumber = index + 1
      }
    }

    const status = req.body.status || 'pending'

    const appointmentId = await createAppointment({
      patient_id,
      doctor_id,
      appointment_date,
      appointment_time,
      status,
      notes,
      serial_number: serialNumber,
    })

    await autoCreateVisitBill(appointmentId, user)

    return res.status(201).json({ message: "Appointment created successfully", appointmentId, patientId: patient_id, serialNumber })
  } catch (error) {
    console.error("Create appointment error:", error)
    if (error.message && (error.message.includes("UNIQUE constraint failed: patients.contact") || error.message.includes("patients.contact"))) {
      return res.status(400).json({ error: "A patient with this contact number already exists." })
    }
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function update(req, res) {
  try {
    const { id } = req.params
    const db = getDB()
    const existing = await new Promise((resolve) => {
      db.get("SELECT * FROM appointments WHERE id = ?", [id], (err, row) => resolve(row))
    })

    if (!existing) {
      return res.status(404).json({ error: "Appointment not found" })
    }

    const patient_id = req.body.patient_id !== undefined ? req.body.patient_id : existing.patient_id
    const doctor_id = req.body.doctor_id !== undefined ? req.body.doctor_id : existing.doctor_id
    const appointment_date = req.body.appointment_date !== undefined ? req.body.appointment_date : existing.appointment_date
    const appointment_time = req.body.appointment_time !== undefined ? req.body.appointment_time : existing.appointment_time
    const status = req.body.status !== undefined ? req.body.status : existing.status
    const notes = req.body.notes !== undefined ? req.body.notes : existing.notes
    
    let serial_number = existing.serial_number
    if (doctor_id !== existing.doctor_id || appointment_date !== existing.appointment_date || appointment_time !== existing.appointment_time) {
      const alreadyBooked = await new Promise((resolve) => {
        db.get(
          "SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelled' AND id != ?",
          [doctor_id, appointment_date, appointment_time, id],
          (err, row) => resolve(row)
        )
      })

      if (alreadyBooked) {
        return res.status(400).json({ error: "This time slot is already booked for this doctor." })
      }

      const doctor = await new Promise((resolve) => {
        db.get("SELECT schedule FROM doctors WHERE id = ?", [doctor_id], (err, row) => resolve(row))
      })

      serial_number = 0
      if (doctor) {
        const slots = generateSlots(doctor.schedule)
        const index = slots.findIndex(s => s.time === appointment_time)
        if (index !== -1) {
          serial_number = index + 1
        }
      }
    }

    await updateAppointment(id, {
      patient_id,
      doctor_id,
      appointment_date,
      appointment_time,
      status,
      notes,
      serial_number
    })

    const user = await getAuthenticatedUser(req)
    await autoCreateVisitBill(id, user)

    return res.json({ message: "Appointment updated successfully" })
  } catch (error) {
    console.error("Update appointment error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function deleteAppointmentById(req, res) {
  try {
    const { id } = req.params
    await deleteAppointment(id)
    return res.json({ message: "Appointment deleted successfully" })
  } catch (error) {
    console.error("Delete appointment error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getAvailableSlots(req, res) {
  try {
    const { doctor_id, date } = req.query

    if (!doctor_id || !date) {
      return res.status(400).json({ error: "doctor_id and date are required" })
    }

    const db = getDB()
    const doctor = await new Promise((resolve) => {
      db.get("SELECT * FROM doctors WHERE id = ? OR user_id = ?", [doctor_id, doctor_id], (err, row) => resolve(row))
    })

    let scheduleStr = (doctor && doctor.schedule && doctor.schedule !== "Not scheduled yet") 
      ? doctor.schedule 
      : "Sat-Wed: 9AM-5PM"

    const allSlots = generateSlots(scheduleStr)

    const targetDocId = doctor ? doctor.id : doctor_id

    const bookedAppointments = await new Promise((resolve, reject) => {
      db.all(
        "SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'",
        [targetDocId, date],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        }
      )
    })

    const bookedTimes = new Set(bookedAppointments.map(a => a.appointment_time))

    const slotsWithStatus = allSlots.map((slot, index) => ({
      time: slot.time,
      display: slot.display,
      serial: index + 1,
      isBooked: bookedTimes.has(slot.time)
    }))

    return res.json(slotsWithStatus)
  } catch (error) {
    console.error("Get available slots error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function autoCreateVisitBill(appointmentId, user) {
  const db = getDB()
  try {
    const appointment = await new Promise((resolve, reject) => {
      db.get(
        `SELECT a.*, d.visit_fee, d.id as doc_id 
         FROM appointments a 
         JOIN doctors d ON a.doctor_id = d.id 
         WHERE a.id = ?`,
        [appointmentId],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    if (!appointment) return

    // Only create a bill if the status is confirmed
    if (appointment.status !== 'confirmed') return

    // Check if a bill already exists for this appointment
    const existingBill = await new Promise((resolve, reject) => {
      db.get(
        "SELECT id FROM advanced_bills WHERE appointment_id = ?",
        [appointmentId],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    if (existingBill) return

    const fee = appointment.visit_fee || 0
    const created_by = user ? user.id : null

    await createAdvancedBill({
      patient_id: appointment.patient_id,
      doctor_id: appointment.doc_id,
      appointment_id: appointmentId,
      subtotal: fee,
      discount_type: 'amount',
      discount_value: 0,
      paid_amount: 0,
      payment_method: 'cash',
      created_by
    })
    console.log(`Auto-created Doctor Visit bill for appointment ${appointmentId} with fee ${fee}`)
  } catch (err) {
    console.error(`Error auto-creating bill for appointment ${appointmentId}:`, err)
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteAppointmentById,
  getAvailableSlots,
}
