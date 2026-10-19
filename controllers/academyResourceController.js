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
  touchResource,
  manuallyCompleteResource,
  updateAudioProgress,
  completeResource,
} =
  require(
    "../services/academyProgressService"
  );


const {
  uploadBuffer,
  deleteAsset,
} =
  require(
    "../services/cloudinaryService"
  );


/* =========================================================
   HELPERS
   ========================================================= */

function getTemporaryExpiry(
  days = 180
) {
  const date =
    new Date();


  date.setDate(
    date.getDate() +
    days
  );


  return date;
}


function shouldTrackLearnerProgress(
  req,
  res
) {
  return Boolean(
    req.session.userId &&
    !res.locals.isAdmin
  );
}


function sendResourceError(
  res,
  statusCode,
  message,
  wantsJson = false
) {
  if (wantsJson) {
    return res
      .status(statusCode)
      .json({
        success:
          false,

        message,
      });
  }


  return res
    .status(statusCode)
    .send(
      message
    );
}


/* =========================================================
   ANALYTICS
   ========================================================= */

async function logAcademyEvent({
  req,
  res,
  course,
  resource = null,
  eventType,
  metadata = {},
  temporary = true,
}) {
  try {

    /*
     * Admin previews must not pollute learner analytics.
     */

    if (
      !req.session.userId ||
      res.locals.isAdmin
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
          ? getTemporaryExpiry(
              180
            )
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
  res,
  {
    json = false,
  } = {}
) {

  if (
    !req.session.userId &&
    !res.locals.isAdmin
  ) {

    sendResourceError(
      res,
      401,
      "Please sign in to access this Learning Material.",
      json
    );


    return null;
  }


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
    })
      .populate(
        "level"
      );


  if (!course) {

    sendResourceError(
      res,
      404,
      "Course not found.",
      json
    );


    return null;
  }


  /* =======================================================
     LEVEL ACCESS
     ======================================================= */

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

      sendResourceError(
        res,
        403,
        "You do not have access to this Course.",
        json
      );


      return null;
    }
  }


  /* =======================================================
     RESOURCE
     ======================================================= */

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

    sendResourceError(
      res,
      404,
      "Learning Material not found.",
      json
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

exports.openResource =
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
      } =
        context;


      const trackProgress =
        shouldTrackLearnerProgress(
          req,
          res
        );


      /* =====================================================
         EXTERNAL RESOURCE
         ===================================================== */

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
          res,
          course,
          resource,

          eventType:
            "EXTERNAL_RESOURCE_VISITED",
        });


        if (
          trackProgress
        ) {

          if (
            resource
              .completion
              ?.method ===
            "external_visit"
          ) {

            await completeResource({
              userId:
                req.session.userId,

              courseId:
                course._id,

              resourceId:
                resource._id,

              source:
                "external_visit",
            });

          } else {

            await touchResource({
              userId:
                req.session.userId,

              courseId:
                course._id,

              resourceId:
                resource._id,
            });
          }
        }


        return res.redirect(
          resource.externalUrl
        );
      }


      /* =====================================================
         UPLOADED RESOURCE
         ===================================================== */

      if (
        !resource
          .access
          ?.allowOnline
      ) {

        return res
          .status(403)
          .send(
            "Online viewing is not enabled for this material."
          );
      }


      if (
        !resource
          .file
          ?.fileUrl
      ) {

        return res
          .status(404)
          .send(
            "Resource file not found."
          );
      }


      /* =====================================================
         ANALYTICS EVENT TYPE
         ===================================================== */

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
        res,
        course,
        resource,
        eventType,
      });


      /* =====================================================
         PROGRESS

         Opening a material starts it.

         It completes automatically only when Admin explicitly
         configured resource_opened as the completion method.
         ===================================================== */

      if (
        trackProgress
      ) {

        if (
          resource
            .completion
            ?.method ===
          "resource_opened"
        ) {

          await completeResource({
            userId:
              req.session.userId,

            courseId:
              course._id,

            resourceId:
              resource._id,

            source:
              "resource_opened",
          });

        } else {

          await touchResource({
            userId:
              req.session.userId,

            courseId:
              course._id,

            resourceId:
              resource._id,
          });
        }
      }


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
      } =
        context;


      if (
        !resource
          .access
          ?.allowDownload
      ) {

        return res
          .status(403)
          .send(
            "Downloading is not enabled for this material."
          );
      }


      if (
        !resource
          .file
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
        res,
        course,
        resource,
        eventType,

        metadata: {
          action:
            "download",
        },
      });


      /*
       * Downloading proves interaction with the resource,
       * but it does NOT prove that the learner actually
       * listened to or read the downloaded file.
       */

      if (
        shouldTrackLearnerProgress(
          req,
          res
        )
      ) {

        await touchResource({
          userId:
            req.session.userId,

          courseId:
            course._id,

          resourceId:
            resource._id,
        });
      }


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
      } =
        context;


      /* =====================================================
         VALIDATION
         ===================================================== */

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


      /* =====================================================
         EXISTING SUBMISSION
         ===================================================== */

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


      /*
       * Learners should not replace a submission while
       * it is currently waiting for Admin review.
       */

      if (
        existingSubmission &&
        (
          existingSubmission.status ===
            "Submitted" ||
          existingSubmission.status ===
            "Reviewed"
        )
      ) {

        return res
          .status(409)
          .send(
            "This assignment is already awaiting review."
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


      /* =====================================================
         UPLOAD NEW FILE FIRST
         ===================================================== */

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


      /* =====================================================
         REVISION
         ===================================================== */

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


        if (
          wasRevision
        ) {

          existingSubmission
            .revisionCount =
            (
              existingSubmission
                .revisionCount ||
              0
            ) +
            1;
        }


        /*
         * The previous feedback has now been acted upon.
         * We intentionally do not preserve old review/file
         * versions because DBW V2 uses only the current
         * submission.
         */

        existingSubmission
          .reviewFeedback =
          "";


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
      }


      /* =====================================================
         FIRST SUBMISSION
         ===================================================== */

      else {

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


      /* =====================================================
         DELETE PREVIOUS CLOUDINARY FILE

         MongoDB already points to the replacement file at
         this stage.
         ===================================================== */

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


      /* =====================================================
         ANALYTICS
         ===================================================== */

      await logAcademyEvent({

        req,
        res,
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


      /* =====================================================
         ASSIGNMENT PROGRESS

         Default:
         submission = In Progress
         acceptance = Completed

         But assignment_submitted remains available as an
         optional Admin-configured completion rule.
         ===================================================== */

      if (
        shouldTrackLearnerProgress(
          req,
          res
        )
      ) {

        if (
          resource
            .completion
            ?.method ===
          "assignment_submitted"
        ) {

          await completeResource({

            userId:
              req.session.userId,

            courseId:
              course._id,

            resourceId:
              resource._id,

            source:
              "assignment_submitted",

            percentage:
              100,
          });

        } else {

          await touchResource({

            userId:
              req.session.userId,

            courseId:
              course._id,

            resourceId:
              resource._id,
          });
        }
      }


      /* =====================================================
         RETURN TO ASSIGNMENT PAGE
         ===================================================== */

      return res.redirect(
        `/academy/${req.academy.slug}/documents?assignment=${resource._id}&submitted=success#assignment-upload`
      );

    } catch (error) {

      /*
       * If anything fails after uploading the new file,
       * remove that newly-created Cloudinary asset.
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


/* =========================================================
   MANUAL RESOURCE COMPLETION
   ========================================================= */

exports.completeResourceManually =
  async (
    req,
    res
  ) => {

    try {

      /*
       * Admin Course previews must never produce learner
       * progress.
       */

      if (
        !shouldTrackLearnerProgress(
          req,
          res
        )
      ) {

        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Only learner accounts can record Course progress.",
          });
      }


      const context =
        await getAccessibleResource(
          req,
          res,
          {
            json:
              true,
          }
        );


      if (!context) {
        return;
      }


      const {
        resource,
      } =
        context;


      const result =
        await manuallyCompleteResource({

          userId:
            req.session.userId,

          resource,
        });


      return res.json({

        success:
          true,

        resourceProgress:
          result.resourceProgress,

        courseProgress:
          result.courseProgress,
      });

    } catch (error) {

      console.error(
        "Manual resource completion error:",
        error
      );


      return res
        .status(400)
        .json({

          success:
            false,

          message:
            error.message ||
            "Unable to complete this Learning Material.",
        });
    }
  };


/* =========================================================
   AUDIO PROGRESS
   ========================================================= */

exports.saveAudioProgress =
  async (
    req,
    res
  ) => {

    try {

      if (
        !shouldTrackLearnerProgress(
          req,
          res
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            message:
              "Only learner accounts can record Course progress.",
          });
      }


      const context =
        await getAccessibleResource(
          req,
          res,
          {
            json:
              true,
          }
        );


      if (!context) {
        return;
      }


      const {
        resource,
      } =
        context;


      if (
        resource.type !==
        "audio"
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "This Learning Material is not an audio resource.",
          });
      }


      const body =
        req.body ||
        {};


      const result =
        await updateAudioProgress({

          userId:
            req.session.userId,

          resource,

          positionSeconds:
            body.positionSeconds,

          durationSeconds:
            body.durationSeconds,

          engagedDeltaSeconds:
            body.engagedDeltaSeconds,
        });


      return res.json({

        success:
          true,

        resourceProgress:
          result.resourceProgress,

        courseProgress:
          result.courseProgress,
      });

    } catch (error) {

      console.error(
        "Save audio progress error:",
        error
      );


      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Unable to save audio progress.",
        });
    }
  };