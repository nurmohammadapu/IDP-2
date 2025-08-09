const { getDB } = require("../db")

// Create a new notification record
function createNotification(notificationData) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    const { user_id, title, message, type, related_id } = notificationData

    connection.query(
      "INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)",
      [user_id, title, message, type || "info", related_id || null],
      (err, result) => {
        if (err) {
          reject(err)  // Reject promise if an error occurs
          return
        }
        resolve(result.insertId)  // Resolve with the new notification ID
      },
    )
  })
}

// Retrieve notifications for a user (including global notifications with user_id NULL)
function getUserNotifications(userId) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    connection.query(
      "SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50",
      [userId],
      (err, results) => {
        if (err) {
          reject(err)  // Reject promise if an error occurs
          return
        }
        resolve(results)  // Resolve with list of notifications
      },
    )
  })
}

// Mark a notification as read by setting its is_read flag to 1
function markAsRead(notificationId) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    connection.query(
      "UPDATE notifications SET is_read = 1 WHERE id = ?",
      [notificationId],
      (err) => {
        if (err) {
          reject(err)  // Reject promise if an error occurs
          return
        }
        resolve(true)  // Resolve indicating success
      },
    )
  })
}

// Get the count of unread notifications for a user (including global notifications)
function getUnreadCount(userId) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    connection.query(
      "SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0",
      [userId],
      (err, results) => {
        if (err) {
          reject(err)  // Reject promise if an error occurs
          return
        }
        resolve(results[0].count)  // Resolve with unread notification count
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
