const { getDB } = require("../db")

// Create a new advanced bill with items and optional initial payment
function createAdvancedBill(billData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const {
      patient_id,
      billing_date,
      items,
      subtotal,
      discount_type,
      discount_value,
      paid_amount,
      payment_method,
    } = billData

    let discount_amount = 0
    if (discount_type === "percentage") {
      discount_amount = (subtotal * discount_value) / 100
    } else {
      discount_amount = discount_value || 0
    }

    const final_total = subtotal - discount_amount
    const due_amount = final_total - (paid_amount || 0)

    // Lookup latest appointment for the patient to resolve their doctor_id automatically
    db.get(
      "SELECT doctor_id FROM appointments WHERE patient_id = ? ORDER BY appointment_date DESC, appointment_time DESC LIMIT 1",
      [patient_id],
      (appErr, appRow) => {
        const resolvedDoctorId = billData.doctor_id || (appRow ? appRow.doctor_id : null);
        const resolvedCreatedBy = billData.created_by || null;

        const sql = `
          INSERT INTO advanced_bills (
            patient_id, doctor_id, created_by, billing_date, subtotal, discount_type, discount_value, 
            discount_amount, total_amount, paid_amount, due_amount, payment_method, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `

        db.run(
          sql,
          [
            patient_id,
            resolvedDoctorId,
            resolvedCreatedBy,
            billing_date,
            subtotal,
            discount_type || "amount",
            discount_value || 0,
            discount_amount,
            final_total,
            paid_amount || 0,
            due_amount,
            payment_method || "cash",
          ],
          function (err) {
            if (err) {
              console.error("Error creating advanced bill:", err)
              reject(err)
              return
            }

        const billId = this.lastID

        if (items && items.length > 0) {
          const insertItems = items.map(
            (item) =>
              new Promise((res, rej) => {
                const sqlItem = `
                  INSERT INTO bill_items (bill_id, item_type, test_id, item_name, item_price, created_at)
                  VALUES (?, ?, ?, ?, ?, datetime('now'))
                `
                db.run(
                  sqlItem,
                  [
                    billId,
                    item.type,
                    item.type === "test" ? item.id : null,
                    item.name,
                    item.price,
                  ],
                  function (err) {
                    if (err) {
                      rej(err)
                      return
                    }
                    res()
                  },
                )
              }),
          )

          Promise.all(insertItems)
            .then(() => {
              if (paid_amount > 0) {
                 const sqlPayment = `
                   INSERT INTO bill_payments (bill_id, amount, payment_method, payment_date, created_by, created_at)
                   VALUES (?, ?, ?, ?, ?, datetime('now'))
                 `
                 db.run(
                   sqlPayment,
                   [billId, paid_amount, payment_method || "cash", new Date().toISOString(), resolvedCreatedBy],
                   function (err) {
                    if (err) {
                      reject(err)
                      return
                    }
                    resolve(billId)
                  },
                )
              } else {
                resolve(billId)
              }
            })
            .catch(reject)
        } else {
          resolve(billId)
        }
      })
    })
  })
}

// Retrieve all advanced bills with associated patient name and contact
function getAllAdvancedBills(user) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const handleResult = (err, rows) => {
      if (err) {
        console.error("Error getting advanced bills:", err)
        reject(err)
        return
      }
      resolve(rows)
    }

    if (!user || user.role === 'admin' || user.role === 'accountant' || user.role === 'receptionist') {
      const sql = `
        SELECT ab.*, p.name as patient_name, p.contact as patient_contact 
        FROM advanced_bills ab 
        JOIN patients p ON ab.patient_id = p.id 
        ORDER BY ab.id DESC
      `
      db.all(sql, [], handleResult)
    } else if (user.role === 'doctor') {
      db.get("SELECT id FROM doctors WHERE user_id = ?", [user.id], (docErr, docRow) => {
        const docId = docRow ? docRow.id : -1;
        const sql = `
          SELECT ab.*, p.name as patient_name, p.contact as patient_contact 
          FROM advanced_bills ab 
          JOIN patients p ON ab.patient_id = p.id 
          WHERE ab.doctor_id = ?
          ORDER BY ab.id DESC
        `
        db.all(sql, [docId], handleResult)
      })
    } else if (user.role === 'patient') {
      db.get("SELECT id FROM patients WHERE user_id = ?", [user.id], (patErr, patRow) => {
        const patId = patRow ? patRow.id : -1;
        const sql = `
          SELECT ab.*, p.name as patient_name, p.contact as patient_contact 
          FROM advanced_bills ab 
          JOIN patients p ON ab.patient_id = p.id 
          WHERE ab.patient_id = ?
          ORDER BY ab.id DESC
        `
        db.all(sql, [patId], handleResult)
      })
    } else {
      resolve([])
    }
  })
}

