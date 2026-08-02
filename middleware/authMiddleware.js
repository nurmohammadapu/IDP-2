const { promisify } = require("util")
const { getDB } = require("../db")
const { findUserById } = require("../models/userModel")

async function getAuthenticatedUser(req) {
  try {
    const sessionId = req.cookies?.sessionId
    if (!sessionId) return null

    const db = getDB()
    const get = promisify(db.get).bind(db)

    const session = await get(
      "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')",
      [sessionId]
    )

    if (!session) return null

    const user = await findUserById(session.user_id)
    return user || null
  } catch (error) {
    console.error("Get authenticated user error:", error)
    return null
  }
}

async function authenticate(req, res, allowedRoles = []) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    res.status(401).json({ error: "Not authenticated" })
    return null
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    res.status(403).json({ error: "Access denied" })
    return null
  }
  return user
}

module.exports = {
  getAuthenticatedUser,
  authenticate,
}
