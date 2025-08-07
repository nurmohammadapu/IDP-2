const url = require("url")
const { getAll, getById, create, update, deleteTestById } = require("../controllers/testController")

async function testRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  try {
    if (pathname === "/api/tests" && method === "GET") {
      await getAll(req, res)
    } else if (pathname === "/api/tests" && method === "POST") {
      await create(req, res)
    } else if (pathname.match(/^\/api\/tests\/\d+$/) && method === "GET") {
      const id = pathname.split("/")[3]
      await getById(req, res, id)
    } else if (pathname.match(/^\/api\/tests\/\d+$/) && method === "PUT") {
      const id = pathname.split("/")[3]
      await update(req, res, id)
    } else if (pathname.match(/^\/api\/tests\/\d+$/) && method === "DELETE") {
      const id = pathname.split("/")[3]
      await deleteTestById(req, res, id)
    } else {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Route not found" }))
    }
  } catch (error) {
    console.error("Test route error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = testRoutes
