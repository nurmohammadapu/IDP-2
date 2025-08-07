const url = require("url")
const ReportController = require("../controllers/reportController")

async function reportRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  try {
    if (pathname === "/api/reports/overview" && method === "GET") {
      await ReportController.getOverview(req, res)
    } else if (pathname === "/api/reports/financial" && method === "GET") {
      await ReportController.getFinancialReport(req, res)
    } else {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Route not found" }))
    }
  } catch (error) {
    console.error("Report route error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = reportRoutes
