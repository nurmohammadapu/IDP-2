const { getDB } = require("../db")

function logActivity(activityData) {
  return new Promise((resolve, reject) => {
    const db = getDB()
    const { user_id, action, table_name, record_id, old_values, new_values, ip_address } = activityData

    const sql = `
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `

    db.run(
      sql,
      [
        user_id,
        action,
        table_name,
        record_id,
        JSON.stringify(old_values || {}),
        JSON.stringify(new_values || {}),
        ip_address,
      ],
      function(err) {
        if (err) {
          reject(err)
          return
        }
        resolve(this.lastID)
      },
    )
  })
}

function getAuditLogs(filters = {}) {
  return new Promise((resolve, reject) => {
    const db = getDB()
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

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      resolve(rows)
    })
  })
}

module.exports = {
  logActivity,
  getAuditLogs,
}
