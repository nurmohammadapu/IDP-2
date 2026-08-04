const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const { getAll, getById, create, update, deleteAppointmentById, getAvailableSlots } = require("../controllers/appointmentController")

router.get("/slots", getAvailableSlots)
router.get("/", getAll)
router.post("/", create)
router.get("/:id", getById)
router.put("/:id", update)
router.delete("/:id", deleteAppointmentById)

module.exports = router
