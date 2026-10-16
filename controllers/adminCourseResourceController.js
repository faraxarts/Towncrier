const path = require("path");

const Course =
  require("../models/course");

const CourseResource =
  require("../models/CourseResource");

const ResourceProgress =
  require("../models/ResourceProgress");

const AcademyEvent =
  require("../models/AcademyEvent");

const AssignmentSubmission =
  require("../models/AssignmentSubmission");

const {
  uploadBuffer,
  deleteAsset,
} = require("../services/cloudinaryService");


/* =========================================================
   RESOURCE TYPES
   ========================================================= */

const allowedTypes = new Set([
  "audio",
  "document",
  "assignment",
  "written",
  "external",
]);


const audioExtensions = new Set([
  ".mp3",
  ".wav",
  ".mpeg",
  ".ogg",
  ".m4a",
  ".aac",
  ".mp4",
]);


const documentExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
]);


/* =========================================================
   BOOLEAN
   ========================================================= */

function toBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }


  if (
    value === true ||
    value === "true" ||
    value === "1" ||
    value === "on" ||
    value === "yes"
  ) {
    return true;
  }


  return false;
}


/* =========================================================
   STATUS
   ========================================================= */

function normalizeStatus(
  value
) {
  const allowed =
    new Set([
      "draft",
      "published",
      "archived",
    ]);


  return allowed.has(value)
    ? value
    : "draft";
}


/* =========================================================
   COMPLETION
   ========================================================= */

function getDefaultCompletion(
  type
) {
  switch (type) {
    case "audio":
      return {
        method:
          "audio_percentage",

        threshold:
          80,
      };


    case "document":
      return {
        method:
          "manual_confirmation",

        threshold:
          100,
      };


    case "assignment":
      return {
        method:
          "assignment_accepted",

        threshold:
          100,
      };


    case "written":
      return {
        method:
          "manual_confirmation",

        threshold:
          100,
      };


    case "external":
      return {
        method:
          "external_visit",

        threshold:
          100,
      };


    default:
      return {
        method:
          "none",

        threshold:
          100,
      };
  }
}


function normalizeCompletion(
  type,
  method,
  threshold
) {
  const allowedByType = {
    audio:
      new Set([
        "audio_percentage",
        "manual_confirmation",
        "none",
      ]),

    document:
      new Set([
        "manual_confirmation",
        "resource_opened",
        "none",
      ]),

    assignment:
      new Set([
        "assignment_submitted",
        "assignment_accepted",
        "none",
      ]),

    written:
      new Set([
        "manual_confirmation",
        "resource_opened",
        "none",
      ]),

    external:
      new Set([
        "external_visit",
        "none",
      ]),
  };


  const defaults =
    getDefaultCompletion(
      type
    );


  const selectedMethod =
    allowedByType[type]?.has(
      method
    )
      ? method
      : defaults.method;


  let selectedThreshold =
    Number(
      threshold
    );


  if (
    !Number.isFinite(
      selectedThreshold
    )
  ) {
    selectedThreshold =
      defaults.threshold;
  }


  selectedThreshold =
    Math.max(
      0,
      Math.min(
        100,
        selectedThreshold
      )
    );


  if (
    selectedMethod !==
    "audio_percentage"
  ) {
    selectedThreshold =
      100;
  }


  return {
    method:
      selectedMethod,

    threshold:
      selectedThreshold,
  };
}


/* =========================================================
   FILE VALIDATION
   ========================================================= */

function validateResourceFile(
  type,
  file
) {
  if (!file) {
    return;
  }


  const extension =
    path
      .extname(
        file.originalname ||
        ""
      )
      .toLowerCase();


  if (
    type === "audio"
  ) {
    if (
      !audioExtensions.has(
        extension
      )
    ) {
      throw new Error(
  "Audio resources must be MP3, WAV, MPEG, OGG, M4A, AAC, or MP4 audio files."
);
    }

    return;
  }


  if (
    type === "document" ||
    type === "assignment"
  ) {
    if (
      !documentExtensions.has(
        extension
      )
    ) {
      throw new Error(
        "Documents and assignments must be PDF, DOC, or DOCX files."
      );
    }

    return;
  }


  throw new Error(
    "This resource type does not accept uploaded files."
  );
}


