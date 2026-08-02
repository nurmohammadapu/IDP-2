const fs = require("fs").promises
const path = require("path")
const url = require("url")
const { connectDB } = require("./db")
const createHttpApp = require("./httpHelper")

// Import routes
const authRoutes = require("./routes/authRoutes")
const patientRoutes = require("./routes/patientRoutes")
const doctorRoutes = require("./routes/doctorRoutes")
const appointmentRoutes = require("./routes/appointmentRoutes")
const testRoutes = require("./routes/testRoutes")
const billingRoutes = require("./routes/billingRoutes")
const reportRoutes = require("./routes/reportRoutes")
const advancedRoutes = require("./routes/advancedRoutes")
const adminRoutes = require("./routes/adminRoutes")

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
      res.status(200).send("")
    } else {
      console.error("Static file error:", error)
      res.status(404).send("File not found")
    }
  }
}

// Create Http Application
const app = createHttpApp()

// Global Middleware for CORS and Static Files
app.use(async (req, res, next) => {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") {
    res.status(200).send("")
    return
  }

  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname

  // Log request
  console.log(`${req.method} ${pathname}`)

  // Serve static files if path is not API
  if (!pathname.startsWith("/api")) {
    if (pathname === "/" || pathname === "/login") {
      await serveStaticFile("index.html", res)
    } else if (pathname === "/register") {
      await serveStaticFile("register.html", res)
    } else {
      await serveStaticFile(pathname.substring(1), res)
    }
  } else {
    next()
  }
})

// Register API Routes
app.use("/api/auth", authRoutes)
app.use("/api/patients", patientRoutes)
app.use("/api/doctors", doctorRoutes)
app.use("/api/appointments", appointmentRoutes)
app.use("/api/tests", testRoutes)
app.use("/api/billing", billingRoutes)
app.use("/api/reports", reportRoutes)
app.use("/api/advanced", advancedRoutes)
app.use("/api/admin", adminRoutes)

// Start server
async function startServer() {
  try {
    await connectDB()
    app.listen(PORT, () => {
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
