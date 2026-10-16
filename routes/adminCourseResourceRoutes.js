const express =
  require("express");

const multer =
  require("multer");

const path =
  require("path");


const {
  getResources,
  createResource,
  updateResource,
  moveResourceUp,
  moveResourceDown,
  deleteResource,
} =
  require(
    "../controllers/adminCourseResourceController"
  );


const {
  isAuthenticated,
} =
  require(
    "../middleware/authMiddleware"
  );


const {
  isAdmin,
} =
  require(
    "../middleware/adminMiddleware"
  );


const router =
  express.Router({
    mergeParams:
      true,
  });


/* =========================================================
   SECURITY
   ========================================================= */

router.use(
  isAuthenticated,
  isAdmin
);


/* =========================================================
   MEMORY UPLOAD
   ========================================================= */

const storage =
  multer.memoryStorage();


const allowedExtensions =
  new Set([
    /* Audio */
    ".mp3",
    ".wav",
    ".mpeg",
    ".ogg",
    ".m4a",
    ".aac",
    ".mp4",

    /* Documents */
    ".pdf",
    ".doc",
    ".docx",
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
    )
  ) {
    return cb(
      null,
      true
    );
  }


 return cb(
  new Error(
    "Unsupported file type. Audio can be MP3, WAV, MPEG, OGG, M4A, AAC, or MP4. Documents can be PDF, DOC, or DOCX."
  )
);
};


const upload =
  multer({
    storage,

    fileFilter,

    limits: {
      fileSize:
        50 *
        1024 *
        1024,

      files:
        1,
    },
  });


/* =========================================================
   ROUTES
   ========================================================= */

router.get(
  "/",
  getResources
);


router.post(
  "/",
  upload.single(
    "resourceFile"
  ),
  createResource
);


router.post(
  "/:resourceId/update",
  upload.single(
    "resourceFile"
  ),
  updateResource
);


router.post(
  "/:resourceId/move-up",
  moveResourceUp
);


router.post(
  "/:resourceId/move-down",
  moveResourceDown
);


router.post(
  "/:resourceId/delete",
  deleteResource
);

/* =========================================================
   RESOURCE UPLOAD ERROR HANDLER

   Keeps AJAX responses consistently JSON instead of
   returning Express HTML error pages.
   ========================================================= */

router.use(
  (
    error,
    req,
    res,
    next
  ) => {

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
          "The selected file is too large. Maximum upload size is 50 MB.";
      }


      return res
        .status(400)
        .json({
          success:
            false,

          message,
        });
    }


    if (error) {

      console.error(
        "Course resource upload error:",
        error
      );


      return res
        .status(400)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to process this upload.",
        });
    }


    return next();
  }
);


module.exports =
  router;
module.exports =
  router;