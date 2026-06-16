const express = require("express");
const {
  getAllManualPaymentRequests,
  approveManualPaymentRequest,
  rejectManualPaymentRequest,
} = require("../controllers/adminManualPaymentController");

const { isAuthenticated } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(isAuthenticated, isAdmin);

router.get("/", getAllManualPaymentRequests);
router.post("/:id/approve", approveManualPaymentRequest);
router.post("/:id/reject", rejectManualPaymentRequest);

module.exports = router;