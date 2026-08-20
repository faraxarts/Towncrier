const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  getAllEvents,
  getNewEventForm,
  createEvent,
  getEditEventForm,
  updateEvent,
  deleteEvent,
  togglePublishEvent,
} = require("../controllers/adminEventController");

const {
  isAuthenticated,
} = require("../middleware/authMiddleware");

const {
  isAdmin,
} = require("../middleware/adminMiddleware");

const router = express.Router();


/* =========================================================
   MULTER MEMORY STORAGE
   =========================================================
   Files now remain in memory only long enough for the
   controller to send them to Cloudinary.

   Nothing is written into public/uploads.
   ========================================================= */

const storage = multer.memoryStorage();


/* =========================================================
   EVENT IMAGE FILTER
   ========================================================= */

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const fileFilter = (req, file, cb) => {
  const extension =
    path.extname(file.originalname || "").toLowerCase();

  const mimeType =
    String(file.mimetype || "").toLowerCase();

  const validExtension =
    allowedExtensions.has(extension);

  const validMimeType =
    allowedMimeTypes.has(mimeType);

  if (validExtension && validMimeType) {
    return cb(null, true);
  }

  return cb(
    new Error(
      "Only JPG, JPEG, PNG, and WEBP image files are allowed."
    )
  );
};


/* =========================================================
   UPLOAD CONFIG
   =========================================================
   10 MB is generous enough for phone photos while
   preventing unexpectedly huge uploads from consuming
   server memory.
   ========================================================= */

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});


/* =========================================================
   ADMIN SECURITY
   ========================================================= */

router.use(
  isAuthenticated,
  isAdmin
);


/* =========================================================
   ROUTES
   ========================================================= */

router.get(
  "/",
  getAllEvents
);

router.get(
  "/new",
  getNewEventForm
);

router.post(
  "/",
  upload.single("featuredImage"),
  createEvent
);

router.get(
  "/:id/edit",
  getEditEventForm
);

router.post(
  "/:id/update",
  upload.single("featuredImage"),
  updateEvent
);

router.post(
  "/:id/delete",
  deleteEvent
);

router.post(
  "/:id/toggle-publish",
  togglePublishEvent
);


module.exports = router;