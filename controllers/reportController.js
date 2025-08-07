const { getConnection } = require("../db")

async function getOverview(req, res) {
  try {
    const connection = getConnection()

    // Get all counts in parallel
    const queries = [
      new Promise((resolve, reject) => {
        connection.query("SELECT COUNT(*) as count FROM patients", (err, results) => {
          if (err) reject(err)
          else resolve(results[0].count)
        })
      }),
      new Promise((resolve, reject) => {
        connection.query("SELECT COUNT(*) as count FROM doctors", (err, results) => {
          if (err) reject(err)
          else resolve(results[0].count)
        })
      }),
      new Promise((resolve, reject) => {
        connection.query("SELECT COUNT(*) as count FROM appointments", (err, results) => {
          if (err) reject(err)
          else resolve(results[0].count)
        })
      }),
      new Promise((resolve, reject) => {
        connection.query(
          "SELECT COUNT(*) as count FROM appointments WHERE DATE(appointment_date) = CURDATE()",
          (err, results) => {
            if (err) reject(err)
            else resolve(results[0].count)
          },
        )
      }),
      new Promise((resolve, reject) => {
        connection.query(
          `SELECT a.*, p.name as patient_name, d.name as doctor_name, d.specialty 
           FROM appointments a 
           JOIN patients p ON a.patient_id = p.id 
           JOIN doctors d ON a.doctor_id = d.id 
           ORDER BY a.appointment_date DESC, a.appointment_time DESC 
           LIMIT 5`,
          (err, results) => {
            if (err) reject(err)
            else resolve(results)
          },
        )
      }),
    ]

    const [totalPatients, totalDoctors, totalAppointments, todayAppointments, recentAppointments] =
      await Promise.all(queries)

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
    const connection = getConnection()

    const queries = [
      // Total revenue from advanced bills
      new Promise((resolve, reject) => {
        connection.query("SELECT SUM(total_amount) as total FROM advanced_bills", (err, results) => {
          if (err) reject(err)
          else resolve(results[0].total || 0)
        })
      }),
      // Pending payments from advanced bills
      new Promise((resolve, reject) => {
        connection.query("SELECT SUM(due_amount) as total FROM advanced_bills WHERE due_amount > 0", (err, results) => {
          if (err) reject(err)
          else resolve(results[0].total || 0)
        })
      }),
      // Daily revenue for last 7 days
      new Promise((resolve, reject) => {
        connection.query(
          `SELECT DATE(billing_date) as date, SUM(total_amount) as revenue 
           FROM advanced_bills 
           WHERE billing_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           GROUP BY DATE(billing_date) 
           ORDER BY date DESC`,
          (err, results) => {
            if (err) reject(err)
            else resolve(results)
          },
        )
      }),
      // Monthly revenue for last 6 months
      new Promise((resolve, reject) => {
        connection.query(
          `SELECT YEAR(billing_date) as year, MONTH(billing_date) as month, SUM(total_amount) as revenue 
           FROM advanced_bills 
           WHERE billing_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
           GROUP BY YEAR(billing_date), MONTH(billing_date) 
           ORDER BY year DESC, month DESC`,
          (err, results) => {
            if (err) reject(err)
            else resolve(results)
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
