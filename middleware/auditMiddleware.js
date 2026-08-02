const { promisify } = require("util")
const { getDB } = require("../db")

// Audit logging middleware (SQLite)
async function logAuditActivity(userId, action, tableName, recordId, oldValues = null, newValues = null, ipAddress = null) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)

    const result = await run(
      `INSERT INTO audit_logs 
        (user_id, action, table_name, record_id, old_values, new_values, ip_address, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        userId,
        action,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
      ]
    )
    return result.lastID // SQLite uses lastID
  } catch (err) {
    console.error("Audit log error:", err)
    throw err
  }
}

// Get user ID from session (SQLite)
async function getUserFromSession(req) {
  try {
    const sessionId = req.cookies?.sessionId
    if (!sessionId) {
      return null
    }

    const db = getDB()
    const get = promisify(db.get).bind(db)
    const row = await get(
      "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')",
      [sessionId]
    )
    return row ? row.user_id : null
  } catch (err) {
    console.error("Get user from session error:", err)
    return null
  }
}

// Audit wrapper function
async function auditAction(req, action, tableName, recordId, oldValues = null, newValues = null) {
  try {
    const userId = await getUserFromSession(req)
    const ipAddress = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown"

    await logAuditActivity(userId, action, tableName, recordId, oldValues, newValues, ipAddress)
  } catch (error) {
    console.error("Failed to log audit activity:", error)
  }
}

module.exports = {
  logAuditActivity,
  getUserFromSession,
  auditAction,
}
