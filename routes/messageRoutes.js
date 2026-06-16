const express = require("express");
const { createMessage } = require("../controllers/messageController");
const { isAuthenticated } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/", isAuthenticated, isAdmin, createMessage);

module.exports = router;