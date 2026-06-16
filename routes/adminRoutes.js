const express = require("express");
const {
  getAdminDashboard,
  getRegistrations,
  getContactMessages,
  getPrayerRequests,
} = require("../controllers/adminController");

const { isAuthenticated } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/", isAuthenticated, isAdmin, getAdminDashboard);
router.get("/registrations", isAuthenticated, isAdmin, getRegistrations);
router.get("/contact-messages", isAuthenticated, isAdmin, getContactMessages);
router.get("/prayer-requests", isAuthenticated, isAdmin, getPrayerRequests);

module.exports = router;