/* =========================================================
   FILE UPLOAD
   ========================================================= */

async function uploadResourceFile(
  type,
  file
) {
  if (!file) {
    return null;
  }


  validateResourceFile(
    type,
    file
  );


  let folder =
    "tcem/courses/resources";


  if (
    type === "audio"
  ) {
    folder =
      "tcem/courses/audios";
  }


  if (
    type === "document"
  ) {
    folder =
      "tcem/courses/documents";
  }


  if (
    type === "assignment"
  ) {
    folder =
      "tcem/courses/assignments";
  }


  return uploadBuffer(
    file.buffer,
    {
      folder,

      resourceType:
        "auto",

      originalFilename:
        file.originalname,
    }
  );
}


/* =========================================================
   CLOUDINARY DELETE
   ========================================================= */

async function removeCloudinaryAsset(
  publicId,
  resourceType
) {
  if (!publicId) {
    return;
  }


  try {
    await deleteAsset(
      publicId,
      resourceType ||
        "raw"
    );
  } catch (error) {
    console.error(
      "CourseResource Cloudinary delete error:",
      error
    );
  }
}


/* =========================================================
   COURSE LOOKUP
   ========================================================= */

async function getCourse(
  courseId
) {
  return Course.findById(
    courseId
  );
}


/* =========================================================
   MUTATION SAFETY

   Migrated Courses remain read-only while their
   contentMode is "legacy".

   This prevents accidentally deleting a Cloudinary file
   which the current live Course page still relies upon.
   ========================================================= */

function courseCanUseResourceEditor(
  course
) {
  return (
    course &&
    course.contentMode ===
      "resources"
  );
}


/* =========================================================
   GET RESOURCES
   ========================================================= */

exports.getResources = async (
  req,
  res
) => {
  try {
    const course =
      await getCourse(
        req.params.courseId
      );


    if (!course) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Course not found.",
        });
    }


    const resources =
      await CourseResource.find({
        course:
          course._id,
      }).sort({
        order: 1,
        createdAt: 1,
      });


    return res.json({
      success:
        true,

      course: {
        id:
          course._id,

        title:
          course.title,

        contentMode:
          course.contentMode,
      },

      resources,
    });
  } catch (error) {
    console.error(
      "Get Course resources error:",
      error
    );


    return res
      .status(500)
      .json({
        success:
          false,

        message:
          "Unable to load Course resources.",
      });
  }
};


/* =========================================================
   CREATE RESOURCE
   ========================================================= */

