const createHttpApp = require("../httpHelper")
const router = createHttpApp.Router()
const { register, login, logout, getCurrentUser, updateProfile, changePassword } = require("../controllers/authController")

router.post("/register", register)
router.post("/login", login)
router.post("/logout", logout)
router.get("/me", getCurrentUser)
router.put("/profile", updateProfile)
router.put("/password", changePassword)

module.exports = router
