const { promisify } = require("util")
const { getDB } = require("../db")

// Create a new test record
async function createTest(testData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { name, category, price, description } = testData

    const sql = `
      INSERT INTO tests (name, category, price, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    const result = await run(sql, [name, category, price, description || ""])
    return result.lastID // last inserted row id
  } catch (err) {
    console.error("createTest database error:", err)
    throw err
  }
}

// Get all tests sorted by category and name
async function getAllTests() {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const sql = "SELECT * FROM tests ORDER BY category, name"
    const rows = await all(sql, [])
    return rows
  } catch (err) {
    console.error("getAllTests database error:", err)
    throw err
  }
}

// Retrieve a single test by its ID
async function getTestById(id) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const sql = "SELECT * FROM tests WHERE id = ?"
    const row = await get(sql, [id])
    return row
  } catch (err) {
    console.error("getTestById database error:", err)
    throw err
  }
}

// Update test details by ID
async function updateTest(id, testData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { name, category, price, description } = testData

    const sql = `
      UPDATE tests SET name = ?, category = ?, price = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `
    const result = await run(sql, [name, category, price, description, id])
    return result.changes > 0
  } catch (err) {
    console.error("updateTest database error:", err)
    throw err
  }
}

// Delete a test by its ID
async function deleteTest(id) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const sql = "DELETE FROM tests WHERE id = ?"
    const result = await run(sql, [id])
    return result.changes > 0
  } catch (err) {
    console.error("deleteTest database error:", err)
    throw err
  }
}

module.exports = {
  createTest,
  getAllTests,
  getTestById,
  updateTest,
  deleteTest,
}
