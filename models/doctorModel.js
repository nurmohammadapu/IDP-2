const { getDB } = require("../db")

// Create a new doctor record in the database
function createDoctor(doctorData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const { unique_id, name, specialty, contact, room_number, visit_fee, schedule } = doctorData
    const sql = `INSERT INTO doctors (unique_id, name, specialty, contact, room_number, visit_fee, schedule, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    db.run(sql, [unique_id || null, name, specialty, contact, room_number || "", visit_fee || 0, schedule || ""], function(err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.lastID)
    })
  })
}

// Retrieve all doctors ordered by creation date descending
function getAllDoctors() {
  const db = getDB()
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM doctors ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      resolve(rows)
    })
  })
}

// Retrieve a single doctor by their ID
function getDoctorById(id) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM doctors WHERE id = ?", [id], (err, row) => {
      if (err) {
        reject(err)
        return
      }
      resolve(row)
    })
  })
}

// Update an existing doctor's details by ID
function updateDoctor(id, doctorData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const { unique_id, name, specialty, contact, room_number, visit_fee, schedule } = doctorData
    const sql = `UPDATE doctors SET unique_id = ?, name = ?, specialty = ?, contact = ?, room_number = ?, visit_fee = ?, schedule = ?, updated_at = datetime('now') WHERE id = ?`
    db.run(sql, [unique_id || null, name, specialty, contact, room_number, visit_fee, schedule, id], function(err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.changes > 0)
    })
  })
}

// Delete a doctor record by ID
function deleteDoctor(id) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    db.get("SELECT user_id FROM doctors WHERE id = ?", [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      const userId = row ? row.user_id : null;
      db.run("DELETE FROM doctors WHERE id = ?", [id], function(err2) {
        if (err2) {
          reject(err2);
          return;
        }
        if (userId) {
          db.run("DELETE FROM users WHERE id = ?", [userId], (err3) => {
            if (err3) {
              console.error("Error deleting linked doctor user:", err3);
            }
            resolve(this.changes > 0);
          });
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  });
}

function searchDoctors(query) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const searchTerm = `%${query}%`
    db.all(
      "SELECT * FROM doctors WHERE name LIKE ? OR contact LIKE ? ORDER BY created_at DESC",
      [searchTerm, searchTerm],
      (err, rows) => {
        if (err) {
          reject(err)
          return
        }
        resolve(rows)
      }
    )
  })
}


module.exports = {
  createDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
  searchDoctors
}
