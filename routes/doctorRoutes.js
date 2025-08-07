const url = require("url")
const { getAll, getById, create, update, deleteDoctorById } = require("../controllers/doctorController")

async function doctorRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  try {
    if (pathname === "/api/doctors" && method === "GET") {
      await getAll(req, res)
    } else if (pathname === "/api/doctors" && method === "POST") {
      await create(req, res)
    } else if (pathname.match(/^\/api\/doctors\/\d+$/) && method === "GET") {
      const id = pathname.split("/")[3]
      await getById(req, res, id)
    } else if (pathname.match(/^\/api\/doctors\/\d+$/) && method === "PUT") {
      const id = pathname.split("/")[3]
      await update(req, res, id)
    } else if (pathname.match(/^\/api\/doctors\/\d+$/) && method === "DELETE") {
      const id = pathname.split("/")[3]
      await deleteDoctorById(req, res, id)
    } else {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Route not found" }))
    }
  } catch (error) {
    console.error("Doctor route error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = doctorRoutes
