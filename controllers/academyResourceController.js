const Course =
  require("../models/course");

const CourseResource =
  require("../models/CourseResource");

const UserLevelAccess =
  require("../models/UserLevelAccess");

const AssignmentSubmission =
  require("../models/AssignmentSubmission");

const AcademyEvent =
  require("../models/AcademyEvent");

const {
  uploadBuffer,
  deleteAsset,
} =
  require("../services/cloudinaryService");


/* =========================================================
   ANALYTICS
   ========================================================= */

function getTemporaryExpiry(
  days = 180
) {
  const date =
    new Date();

  date.setDate(
    date.getDate() + days
  );

  return date;
}


async function logAcademyEvent({
  req,
  course,
  resource,
  eventType,
  metadata = {},
  temporary = true,
}) {
  try {
    if (
      !req.session.userId
    ) {
      return;
    }

    await AcademyEvent.create({
      user:
        req.session.userId,

      academy:
        req.academy._id,

      level:
        course.level?._id ||
        course.level ||
        null,

      course:
        course._id,

      resource:
        resource?._id ||
        null,

      eventType,

      metadata,

      occurredAt:
        new Date(),

      expiresAt:
        temporary
          ? getTemporaryExpiry(180)
          : null,
    });
  } catch (error) {
    /*
     * Analytics must never stop learning.
     */
    console.error(
      "Academy analytics event error:",
      error
    );
  }
}


/* =========================================================
   ACCESS CHECK
   ========================================================= */

async function getAccessibleResource(
  req,
  res
) {
  const course =
    await Course.findOne({
      academy:
        req.academy._id,

      slug:
        req.params.courseSlug,

      isPublished:
        true,

      contentMode:
        "resources",
    }).populate(
      "level"
    );


  if (!course) {
    res
      .status(404)
      .send(
        "Course not found."
      );

    return null;
  }


  if (
    course.level &&
    !res.locals.isAdmin
  ) {
    const access =
      await UserLevelAccess.findOne({
        user:
          req.session.userId,

        level:
          course.level._id,

        status:
          "active",
      });


    if (!access) {
      res
        .status(403)
        .send(
          "You do not have access to this Course."
        );

      return null;
    }
  }


  const resource =
    await CourseResource.findOne({
      _id:
        req.params.resourceId,

      course:
        course._id,

      status:
        "published",
    });


  if (!resource) {
    res
      .status(404)
      .send(
        "Learning Material not found."
      );

    return null;
  }


  return {
    course,
    resource,
  };
}


/* =========================================================
   OPEN RESOURCE
   ========================================================= */

exports.openResource = async (
  req,
  res
) => {
  try {
    const context =
      await getAccessibleResource(
        req,
        res
      );


    if (!context) {
      return;
    }


    const {
      course,
      resource,
    } = context;


    /* External resource */

    if (
      resource.type ===
      "external"
    ) {
      if (
        !/^https?:\/\//i.test(
          resource.externalUrl ||
          ""
        )
      ) {
        return res
          .status(400)
          .send(
            "Invalid external resource URL."
          );
      }


      await logAcademyEvent({
        req,
        course,
        resource,

        eventType:
          "EXTERNAL_RESOURCE_VISITED",
      });


      return res.redirect(
        resource.externalUrl
      );
    }


    /* Uploaded resources */

    if (
      !resource.access
        ?.allowOnline
    ) {
      return res
        .status(403)
        .send(
          "Online viewing is not enabled for this material."
        );
    }


    if (
      !resource.file
        ?.fileUrl
    ) {
      return res
        .status(404)
        .send(
          "Resource file not found."
        );
    }


    let eventType =
      "RESOURCE_OPENED";


    if (
      resource.type ===
      "document"
    ) {
      eventType =
        "DOCUMENT_OPENED";
    }


    if (
      resource.type ===
      "assignment"
    ) {
      eventType =
        "ASSIGNMENT_OPENED";
    }


    await logAcademyEvent({
      req,
      course,
      resource,
      eventType,
    });


    return res.redirect(
      resource.file.fileUrl
    );
  } catch (error) {
    console.error(
      "Open Academy resource error:",
      error
    );


    return res
      .status(500)
      .send(
        "Unable to open this Learning Material."
      );
  }
};


/* =========================================================
   DOWNLOAD RESOURCE
   ========================================================= */

exports.downloadResource =
  async (
    req,
    res
  ) => {
    try {
      const context =
        await getAccessibleResource(
          req,
          res
        );


      if (!context) {
        return;
      }


      const {
        course,
        resource,
      } = context;


      if (
        !resource.access
          ?.allowDownload
      ) {
        return res
          .status(403)
          .send(
            "Downloading is not enabled for this material."
          );
      }


      if (
        !resource.file
          ?.fileUrl
      ) {
        return res
          .status(404)
          .send(
            "Resource file not found."
          );
      }


      let eventType =
        "RESOURCE_OPENED";


      if (
        resource.type ===
        "audio"
      ) {
        eventType =
          "AUDIO_DOWNLOADED";
      }


      if (
        resource.type ===
        "document"
      ) {
        eventType =
          "DOCUMENT_DOWNLOADED";
      }


      if (
        resource.type ===
        "assignment"
      ) {
        eventType =
          "ASSIGNMENT_DOWNLOADED";
      }


      await logAcademyEvent({
        req,
        course,
        resource,
        eventType,

        metadata: {
          action:
            "download",
        },
      });


      return res.redirect(
        resource.file.fileUrl
      );
    } catch (error) {
      console.error(
        "Download Academy resource error:",
        error
      );


      return res
        .status(500)
        .send(
          "Unable to download this Learning Material."
        );
    }
  };


