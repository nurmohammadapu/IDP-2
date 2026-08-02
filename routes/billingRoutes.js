const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const {
  getAll,
  create,
  updateStatus,
  getAllAdvanced,
  getAdvancedById,
  createAdvanced,
  updateAdvanced,
  addBillPayment,
  generateBillPDF,
} = require("../controllers/billingController")

router.get("/advanced", getAllAdvanced)
router.post("/advanced", createAdvanced)
router.get("/advanced/:id", getAdvancedById)
router.put("/advanced/:id", updateAdvanced)
router.post("/advanced/:id/payment", addBillPayment)
router.get("/advanced/:id/pdf", generateBillPDF)

router.get("/", getAll)
router.post("/", create)
router.put("/:id/status", updateStatus)

module.exports = router
