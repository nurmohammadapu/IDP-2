const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const ReportController = require("../controllers/reportController")

router.get("/overview", ReportController.getOverview)
router.get("/financial", ReportController.getFinancialReport)

module.exports = router