exports.createResource = async (
  req,
  res
) => {
  let uploadedAsset =
    null;


  try {
    const course =
      await getCourse(
        req.params.courseId
      );


    if (!course) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Course not found.",
        });
    }


    if (
      !courseCanUseResourceEditor(
        course
      )
    ) {
      return res
        .status(409)
        .json({
          success:
            false,

          message:
            "This Course is still using the legacy learning-material system.",
        });
    }


    const type =
      req.body.type?.trim();


    const title =
      req.body.title?.trim();


    if (
      !allowedTypes.has(
        type
      )
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Invalid learning material type.",
        });
    }


    if (!title) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Material title is required.",
        });
    }


    /* =====================================================
       OPTIONAL FILE
       ===================================================== */

    if (req.file) {
      uploadedAsset =
        await uploadResourceFile(
          type,
          req.file
        );
    }


    /* =====================================================
       ORDER
       ===================================================== */

    const lastResource =
      await CourseResource.findOne({
        course:
          course._id,
      })
        .sort({
          order: -1,
        })
        .select(
          "order"
        );


    const nextOrder =
      lastResource
        ? lastResource.order + 1
        : 1;


    /* =====================================================
       ACCESS DEFAULTS
       ===================================================== */

    const extension =
      req.file
        ? path
            .extname(
              req.file.originalname
            )
            .toLowerCase()
        : "";


    const canReadOnline =
      type === "audio" ||
      (
        (
          type === "document" ||
          type === "assignment"
        ) &&
        extension === ".pdf"
      );


    const fileBased =
      [
        "audio",
        "document",
        "assignment",
      ].includes(
        type
      );


    const completion =
      normalizeCompletion(
        type,

        req.body
          .completionMethod,

        req.body
          .completionThreshold
      );


    const resource =
      await CourseResource.create({
        course:
          course._id,

        type,

        title,

        description:
          req.body
            .description
            ?.trim() ||
          "",

        content:
          type === "written"
            ? (
                req.body.content ||
                ""
              )
            : "",

        externalUrl:
          type === "external"
            ? (
                req.body
                  .externalUrl
                  ?.trim() ||
                ""
              )
            : "",

        order:
          nextOrder,

        required:
          req.body.required ===
          undefined
            ? true
            : toBoolean(
                req.body.required
              ),

        status:
          normalizeStatus(
            req.body.status
          ),

        file:
          uploadedAsset
            ? {
                originalName:
                  req.file
                    .originalname,

                fileUrl:
                  uploadedAsset.url,

                publicId:
                  uploadedAsset
                    .publicId,

                resourceType:
                  uploadedAsset
                    .resourceType,

                mimeType:
                  req.file.mimetype ||
                  "",

                bytes:
                  uploadedAsset.bytes ||
                  req.file.size ||
                  0,
              }
            : {},

        access: {
          allowOnline:
            req.body
              .allowOnline ===
            undefined
              ? canReadOnline
              : toBoolean(
                  req.body
                    .allowOnline
                ),

          allowDownload:
            req.body
              .allowDownload ===
            undefined
              ? fileBased
              : toBoolean(
                  req.body
                    .allowDownload
                ),

          openInNewTab:
            req.body
              .openInNewTab ===
            undefined
              ? true
              : toBoolean(
                  req.body
                    .openInNewTab
                ),
        },

        completion,

        assignmentSettings:
          type === "assignment"
            ? {
                submissionRequired:
                  req.body
                    .submissionRequired ===
                  undefined
                    ? true
                    : toBoolean(
                        req.body
                          .submissionRequired
                      ),

                acceptedFormats: [
                  "pdf",
                  "doc",
                  "docx",
                ],
              }
            : {},

        createdBy:
          req.session.userId ||
          null,
      });


    return res
      .status(201)
      .json({
        success:
          true,

        message:
          "Learning material added successfully.",

        resource,
      });
  } catch (error) {

    if (
      uploadedAsset
        ?.publicId
    ) {
      await removeCloudinaryAsset(
        uploadedAsset
          .publicId,

        uploadedAsset
          .resourceType
      );
    }


    console.error(
      "Create Course resource error:",
      error
    );


    return res
      .status(500)
      .json({
        success:
          false,

        message:
          error.message ||
          "Unable to create learning material.",
      });
  }
};


/* =========================================================
   UPDATE RESOURCE
   ========================================================= */

