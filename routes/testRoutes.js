const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const { getAll, getById, create, update, deleteTestById } = require("../controllers/testController")

router.get("/", getAll)
router.post("/", create)
router.get("/:id", getById)
router.put("/:id", update)
router.delete("/:id", deleteTestById)

module.exports = router
