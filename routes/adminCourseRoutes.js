const express = require("express");
const multer = require("multer");
const path = require("path");


/* =========================================================
   DBW V2 RESOURCE ROUTES
   ========================================================= */

const adminCourseResourceRoutes =
  require("./adminCourseResourceRoutes");


/* =========================================================
   LEGACY COURSE CONTROLLER

   We intentionally keep the old Course controller because
   existing legacy Courses still use the old Edit/Update
   workflow during the transition to DBW V2.
   ========================================================= */

const {
  getAllCourses,
  createCourse,
  getEditCourseForm,
  updateCourse,
  deleteCourse,
  togglePublishCourse,
} = require("../controllers/adminCourseController");


/* =========================================================
   DBW V2 COURSE BUILDER CONTROLLER
   ========================================================= */

const {
  getBuilderStartForm,
  startBuilder,
  getBuilder,
  updateBuilderDetails,
  updateBuilderRules,
  saveBuilderDraft,
  publishBuilderCourse,
} = require(
  "../controllers/adminCourseBuilderController"
);


/* =========================================================
   AUTH
   ========================================================= */

const {
  isAuthenticated,
} = require("../middleware/authMiddleware");


const {
  isAdmin,
} = require("../middleware/adminMiddleware");


const router =
  express.Router();


/* =========================================================
   MULTER MEMORY STORAGE

   Files are not permanently written to Render.
   They are held in memory and passed to Cloudinary.
   ========================================================= */

const storage =
  multer.memoryStorage();


/* =========================================================
   ALLOWED FILE EXTENSIONS
   ========================================================= */

const imageExtensions =
  new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
  ]);


const documentExtensions =
  new Set([
    ".pdf",
    ".doc",
    ".docx",
  ]);


const audioExtensions =
  new Set([
    ".mp3",
    ".wav",
    ".mpeg",
    ".ogg",
  ]);


/* =========================================================
   FILE FILTER
   ========================================================= */

const fileFilter = (
  req,
  file,
  cb
) => {

  const ext =
    path
      .extname(
        file.originalname ||
        ""
      )
      .toLowerCase();


  /* Featured image */

  if (
    file.fieldname ===
    "featuredImage"
  ) {

    if (
      imageExtensions.has(
        ext
      )
    ) {
      return cb(
        null,
        true
      );
    }


    return cb(
      new Error(
        "Only JPG, JPEG, PNG, and WEBP files are allowed for the featured image."
      )
    );
  }


  /* Course documents */

  if (
    file.fieldname ===
      "courseDocuments" ||
    file.fieldname ===
      "assignmentDocument"
  ) {

    if (
      documentExtensions.has(
        ext
      )
    ) {
      return cb(
        null,
        true
      );
    }


    return cb(
      new Error(
        "Only PDF, DOC, and DOCX files are allowed for documents."
      )
    );
  }


  /* Course audio */

  if (
    file.fieldname ===
    "courseAudios"
  ) {

    if (
      audioExtensions.has(
        ext
      )
    ) {
      return cb(
        null,
        true
      );
    }


    return cb(
      new Error(
        "Only MP3, WAV, MPEG, and OGG audio files are allowed."
      )
    );
  }


  return cb(
    null,
    false
  );
};


/* =========================================================
   MULTER CONFIGURATION
   ========================================================= */

const upload =
  multer({
    storage,

    fileFilter,

    limits: {

      /*
       * Maximum size PER FILE.
       */
      fileSize:
        50 *
        1024 *
        1024,

      files:
        42,
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
   COURSE LIST
   ========================================================= */

router.get(
  "/",
  getAllCourses
);


/* =========================================================
   DBW V2 — NEW COURSE ENTRY POINT

   IMPORTANT:
   /admin/courses/new must ALWAYS open the new Course Builder.

   The old getNewCourseForm is intentionally NOT used here.
   ========================================================= */

router.get(
  "/new",
  getBuilderStartForm
);


/* =========================================================
   DBW V2 — START PERSISTENT DRAFT
   ========================================================= */

router.post(
  "/builder/start",

  upload.single(
    "featuredImage"
  ),

  startBuilder
);


/* =========================================================
   DBW V2 — COURSE BUILDER
   ========================================================= */

router.get(
  "/:id/builder/:step",
  getBuilder
);


router.post(
  "/:id/builder/details",

  upload.single(
    "featuredImage"
  ),

  updateBuilderDetails
);


router.post(
  "/:id/builder/rules",
  updateBuilderRules
);


router.post(
  "/:id/builder/save-draft",
  saveBuilderDraft
);


router.post(
  "/:id/builder/publish",
  publishBuilderCourse
);


/* =========================================================
   DBW V2 — LEARNING MATERIAL CRUD

   Examples:

   /admin/courses/:courseId/resources
   /admin/courses/:courseId/resources/:resourceId/update
   ========================================================= */

router.use(
  "/:courseId/resources",
  adminCourseResourceRoutes
);


/* =========================================================
   LEGACY COURSE CREATE ENDPOINT

   Kept temporarily for migration compatibility.

   The normal "Add New Course" button no longer uses this
   endpoint. New DBW Courses are created through
   /builder/start instead.
   ========================================================= */

router.post(
  "/",

  upload.fields([
    {
      name:
        "featuredImage",

      maxCount:
        1,
    },

    {
      name:
        "courseDocuments",

      maxCount:
        20,
    },

    {
      name:
        "courseAudios",

      maxCount:
        20,
    },

    {
      name:
        "assignmentDocument",

      maxCount:
        1,
    },
  ]),

  createCourse
);


/* =========================================================
   LEGACY COURSE EDIT

   Existing Courses with contentMode = "legacy"
   continue using these routes.
   ========================================================= */

router.get(
  "/:id/edit",
  getEditCourseForm
);


router.post(
  "/:id/update",

  upload.fields([
    {
      name:
        "featuredImage",

      maxCount:
        1,
    },

    {
      name:
        "courseDocuments",

      maxCount:
        20,
    },

    {
      name:
        "courseAudios",

      maxCount:
        20,
    },

    {
      name:
        "assignmentDocument",

      maxCount:
        1,
    },
  ]),

  updateCourse
);


/* =========================================================
   DELETE COURSE
   ========================================================= */

router.post(
  "/:id/delete",
  deleteCourse
);


/* =========================================================
   LEGACY PUBLISH TOGGLE
   ========================================================= */

router.post(
  "/:id/toggle-publish",
  togglePublishCourse
);


module.exports =
  router;