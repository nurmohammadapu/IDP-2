const {
  createUser,
  getAllUsers,
  deleteUser,
  updateUserStatus,
  updateUserByAdmin,
  findUserByEmail
} = require("../models/userModel")
const { getAuthenticatedUser } = require("../middleware/authMiddleware")
const { getDB } = require("../db")

async function getAll(req, res) {
  try {
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." })
    }

    const users = await getAllUsers()
    return res.json(users)
  } catch (error) {
    console.error("Get admin users error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function create(req, res) {
  try {
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." })
    }

    const { name, email, password, role, status, phone, address, specialty, room_number, visit_fee, age, gender } = req.body

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Name, email, password, and role are required" })
    }

    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" })
    }

    const userId = await createUser({ name, email, password, role, status: status || 'active' })
    const db = getDB()

    try {
      if (role === "doctor") {
        if (!specialty || !phone) {
          await new Promise((resolve) => db.run("DELETE FROM users WHERE id = ?", [userId], () => resolve()))
          return res.status(400).json({ error: "Specialty and contact phone number are required for doctors" })
        }
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO doctors (user_id, name, specialty, contact, room_number, visit_fee, schedule)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, specialty, phone, room_number || "", visit_fee || 0, "Not scheduled yet"],
            function (err) {
              if (err) reject(err)
              else resolve()
            }
          )
        })
      } else if (role === "patient") {
        if (!age || !gender || !phone || !address) {
          await new Promise((resolve) => db.run("DELETE FROM users WHERE id = ?", [userId], () => resolve()))
          return res.status(400).json({ error: "Age, gender, contact phone, and address are required for patients" })
        }
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO patients (user_id, name, age, gender, contact, address, medical_history)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, age, gender, phone, address, "None"],
            function (err) {
              if (err) reject(err)
              else resolve()
            }
          )
        })
      }

      // Update phone/address profile fields in users table
      if (phone || address || gender) {
        const { updateUserProfile } = require("../models/userModel")
        await updateUserProfile(userId, {
          name,
          phone: phone || "",
          address: address || "",
          gender: gender || "",
          date_of_birth: ""
        })
      }
    } catch (dbError) {
      await new Promise((resolve) => db.run("DELETE FROM users WHERE id = ?", [userId], () => resolve()))
      return res.status(400).json({ error: "Linked table creation failed: " + dbError.message })
    }

    return res.status(201).json({ message: "User created successfully", userId })
  } catch (error) {
    console.error("Create admin user error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function update(req, res) {
  try {
    const { id } = req.params
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." })
    }

    const { name, email, role, status } = req.body
    if (!name || !email || !role || !status) {
      return res.status(400).json({ error: "Name, email, role, and status are required" })
    }

    await updateUserByAdmin(id, { name, email, role, status })

    // Keep name in doctors/patients synchronized
    const db = getDB()
    if (role === "doctor") {
      db.run("UPDATE doctors SET name = ? WHERE user_id = ?", [name, id])
    } else if (role === "patient") {
      db.run("UPDATE patients SET name = ? WHERE user_id = ?", [name, id])
    }

    return res.json({ message: "User updated successfully" })
  } catch (error) {
    console.error("Update admin user error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function changeStatus(req, res) {
  try {
    const { id } = req.params
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." })
    }

    const { status } = req.body
    if (!status) {
      return res.status(400).json({ error: "Status is required" })
    }

    await updateUserStatus(id, status)
    return res.json({ message: "User status updated successfully" })
  } catch (error) {
    console.error("Change status error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." })
    }

    // Get user role before delete
    const db = getDB()
    const user = await new Promise((resolve) => {
      db.get("SELECT role FROM users WHERE id = ?", [id], (err, row) => resolve(row))
    })

    if (user) {
      // Cascade delete manually just to be safe
      if (user.role === 'doctor') {
        db.run("DELETE FROM doctors WHERE user_id = ?", [id])
      } else if (user.role === 'patient') {
        db.run("DELETE FROM patients WHERE user_id = ?", [id])
      }
    }

    await deleteUser(id)
    return res.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Delete user error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getAssistants(req, res) {
  try {
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." })
    }

    const db = getDB()
    const sql = `
      SELECT da.id, da.assistant_user_id, da.doctor_id, u.name as assistant_name, u.email as assistant_email, u.phone as assistant_phone, d.name as doctor_name
      FROM doctor_assistants da
      JOIN users u ON da.assistant_user_id = u.id
      JOIN doctors d ON da.doctor_id = d.id
    `
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      return res.json(rows || [])
    })
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function assignAssistant(req, res) {
  try {
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." })
    }

    const { assistant_user_id, doctor_id } = req.body
    if (!assistant_user_id || !doctor_id) {
      return res.status(400).json({ error: "Assistant user and doctor are required" })
    }

    const db = getDB()
    db.run(
      "INSERT INTO doctor_assistants (assistant_user_id, doctor_id) VALUES (?, ?) ON CONFLICT(assistant_user_id) DO UPDATE SET doctor_id = EXCLUDED.doctor_id",
      [assistant_user_id, doctor_id],
      function (err) {
        if (err) return res.status(400).json({ error: err.message })
        return res.json({ message: "Assistant assigned successfully", id: this.lastID })
      }
    )
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function removeAssistant(req, res) {
  try {
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." })
    }

    const { id } = req.params
    const db = getDB()
    db.run("DELETE FROM doctor_assistants WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message })
      return res.json({ message: "Assistant unassigned successfully" })
    })
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" })
  }
}

module.exports = {
  getAll,
  create,
  update,
  changeStatus,
  remove,
  getAssistants,
  assignAssistant,
  removeAssistant
}
