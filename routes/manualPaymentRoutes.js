const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  getManualPaymentPage,
  submitManualPaymentRequest,
} = require("../controllers/manualPaymentController");

const {
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
} = require("../middleware/academyEnrollmentMiddleware");


const router = express.Router({
  mergeParams: true,
});


/* =========================================================
   PAYMENT PROOF UPLOAD

   No permanent Render filesystem storage.
   ========================================================= */

const storage = multer.memoryStorage();


const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".pdf",
]);


const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
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
      "Only JPG, JPEG, PNG, and PDF files are allowed."
    )
  );
};


const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize:
      10 * 1024 * 1024,

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
  "/levels/:levelId",

  requireAcademyEnrollmentPage,

  getManualPaymentPage
);


router.post(
  "/levels/:levelId/submit",

  requireAcademyEnrollmentPage,

  upload.single(
    "proofFile"
  ),

  submitManualPaymentRequest
);


module.exports = router;