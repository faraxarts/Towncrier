const fs = require("fs");
const path = require("path");

const Course = require("../models/course");
const Level = require("../models/Level");
const Academy = require("../models/Academy");

const {
  uploadBuffer,
  deleteAsset,
} = require("../services/cloudinaryService");

const {
  createCourseNotificationIfNeeded,
} = require("../services/notificationService");


/* =========================================================
   SLUG
   ========================================================= */

function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");
}


/* =========================================================
   TEXT LIST
   ========================================================= */

function parseList(value) {
  if (!value) {
    return [];
  }

  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}


/* =========================================================
   MODULE LIST
   ========================================================= */

function parseModules(value) {
  if (!value) {
    return [];
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [
        titlePart,
        lessonsPart,
      ] = line
        .split("|")
        .map((item) =>
          item.trim()
        );

      return {
        title:
          titlePart ||
          "Untitled Module",

        lessons:
          Number(
            lessonsPart || 0
          ),
      };
    });
}


/* =========================================================
   ADMIN REDIRECT
   ========================================================= */

function buildAdminRedirect(
  basePath,
  academyId = ""
) {
  return academyId
    ? `${basePath}?academy=${encodeURIComponent(
        academyId
      )}`
    : basePath;
}


/* =========================================================
   CLOUDINARY UPLOAD HELPERS
   ========================================================= */

async function uploadCourseImage(file) {
  if (!file) {
    return null;
  }

  return uploadBuffer(
    file.buffer,
    {
      folder:
        "tcem/courses/images",

      resourceType:
        "image",

      originalFilename:
        file.originalname,
    }
  );
}


async function uploadCourseDocument(
  file
) {
  if (!file) {
    return null;
  }

  /*
   * auto lets Cloudinary correctly determine
   * PDF / DOC / DOCX handling.
   */
  return uploadBuffer(
    file.buffer,
    {
      folder:
        "tcem/courses/documents",

      resourceType:
        "auto",

      originalFilename:
        file.originalname,
    }
  );
}


async function uploadCourseAudio(file) {
  if (!file) {
    return null;
  }

  /*
   * Cloudinary classifies audio as video.
   * auto will return resourceType "video".
   */
  return uploadBuffer(
    file.buffer,
    {
      folder:
        "tcem/courses/audios",

      resourceType:
        "auto",

      originalFilename:
        file.originalname,
    }
  );
}


async function uploadAssignmentDocument(
  file
) {
  if (!file) {
    return null;
  }

  return uploadBuffer(
    file.buffer,
    {
      folder:
        "tcem/courses/assignments",

      resourceType:
        "auto",

      originalFilename:
        file.originalname,
    }
  );
}


/* =========================================================
   CONVERT CLOUDINARY RESULT INTO COURSE FILE ITEM
   ========================================================= */

function buildStoredFile(
  file,
  uploadResult
) {
  return {
    originalName:
      file.originalname,

    fileUrl:
      uploadResult.url,

    publicId:
      uploadResult.publicId,

    resourceType:
      uploadResult.resourceType,
  };
}


/* =========================================================
   UPLOAD FILE ARRAY SEQUENTIALLY
   =========================================================
   Sequential uploads reduce simultaneous Cloudinary
   requests and make cleanup easier.
   ========================================================= */

async function uploadFileList(
  files,
  uploader,
  uploadedAssets
) {
  const storedFiles = [];

  for (const file of files) {
    const result =
      await uploader(file);

    if (!result) {
      continue;
    }

    uploadedAssets.push({
      publicId:
        result.publicId,

      resourceType:
        result.resourceType,
    });

    storedFiles.push(
      buildStoredFile(
        file,
        result
      )
    );
  }

  return storedFiles;
}


/* =========================================================
   LEGACY LOCAL FILE DELETE
   ========================================================= */

