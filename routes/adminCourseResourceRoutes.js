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
    ".mp3",
    ".wav",
    ".mpeg",
    ".ogg",

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
      "Only supported audio or document files are allowed."
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


module.exports =
  router;