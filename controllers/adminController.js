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
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Access denied. Admin only." }))
      return
    }

    const users = await getAllUsers()
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(users))
  } catch (error) {
    console.error("Get admin users error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function create(req, res) {
  try {
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Access denied. Admin only." }))
      return
    }

    const { name, email, password, role, status, phone, address, specialty, room_number, visit_fee, age, gender } = req.body

    if (!name || !email || !password || !role) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, email, password, and role are required" }))
      return
    }

    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "User with this email already exists" }))
      return
    }

    const userId = await createUser({ name, email, password, role, status: status || 'active' })
    const db = getDB()

    try {
      if (role === "doctor") {
        if (!specialty || !phone) {
          await new Promise((resolve) => db.run("DELETE FROM users WHERE id = ?", [userId], () => resolve()))
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Specialty and contact phone number are required for doctors" }))
          return
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
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Age, gender, contact phone, and address are required for patients" }))
          return
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
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Linked table creation failed: " + dbError.message }))
      return
    }

    res.writeHead(201, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "User created successfully", userId }))
  } catch (error) {
    console.error("Create admin user error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function update(req, res, id) {
  try {
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Access denied. Admin only." }))
      return
    }

    const { name, email, role, status } = req.body
    if (!name || !email || !role || !status) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, email, role, and status are required" }))
      return
    }

    await updateUserByAdmin(id, { name, email, role, status })

    // Keep name in doctors/patients synchronized
    const db = getDB()
    if (role === "doctor") {
      db.run("UPDATE doctors SET name = ? WHERE user_id = ?", [name, id])
    } else if (role === "patient") {
      db.run("UPDATE patients SET name = ? WHERE user_id = ?", [name, id])
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "User updated successfully" }))
  } catch (error) {
    console.error("Update admin user error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function changeStatus(req, res, id) {
  try {
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Access denied. Admin only." }))
      return
    }

    const { status } = req.body
    if (!status) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Status is required" }))
      return
    }

    await updateUserStatus(id, status)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "User status updated successfully" }))
  } catch (error) {
    console.error("Change status error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function remove(req, res, id) {
  try {
    const adminUser = await getAuthenticatedUser(req)
    if (!adminUser || adminUser.role !== "admin") {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Access denied. Admin only." }))
      return
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
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "User deleted successfully" }))
  } catch (error) {
    console.error("Delete user error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = {
  getAll,
  create,
  update,
  changeStatus,
  remove
}