async function removeLegacyPublicFile(
  publicUrl
) {
  try {
    if (!publicUrl) {
      return;
    }

    /*
     * Never attempt to convert an external URL into
     * a filesystem path.
     */
    if (
      /^https?:\/\//i.test(
        publicUrl
      )
    ) {
      return;
    }

    const cleanRelativePath =
      publicUrl.replace(
        /^\/+/,
        ""
      );

    const absolutePath =
      path.join(
        __dirname,
        "..",
        "public",
        cleanRelativePath
      );

    if (
      fs.existsSync(
        absolutePath
      )
    ) {
      await fs.promises.unlink(
        absolutePath
      );
    }
  } catch (error) {
    console.error(
      "Legacy Course file delete error:",
      error.message
    );
  }
}


/* =========================================================
   DELETE STORED ASSET
   ========================================================= */

async function removeStoredAsset({
  url = "",
  publicId = "",
  resourceType = "",
} = {}) {
  if (publicId) {
    try {
      await deleteAsset(
        publicId,
        resourceType ||
          "image"
      );
    } catch (error) {
      console.error(
        "Cloudinary Course asset delete error:",
        error.message
      );
    }

    return;
  }

  if (url) {
    await removeLegacyPublicFile(
      url
    );
  }
}


/* =========================================================
   CLEANUP NEW UPLOADS AFTER FAILED DB OPERATION
   ========================================================= */

async function cleanupUploadedAssets(
  assets = []
) {
  for (const asset of assets) {
    if (!asset.publicId) {
      continue;
    }

    try {
      await deleteAsset(
        asset.publicId,
        asset.resourceType ||
          "image"
      );
    } catch (error) {
      console.error(
        "Course upload cleanup error:",
        error.message
      );
    }
  }
}


/* =========================================================
   DELETE EVERYTHING OWNED BY COURSE
   ========================================================= */

async function removeCourseFiles(
  course
) {
  if (!course) {
    return;
  }


  /* Featured image */

  await removeStoredAsset({
    url:
      course.featuredImage,

    publicId:
      course.featuredImagePublicId,

    resourceType:
      course.featuredImageResourceType ||
      "image",
  });


  /* Course documents */

  if (
    Array.isArray(
      course.courseDocuments
    )
  ) {
    for (
      const doc
      of course.courseDocuments
    ) {
      await removeStoredAsset({
        url:
          doc.fileUrl,

        publicId:
          doc.publicId,

        resourceType:
          doc.resourceType ||
          "raw",
      });
    }
  }


  /* Course audios */

  if (
    Array.isArray(
      course.courseAudios
    )
  ) {
    for (
      const audio
      of course.courseAudios
    ) {
      await removeStoredAsset({
        url:
          audio.fileUrl,

        publicId:
          audio.publicId,

        resourceType:
          audio.resourceType ||
          "video",
      });
    }
  }


  /* Assignment document */

  if (
    course.assignmentDocument &&
    course.assignmentDocument.fileUrl
  ) {
    await removeStoredAsset({
      url:
        course.assignmentDocument
          .fileUrl,

      publicId:
        course.assignmentDocument
          .publicId,

      resourceType:
        course.assignmentDocument
          .resourceType ||
        "raw",
    });
  }
}


/* =========================================================
   LIST COURSES
   ========================================================= */

