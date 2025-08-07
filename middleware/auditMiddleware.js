const { getConnection } = require("../db")

// Audit logging middleware
function logAuditActivity(userId, action, tableName, recordId, oldValues = null, newValues = null, ipAddress = null) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()

    connection.query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        action,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
      ],
      (err, result) => {
        if (err) {
          console.error("Audit log error:", err)
          reject(err)
        } else {
          resolve(result.insertId)
        }
      },
    )
  })
}

// Get user ID from session
async function getUserFromSession(req) {
  return new Promise((resolve) => {
    const sessionId = req.cookies?.sessionId
    if (!sessionId) {
      resolve(null)
      return
    }

    const connection = getConnection()
    connection.query(
      "SELECT user_id FROM sessions WHERE id = ? AND expires_at > NOW()",
      [sessionId],
      (err, results) => {
        if (err || results.length === 0) {
          resolve(null)
        } else {
          resolve(results[0].user_id)
        }
      },
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
