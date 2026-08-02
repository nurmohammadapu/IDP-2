const { promisify } = require("util")
const { getDB } = require("../db")

// Create a new notification record
async function createNotification(notificationData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { user_id, title, message, type, related_id } = notificationData

    const result = await run(
      "INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)",
      [user_id, title, message, type || "info", related_id || null]
    )
    return result.lastID
  } catch (err) {
    console.error("createNotification database error:", err)
    throw err
  }
}

// Retrieve notifications for a user (including global notifications with user_id NULL)
async function getUserNotifications(userId) {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const results = await all(
      "SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50",
      [userId]
    )
    return results
  } catch (err) {
    console.error("getUserNotifications database error:", err)
    throw err
  }
}

// Mark a notification as read by setting its is_read flag to 1
async function markAsRead(notificationId) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    await run(
      "UPDATE notifications SET is_read = 1 WHERE id = ?",
      [notificationId]
    )
    return true
  } catch (err) {
    console.error("markAsRead database error:", err)
    throw err
  }
}

// Get the count of unread notifications for a user (including global notifications)
async function getUnreadCount(userId) {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const results = await all(
      "SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0",
      [userId]
    )
    return results[0].count
  } catch (err) {
    console.error("getUnreadCount database error:", err)
    throw err
  }
}

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  getUnreadCount,
}
