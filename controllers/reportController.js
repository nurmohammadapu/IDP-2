const { getDB } = require("../db") 

async function getOverview(req, res) {
  try {
    const db = getDB()

    const queries = [
      new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) as count FROM patients", (err, row) => {
          if (err) reject(err)
          else resolve(row.count)
        })
      }),
      new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) as count FROM doctors", (err, row) => {
          if (err) reject(err)
          else resolve(row.count)
        })
      }),
      new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) as count FROM appointments", (err, row) => {
          if (err) reject(err)
          else resolve(row.count)
        })
      }),
      new Promise((resolve, reject) => {
        // SQLite current date: date('now','localtime')
        db.get(
          "SELECT COUNT(*) as count FROM appointments WHERE date(appointment_date) = date('now','localtime')",
          (err, row) => {
            if (err) reject(err)
            else resolve(row.count)
          },
        )
      }),
      new Promise((resolve, reject) => {
        db.all(
          `SELECT a.*, p.name as patient_name, d.name as doctor_name, d.specialty
           FROM appointments a
           JOIN patients p ON a.patient_id = p.id
           JOIN doctors d ON a.doctor_id = d.id
           ORDER BY a.appointment_date DESC, a.appointment_time DESC
           LIMIT 5`,
          (err, rows) => {
            if (err) reject(err)
            else resolve(rows)
          },
        )
      }),
    ]

    const [
      totalPatients,
      totalDoctors,
      totalAppointments,
      todayAppointments,
      recentAppointments,
    ] = await Promise.all(queries)

    const overview = {
      totalPatients,
      totalDoctors,
      totalAppointments,
      todayAppointments,
      recentAppointments,
    }

    return res.json(overview)
  } catch (error) {
    console.error("Get overview error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getFinancialReport(req, res) {
  try {
    const { getAuthenticatedUser } = require("../middleware/authMiddleware")
    const user = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const db = getDB()
    let filterSql = ""
    let filterParams = []

    if (user.role !== 'admin') {
      if (user.role === 'accountant' || user.role === 'receptionist') {
        filterSql = "created_by = ?"
        filterParams = [user.id]
      } else if (user.role === 'doctor') {
        const docRow = await new Promise((resolve) => {
          db.get("SELECT id FROM doctors WHERE user_id = ?", [user.id], (err, row) => resolve(row))
        })
        const docId = docRow ? docRow.id : -1
        filterSql = "doctor_id = ?"
        filterParams = [docId]
      } else if (user.role === 'patient') {
        const patRow = await new Promise((resolve) => {
          db.get("SELECT id FROM patients WHERE user_id = ?", [user.id], (err, row) => resolve(row))
        })
        const patId = patRow ? patRow.id : -1
        filterSql = "patient_id = ?"
        filterParams = [patId]
      } else {
        filterSql = "1=0"
      }
    }

    let query1Sql = ""
    let query1Params = []
    let query2Sql = ""
    let query2Params = []
    let query3Sql = ""
    let query3Params = []
    let query4Sql = ""
    let query4Params = []
    let query5Sql = ""
    let query5Params = []

    if (!user || user.role === 'admin') {
      query1Sql = "SELECT SUM(amount) as total FROM bill_payments"
      query2Sql = "SELECT SUM(due_amount) as total FROM advanced_bills WHERE due_amount > 0"
      query3Sql = `SELECT date(payment_date) as date, SUM(amount) as revenue
                   FROM bill_payments
                   WHERE payment_date >= date('now','-6 days')
                   GROUP BY date(payment_date)
                   ORDER BY date DESC`
      query4Sql = `SELECT strftime('%Y', payment_date) as year, strftime('%m', payment_date) as month, SUM(amount) as revenue
                   FROM bill_payments
                   WHERE payment_date >= date('now','start of month','-5 months')
                   GROUP BY year, month
                   ORDER BY year DESC, month DESC`
      query5Sql = `SELECT d.name as doctor_name, COALESCE(u.name, 'System') as staff_name, COUNT(bp.id) as visit_count, SUM(bp.amount) as total_collected
                   FROM bill_payments bp
                   JOIN advanced_bills ab ON bp.bill_id = ab.id
                   JOIN doctors d ON ab.doctor_id = d.id
                   LEFT JOIN users u ON bp.created_by = u.id
                   GROUP BY d.id, bp.created_by`
      query5Params = []
    } else if (user.role === 'accountant' || user.role === 'doctor_assistant') {
      query1Sql = "SELECT SUM(amount) as total FROM bill_payments WHERE created_by = ?"
      query1Params = [user.id]

      query2Sql = "SELECT SUM(amount) as total FROM bill_payments WHERE created_by = ? AND date(payment_date) = date('now','localtime')"
      query2Params = [user.id]

      query3Sql = `SELECT date(payment_date) as date, SUM(amount) as revenue
                   FROM bill_payments
                   WHERE created_by = ? AND payment_date >= date('now','-6 days')
                   GROUP BY date(payment_date)
                   ORDER BY date DESC`
      query3Params = [user.id]

      query4Sql = `SELECT strftime('%Y', payment_date) as year, strftime('%m', payment_date) as month, SUM(amount) as revenue
                   FROM bill_payments
                   WHERE created_by = ? AND payment_date >= date('now','start of month','-5 months')
                   GROUP BY year, month
                   ORDER BY year DESC, month DESC`
      query4Params = [user.id]

      query5Sql = "SELECT '' as doctor_name, '' as staff_name, 0 as visit_count, 0 as total_collected WHERE 1=0"
      query5Params = []
    } else if (user.role === 'receptionist') {
      query1Sql = "SELECT SUM(amount) as total FROM bill_payments WHERE created_by = ?"
      query1Params = [user.id]

      query2Sql = "SELECT SUM(amount) as total FROM bill_payments WHERE created_by = ? AND date(payment_date) = date('now','localtime')"
      query2Params = [user.id]

      query3Sql = `SELECT date(payment_date) as date, SUM(amount) as revenue
                   FROM bill_payments
                   WHERE created_by = ? AND payment_date >= date('now','-6 days')
                   GROUP BY date(payment_date)
                   ORDER BY date DESC`
      query3Params = [user.id]

      query4Sql = `SELECT strftime('%Y', payment_date) as year, strftime('%m', payment_date) as month, SUM(amount) as revenue
                   FROM bill_payments
                   WHERE created_by = ? AND payment_date >= date('now','start of month','-5 months')
                   GROUP BY year, month
                   ORDER BY year DESC, month DESC`
      query4Params = [user.id]

      query5Sql = `SELECT d.name as doctor_name, COALESCE(u.name, 'Me') as staff_name, COUNT(bp.id) as visit_count, SUM(bp.amount) as total_collected
                   FROM bill_payments bp
                   JOIN advanced_bills ab ON bp.bill_id = ab.id
                   JOIN doctors d ON ab.doctor_id = d.id
                   LEFT JOIN users u ON bp.created_by = u.id
                   WHERE bp.created_by = ?
                   GROUP BY d.id`
      query5Params = [user.id]
    } else if (user.role === 'doctor') {
      const docRow = await new Promise((resolve) => {
        db.get("SELECT id FROM doctors WHERE user_id = ?", [user.id], (err, row) => resolve(row))
      })
      const docId = docRow ? docRow.id : -1

      query1Sql = "SELECT SUM(bp.amount) as total FROM bill_payments bp JOIN advanced_bills ab ON bp.bill_id = ab.id WHERE ab.doctor_id = ?"
      query1Params = [docId]

      query2Sql = "SELECT SUM(due_amount) as total FROM advanced_bills WHERE due_amount > 0 AND doctor_id = ?"
      query2Params = [docId]

      query3Sql = `SELECT date(bp.payment_date) as date, SUM(bp.amount) as revenue
                   FROM bill_payments bp
                   JOIN advanced_bills ab ON bp.bill_id = ab.id
                   WHERE ab.doctor_id = ? AND bp.payment_date >= date('now','-6 days')
                   GROUP BY date(bp.payment_date)
                   ORDER BY date DESC`
      query3Params = [docId]

      query4Sql = `SELECT strftime('%Y', bp.payment_date) as year, strftime('%m', bp.payment_date) as month, SUM(bp.amount) as revenue
                   FROM bill_payments bp
                   JOIN advanced_bills ab ON bp.bill_id = ab.id
                   WHERE ab.doctor_id = ? AND bp.payment_date >= date('now','start of month','-5 months')
                   GROUP BY year, month
                   ORDER BY year DESC, month DESC`
      query4Params = [docId]

      query5Sql = `SELECT d.name as doctor_name, COALESCE(u.name, 'System') as staff_name, COUNT(bp.id) as visit_count, SUM(bp.amount) as total_collected
                   FROM bill_payments bp
                   JOIN advanced_bills ab ON bp.bill_id = ab.id
                   JOIN doctors d ON ab.doctor_id = d.id
                   LEFT JOIN users u ON bp.created_by = u.id
                   WHERE ab.doctor_id = ?
                   GROUP BY bp.created_by`
      query5Params = [docId]
    } else if (user.role === 'patient') {
      const patRow = await new Promise((resolve) => {
        db.get("SELECT id FROM patients WHERE user_id = ?", [user.id], (err, row) => resolve(row))
      })
      const patId = patRow ? patRow.id : -1

      query1Sql = "SELECT SUM(bp.amount) as total FROM bill_payments bp JOIN advanced_bills ab ON bp.bill_id = ab.id WHERE ab.patient_id = ?"
      query1Params = [patId]

      query2Sql = "SELECT SUM(due_amount) as total FROM advanced_bills WHERE due_amount > 0 AND patient_id = ?"
      query2Params = [patId]

      query3Sql = `SELECT date(bp.payment_date) as date, SUM(bp.amount) as revenue
                   FROM bill_payments bp
                   JOIN advanced_bills ab ON bp.bill_id = ab.id
                   WHERE ab.patient_id = ? AND bp.payment_date >= date('now','-6 days')
                   GROUP BY date(bp.payment_date)
                   ORDER BY date DESC`
      query3Params = [patId]

      query4Sql = `SELECT strftime('%Y', bp.payment_date) as year, strftime('%m', bp.payment_date) as month, SUM(bp.amount) as revenue
                   FROM bill_payments bp
                   JOIN advanced_bills ab ON bp.bill_id = ab.id
                   WHERE ab.patient_id = ? AND bp.payment_date >= date('now','start of month','-5 months')
                   GROUP BY year, month
                   ORDER BY year DESC, month DESC`
      query4Params = [patId]

      query5Sql = `SELECT d.name as doctor_name, COALESCE(u.name, 'System') as staff_name, COUNT(bp.id) as visit_count, SUM(bp.amount) as total_collected
                   FROM bill_payments bp
                   JOIN advanced_bills ab ON bp.bill_id = ab.id
                   JOIN doctors d ON ab.doctor_id = d.id
                   LEFT JOIN users u ON bp.created_by = u.id
                   WHERE ab.patient_id = ?
                   GROUP BY d.id`
      query5Params = [patId]
    } else {
      query1Sql = "SELECT 0 as total"
      query2Sql = "SELECT 0 as total"
      query3Sql = "SELECT '' as date, 0 as revenue WHERE 1=0"
      query4Sql = "SELECT '' as year, '' as month, 0 as revenue WHERE 1=0"
      query5Sql = "SELECT '' as doctor_name, '' as staff_name, 0 as visit_count, 0 as total_collected WHERE 1=0"
      query5Params = []
    }

    const queries = [
      new Promise((resolve, reject) => {
        db.get(query1Sql, query1Params, (err, row) => {
          if (err) reject(err)
          else resolve(row.total || 0)
        })
      }),
      new Promise((resolve, reject) => {
        db.get(query2Sql, query2Params, (err, row) => {
          if (err) reject(err)
          else resolve(row.total || 0)
        })
      }),
      new Promise((resolve, reject) => {
        db.all(query3Sql, query3Params, (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        })
      }),
      new Promise((resolve, reject) => {
        db.all(query4Sql, query4Params, (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        })
      }),
      new Promise((resolve, reject) => {
        db.all(query5Sql, query5Params, (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        })
      }),
    ]

    const [totalRevenue, pendingPayments, dailyRevenue, monthlyRevenue, visitBreakdown] = await Promise.all(queries)

    const financialReport = {
      totalRevenue,
      pendingPayments,
      dailyRevenue,
      monthlyRevenue,
      visitBreakdown,
    }

    return res.json(financialReport)
  } catch (error) {
    console.error("Get financial report error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

module.exports = {
  getOverview,
  getFinancialReport,
}