/* =========================================================
   SUBMIT / REVISE ASSIGNMENT
   ========================================================= */

exports.submitResourceAssignment =
  async (
    req,
    res
  ) => {
    let newUpload =
      null;


    try {
      const context =
        await getAccessibleResource(
          req,
          res
        );


      if (!context) {
        return;
      }


      const {
        course,
        resource,
      } = context;


      if (
        resource.type !==
        "assignment"
      ) {
        return res
          .status(400)
          .send(
            "This Learning Material is not an assignment."
          );
      }


      if (
        resource
          .assignmentSettings
          ?.submissionRequired ===
        false
      ) {
        return res
          .status(400)
          .send(
            "This assignment does not require a file submission."
          );
      }


      if (!req.file) {
        return res
          .status(400)
          .send(
            "Please select your assignment file."
          );
      }


      const existingSubmission =
        await AssignmentSubmission.findOne({
          user:
            req.session.userId,

          resource:
            resource._id,
        });


      if (
        existingSubmission
          ?.status ===
        "Accepted"
      ) {
        return res
          .status(409)
          .send(
            "This assignment has already been accepted."
          );
      }


      const oldFile = {
        publicId:
          existingSubmission
            ?.file
            ?.publicId ||
          "",

        resourceType:
          existingSubmission
            ?.file
            ?.resourceType ||
          "",
      };


      /* Upload replacement first */

      newUpload =
        await uploadBuffer(
          req.file.buffer,
          {
            folder:
              "tcem/academy/submissions",

            resourceType:
              "auto",

            originalFilename:
              req.file
                .originalname,
          }
        );


      const submissionNote =
        req.body
          .submissionNote
          ?.trim() ||
        "";


      let submission;


      if (
        existingSubmission
      ) {
        const wasRevision =
          existingSubmission
            .status ===
          "Needs Revision";


        existingSubmission
          .assignmentTitle =
          resource.title;


        existingSubmission
          .submissionNote =
          submissionNote;


        existingSubmission.file = {
          originalName:
            req.file
              .originalname,

          fileUrl:
            newUpload.url,

          publicId:
            newUpload
              .publicId,

          resourceType:
            newUpload
              .resourceType,

          mimeType:
            req.file
              .mimetype ||
            "",

          bytes:
            newUpload
              .bytes ||
            req.file
              .size ||
            0,
        };


        existingSubmission.status =
          "Submitted";


        if (wasRevision) {
          existingSubmission
            .revisionCount += 1;
        }


        existingSubmission
          .reviewedBy =
          null;


        existingSubmission
          .reviewedAt =
          null;


        existingSubmission
          .acceptedAt =
          null;


        submission =
          await existingSubmission
            .save();
      } else {
        submission =
          await AssignmentSubmission.create({
            user:
              req.session.userId,

            course:
              course._id,

            resource:
              resource._id,

            assignmentTitle:
              resource.title,

            submissionNote,

            file: {
              originalName:
                req.file
                  .originalname,

              fileUrl:
                newUpload.url,

              publicId:
                newUpload
                  .publicId,

              resourceType:
                newUpload
                  .resourceType,

              mimeType:
                req.file
                  .mimetype ||
                "",

              bytes:
                newUpload
                  .bytes ||
                req.file
                  .size ||
                0,
            },

            status:
              "Submitted",
          });
      }


      /*
       * New file is safely stored in MongoDB.
       * Now remove the old revision from Cloudinary.
       */
      if (
        oldFile.publicId
      ) {
        try {
          await deleteAsset(
            oldFile.publicId,

            oldFile.resourceType ||
              "raw"
          );
        } catch (error) {
          console.error(
            "Old assignment file cleanup error:",
            error
          );
        }
      }


      await logAcademyEvent({
        req,
        course,
        resource,

        eventType:
          "ASSIGNMENT_SUBMITTED",

        temporary:
          false,

        metadata: {
          revisionCount:
            submission
              .revisionCount ||
            0,
        },
      });


      return res.redirect(
        `/academy/${req.academy.slug}/courses/${course.slug}?assignment=submitted#resource-${resource._id}`
      );
    } catch (error) {

      /*
       * MongoDB operation failed after upload.
       */
      if (
        newUpload?.publicId
      ) {
        try {
          await deleteAsset(
            newUpload.publicId,

            newUpload.resourceType ||
              "raw"
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "New assignment cleanup error:",
            cleanupError
          );
        }
      }


      console.error(
        "Submit V2 assignment error:",
        error
      );


      return res
        .status(500)
        .send(
          "Unable to submit your assignment."
        );
    }
  };