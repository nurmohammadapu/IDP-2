const { getDB } = require("../db")

// Create a new test record
function createTest(testData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const { name, category, price, description } = testData

    const sql = `
      INSERT INTO tests (name, category, price, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    db.run(sql, [name, category, price, description || ""], function (err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.lastID) // last inserted row id
    })
  })
}

// Get all tests sorted by category and name
function getAllTests() {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM tests ORDER BY category, name"
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      resolve(rows)
    })
  })
}

// Retrieve a single test by its ID
function getTestById(id) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM tests WHERE id = ?"
    db.get(sql, [id], (err, row) => {
      if (err) {
        reject(err)
        return
      }
      resolve(row)
    })
  })
}

// Update test details by ID
function updateTest(id, testData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const { name, category, price, description } = testData

    const sql = `
      UPDATE tests SET name = ?, category = ?, price = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `
    db.run(sql, [name, category, price, description, id], function (err) {
      if (err) {
        reject(err)
        return
      }
      resolve(true)
    })
  })
}

// Delete a test by its ID
function deleteTest(id) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM tests WHERE id = ?"
    db.run(sql, [id], function (err) {
      if (err) {
        reject(err)
        return
      }
      resolve(true)
    })
  })
}

module.exports = {
  createTest,
  getAllTests,
  getTestById,
  updateTest,
  deleteTest,
}
