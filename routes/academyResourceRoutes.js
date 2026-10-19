const express =
  require("express");

const multer =
  require("multer");

const path =
  require("path");


const {
  openResource,
  downloadResource,
  submitResourceAssignment,
  completeResourceManually,
  saveAudioProgress,
} =
  require(
    "../controllers/academyResourceController"
  );


const router =
  express.Router({
    mergeParams:
      true,
  });


/* =========================================================
   ASSIGNMENT SUBMISSION UPLOAD
   ========================================================= */

const storage =
  multer.memoryStorage();


const allowedExtensions =
  new Set([
    ".pdf",
    ".doc",
    ".docx",
  ]);


const allowedMimeTypes =
  new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);


/* =========================================================
   FILE FILTER
   ========================================================= */

const fileFilter = (
  req,
  file,
  cb
) => {

  const extension =
    path
      .extname(
        file.originalname ||
        ""
      )
      .toLowerCase();


  if (
    allowedExtensions.has(
      extension
    ) &&
    allowedMimeTypes.has(
      file.mimetype
    )
  ) {

    return cb(
      null,
      true
    );
  }


  return cb(
    new Error(
      "Only PDF, DOC, and DOCX assignment files are allowed."
    )
  );
};


/* =========================================================
   MULTER
   ========================================================= */

const upload =
  multer({

    storage,

    fileFilter,

    limits: {

      fileSize:
        15 *
        1024 *
        1024,

      files:
        1,
    },
  });


/* =========================================================
   RESOURCE ROUTES
   ========================================================= */

router.get(
  "/:resourceId/open",
  openResource
);


router.get(
  "/:resourceId/download",
  downloadResource
);


/* =========================================================
   ASSIGNMENT SUBMISSION
   ========================================================= */

router.post(
  "/:resourceId/assignment-submit",

  upload.single(
    "assignmentFile"
  ),

  submitResourceAssignment
);


/* =========================================================
   DBW V2 — MANUAL COMPLETION
   ========================================================= */

router.post(
  "/:resourceId/complete",
  completeResourceManually
);


/* =========================================================
   DBW V2 — AUDIO PROGRESS
   ========================================================= */

router.post(
  "/:resourceId/audio-progress",

  express.json({
    limit:
      "32kb",
  }),

  saveAudioProgress
);


/* =========================================================
   MULTER ERROR HANDLER
   ========================================================= */

router.use(
  (
    error,
    req,
    res,
    next
  ) => {

    if (!error) {
      return next();
    }


    if (
      error instanceof
      multer.MulterError
    ) {

      let message =
        error.message;


      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        message =
          "The assignment file is too large. Maximum size is 15 MB.";
      }


      return res
        .status(400)
        .send(
          message
        );
    }


    if (
      error.message ===
      "Only PDF, DOC, and DOCX assignment files are allowed."
    ) {

      return res
        .status(400)
        .send(
          error.message
        );
    }


    return next(
      error
    );
  }
);


module.exports =
  router;