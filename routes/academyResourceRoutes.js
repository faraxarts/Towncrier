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


router.post(
  "/:resourceId/assignment-submit",

  upload.single(
    "assignmentFile"
  ),

  submitResourceAssignment
);


module.exports =
  router;