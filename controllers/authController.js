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

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body

    if (!name || !email || !password || !role) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "All fields are required" }))
      return
    }

    if (role !== "patient") {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Only patient registration is allowed publicly" }))
      return
    }

    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "User with this email already exists" }))
      return
    }

    // Check unique phone number
    const { phone } = req.body
    if (phone) {
      const db = getDB()
      const existingPatientPhone = await new Promise((resolve, reject) => {
        db.get("SELECT id FROM patients WHERE contact = ?", [phone], (err, row) => {
          if (err) reject(err)
          else resolve(row)
        })
      })
      const existingDoctorPhone = await new Promise((resolve, reject) => {
        db.get("SELECT id FROM doctors WHERE contact = ?", [phone], (err, row) => {
          if (err) reject(err)
          else resolve(row)
        })
      })
      if (existingPatientPhone || existingDoctorPhone) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "User with this phone number already exists" }))
        return
      }
    }

    // Default status: pending for doctor/receptionist, active for admin/patient
    const status = (role === "doctor" || role === "receptionist") ? "pending" : "active";

    const userId = await createUser({ name, email, password, role, status })
    const db = getDB()

    try {
      if (role === "doctor") {
        const { specialty, phone, room_number, visit_fee } = req.body
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
        const { age, gender, phone, address } = req.body
        if (!phone) {
          await new Promise((resolve) => db.run("DELETE FROM users WHERE id = ?", [userId], () => resolve()))
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Contact phone number is required" }))
          return
        }

        const finalAge = age !== undefined && age !== "" ? parseInt(age) : 0
        const finalGender = gender || "Unspecified"
        const finalAddress = address || "Not specified"

        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO patients (user_id, name, age, gender, contact, address, medical_history)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, finalAge, finalGender, phone, finalAddress, "None"],
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
          address: req.body.address || "Not specified",
          gender: req.body.gender || "Unspecified",
          date_of_birth: req.body.date_of_birth || ""
        })
      }
    } catch (dbError) {
      // Rollback user creation on linked table errors (e.g. unique constraint on contact number)
      await new Promise((resolve) => db.run("DELETE FROM users WHERE id = ?", [userId], () => resolve()))
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Linked record error: " + dbError.message }))
      return
    }

    res.writeHead(201, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        message: "User registered successfully",
        userId,
        user: { id: userId, name, email, role, status },
      }),
    )
  } catch (error) {
    console.error("Register error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error: " + error.message }))
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Email and password are required" }))
      return
    }

    const user = await findUserByEmailOrPhone(email)
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Invalid credentials" }))
      return
    }

    const isValidPassword = verifyPassword(password, user.password)
    if (!isValidPassword) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Invalid credentials" }))
      return
    }

    // Check account status
    if (user.status && user.status !== "active") {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Your account is pending approval by an administrator." }))
      return
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
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=86400`,
    })
    res.end(
      JSON.stringify({
        message: "Login successful",
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      }),
    )
  } catch (error) {
    console.error("Login error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
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

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": "sessionId=; HttpOnly; Path=/; Max-Age=0",
    })
    res.end(JSON.stringify({ message: "Logout successful" }))
  } catch (error) {
    console.error("Logout error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function getCurrentUser(req, res) {
  try {
    const sessionId = req.cookies.sessionId

    if (!sessionId) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Not authenticated" }))
      return
    }

    const db = getDB()

    db.get(
      "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')",
      [sessionId],
      async (err, session) => {
        if (err) {
          console.error("Session check error:", err)
          res.writeHead(500, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Internal server error" }))
          return
        }

        if (!session) {
          res.writeHead(401, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Session expired" }))
          return
        }

        try {
          const user = await findUserById(session.user_id)
          if (user) delete user.password

          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ user }))
        } catch (userError) {
          console.error("User fetch error:", userError)
          res.writeHead(500, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Internal server error" }))
        }
      },
    )
  } catch (error) {
    console.error("getCurrentUser error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function updateProfile(req, res) {
  try {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not authenticated" }));
      return;
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
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session expired" }));
      return;
    }

    await updateUserProfile(session.user_id, req.body);
    const updatedUser = await findUserById(session.user_id);
    if (updatedUser) delete updatedUser.password;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Profile updated successfully", user: updatedUser }));
  } catch (error) {
    console.error("Update profile error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}

async function changePassword(req, res) {
  try {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not authenticated" }));
      return;
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
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session expired" }));
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Current password and new password are required" }));
      return;
    }

    if (newPassword.length < 6) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "New password must be at least 6 characters" }));
      return;
    }

    const user = await findUserById(session.user_id);
    const isValid = verifyPassword(currentPassword, user.password);

    if (!isValid) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Current password is incorrect" }));
      return;
    }

    await updateUserPassword(session.user_id, newPassword);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Password changed successfully" }));
  } catch (error) {
    console.error("Change password error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
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
