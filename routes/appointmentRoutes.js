const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const { getAll, getById, create, update, deleteAppointmentById } = require("../controllers/appointmentController")

router.get("/", getAll)
router.post("/", create)
router.get("/:id", getById)
router.put("/:id", update)
router.delete("/:id", deleteAppointmentById)

module.exports = router
