const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  getAllCourses,
  getNewCourseForm,
  createCourse,
  getEditCourseForm,
  updateCourse,
  deleteCourse,
  togglePublishCourse,
} = require("../controllers/adminCourseController");

const { isAuthenticated } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

const uploadBase = path.join(__dirname, "..", "public", "uploads", "courses");
const imageDir = path.join(uploadBase, "images");
const documentDir = path.join(uploadBase, "documents");
const audioDir = path.join(uploadBase, "audios");
const assignmentDir = path.join(uploadBase, "assignments");

[uploadBase, imageDir, documentDir, audioDir, assignmentDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === "featuredImage") return cb(null, imageDir);
    if (file.fieldname === "courseDocuments") return cb(null, documentDir);
    if (file.fieldname === "courseAudios") return cb(null, audioDir);
    if (file.fieldname === "assignmentDocument") return cb(null, assignmentDir);
    cb(null, uploadBase);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const safeName = `${file.fieldname}-${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|webp/;
  const docTypes = /pdf|doc|docx/;
  const audioTypes = /mp3|wav|mpeg|ogg/;

  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "featuredImage") {
    return imageTypes.test(ext) ? cb(null, true) : cb(new Error("Only image files are allowed for featured image."));
  }

  if (file.fieldname === "courseDocuments" || file.fieldname === "assignmentDocument") {
    return docTypes.test(ext) ? cb(null, true) : cb(new Error("Only PDF, DOC, and DOCX files are allowed for documents."));
  }

  if (file.fieldname === "courseAudios") {
    return audioTypes.test(ext) ? cb(null, true) : cb(new Error("Only audio files are allowed for course audios."));
  }

  cb(null, false);
};

const upload = multer({ storage, fileFilter });

router.use(isAuthenticated, isAdmin);

router.get("/", getAllCourses);
router.get("/new", getNewCourseForm);

router.post(
  "/",
  upload.fields([
    { name: "featuredImage", maxCount: 1 },
    { name: "courseDocuments", maxCount: 20 },
    { name: "courseAudios", maxCount: 20 },
    { name: "assignmentDocument", maxCount: 1 },
  ]),
  createCourse
);

router.get("/:id/edit", getEditCourseForm);

router.post(
  "/:id/update",
  upload.fields([
    { name: "featuredImage", maxCount: 1 },
    { name: "courseDocuments", maxCount: 20 },
    { name: "courseAudios", maxCount: 20 },
    { name: "assignmentDocument", maxCount: 1 },
  ]),
  updateCourse
);

router.post("/:id/delete", deleteCourse);
router.post("/:id/toggle-publish", togglePublishCourse);

module.exports = router;