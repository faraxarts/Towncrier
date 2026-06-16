const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  getManualPaymentPage,
  submitManualPaymentRequest,
} = require("../controllers/manualPaymentController");

const {
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
} = require("../middleware/academyEnrollmentMiddleware");

const router = express.Router({ mergeParams: true });

const uploadDir = path.join(__dirname, "..", "public", "uploads", "payment-proofs");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `payment-proof-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.pdf)$/i;
  const isValid = allowedExtensions.test(file.originalname);

  if (isValid) {
    return cb(null, true);
  }

  cb(new Error("Only JPG, JPEG, PNG, and PDF files are allowed."));
};

const upload = multer({ storage, fileFilter });

router.use(loadAcademyBySlug);

router.get("/levels/:levelId", requireAcademyEnrollmentPage, getManualPaymentPage);
router.post(
  "/levels/:levelId/submit",
  requireAcademyEnrollmentPage,
  upload.single("proofFile"),
  submitManualPaymentRequest
);

module.exports = router;