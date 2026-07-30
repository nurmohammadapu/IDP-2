const url = require("url")
const { getAll, create, update, changeStatus, remove } = require("../controllers/adminController")

async function adminRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  try {
    if (pathname === "/api/admin/users" && method === "GET") {
      await getAll(req, res)
    } else if (pathname === "/api/admin/users" && method === "POST") {
      await create(req, res)
    } else if (pathname.match(/^\/api\/admin\/users\/\d+\/status$/) && method === "PUT") {
      const id = pathname.split("/")[4]
      await changeStatus(req, res, id)
    } else if (pathname.match(/^\/api\/admin\/users\/\d+$/) && method === "PUT") {
      const id = pathname.split("/")[4]
      await update(req, res, id)
    } else if (pathname.match(/^\/api\/admin\/users\/\d+$/) && method === "DELETE") {
      const id = pathname.split("/")[4]
      await remove(req, res, id)
    } else {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Route not found" }))
    }
  } catch (error) {
    console.error("Admin route error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = adminRoutes
