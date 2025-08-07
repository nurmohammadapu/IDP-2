const url = require("url")
const {
  getAll,
  create,
  updateStatus,
  getAllAdvanced,
  getAdvancedById,
  createAdvanced,
  updateAdvanced,
  addBillPayment,
  generateBillPDF,
} = require("../controllers/billingController")

async function billingRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  try {
    // Advanced billing routes
    if (pathname === "/api/billing/advanced" && method === "GET") {
      await getAllAdvanced(req, res)
    } else if (pathname === "/api/billing/advanced" && method === "POST") {
      await createAdvanced(req, res)
    } else if (pathname.match(/^\/api\/billing\/advanced\/\d+$/) && method === "GET") {
      const id = pathname.split("/")[4]
      await getAdvancedById(req, res, id)
    } else if (pathname.match(/^\/api\/billing\/advanced\/\d+$/) && method === "PUT") {
      const id = pathname.split("/")[4]
      await updateAdvanced(req, res, id)
    } else if (pathname.match(/^\/api\/billing\/advanced\/\d+\/payment$/) && method === "POST") {
      const id = pathname.split("/")[4]
      await addBillPayment(req, res, id)
    } else if (pathname.match(/^\/api\/billing\/advanced\/\d+\/pdf$/) && method === "GET") {
      const id = pathname.split("/")[4]
      await generateBillPDF(req, res, id)
    }
    // Legacy billing routes
    else if (pathname === "/api/billing" && method === "GET") {
      await getAll(req, res)
    } else if (pathname === "/api/billing" && method === "POST") {
      await create(req, res)
    } else if (pathname.match(/^\/api\/billing\/\d+\/status$/) && method === "PUT") {
      const id = pathname.split("/")[3]
      await updateStatus(req, res, id)
    } else {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Route not found" }))
    }
  } catch (error) {
    console.error("Billing route error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = billingRoutes
