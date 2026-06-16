const express = require("express");
const {
  getUserNotifications,
  openNotification,
  markAllNotificationsRead,
} = require("../controllers/notificationController");
const { isAuthenticated } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", isAuthenticated, getUserNotifications);
router.get("/:id/open", isAuthenticated, openNotification);
router.post("/read-all", isAuthenticated, markAllNotificationsRead);

module.exports = router;