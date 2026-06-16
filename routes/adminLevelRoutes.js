const express = require("express");
const {
  getAllLevels,
  getNewLevelForm,
  createLevel,
  getEditLevelForm,
  updateLevel,
  deleteLevel,
  togglePublishLevel,
} = require("../controllers/adminLevelController");

const { isAuthenticated } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(isAuthenticated, isAdmin);

router.get("/", getAllLevels);
router.get("/new", getNewLevelForm);
router.post("/", createLevel);
router.get("/:id/edit", getEditLevelForm);
router.post("/:id/update", updateLevel);
router.post("/:id/delete", deleteLevel);
router.post("/:id/toggle-publish", togglePublishLevel);

module.exports = router;