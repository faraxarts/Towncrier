const express = require("express");
const { getAllAssignmentSubmissions } = require("../controllers/adminAssignmentController");
const { isAuthenticated } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/", isAuthenticated, isAdmin, getAllAssignmentSubmissions);

module.exports = router;