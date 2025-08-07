const url = require("url")
const {
  getNotifications,
  markNotificationRead,
  getAuditTrail,
  getSystemStats,
  createSystemBackup,
  getBackups,
  exportData,
  sendAppointmentReminder,
  advancedSearch,
} = require("../controllers/advancedController")

async function advancedRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  try {
    if (pathname === "/api/advanced/notifications" && method === "GET") {
      await getNotifications(req, res)
    } else if (pathname.match(/^\/api\/advanced\/notifications\/\d+\/read$/) && method === "PUT") {
      const id = pathname.split("/")[4]
      await markNotificationRead(req, res, id)
    } else if (pathname === "/api/advanced/audit" && method === "GET") {
      req.query = parsedUrl.query
      await getAuditTrail(req, res)
    } else if (pathname === "/api/advanced/stats" && method === "GET") {
      await getSystemStats(req, res)
    } else if (pathname === "/api/advanced/backup" && method === "POST") {
      await createSystemBackup(req, res)
    } else if (pathname === "/api/advanced/backups" && method === "GET") {
      await getBackups(req, res)
    } else if (pathname === "/api/advanced/export" && method === "POST") {
      await exportData(req, res)
    } else if (pathname === "/api/advanced/send-reminder" && method === "POST") {
      await sendAppointmentReminder(req, res)
    } else if (pathname === "/api/advanced/search" && method === "POST") {
      await advancedSearch(req, res)
    } else {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Route not found" }))
    }
  } catch (error) {
    console.error("Advanced route error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = advancedRoutes
