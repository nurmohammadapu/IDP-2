const { getConnection } = require("../db")

function createNotification(notificationData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { user_id, title, message, type, related_id } = notificationData

    connection.query(
      "INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)",
      [user_id, title, message, type || "info", related_id || null],
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

function getUserNotifications(userId) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query(
      "SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50",
      [userId],
      (err, results) => {
        if (err) {
          reject(err)
          return
        }
        resolve(results)
      },
    )
  })
}

function markAsRead(notificationId) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [notificationId], (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve(true)
    })
  })
}

function getUnreadCount(userId) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query(
      "SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0",
      [userId],
      (err, results) => {
        if (err) {
          reject(err)
          return
        }
        resolve(results[0].count)
      },
    )
  })
}

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  getUnreadCount,
}