// Retrieve detailed bill by ID including bill items and payment history
function getAdvancedBillById(id) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT ab.*, p.name as patient_name, p.contact as patient_contact, p.address as patient_address
      FROM advanced_bills ab 
      JOIN patients p ON ab.patient_id = p.id 
      WHERE ab.id = ?
    `
    db.get(sql, [id], (err, bill) => {
      if (err) {
        console.error("Error getting advanced bill by id:", err)
        reject(err)
        return
      }

      if (!bill) {
        resolve(null)
        return
      }

      db.all("SELECT * FROM bill_items WHERE bill_id = ?", [id], (err, items) => {
        if (err) {
          console.error("Error getting bill items:", err)
          reject(err)
          return
        }

        db.all(
          "SELECT * FROM bill_payments WHERE bill_id = ? ORDER BY payment_date DESC",
          [id],
          (err, payments) => {
            if (err) {
              console.error("Error getting bill payments:", err)
              reject(err)
              return
            }

            bill.items = items
            bill.payments = payments
            resolve(bill)
          },
        )
      })
    })
  })
}

// Update an existing advanced bill and replace its items
function updateAdvancedBill(id, billData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const {
      patient_id,
      billing_date,
      items,
      subtotal,
      discount_type,
      discount_value,
      paid_amount,
      payment_method,
    } = billData

    let discount_amount = 0
    if (discount_type === "percentage") {
      discount_amount = (subtotal * discount_value) / 100
    } else {
      discount_amount = discount_value || 0
    }

    const final_total = subtotal - discount_amount
    const due_amount = final_total - (paid_amount || 0)

    const sqlUpdate = `
      UPDATE advanced_bills SET 
        patient_id = ?, billing_date = ?, subtotal = ?, discount_type = ?, 
        discount_value = ?, discount_amount = ?, total_amount = ?, 
        paid_amount = ?, due_amount = ?, payment_method = ?, updated_at = datetime('now')
      WHERE id = ?
    `
    db.run(
      sqlUpdate,
      [
        patient_id,
        billing_date,
        subtotal,
        discount_type || "amount",
        discount_value || 0,
        discount_amount,
        final_total,
        paid_amount || 0,
        due_amount,
        payment_method || "cash",
        id,
      ],
      function (err) {
        if (err) {
          console.error("Error updating advanced bill:", err)
          reject(err)
          return
        }

        db.run("DELETE FROM bill_items WHERE bill_id = ?", [id], function (err) {
          if (err) {
            console.error("Error deleting old bill items:", err)
            reject(err)
            return
          }

          if (items && items.length > 0) {
            const insertItems = items.map(
              (item) =>
                new Promise((res, rej) => {
                  const sqlItem = `
                    INSERT INTO bill_items (bill_id, item_type, test_id, item_name, item_price, created_at)
                    VALUES (?, ?, ?, ?, ?, datetime('now'))
                  `
                  db.run(
                    sqlItem,
                    [
                      id,
                      item.type,
                      item.type === "test" ? item.id : null,
                      item.name,
                      item.price,
                    ],
                    function (err) {
                      if (err) {
                        rej(err)
                        return
                      }
                      res()
                    },
                  )
                }),
            )

            Promise.all(insertItems)
              .then(() => resolve(true))
              .catch(reject)
          } else {
            resolve(true)
          }
        })
      },
    )
  })
}

// Add a payment to an existing bill and update paid/due amounts
function addPayment(billId, paymentData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const { amount, payment_method, notes, created_by } = paymentData

    const sqlInsertPayment = `
      INSERT INTO bill_payments (bill_id, amount, payment_method, notes, payment_date, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `
    db.run(
      sqlInsertPayment,
      [billId, amount, payment_method, notes || "", new Date().toISOString(), created_by || null],
      function (err) {
        if (err) {
          console.error("Error adding payment:", err)
          reject(err)
          return
        }

        const sqlUpdateBill = `
          UPDATE advanced_bills SET 
            paid_amount = paid_amount + ?, 
            due_amount = due_amount - ?
          WHERE id = ?
        `
        db.run(sqlUpdateBill, [amount, amount, billId], function (err) {
          if (err) {
            console.error("Error updating bill amounts:", err)
            reject(err)
            return
          }
          resolve(this.lastID)
        })
      },
    )
  })
}

// Legacy function to create a simple billing record (for backward compatibility)
function createBill(billingData) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const { patient_id, amount, service_details, billing_date } = billingData

    const sql = `
      INSERT INTO billing (patient_id, amount, service_details, billing_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `

    db.run(sql, [patient_id, amount, service_details, billing_date], function (err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this.lastID)
    })
  })
}

// Retrieve all legacy bills with patient info
function getAllBills() {
  const db = getDB()
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT b.*, p.name as patient_name, p.contact as patient_contact 
      FROM billing b 
      JOIN patients p ON b.patient_id = p.id 
      ORDER BY b.billing_date DESC
    `
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      resolve(rows)
    })
  })
}

// Update status of a legacy bill by ID
function updateBillStatus(id, status) {
  const db = getDB()
  return new Promise((resolve, reject) => {
    db.run("UPDATE billing SET status = ? WHERE id = ?", [status, id], function (err) {
      if (err) {
        reject(err)
        return
      }
      resolve(true)
    })
  })
}

module.exports = {
  // Advanced billing functions
  createAdvancedBill,
  getAllAdvancedBills,
  getAdvancedBillById,
  updateAdvancedBill,
  addPayment,
  // Legacy functions
  createBill,
  getAllBills,
  updateBillStatus,
}
