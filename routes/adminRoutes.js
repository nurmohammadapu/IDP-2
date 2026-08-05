const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const { getAll, create, update, changeStatus, remove, getAssistants, assignAssistant, removeAssistant } = require("../controllers/adminController")

router.get("/users", getAll)
router.post("/users", create)
router.put("/users/:id/status", changeStatus)
router.put("/users/:id", update)
router.delete("/users/:id", remove)

router.get("/assistants", getAssistants)
router.post("/assistants", assignAssistant)
router.delete("/assistants/:id", removeAssistant)

module.exports = router
