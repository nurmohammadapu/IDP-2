const { promisify } = require("util")
const { getDB } = require("../db")

async function logActivity(activityData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { user_id, action, table_name, record_id, old_values, new_values, ip_address } = activityData

    const sql = `
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `

    const result = await run(
      sql,
      [
        user_id,
        action,
        table_name,
        record_id,
        JSON.stringify(old_values || {}),
        JSON.stringify(new_values || {}),
        ip_address,
      ]
    )
    return result.lastID
  } catch (err) {
    console.error("logActivity database error:", err)
    throw err
  }
}

async function getAuditLogs(filters = {}) {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    let query = `
      SELECT a.*, u.name as user_name, u.email as user_email 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `
    const params = []

    if (filters.user_id) {
      query += " AND a.user_id = ?"
      params.push(filters.user_id)
    }

    if (filters.action) {
      query += " AND a.action = ?"
      params.push(filters.action)
    }

    if (filters.table_name) {
      query += " AND a.table_name = ?"
      params.push(filters.table_name)
    }

    if (filters.date_from) {
      query += " AND date(a.created_at) >= date(?)"
      params.push(filters.date_from)
    }

    if (filters.date_to) {
      query += " AND date(a.created_at) <= date(?)"
      params.push(filters.date_to)
    }

    query += " ORDER BY a.created_at DESC LIMIT 100"

    const rows = await all(query, params)
    return rows
  } catch (err) {
    console.error("getAuditLogs database error:", err)
    throw err
  }
}

module.exports = {
  logActivity,
  getAuditLogs,
}
