const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  getDocumentsPage,
  submitAssignment,
} = require("../controllers/hubDocumentController");

const {
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
} = require("../middleware/academyEnrollmentMiddleware");

const router = express.Router({
  mergeParams: true,
});


/* =========================================================
   ASSIGNMENT UPLOAD

   Files stay temporarily in memory and are uploaded
   permanently to Cloudinary by the controller.
   ========================================================= */

const storage = multer.memoryStorage();


const allowedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
]);


const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);


const fileFilter = (
  req,
  file,
  cb
) => {
  const extension = path
    .extname(
      file.originalname || ""
    )
    .toLowerCase();


  const extensionAllowed =
    allowedExtensions.has(
      extension
    );


  const mimeAllowed =
    allowedMimeTypes.has(
      file.mimetype
    );


  if (
    extensionAllowed &&
    mimeAllowed
  ) {
    return cb(
      null,
      true
    );
  }


  return cb(
    new Error(
      "Only PDF, DOC, and DOCX files are allowed."
    )
  );
};


const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize:
      15 * 1024 * 1024,

    files: 1,
  },
});


/* =========================================================
   ACADEMY
   ========================================================= */

router.use(
  loadAcademyBySlug
);


router.get(
  "/",

  requireAcademyEnrollmentPage,

  getDocumentsPage
);


router.post(
  "/submit-assignment",

  requireAcademyEnrollmentPage,

  upload.single(
    "assignmentFile"
  ),

  submitAssignment
);


module.exports = router;