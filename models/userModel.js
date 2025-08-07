const { getConnection } = require("../db")
const crypto = require("crypto")

function createUser(userData) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    const { name, email, password, role } = userData
    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex")

    console.log("Creating user with data:", { name, email, role })

    connection.query(
      "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())",
      [name, email, hashedPassword, role],
      (err, result) => {
        if (err) {
          console.error("Database error creating user:", err)
          reject(err)
          return
        }
        console.log("User created with ID:", result.insertId)
        resolve(result.insertId)
      },
    )
  })
}

function findUserByEmail(email) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
      if (err) {
        console.error("Database error finding user by email:", err)
        reject(err)
        return
      }
      resolve(results[0])
    })
  })
}

function findUserById(id) {
  return new Promise((resolve, reject) => {
    const connection = getConnection()
    connection.query("SELECT * FROM users WHERE id = ?", [id], (err, results) => {
      if (err) {
        console.error("Database error finding user by ID:", err)
        reject(err)
        return
      }
      resolve(results[0])
    })
  })
}

function verifyPassword(plainPassword, hashedPassword) {
  const inputHash = crypto.createHash("sha256").update(plainPassword).digest("hex")
  return inputHash === hashedPassword
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
}
