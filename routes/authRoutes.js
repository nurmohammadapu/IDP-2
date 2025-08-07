const url = require("url")
const { register, login, logout, getCurrentUser } = require("../controllers/authController")

async function authRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  try {
    if (pathname === "/api/auth/register" && method === "POST") {
      await register(req, res)
    } else if (pathname === "/api/auth/login" && method === "POST") {
      await login(req, res)
    } else if (pathname === "/api/auth/logout" && method === "POST") {
      await logout(req, res)
    } else if (pathname === "/api/auth/me" && method === "GET") {
      await getCurrentUser(req, res)
    } else {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Route not found" }))
    }
  } catch (error) {
    console.error("Auth route error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = authRoutes