exports.updateResource = async (
  req,
  res
) => {
  let newUpload =
    null;


  try {
    const course =
      await getCourse(
        req.params.courseId
      );


    if (!course) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Course not found.",
        });
    }


    if (
      !courseCanUseResourceEditor(
        course
      )
    ) {
      return res
        .status(409)
        .json({
          success:
            false,

          message:
            "This Course is still using the legacy learning-material system.",
        });
    }


    const resource =
      await CourseResource.findOne({
        _id:
          req.params.resourceId,

        course:
          course._id,
      });


    if (!resource) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Learning material not found.",
        });
    }


    /*
     * Resource type remains fixed.
     *
     * If Admin selected the wrong type,
     * remove the resource and add the correct type.
     */
    const type =
      resource.type;


    const oldFile = {
      publicId:
        resource.file
          ?.publicId ||
        "",

      resourceType:
        resource.file
          ?.resourceType ||
        "",
    };


    /* =====================================================
       REPLACEMENT FILE
       ===================================================== */

    if (req.file) {
      newUpload =
        await uploadResourceFile(
          type,
          req.file
        );


      resource.file = {
        originalName:
          req.file.originalname,

        fileUrl:
          newUpload.url,

        publicId:
          newUpload.publicId,

        resourceType:
          newUpload
            .resourceType,

        mimeType:
          req.file.mimetype ||
          "",

        bytes:
          newUpload.bytes ||
          req.file.size ||
          0,
      };
    }


    if (
      req.body.title !==
      undefined
    ) {
      resource.title =
        req.body.title.trim();
    }


    if (
      req.body.description !==
      undefined
    ) {
      resource.description =
        req.body.description.trim();
    }


    if (
      type === "written" &&
      req.body.content !==
        undefined
    ) {
      resource.content =
        req.body.content;
    }


    if (
      type === "external" &&
      req.body.externalUrl !==
        undefined
    ) {
      resource.externalUrl =
        req.body.externalUrl.trim();
    }


    if (
      req.body.required !==
      undefined
    ) {
      resource.required =
        toBoolean(
          req.body.required
        );
    }


    if (
      req.body.status !==
      undefined
    ) {
      resource.status =
        normalizeStatus(
          req.body.status
        );
    }


    if (
      req.body.allowOnline !==
      undefined
    ) {
      resource.access.allowOnline =
        toBoolean(
          req.body.allowOnline
        );
    }


    if (
      req.body.allowDownload !==
      undefined
    ) {
      resource.access.allowDownload =
        toBoolean(
          req.body.allowDownload
        );
    }


    if (
      req.body.openInNewTab !==
      undefined
    ) {
      resource.access.openInNewTab =
        toBoolean(
          req.body.openInNewTab
        );
    }


    resource.completion =
      normalizeCompletion(
        type,

        req.body
          .completionMethod ||
          resource.completion
            ?.method,

        req.body
          .completionThreshold ??
          resource.completion
            ?.threshold
      );


    if (
      type === "assignment" &&
      req.body
        .submissionRequired !==
        undefined
    ) {
      resource
        .assignmentSettings
        .submissionRequired =
        toBoolean(
          req.body
            .submissionRequired
        );
    }


    await resource.save();


    /*
     * Delete old file only AFTER the database safely
     * contains the replacement file.
     */
    if (
      newUpload &&
      oldFile.publicId
    ) {
      await removeCloudinaryAsset(
        oldFile.publicId,

        oldFile.resourceType
      );
    }


    return res.json({
      success:
        true,

      message:
        "Learning material updated successfully.",

      resource,
    });
  } catch (error) {

    /*
     * MongoDB save failed after new Cloudinary upload:
     * remove the unused replacement.
     */
    if (
      newUpload?.publicId
    ) {
      await removeCloudinaryAsset(
        newUpload.publicId,

        newUpload.resourceType
      );
    }


    console.error(
      "Update Course resource error:",
      error
    );


    return res
      .status(500)
      .json({
        success:
          false,

        message:
          error.message ||
          "Unable to update learning material.",
      });
  }
};


/* =========================================================
   MOVE RESOURCE
   ========================================================= */

async function moveResource(
  req,
  res,
  direction
) {
  try {
    const course =
      await getCourse(
        req.params.courseId
      );


    if (!course) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Course not found.",
        });
    }


    if (
      !courseCanUseResourceEditor(
        course
      )
    ) {
      return res
        .status(409)
        .json({
          success:
            false,

          message:
            "This Course is still using the legacy learning-material system.",
        });
    }


    const resources =
      await CourseResource.find({
        course:
          course._id,
      }).sort({
        order: 1,
        createdAt: 1,
      });


    const index =
      resources.findIndex(
        (item) =>
          String(
            item._id
          ) ===
          String(
            req.params.resourceId
          )
      );


    if (index === -1) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Learning material not found.",
        });
    }


    const targetIndex =
      direction === "up"
        ? index - 1
        : index + 1;


    if (
      targetIndex < 0 ||
      targetIndex >=
        resources.length
    ) {
      return res.json({
        success:
          true,

        message:
          "Material is already at the edge of the list.",
      });
    }


    const current =
      resources[index];


    const target =
      resources[
        targetIndex
      ];


    const currentOrder =
      current.order;


    current.order =
      target.order;


    target.order =
      currentOrder;


    await Promise.all([
      current.save(),
      target.save(),
    ]);


    return res.json({
      success:
        true,

      message:
        direction === "up"
          ? "Material moved up."
          : "Material moved down.",
    });
  } catch (error) {
    console.error(
      "Move Course resource error:",
      error
    );


    return res
      .status(500)
      .json({
        success:
          false,

        message:
          "Unable to reorder learning material.",
      });
  }
}


