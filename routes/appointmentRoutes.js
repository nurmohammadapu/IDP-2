const url = require("url")
const AppointmentController = require("../controllers/appointmentController")

async function appointmentRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  try {
    if (pathname === "/api/appointments" && method === "GET") {
      await AppointmentController.getAll(req, res)
    } else if (pathname === "/api/appointments" && method === "POST") {
      await AppointmentController.create(req, res)
    } else if (pathname.match(/^\/api\/appointments\/\d+$/) && method === "GET") {
      const id = pathname.split("/")[3]
      await AppointmentController.getById(req, res, id)
    } else if (pathname.match(/^\/api\/appointments\/\d+$/) && method === "PUT") {
      const id = pathname.split("/")[3]
      await AppointmentController.update(req, res, id)
    } else if (pathname.match(/^\/api\/appointments\/\d+$/) && method === "DELETE") {
      const id = pathname.split("/")[3]
      await AppointmentController.delete(req, res, id)
    } else {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Route not found" }))
    }
  } catch (error) {
    console.error("Appointment route error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = appointmentRoutes
