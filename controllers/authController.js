const {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
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

    const validRoles = ["admin", "doctor", "receptionist", "patient"]
    if (!validRoles.includes(role)) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Invalid role selected" }))
      return
    }

    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "User with this email already exists" }))
      return
    }

    const userId = await createUser({ name, email, password, role })

    res.writeHead(201, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        message: "User registered successfully",
        userId,
        user: { id: userId, name, email, role },
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

    const user = await findUserByEmail(email)
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

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
}
