const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const { getAll, create, update, changeStatus, remove } = require("../controllers/adminController")

router.get("/users", getAll)
router.post("/users", create)
router.put("/users/:id/status", changeStatus)
router.put("/users/:id", update)
router.delete("/users/:id", remove)

module.exports = router