exports.getAllCourses = async (
  req,
  res
) => {
  try {
    const selectedAcademy =
      req.query.academy?.trim() ||
      "";

    const filter = {};

    if (selectedAcademy) {
      filter.academy =
        selectedAcademy;
    }


    const [
      academies,
      courses,
    ] = await Promise.all([
      Academy.find({
        isPublished: true,
      }).sort({
        createdAt: 1,
      }),

      Course.find(filter)
        .populate("academy")
        .populate("level")
        .sort({
          createdAt: -1,
        }),
    ]);


    return res.render(
      "admin/courses/index",
      {
        courses,
        academies,
        selectedAcademy,
      }
    );
  } catch (error) {
    console.error(
      "Get courses error:",
      error
    );

    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   NEW COURSE FORM
   ========================================================= */

exports.getNewCourseForm = async (
  req,
  res
) => {
  try {
    const academies =
      await Academy.find({
        isPublished: true,
      }).sort({
        createdAt: 1,
      });


    const levels =
      await Level.find({
        isPublished: true,
      })
        .populate(
          "academy"
        )
        .sort({
          order: 1,
          createdAt: 1,
        });


    return res.render(
      "admin/courses/new",
      {
        academies,
        levels,
      }
    );
  } catch (error) {
    console.error(
      "Get new course form error:",
      error
    );

    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   CREATE COURSE
   ========================================================= */

exports.createCourse = async (
  req,
  res
) => {
  const uploadedAssets = [];

  try {
    const academyId =
      req.body.academy?.trim();

    const title =
      req.body.title?.trim();

    const description =
      req.body.description?.trim();


    if (
      !academyId ||
      !title ||
      !description
    ) {
      return res
        .status(400)
        .send(
          "Academy, title, and description are required."
        );
    }


    const academy =
      await Academy.findById(
        academyId
      );


    if (!academy) {
      return res
        .status(400)
        .send(
          "Selected academy does not exist."
        );
    }


    /* -----------------------------------------
       SLUG
       ----------------------------------------- */

    let slug =
      req.body.slug?.trim() ||
      slugify(title);


    const existingSlug =
      await Course.findOne({
        slug,
      });


    if (existingSlug) {
      slug =
        `${slug}-${Date.now()}`;
    }


    /* -----------------------------------------
       LEVEL
       ----------------------------------------- */

    const levelId =
      req.body.level?.trim() ||
      null;

    const levelPosition =
      Number(
        req.body.levelPosition ||
        1
      );


    if (levelId) {
      const levelExists =
        await Level.findOne({
          _id:
            levelId,

          academy:
            academyId,
        });


      if (!levelExists) {
        return res
          .status(400)
          .send(
            "Selected level does not belong to the selected academy."
          );
      }
    }


    /* -----------------------------------------
       FILE INPUTS
       ----------------------------------------- */

    const featuredImageFile =
      req.files
        ?.featuredImage?.[0];

    const assignmentFile =
      req.files
        ?.assignmentDocument?.[0];

    const documentFiles =
      req.files
        ?.courseDocuments ||
      [];

    const audioFiles =
      req.files
        ?.courseAudios ||
      [];


    /* -----------------------------------------
       UPLOAD FEATURED IMAGE
       ----------------------------------------- */

    let featuredImageUpload =
      null;


    if (featuredImageFile) {
      featuredImageUpload =
        await uploadCourseImage(
          featuredImageFile
        );


      uploadedAssets.push({
        publicId:
          featuredImageUpload
            .publicId,

        resourceType:
          featuredImageUpload
            .resourceType,
      });
    }


    /* -----------------------------------------
       UPLOAD DOCUMENTS
       ----------------------------------------- */

    const storedDocuments =
      await uploadFileList(
        documentFiles,

        uploadCourseDocument,

        uploadedAssets
      );


    /* -----------------------------------------
       UPLOAD AUDIO
       ----------------------------------------- */

    const storedAudios =
      await uploadFileList(
        audioFiles,

        uploadCourseAudio,

        uploadedAssets
      );


    /* -----------------------------------------
       ASSIGNMENT DOCUMENT
       ----------------------------------------- */

    let assignmentUpload =
      null;


    if (assignmentFile) {
      assignmentUpload =
        await uploadAssignmentDocument(
          assignmentFile
        );


      uploadedAssets.push({
        publicId:
          assignmentUpload
            .publicId,

        resourceType:
          assignmentUpload
            .resourceType,
      });
    }


    /* -----------------------------------------
       CREATE COURSE
       ----------------------------------------- */

    const course =
      new Course({
        academy:
          academyId,

        title,

        slug,

        level:
          levelId,

        levelPosition,

        featuredImage:
          featuredImageUpload
            ? featuredImageUpload.url
            : "",

        featuredImagePublicId:
          featuredImageUpload
            ? featuredImageUpload.publicId
            : "",

        featuredImageResourceType:
          featuredImageUpload
            ? featuredImageUpload.resourceType
            : "",

        description,

        overview:
          req.body.overview?.trim() ||
          "",

        duration:
          req.body.duration?.trim() ||
          "",

        lessons:
          req.body.lessons?.trim() ||
          "",

        instructor:
          req.body.instructor?.trim() ||
          "",

        price:
          req.body.price?.trim() ||
          "",

        buttonText:
          req.body.buttonText?.trim() ||
          "View Course",

        buttonClass:
          req.body.buttonClass?.trim() ||
          "bg-[#4F46E5] hover:bg-indigo-700",

        courseDocuments:
          storedDocuments,

        courseAudios:
          storedAudios,

        assignmentDocument:
          assignmentUpload
            ? {
                originalName:
                  assignmentFile
                    .originalname,

                fileUrl:
                  assignmentUpload
                    .url,

                publicId:
                  assignmentUpload
                    .publicId,

                resourceType:
                  assignmentUpload
                    .resourceType,
              }
            : {
                originalName:
                  "",

                fileUrl:
                  "",

                publicId:
                  "",

                resourceType:
                  "",
              },

        whatYouWillLearn:
          parseList(
            req.body
              .whatYouWillLearn
          ),

        modules:
          parseModules(
            req.body.modules
          ),

        requirements:
          parseList(
            req.body.requirements
          ),

        audience:
          parseList(
            req.body.audience
          ),

        isPublished:
          req.body.isPublished ===
          "on",
      });


    await course.save();


    if (course.isPublished) {
      await createCourseNotificationIfNeeded(
        course._id
      );
    }


    return res.redirect(
      buildAdminRedirect(
        "/admin/courses",
        academyId
      )
    );
  } catch (error) {
    await cleanupUploadedAssets(
      uploadedAssets
    );


    console.error(
      "Create course error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   EDIT FORM
   ========================================================= */

exports.getEditCourseForm = async (
  req,
  res
) => {
  try {
    const course =
      await Course.findById(
        req.params.id
      );


    if (!course) {
      return res
        .status(404)
        .send(
          "Course not found"
        );
    }


    const academies =
      await Academy.find({
        isPublished: true,
      }).sort({
        createdAt: 1,
      });


    const levels =
      await Level.find({
        isPublished: true,
      })
        .populate(
          "academy"
        )
        .sort({
          order: 1,
          createdAt: 1,
        });


    return res.render(
      "admin/courses/edit",
      {
        course,
        academies,
        levels,

        selectedAcademy:
          req.query.academy?.trim() ||
          "",
      }
    );
  } catch (error) {
    console.error(
      "Get edit course error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   UPDATE COURSE
   ========================================================= */

exports.updateCourse = async (
  req,
  res
) => {
  const uploadedAssets = [];

  try {
    const course =
      await Course.findById(
        req.params.id
      );


    if (!course) {
      return res
        .status(404)
        .send(
          "Course not found"
        );
    }


    const wasPublished =
      course.isPublished;


    const academyId =
      req.body.academy?.trim();

    const title =
      req.body.title?.trim();

    const description =
      req.body.description?.trim();


    const redirectAcademy =
      req.body.redirectAcademy?.trim() ||
      academyId ||
      "";


    if (
      !academyId ||
      !title ||
      !description
    ) {
      return res
        .status(400)
        .send(
          "Academy, title, and description are required."
        );
    }


    const academy =
      await Academy.findById(
        academyId
      );


    if (!academy) {
      return res
        .status(400)
        .send(
          "Selected academy does not exist."
        );
    }


    let slug =
      req.body.slug?.trim() ||
      slugify(title);


    const existingSlug =
      await Course.findOne({
        slug,

        _id: {
          $ne:
            course._id,
        },
      });


    if (existingSlug) {
      slug =
        `${slug}-${Date.now()}`;
    }


    const levelId =
      req.body.level?.trim() ||
      null;


    const levelPosition =
      Number(
        req.body.levelPosition ||
        1
      );


    if (levelId) {
      const levelExists =
        await Level.findOne({
          _id:
            levelId,

          academy:
            academyId,
        });


      if (!levelExists) {
        return res
          .status(400)
          .send(
            "Selected level does not belong to the selected academy."
          );
      }
    }


    const featuredImageFile =
      req.files
        ?.featuredImage?.[0];

    const assignmentFile =
      req.files
        ?.assignmentDocument?.[0];

    const documentFiles =
      req.files
        ?.courseDocuments ||
      [];

    const audioFiles =
      req.files
        ?.courseAudios ||
      [];


    /* -----------------------------------------
       PRESERVE OLD REPLACEABLE ASSETS
       ----------------------------------------- */

    const oldFeaturedImage = {
      url:
        course.featuredImage,

      publicId:
        course.featuredImagePublicId,

      resourceType:
        course.featuredImageResourceType ||
        "image",
    };


    const oldAssignment = {
      url:
        course.assignmentDocument
          ?.fileUrl ||
        "",

      publicId:
        course.assignmentDocument
          ?.publicId ||
        "",

      resourceType:
        course.assignmentDocument
          ?.resourceType ||
        "raw",
    };


    /* -----------------------------------------
       UPLOAD NEW FEATURED IMAGE
       ----------------------------------------- */

    let featuredImageUpload =
      null;


    if (featuredImageFile) {
      featuredImageUpload =
        await uploadCourseImage(
          featuredImageFile
        );


      uploadedAssets.push({
        publicId:
          featuredImageUpload
            .publicId,

        resourceType:
          featuredImageUpload
            .resourceType,
      });
    }


    /* -----------------------------------------
       NEW DOCUMENTS
       ----------------------------------------- */

    const newDocuments =
      await uploadFileList(
        documentFiles,

        uploadCourseDocument,

        uploadedAssets
      );


    /* -----------------------------------------
       NEW AUDIOS
       ----------------------------------------- */

    const newAudios =
      await uploadFileList(
        audioFiles,

        uploadCourseAudio,

        uploadedAssets
      );


    /* -----------------------------------------
       NEW ASSIGNMENT DOCUMENT
       ----------------------------------------- */

    let assignmentUpload =
      null;


    if (assignmentFile) {
      assignmentUpload =
        await uploadAssignmentDocument(
          assignmentFile
        );


      uploadedAssets.push({
        publicId:
          assignmentUpload
            .publicId,

        resourceType:
          assignmentUpload
            .resourceType,
      });
    }


    /* -----------------------------------------
       UPDATE NORMAL FIELDS
       ----------------------------------------- */

    course.academy =
      academyId;

    course.title =
      title;

    course.slug =
      slug;

    course.level =
      levelId;

    course.levelPosition =
      levelPosition;

    course.description =
      description;

    course.overview =
      req.body.overview?.trim() ||
      "";

    course.duration =
      req.body.duration?.trim() ||
      "";

    course.lessons =
      req.body.lessons?.trim() ||
      "";

    course.instructor =
      req.body.instructor?.trim() ||
      "";

    course.price =
      req.body.price?.trim() ||
      "";

    course.buttonText =
      req.body.buttonText?.trim() ||
      "View Course";

    course.buttonClass =
      req.body.buttonClass?.trim() ||
      "bg-[#4F46E5] hover:bg-indigo-700";

    course.whatYouWillLearn =
      parseList(
        req.body.whatYouWillLearn
      );

    course.modules =
      parseModules(
        req.body.modules
      );

    course.requirements =
      parseList(
        req.body.requirements
      );

    course.audience =
      parseList(
        req.body.audience
      );

    course.isPublished =
      req.body.isPublished ===
      "on";


    /* -----------------------------------------
       REPLACE FEATURED IMAGE
       ----------------------------------------- */

    if (featuredImageUpload) {
      course.featuredImage =
        featuredImageUpload.url;

      course.featuredImagePublicId =
        featuredImageUpload.publicId;

      course.featuredImageResourceType =
        featuredImageUpload.resourceType;
    }


    /* -----------------------------------------
       APPEND NEW DOCUMENTS
       ----------------------------------------- */

    if (newDocuments.length) {
      course.courseDocuments = [
        ...course.courseDocuments,
        ...newDocuments,
      ];
    }


    /* -----------------------------------------
       APPEND NEW AUDIOS
       ----------------------------------------- */

    if (newAudios.length) {
      course.courseAudios = [
        ...course.courseAudios,
        ...newAudios,
      ];
    }


    /* -----------------------------------------
       REPLACE ASSIGNMENT
       ----------------------------------------- */

    if (assignmentUpload) {
      course.assignmentDocument = {
        originalName:
          assignmentFile
            .originalname,

        fileUrl:
          assignmentUpload.url,

        publicId:
          assignmentUpload.publicId,

        resourceType:
          assignmentUpload
            .resourceType,
      };
    }


    /* -----------------------------------------
       DATABASE FIRST
       ----------------------------------------- */

    await course.save();


    /* -----------------------------------------
       REMOVE OLD FEATURED IMAGE
       ----------------------------------------- */

    if (featuredImageUpload) {
      await removeStoredAsset(
        oldFeaturedImage
      );
    }


    /* -----------------------------------------
       REMOVE OLD ASSIGNMENT
       ----------------------------------------- */

    if (assignmentUpload) {
      await removeStoredAsset(
        oldAssignment
      );
    }


    if (
      !wasPublished &&
      course.isPublished
    ) {
      await createCourseNotificationIfNeeded(
        course._id
      );
    }


    return res.redirect(
      buildAdminRedirect(
        "/admin/courses",
        redirectAcademy
      )
    );
  } catch (error) {
    /*
     * Database update failed:
     * remove only newly-uploaded Cloudinary assets.
     * Existing Course assets remain untouched.
     */
    await cleanupUploadedAssets(
      uploadedAssets
    );


    console.error(
      "Update course error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   DELETE COURSE
   ========================================================= */

exports.deleteCourse = async (
  req,
  res
) => {
  try {
    const redirectAcademy =
      req.body.redirectAcademy?.trim() ||
      "";


    const course =
      await Course.findById(
        req.params.id
      );


    if (!course) {
      return res
        .status(404)
        .send(
          "Course not found"
        );
    }


    /*
     * Remove database record first.
     *
     * If cloud cleanup subsequently fails,
     * the only issue is an orphaned Cloudinary asset,
     * rather than a live Course with missing files.
     */
    await Course.findByIdAndDelete(
      req.params.id
    );


    await removeCourseFiles(
      course
    );


    return res.redirect(
      buildAdminRedirect(
        "/admin/courses",
        redirectAcademy
      )
    );
  } catch (error) {
    console.error(
      "Delete course error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   TOGGLE PUBLISH
   ========================================================= */

exports.togglePublishCourse = async (
  req,
  res
) => {
  try {
    const redirectAcademy =
      req.body.redirectAcademy?.trim() ||
      "";


    const course =
      await Course.findById(
        req.params.id
      );


    if (!course) {
      return res
        .status(404)
        .send(
          "Course not found"
        );
    }


    course.isPublished =
      !course.isPublished;


    await course.save();


    if (course.isPublished) {
      await createCourseNotificationIfNeeded(
        course._id
      );
    }


    return res.redirect(
      buildAdminRedirect(
        "/admin/courses",
        redirectAcademy
      )
    );
  } catch (error) {
    console.error(
      "Toggle publish error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};