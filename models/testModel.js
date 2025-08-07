const { getConnection } = require("../db")

function createTest(testData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { name, category, price, description } = testData

    connection.query(
      "INSERT INTO tests (name, category, price, description) VALUES (?, ?, ?, ?)",
      [name, category, price, description || ""],
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

function getAllTests() {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("SELECT * FROM tests ORDER BY category, name", (err, results) => {
      if (err) {
        reject(err)
        return
      }
      resolve(results)
    })
  })
}

function getTestById(id) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("SELECT * FROM tests WHERE id = ?", [id], (err, results) => {
      if (err) {
        reject(err)
        return
      }
      resolve(results[0])
    })
  })
}

function updateTest(id, testData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { name, category, price, description } = testData

    connection.query(
      "UPDATE tests SET name = ?, category = ?, price = ?, description = ? WHERE id = ?",
      [name, category, price, description, id],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(true)
      },
    )
  })
}

function deleteTest(id) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("DELETE FROM tests WHERE id = ?", [id], (err) => {
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
