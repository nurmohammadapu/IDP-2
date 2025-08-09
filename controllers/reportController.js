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

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(overview))
  } catch (error) {
    console.error("Get overview error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function getFinancialReport(req, res) {
  try {
    const db = getDB()

    const queries = [
      new Promise((resolve, reject) => {
        db.get("SELECT SUM(total_amount) as total FROM advanced_bills", (err, row) => {
          if (err) reject(err)
          else resolve(row.total || 0)
        })
      }),
      new Promise((resolve, reject) => {
        db.get(
          "SELECT SUM(due_amount) as total FROM advanced_bills WHERE due_amount > 0",
          (err, row) => {
            if (err) reject(err)
            else resolve(row.total || 0)
          },
        )
      }),
      new Promise((resolve, reject) => {
        // Daily revenue last 7 days
        db.all(
          `SELECT date(billing_date) as date, SUM(total_amount) as revenue
           FROM advanced_bills
           WHERE billing_date >= date('now','-6 days')
           GROUP BY date(billing_date)
           ORDER BY date DESC`,
          (err, rows) => {
            if (err) reject(err)
            else resolve(rows)
          },
        )
      }),
      new Promise((resolve, reject) => {
        // Monthly revenue last 6 months
        // SQLite does not have YEAR() or MONTH() so use strftime
        db.all(
          `SELECT strftime('%Y', billing_date) as year, strftime('%m', billing_date) as month, SUM(total_amount) as revenue
           FROM advanced_bills
           WHERE billing_date >= date('now','start of month','-5 months')
           GROUP BY year, month
           ORDER BY year DESC, month DESC`,
          (err, rows) => {
            if (err) reject(err)
            else resolve(rows)
          },
        )
      }),
    ]

    const [totalRevenue, pendingPayments, dailyRevenue, monthlyRevenue] = await Promise.all(queries)

    const financialReport = {
      totalRevenue,
      pendingPayments,
      dailyRevenue,
      monthlyRevenue,
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(financialReport))
  } catch (error) {
    console.error("Get financial report error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = {
  getOverview,
  getFinancialReport,
}
