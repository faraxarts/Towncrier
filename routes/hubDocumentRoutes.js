const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  getDocumentsPage,
  submitAssignment,
} = require("../controllers/hubDocumentController");

const {
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
} = require("../middleware/academyEnrollmentMiddleware");

const router = express.Router({ mergeParams: true });

const uploadDir = path.join(__dirname, "..", "public", "uploads", "submissions");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `submission-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /(\.pdf|\.doc|\.docx)$/i;
  const isValid = allowedExtensions.test(file.originalname);

  if (isValid) {
    return cb(null, true);
  }

  cb(new Error("Only PDF, DOC, and DOCX files are allowed."));
};

const upload = multer({ storage, fileFilter });

router.use(loadAcademyBySlug);

router.get("/", requireAcademyEnrollmentPage, getDocumentsPage);
router.post(
  "/submit-assignment",
  requireAcademyEnrollmentPage,
  upload.single("assignmentFile"),
  submitAssignment
);

module.exports = router;