exports.moveResourceUp = (
  req,
  res
) =>
  moveResource(
    req,
    res,
    "up"
  );


exports.moveResourceDown = (
  req,
  res
) =>
  moveResource(
    req,
    res,
    "down"
  );


/* =========================================================
   DELETE RESOURCE PERMANENTLY
   ========================================================= */

exports.deleteResource = async (
  req,
  res
) => {
  try {
    const course =
      await getCourse(
        req.params.courseId
      );


    if (!course) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Course not found.",
        });
    }


    if (
      !courseCanUseResourceEditor(
        course
      )
    ) {
      return res
        .status(409)
        .json({
          success:
            false,

          message:
            "This Course is still using the legacy learning-material system.",
        });
    }


    const resource =
      await CourseResource.findOne({
        _id:
          req.params.resourceId,

        course:
          course._id,
      });


    if (!resource) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Learning material not found.",
        });
    }


    /* =====================================================
       FIND ASSIGNMENT SUBMISSION FILES

       If this is an assignment resource, student
       submission files also belong to it.
       ===================================================== */

    const submissions =
      await AssignmentSubmission.find({
        resource:
          resource._id,
      });


    const cloudinaryAssets =
      [];


    if (
      resource.file
        ?.publicId
    ) {
      cloudinaryAssets.push({
        publicId:
          resource.file
            .publicId,

        resourceType:
          resource.file
            .resourceType ||
          "raw",
      });
    }


    for (
      const submission
      of submissions
    ) {
      if (
        submission.file
          ?.publicId
      ) {
        cloudinaryAssets.push({
          publicId:
            submission.file
              .publicId,

          resourceType:
            submission.file
              .resourceType ||
            "raw",
        });
      }
    }


    /* =====================================================
       DATABASE CLEANUP
       ===================================================== */

    await Promise.all([
      ResourceProgress.deleteMany({
        resource:
          resource._id,
      }),

      AcademyEvent.deleteMany({
        resource:
          resource._id,
      }),

      AssignmentSubmission.deleteMany({
        resource:
          resource._id,
      }),

      CourseResource.deleteOne({
        _id:
          resource._id,
      }),
    ]);


    /* =====================================================
       CLOUDINARY CLEANUP
       ===================================================== */

    for (
      const asset
      of cloudinaryAssets
    ) {
      await removeCloudinaryAsset(
        asset.publicId,

        asset.resourceType
      );
    }


    /* =====================================================
       NORMALISE ORDER
       ===================================================== */

    const remaining =
      await CourseResource.find({
        course:
          course._id,
      }).sort({
        order: 1,
        createdAt: 1,
      });


    for (
      let index = 0;
      index <
      remaining.length;
      index += 1
    ) {
      const expected =
        index + 1;


      if (
        remaining[index]
          .order !==
        expected
      ) {
        remaining[index]
          .order =
          expected;


        await remaining[index]
          .save();
      }
    }


    return res.json({
      success:
        true,

      message:
        "Learning material permanently deleted.",
    });
  } catch (error) {
    console.error(
      "Delete Course resource error:",
      error
    );


    return res
      .status(500)
      .json({
        success:
          false,

        message:
          "Unable to delete learning material.",
      });
  }
};