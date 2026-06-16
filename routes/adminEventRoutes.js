const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  getAllEvents,
  getNewEventForm,
  createEvent,
  getEditEventForm,
  updateEvent,
  deleteEvent,
  togglePublishEvent,
} = require("../controllers/adminEventController");

const { isAuthenticated } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "public", "uploads", "events", "images");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `event-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.webp)$/i;
  const isValid = allowedExtensions.test(file.originalname);

  if (isValid) {
    return cb(null, true);
  }

  cb(new Error("Only JPG, JPEG, PNG, and WEBP files are allowed."));
};

const upload = multer({ storage, fileFilter });

router.use(isAuthenticated, isAdmin);

router.get("/", getAllEvents);
router.get("/new", getNewEventForm);
router.post("/", upload.single("featuredImage"), createEvent);
router.get("/:id/edit", getEditEventForm);
router.post("/:id/update", upload.single("featuredImage"), updateEvent);
router.post("/:id/delete", deleteEvent);
router.post("/:id/toggle-publish", togglePublishEvent);

module.exports = router;