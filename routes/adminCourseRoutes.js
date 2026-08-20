const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  getAllCourses,
  getNewCourseForm,
  createCourse,
  getEditCourseForm,
  updateCourse,
  deleteCourse,
  togglePublishCourse,
} = require("../controllers/adminCourseController");

const {
  isAuthenticated,
} = require("../middleware/authMiddleware");

const {
  isAdmin,
} = require("../middleware/adminMiddleware");

const router = express.Router();


/* =========================================================
   MULTER MEMORY STORAGE

   Files are no longer written to public/uploads.
   They are kept temporarily in memory and immediately
   uploaded to Cloudinary by the controller.
   ========================================================= */

const storage = multer.memoryStorage();


/* =========================================================
   ALLOWED FILE EXTENSIONS
   ========================================================= */

const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const documentExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
]);

const audioExtensions = new Set([
  ".mp3",
  ".wav",
  ".mpeg",
  ".ogg",
]);


/* =========================================================
   FILE FILTER
   ========================================================= */

const fileFilter = (req, file, cb) => {
  const ext = path
    .extname(file.originalname || "")
    .toLowerCase();


  if (file.fieldname === "featuredImage") {
    if (imageExtensions.has(ext)) {
      return cb(null, true);
    }

    return cb(
      new Error(
        "Only JPG, JPEG, PNG, and WEBP files are allowed for the featured image."
      )
    );
  }


  if (
    file.fieldname === "courseDocuments" ||
    file.fieldname === "assignmentDocument"
  ) {
    if (documentExtensions.has(ext)) {
      return cb(null, true);
    }

    return cb(
      new Error(
        "Only PDF, DOC, and DOCX files are allowed for documents."
      )
    );
  }


  if (file.fieldname === "courseAudios") {
    if (audioExtensions.has(ext)) {
      return cb(null, true);
    }

    return cb(
      new Error(
        "Only MP3, WAV, MPEG, and OGG audio files are allowed."
      )
    );
  }


  return cb(null, false);
};


/* =========================================================
   MULTER CONFIGURATION
   ========================================================= */

const upload = multer({
  storage,

  fileFilter,

  limits: {
    /*
     * Per-file limit.
     *
     * 50 MB allows reasonable course audio uploads.
     * If you later need much larger sermon/audio files,
     * we can switch those specifically to chunked upload.
     */
    fileSize: 50 * 1024 * 1024,

    files: 42,
  },
});


/* =========================================================
   SECURITY
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
  getAllCourses
);

router.get(
  "/new",
  getNewCourseForm
);


router.post(
  "/",

  upload.fields([
    {
      name: "featuredImage",
      maxCount: 1,
    },

    {
      name: "courseDocuments",
      maxCount: 20,
    },

    {
      name: "courseAudios",
      maxCount: 20,
    },

    {
      name: "assignmentDocument",
      maxCount: 1,
    },
  ]),

  createCourse
);


router.get(
  "/:id/edit",
  getEditCourseForm
);


router.post(
  "/:id/update",

  upload.fields([
    {
      name: "featuredImage",
      maxCount: 1,
    },

    {
      name: "courseDocuments",
      maxCount: 20,
    },

    {
      name: "courseAudios",
      maxCount: 20,
    },

    {
      name: "assignmentDocument",
      maxCount: 1,
    },
  ]),

  updateCourse
);


router.post(
  "/:id/delete",
  deleteCourse
);


router.post(
  "/:id/toggle-publish",
  togglePublishCourse
);


module.exports = router;