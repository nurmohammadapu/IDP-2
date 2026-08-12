const {
  createUser,
  findUserByEmail,
  findUserByEmailOrPhone,
  findUserById,
  verifyPassword,
  updateUserProfile,
  updateUserPassword,
} = require("../models/userModel")
const crypto = require("crypto")
const { getDB } = require("../db") 

function formatDBError(err) {
  const msg = err && err.message ? err.message : String(err)
  if (msg.includes("UNIQUE constraint failed: patients.contact") || msg.includes("patients.contact") || msg.includes("users.phone")) {
    return "This phone number is already registered with another account."
  }
  if (msg.includes("UNIQUE constraint failed: users.email") || msg.includes("users.email")) {
    return "This email address is already registered with another account."
  }
  if (msg.includes("UNIQUE constraint failed: doctors.contact")) {
    return "This contact number is already registered for another doctor."
  }
  if (msg.includes("UNIQUE constraint failed")) {
    return "An account with this information already exists."
  }
  return msg
}

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields are required" })
    }

    if (role !== "patient") {
      return res.status(400).json({ error: "Only patient registration is allowed publicly" })
    }

    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return res.status(400).json({ error: "This email address is already registered" })
    }

    const db = getDB()
    const patientPhone = req.body.phone || req.body.contact || ""
    if (patientPhone) {
      const existingPhone = await new Promise((resolve) => {
        db.get("SELECT id FROM patients WHERE contact = ?", [patientPhone], (err, row) => resolve(row))
      })
      if (existingPhone) {
        return res.status(400).json({ error: "This phone number is already registered with another account" })
      }
    }

    // Default status: pending for doctor/receptionist, active for admin/patient
    const status = (role === "doctor" || role === "receptionist") ? "pending" : "active";

    const userId = await createUser({ name, email, password, role, status })

    try {
      if (role === "doctor") {
        const { specialty, phone, room_number, visit_fee } = req.body
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
        const { age, gender, phone, address } = req.body
        const phoneNum = phone || req.body.contact || ""
        if (!phoneNum) {
          await new Promise((resolve) => db.run("DELETE FROM users WHERE id = ?", [userId], () => resolve()))
          return res.status(400).json({ error: "Contact phone number is required for patients" })
        }
        const patientAge = age ? parseInt(age, 10) : 0
        const patientGender = gender || "Not Specified"
        const patientAddress = address || "N/A"

        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO patients (user_id, name, age, gender, contact, address, medical_history)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, patientAge, patientGender, phoneNum, patientAddress, "None"],
            function (err) {
              if (err) reject(err)
              else resolve()
            }
          )
        })
      }

      // Update phone & address on users profile columns too
      if (req.body.phone || req.body.address) {
        await updateUserProfile(userId, {
          name,
          phone: req.body.phone,
          address: req.body.address,
          gender: req.body.gender || "",
          date_of_birth: req.body.date_of_birth || ""
        })
      }
    } catch (dbError) {
      // Rollback user creation on linked table errors
      await new Promise((resolve) => db.run("DELETE FROM users WHERE id = ?", [userId], () => resolve()))
      return res.status(400).json({ error: formatDBError(dbError) })
    }

    return res.status(201).json({
      message: "User registered successfully",
      userId,
      user: { id: userId, name, email, role, status },
    })
  } catch (error) {
    console.error("Register error:", error)
    return res.status(400).json({ error: formatDBError(error) })
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email or phone number and password are required" })
    }

    const user = await findUserByEmailOrPhone(email)
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const isValidPassword = verifyPassword(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Check account status
    if (user.status && user.status !== "active") {
      return res.status(403).json({ error: "Your account is pending approval by an administrator." })
    }

    // Create session in SQLite
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours, ISO string

    const db = getDB()

    await new Promise((resolve, reject) => {
      const sql = "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
      db.run(sql, [sessionId, user.id, expiresAt], function (err) {
        if (err) reject(err)
        else resolve()
      })
    })

    // Set cookie and respond
    res.cookie("sessionId", sessionId, { httpOnly: true, path: "/", maxAge: 86400000 })
    return res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error("Login error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function logout(req, res) {
  try {
    const sessionId = req.cookies.sessionId

    if (sessionId) {
      const db = getDB()
      await new Promise((resolve, reject) => {
        db.run("DELETE FROM sessions WHERE id = ?", [sessionId], function (err) {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    res.clearCookie("sessionId", { httpOnly: true, path: "/" })
    return res.json({ message: "Logout successful" })
  } catch (error) {
    console.error("Logout error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getCurrentUser(req, res) {
  try {
    const sessionId = req.cookies.sessionId

    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" })
    }

    const db = getDB()

    db.get(
      "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')",
      [sessionId],
      async (err, session) => {
        if (err) {
          console.error("Session check error:", err)
          return res.status(500).json({ error: "Internal server error" })
        }

        if (!session) {
          return res.status(401).json({ error: "Session expired" })
        }

        try {
          const user = await findUserById(session.user_id)
          if (user) delete user.password

          return res.json({ user })
        } catch (userError) {
          console.error("User fetch error:", userError)
          return res.status(500).json({ error: "Internal server error" })
        }
      },
    )
  } catch (error) {
    console.error("getCurrentUser error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function updateProfile(req, res) {
  try {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" })
    }

    const db = getDB();

    const session = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')",
        [sessionId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!session) {
      return res.status(401).json({ error: "Session expired" })
    }

    await updateUserProfile(session.user_id, req.body);
    const updatedUser = await findUserById(session.user_id);
    if (updatedUser) delete updatedUser.password;

    return res.json({ message: "Profile updated successfully", user: updatedUser })
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function changePassword(req, res) {
  try {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" })
    }

    const db = getDB();

    const session = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')",
        [sessionId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!session) {
      return res.status(401).json({ error: "Session expired" })
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" })
    }

    const user = await findUserById(session.user_id);
    const isValid = verifyPassword(currentPassword, user.password);

    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" })
    }

    await updateUserPassword(session.user_id, newPassword);

    return res.json({ message: "Password changed successfully" })
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Internal server error" })
  }
}

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
}
