const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const {
  getNotifications,
  markNotificationRead,
  getAuditTrail,
  getSystemStats,
  createSystemBackup,
  getBackups,
  exportData,
  sendAppointmentReminder,
  advancedSearch,
} = require("../controllers/advancedController")

router.get("/notifications", getNotifications)
router.put("/notifications/:id/read", markNotificationRead)
router.get("/audit", getAuditTrail)
router.get("/stats", getSystemStats)
router.post("/backup", createSystemBackup)
router.get("/backups", getBackups)
router.post("/export", exportData)
router.post("/send-reminder", sendAppointmentReminder)
router.post("/search", advancedSearch)

module.exports = router
