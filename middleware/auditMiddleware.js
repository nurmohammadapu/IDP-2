const { getDB } = require("../db")

// Audit logging middleware (SQLite)
function logAuditActivity(userId, action, tableName, recordId, oldValues = null, newValues = null, ipAddress = null) {
  return new Promise((resolve, reject) => {
    const db = getDB()

    db.run(
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
      ],
      function (err) {
        if (err) {
          console.error("Audit log error:", err)
          reject(err)
        } else {
          resolve(this.lastID) // SQLite uses lastID instead of insertId
        }
      }
    )
  })
}

// Get user ID from session (SQLite)
async function getUserFromSession(req) {
  return new Promise((resolve) => {
    const sessionId = req.cookies?.sessionId
    if (!sessionId) {
      resolve(null)
      return
    }

    const db = getDB()
    db.get(
      "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')",
      [sessionId],
      (err, row) => {
        if (err || !row) {
          resolve(null)
        } else {
          resolve(row.user_id)
        }
      }
    )
  })
}

// Audit wrapper function
async function auditAction(req, action, tableName, recordId, oldValues = null, newValues = null) {
  try {
    const userId = await getUserFromSession(req)
    const ipAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress || "unknown"

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
