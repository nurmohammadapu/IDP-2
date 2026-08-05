const { promisify } = require("util")
const { getDB } = require("../db")

async function createAdvancedBill(billData) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const run = promisify(db.run).bind(db)

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
    const appRow = await get(
      "SELECT doctor_id FROM appointments WHERE patient_id = ? ORDER BY appointment_date DESC, appointment_time DESC LIMIT 1",
      [patient_id]
    )

    const resolvedDoctorId = billData.doctor_id || (appRow ? appRow.doctor_id : null)
    const resolvedCreatedBy = billData.created_by || null

    const sql = `
      INSERT INTO advanced_bills (
        patient_id, doctor_id, created_by, appointment_id, billing_date, subtotal, discount_type, discount_value, 
        discount_amount, total_amount, paid_amount, due_amount, payment_method, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `

    const result = await run(sql, [
      patient_id,
      resolvedDoctorId,
      resolvedCreatedBy,
      billData.appointment_id || null,
      billing_date,
      subtotal,
      discount_type || "amount",
      discount_value || 0,
      discount_amount,
      final_total,
      paid_amount || 0,
      due_amount,
      payment_method || "cash",
    ])

    const billId = result.lastID

    if (items && items.length > 0) {
      for (const item of items) {
        const sqlItem = `
          INSERT INTO bill_items (bill_id, item_type, test_id, item_name, item_price, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `
        await run(sqlItem, [
          billId,
          item.type,
          item.type === "test" ? item.id : null,
          item.name,
          item.price,
        ])
      }
    }

    if (paid_amount > 0) {
      const sqlPayment = `
        INSERT INTO bill_payments (bill_id, amount, payment_method, payment_date, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `
      await run(sqlPayment, [
        billId,
        paid_amount,
        payment_method || "cash",
        new Date().toISOString(),
        resolvedCreatedBy,
      ])
    }

    return billId
  } catch (err) {
    console.error("createAdvancedBill database error:", err)
    throw err
  }
}

async function getAllAdvancedBills(user) {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const get = promisify(db.get).bind(db)

    if (!user || user.role === 'admin' || user.role === 'receptionist') {
      const sql = `
        SELECT ab.*, p.name as patient_name, p.contact as patient_contact 
        FROM advanced_bills ab 
        JOIN patients p ON ab.patient_id = p.id 
        ORDER BY ab.id DESC
      `
      return await all(sql, [])
    } else if (user.role === 'accountant') {
      // Accountants see only bills that contain test items / non-Doctor Visit items
      const sql = `
        SELECT DISTINCT ab.*, p.name as patient_name, p.contact as patient_contact 
        FROM advanced_bills ab 
        JOIN patients p ON ab.patient_id = p.id 
        JOIN bill_items bi ON ab.id = bi.bill_id
        WHERE bi.item_name != 'Doctor Visit' AND (bi.item_type = 'test' OR bi.test_id IS NOT NULL OR bi.item_name LIKE '%Test%')
        ORDER BY ab.id DESC
      `
      return await all(sql, [])
    } else if (user.role === 'doctor') {
      const docRow = await get("SELECT id FROM doctors WHERE user_id = ?", [user.id])
      const docId = docRow ? docRow.id : -1
      const sql = `
        SELECT ab.*, p.name as patient_name, p.contact as patient_contact 
        FROM advanced_bills ab 
        JOIN patients p ON ab.patient_id = p.id 
        WHERE ab.doctor_id = ?
        ORDER BY ab.id DESC
      `
      return await all(sql, [docId])
    } else if (user.role === 'patient') {
      const patRow = await get("SELECT id FROM patients WHERE user_id = ?", [user.id])
      const patId = patRow ? patRow.id : -1
      const sql = `
        SELECT ab.*, p.name as patient_name, p.contact as patient_contact 
        FROM advanced_bills ab 
        JOIN patients p ON ab.patient_id = p.id 
        WHERE ab.patient_id = ?
        ORDER BY ab.id DESC
      `
      return await all(sql, [patId])
    } else {
      return []
    }
  } catch (err) {
    console.error("getAllAdvancedBills database error:", err)
    throw err
  }
}

async function getAdvancedBillById(id) {
  try {
    const db = getDB()
    const get = promisify(db.get).bind(db)
    const all = promisify(db.all).bind(db)

    const sql = `
      SELECT ab.*, p.name as patient_name, p.contact as patient_contact, p.address as patient_address
      FROM advanced_bills ab 
      JOIN patients p ON ab.patient_id = p.id 
      WHERE ab.id = ?
    `
    const bill = await get(sql, [id])
    if (!bill) return null

    const items = await all("SELECT * FROM bill_items WHERE bill_id = ?", [id])
    const payments = await all("SELECT * FROM bill_payments WHERE bill_id = ? ORDER BY payment_date DESC", [id])

    bill.items = items
    bill.payments = payments
    return bill
  } catch (err) {
    console.error("getAdvancedBillById database error:", err)
    throw err
  }
}

async function updateAdvancedBill(id, billData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)

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
    await run(sqlUpdate, [
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
    ])

    await run("DELETE FROM bill_items WHERE bill_id = ?", [id])

    if (items && items.length > 0) {
      for (const item of items) {
        const sqlItem = `
          INSERT INTO bill_items (bill_id, item_type, test_id, item_name, item_price, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `
        await run(sqlItem, [
          id,
          item.type,
          item.type === "test" ? item.id : null,
          item.name,
          item.price,
        ])
      }
    }

    return true
  } catch (err) {
    console.error("updateAdvancedBill database error:", err)
    throw err
  }
}

async function addPayment(billId, paymentData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { amount, payment_method, notes, created_by } = paymentData

    const sqlInsertPayment = `
      INSERT INTO bill_payments (bill_id, amount, payment_method, notes, payment_date, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `
    const resultPayment = await run(sqlInsertPayment, [
      billId,
      amount,
      payment_method,
      notes || "",
      new Date().toISOString(),
      created_by || null,
    ])

    const sqlUpdateBill = `
      UPDATE advanced_bills SET 
        paid_amount = paid_amount + ?, 
        due_amount = due_amount - ?
      WHERE id = ?
    `
    await run(sqlUpdateBill, [amount, amount, billId])

    return resultPayment.lastID
  } catch (err) {
    console.error("addPayment database error:", err)
    throw err
  }
}

async function createBill(billingData) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    const { patient_id, amount, service_details, billing_date } = billingData

    const sql = `
      INSERT INTO billing (patient_id, amount, service_details, billing_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    const result = await run(sql, [patient_id, amount, service_details, billing_date])
    return result.lastID
  } catch (err) {
    console.error("createBill database error:", err)
    throw err
  }
}

async function getAllBills() {
  try {
    const db = getDB()
    const all = promisify(db.all).bind(db)
    const sql = `
      SELECT b.*, p.name as patient_name, p.contact as patient_contact 
      FROM billing b 
      JOIN patients p ON b.patient_id = p.id 
      ORDER BY b.billing_date DESC
    `
    return await all(sql, [])
  } catch (err) {
    console.error("getAllBills database error:", err)
    throw err
  }
}

async function updateBillStatus(id, status) {
  try {
    const db = getDB()
    const run = promisify(db.run).bind(db)
    await run("UPDATE billing SET status = ? WHERE id = ?", [status, id])
    return true
  } catch (err) {
    console.error("updateBillStatus database error:", err)
    throw err
  }
}

module.exports = {
  createAdvancedBill,
  getAllAdvancedBills,
  getAdvancedBillById,
  updateAdvancedBill,
  addPayment,
  createBill,
  getAllBills,
  updateBillStatus,
}
