const url = require("url")
const { getAll, getById, create, update, deletePatientById, search } = require("../controllers/patientController")

async function patientRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  try {
    if (pathname === "/api/patients" && method === "GET") {
      const { search: searchQuery } = parsedUrl.query
      if (searchQuery) {
        await search(req, res, searchQuery)
      } else {
        await getAll(req, res)
      }
    } else if (pathname === "/api/patients" && method === "POST") {
      await create(req, res)
    } else if (pathname.match(/^\/api\/patients\/\d+$/) && method === "GET") {
      const id = pathname.split("/")[3]
      await getById(req, res, id)
    } else if (pathname.match(/^\/api\/patients\/\d+$/) && method === "PUT") {
      const id = pathname.split("/")[3]
      await update(req, res, id)
    } else if (pathname.match(/^\/api\/patients\/\d+$/) && method === "DELETE") {
      const id = pathname.split("/")[3]
      await deletePatientById(req, res, id)
    } else {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Route not found" }))
    }
  } catch (error) {
    console.error("Patient route error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = patientRoutes
