const http = require("http")
const fs = require("fs").promises
const path = require("path")
const url = require("url")
const { connectDB } = require("./db")

// Import routes
const authRoutes = require("./routes/authRoutes")
const patientRoutes = require("./routes/patientRoutes")
const doctorRoutes = require("./routes/doctorRoutes")
const appointmentRoutes = require("./routes/appointmentRoutes")
const testRoutes = require("./routes/testRoutes")
const billingRoutes = require("./routes/billingRoutes")
const reportRoutes = require("./routes/reportRoutes")
const advancedRoutes = require("./routes/advancedRoutes")

const PORT = process.env.PORT || 3000

// MIME types
const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
}

// Parse cookies
function parseCookies(cookieHeader) {
  const cookies = {}
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=")
      if (name && value) {
        cookies[name] = value
      }
    })
  }
  return cookies
}

// Parse request body
async function parseBody(req) {
  return new Promise((resolve) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk.toString()
    })
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        console.error("JSON parse error:", error)
        resolve({})
      }
    })
  })
}

// Serve static files
async function serveStaticFile(filePath, res) {
  try {
    const fullPath = path.join(__dirname, "public", filePath)
    const data = await fs.readFile(fullPath)
    const ext = path.extname(filePath)
    const contentType = mimeTypes[ext] || "text/plain"

    res.writeHead(200, { "Content-Type": contentType })
    res.end(data)
  } catch (error) {
    if (filePath === "favicon.ico") {
      // Return empty favicon to avoid 404
      res.writeHead(200, { "Content-Type": "image/x-icon" })
      res.end()
    } else {
      console.error("Static file error:", error)
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("File not found")
    }
  }
}

// Main server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname
  const method = req.method

  console.log(`${method} ${pathname}`)

  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }

  // Parse cookies and body
  req.cookies = parseCookies(req.headers.cookie)
  if (method === "POST" || method === "PUT") {
    req.body = await parseBody(req)
  }

  try {
    // API Routes
    if (pathname.startsWith("/api/auth")) {
      await authRoutes(req, res)
    } else if (pathname.startsWith("/api/patients")) {
      await patientRoutes(req, res)
    } else if (pathname.startsWith("/api/doctors")) {
      await doctorRoutes(req, res)
    } else if (pathname.startsWith("/api/appointments")) {
      await appointmentRoutes(req, res)
    } else if (pathname.startsWith("/api/tests")) {
      await testRoutes(req, res)
    } else if (pathname.startsWith("/api/billing")) {
      await billingRoutes(req, res)
    } else if (pathname.startsWith("/api/reports")) {
      await reportRoutes(req, res)
    } else if (pathname.startsWith("/api/advanced")) {
      await advancedRoutes(req, res)
    }
    // Static file serving
    else if (pathname === "/" || pathname === "/login") {
      await serveStaticFile("index.html", res)
    } else if (pathname === "/register") {
      await serveStaticFile("register.html", res)
    } else if (pathname.startsWith("/")) {
      await serveStaticFile(pathname.substring(1), res)
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("Not Found")
    }
  } catch (error) {
    console.error("Server error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error: " + error.message }))
  }
})

// Start server
async function startServer() {
  try {
    await connectDB()
    server.listen(PORT, () => {
      console.log(`🚀 Hospital Management Server running on http://localhost:${PORT}`)
      console.log(`📝 Registration: http://localhost:${PORT}/register.html`)
      console.log(`🔐 Login: http://localhost:${PORT}/login.html`)
      console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`)
      console.log(`⚡ Advanced Features: http://localhost:${PORT}/advanced.html`)
    })
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
