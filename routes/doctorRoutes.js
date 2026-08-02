const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const { getAll, getById, create, update, deleteDoctorById, search, getDashboardData } = require("../controllers/doctorController")

router.get("/dashboard", getDashboardData)
router.get("/", (req, res) => {
  const { search: searchQuery } = req.query
  if (searchQuery) {
    return search(req, res)
  }
  return getAll(req, res)
})
router.post("/", create)
router.get("/:id", getById)
router.put("/:id", update)
router.delete("/:id", deleteDoctorById)

module.exports = router
