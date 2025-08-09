const { getDB } = require("../db")

// Create a new advanced bill record with items and initial payment
function createAdvancedBill(billData) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    const {
      patient_id,
      billing_date,
      items,
      subtotal,
      discount_type,
      discount_value,
      total_amount,
      paid_amount,
      payment_method,
    } = billData

    // Calculate discount amount based on discount type
    let discount_amount = 0
    if (discount_type === "percentage") {
      discount_amount = (subtotal * discount_value) / 100
    } else {
      discount_amount = discount_value
    }

    const final_total = subtotal - discount_amount
    const due_amount = final_total - (paid_amount || 0)

    // Insert the main bill record
    connection.query(
      `INSERT INTO advanced_bills (
        patient_id, billing_date, subtotal, discount_type, discount_value, 
        discount_amount, total_amount, paid_amount, due_amount, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ],
      (err, result) => {
        if (err) {
          reject(err)
          return
        }

        const billId = result.insertId

        // Insert bill items if any
        if (items && items.length > 0) {
          const itemValues = items.map((item) => [
            billId,
            item.type,
            item.type === "test" ? item.id : null,
            item.name,
            item.price,
          ])

          connection.query(
            "INSERT INTO bill_items (bill_id, item_type, test_id, item_name, item_price) VALUES ?",
            [itemValues],
            (err) => {
              if (err) {
                reject(err)
                return
              }

              // Insert initial payment if paid_amount > 0
              if (paid_amount > 0) {
                connection.query(
                  "INSERT INTO bill_payments (bill_id, amount, payment_method, payment_date) VALUES (?, ?, ?, ?)",
                  [billId, paid_amount, payment_method, new Date()],
                  (err) => {
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
            },
          )
        } else {
          resolve(billId)
        }
      },
    )
  })
}

// Retrieve all advanced bills with patient info, ordered by billing date descending
function getAllAdvancedBills() {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    connection.query(
      `SELECT ab.*, p.name as patient_name, p.contact as patient_contact 
       FROM advanced_bills ab 
       JOIN patients p ON ab.patient_id = p.id 
       ORDER BY ab.billing_date DESC`,
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

// Get detailed advanced bill by ID including items and payment history
function getAdvancedBillById(id) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    connection.query(
      `SELECT ab.*, p.name as patient_name, p.contact as patient_contact, p.address as patient_address
       FROM advanced_bills ab 
       JOIN patients p ON ab.patient_id = p.id 
       WHERE ab.id = ?`,
      [id],
      (err, results) => {
        if (err) {
          reject(err)
          return
        }

        if (results.length === 0) {
          resolve(null)
          return
        }

        const bill = results[0]

        // Get bill items related to this bill
        connection.query("SELECT * FROM bill_items WHERE bill_id = ?", [id], (err, items) => {
          if (err) {
            reject(err)
            return
          }

          // Get payment history for this bill
          connection.query(
            "SELECT * FROM bill_payments WHERE bill_id = ? ORDER BY payment_date DESC",
            [id],
            (err, payments) => {
              if (err) {
                reject(err)
                return
              }

              bill.items = items
              bill.payments = payments
              resolve(bill)
            },
          )
        })
      },
    )
  })
}

// Update an existing advanced bill with new data and items
function updateAdvancedBill(id, billData) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    const { patient_id, billing_date, items, subtotal, discount_type, discount_value, paid_amount, payment_method } =
      billData

    // Calculate discount amount
    let discount_amount = 0
    if (discount_type === "percentage") {
      discount_amount = (subtotal * discount_value) / 100
    } else {
      discount_amount = discount_value
    }

    const final_total = subtotal - discount_amount
    const due_amount = final_total - (paid_amount || 0)

    connection.query(
      `UPDATE advanced_bills SET 
        patient_id = ?, billing_date = ?, subtotal = ?, discount_type = ?, 
        discount_value = ?, discount_amount = ?, total_amount = ?, 
        paid_amount = ?, due_amount = ?, payment_method = ?
       WHERE id = ?`,
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
      (err) => {
        if (err) {
          reject(err)
          return
        }

        // Remove old bill items
        connection.query("DELETE FROM bill_items WHERE bill_id = ?", [id], (err) => {
          if (err) {
            reject(err)
            return
          }

          // Insert updated bill items
          if (items && items.length > 0) {
            const itemValues = items.map((item) => [
              id,
              item.type,
              item.type === "test" ? item.id : null,
              item.name,
              item.price,
            ])

            connection.query(
              "INSERT INTO bill_items (bill_id, item_type, test_id, item_name, item_price) VALUES ?",
              [itemValues],
              (err) => {
                if (err) {
                  reject(err)
                  return
                }
                resolve(true)
              },
            )
          } else {
            resolve(true)
          }
        })
      },
    )
  })
}

// Add a payment to an existing bill and update paid/due amounts accordingly
function addPayment(billId, paymentData) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    const { amount, payment_method, notes } = paymentData

    // Insert payment record
    connection.query(
      "INSERT INTO bill_payments (bill_id, amount, payment_method, notes, payment_date) VALUES (?, ?, ?, ?, ?)",
      [billId, amount, payment_method, notes || "", new Date()],
      (err, result) => {
        if (err) {
          reject(err)
          return
        }

        // Update paid and due amounts in the bill
        connection.query(
          `UPDATE advanced_bills SET 
            paid_amount = paid_amount + ?, 
            due_amount = due_amount - ?
           WHERE id = ?`,
          [amount, amount, billId],
          (err) => {
            if (err) {
              reject(err)
              return
            }
            resolve(result.insertId)
          },
        )
      },
    )
  })
}

// Legacy functions to handle old billing system compatibility

// Create a simple bill record (legacy)
function createBill(billingData) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    const { patient_id, amount, service_details, billing_date } = billingData

    connection.query(
      "INSERT INTO billing (patient_id, amount, service_details, billing_date) VALUES (?, ?, ?, ?)",
      [patient_id, amount, service_details, billing_date],
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

// Get all legacy bills with patient info
function getAllBills() {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    connection.query(
      `SELECT b.*, p.name as patient_name, p.contact as patient_contact 
       FROM billing b 
       JOIN patients p ON b.patient_id = p.id 
       ORDER BY b.billing_date DESC`,
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

// Update status of a legacy bill
function updateBillStatus(id, status) {
  return new Promise((resolve, reject) => {
    const connection = getDB()
    connection.query("UPDATE billing SET status = ? WHERE id = ?", [status, id], (err) => {
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
