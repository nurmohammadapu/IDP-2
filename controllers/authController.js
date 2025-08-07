const { createUser, findUserByEmail, findUserById, verifyPassword } = require("../models/userModel")
const crypto = require("crypto")
const { getConnection } = require("../db")

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body

    console.log("Registration attempt:", { name, email, role })

    if (!name || !email || !password || !role) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "All fields are required" }))
      return
    }

    // Validate role
    const validRoles = ["admin", "doctor", "receptionist", "patient"]
    if (!validRoles.includes(role)) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Invalid role selected" }))
      return
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "User with this email already exists" }))
      return
    }

    // Create user
    const userId = await createUser({ name, email, password, role })

    console.log("User created successfully:", userId)

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

    // Create session
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const connection = getConnection()

    connection.query(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
      [sessionId, user.id, expiresAt],
      (err) => {
        if (err) {
          console.error("Session creation error:", err)
          res.writeHead(500, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Internal server error" }))
          return
        }

        // Set cookie
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
      },
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
      const connection = getConnection()
      connection.query("DELETE FROM sessions WHERE id = ?", [sessionId], (err) => {
        if (err) {
          console.error("Logout error:", err)
        }
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

    const connection = getConnection()
    connection.query(
      "SELECT * FROM sessions WHERE id = ? AND expires_at > NOW()",
      [sessionId],
      async (err, sessions) => {
        if (err) {
          console.error("Session check error:", err)
          res.writeHead(500, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Internal server error" }))
          return
        }

        if (sessions.length === 0) {
          res.writeHead(401, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Session expired" }))
          return
        }

        try {
          const user = await findUserById(sessions[0].user_id)
          delete user.password

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
