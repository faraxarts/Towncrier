const express = require("express");
const {
  getAllLevelAccess,
  revokeLevelAccess,
} = require("../controllers/adminLevelAccessController");
const { isAuthenticated } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/", isAuthenticated, isAdmin, getAllLevelAccess);
router.post("/:id/delete", isAuthenticated, isAdmin, revokeLevelAccess);

module.exports = router;