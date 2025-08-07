const { getConnection } = require("../db")

function logActivity(activityData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { user_id, action, table_name, record_id, old_values, new_values, ip_address } = activityData

    connection.query(
      "INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        user_id,
        action,
        table_name,
        record_id,
        JSON.stringify(old_values || {}),
        JSON.stringify(new_values || {}),
        ip_address,
      ],
      (err, result) => {
        if (err) {
          reject(err)
          return
        }
        resolve(result.insertId)
      },
    )
  })
}

function getAuditLogs(filters = {}) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
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
      query += " AND DATE(a.created_at) >= ?"
      params.push(filters.date_from)
    }

    if (filters.date_to) {
      query += " AND DATE(a.created_at) <= ?"
      params.push(filters.date_to)
    }

    query += " ORDER BY a.created_at DESC LIMIT 100"

    connection.query(query, params, (err, results) => {
      if (err) {
        reject(err)
        return
      }
      resolve(results)
    })
  })
}

module.exports = {
  logActivity,
  getAuditLogs,
}
