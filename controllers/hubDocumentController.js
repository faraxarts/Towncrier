const Course =
  require("../models/course");

const CourseResource =
  require("../models/CourseResource");
  
const AssignmentSubmission =
  require("../models/AssignmentSubmission");

const UserLevelAccess =
  require("../models/UserLevelAccess");

const {
  uploadBuffer,
  deleteAsset,
} = require("../services/cloudinaryService");


/* =========================================================
   DOCUMENTS / ASSIGNMENT PAGE
   ========================================================= */

exports.getDocumentsPage = async (
  req,
  res
) => {
  try {
    const academy =
      req.academy;


    /* =====================================================
       ACCESSIBLE LEVELS
       ===================================================== */

    const accesses =
      await UserLevelAccess.find({
        user:
          req.session.userId,

        status:
          "active",
      }).select(
        "level"
      );


    const unlockedLevelIds =
      accesses.map(
        (item) =>
          item.level
      );


    /* =====================================================
       ACCESSIBLE COURSES
       ===================================================== */

    const courses =
      await Course.find({
        academy:
          academy._id,

        isPublished:
          true,

        level: {
          $in:
            unlockedLevelIds,
        },
      })
        .select(
          "title slug contentMode level"
        )
        .sort({
          levelPosition:
            1,

          createdAt:
            1,
        });


    const accessibleCourseIds =
      courses.map(
        (course) =>
          course._id
      );


    /* =====================================================
       DBW V2 ASSIGNMENTS
       ===================================================== */

    const v2Assignments =
      await CourseResource.find({
        course: {
          $in:
            accessibleCourseIds,
        },

        type:
          "assignment",

        status:
          "published",
      })
        .populate(
          "course",
          "title slug academy level"
        )
        .sort({
          order:
            1,

          createdAt:
            1,
        });


    /* =====================================================
       SELECTED ASSIGNMENT

       Coming from:
       ?assignment=COURSE_RESOURCE_ID
       ===================================================== */

    const requestedAssignmentId =
      req.query
        .assignment ||
      "";


    const selectedAssignment =
      requestedAssignmentId
        ? (
            v2Assignments.find(
              (assignment) =>
                String(
                  assignment._id
                ) ===
                String(
                  requestedAssignmentId
                )
            ) ||
            null
          )
        : null;


    /* =====================================================
       CURRENT SUBMISSION FOR SELECTED ASSIGNMENT
       ===================================================== */

    let selectedSubmission =
      null;


    if (
      selectedAssignment
    ) {
      selectedSubmission =
        await AssignmentSubmission.findOne({
          user:
            req.session.userId,

          resource:
            selectedAssignment
              ._id,
        }).lean();
    }


    /* =====================================================
       SUBMISSION HISTORY
       ===================================================== */

    const dbSubmissions =
      await AssignmentSubmission.find({
        user:
          req.session.userId,
      })
        .populate(
          "course",
          "title slug academy"
        )
        .populate(
          "resource",
          "title type"
        )
        .sort({
          updatedAt:
            -1,
        });


    const submissions =
      dbSubmissions
        .filter(
          (item) =>
            item.course &&
            String(
              item.course
                .academy
            ) ===
              String(
                academy._id
              )
        )
        .map(
          (item) => ({
            assignmentTitle:
              item.resource
                ?.title ||
              item.assignmentTitle,

            courseTitle:
              item.course
                ?.title ||
              "Unknown Course",

            status:
              item.status ||
              "Submitted",

            submittedAt:
              new Date(
                item.updatedAt ||
                item.createdAt
              )
                .toLocaleString(),

            submissionNote:
              item.submissionNote ||
              "",

            reviewFeedback:
              item.reviewFeedback ||
              "",

            revisionCount:
              item.revisionCount ||
              0,

            fileUrl:
              item.file
                ?.fileUrl ||
              "",

            originalName:
              item.file
                ?.originalName ||
              "",

            resourceId:
              item.resource
                ?._id ||
              null,
          })
        );


    return res.render(
      "hub/documents",
      {
        academy,

        courses,

        v2Assignments,

        selectedAssignment,

        selectedSubmission,

        submissions,

        submitted:
          req.query
            .submitted ||
          "",
      }
    );
  } catch (error) {
    console.error(
      "Get documents page error:",
      error
    );


    return res
      .status(500)
      .render(
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
   SUBMIT ASSIGNMENT
   ========================================================= */

exports.submitAssignment = async (
  req,
  res
) => {
  let uploadedAsset = null;

  try {
    const academy =
      req.academy;


    const courseId =
      req.body.courseId?.trim();


    const assignmentTitle =
      req.body.assignmentTitle?.trim();


    const submissionNote =
      req.body.submissionNote?.trim() ||
      "";


    /* =====================================================
       VALIDATION
       ===================================================== */

    if (
      !courseId ||
      !assignmentTitle ||
      !req.file
    ) {
      return res
        .status(400)
        .send(
          "Course, assignment title, and file are required."
        );
    }


    const course =
      await Course.findOne({
        _id:
          courseId,

        academy:
          academy._id,
      });


    if (!course) {
      return res
        .status(404)
        .send(
          "Selected course not found."
        );
    }


    /* =====================================================
       VERIFY LEVEL ACCESS
       ===================================================== */

    const hasAccess =
      await UserLevelAccess.findOne({
        user:
          req.session.userId,

        level:
          course.level,

        status:
          "active",
      });


    if (!hasAccess) {
      return res
        .status(403)
        .send(
          "You do not have access to this course level."
        );
    }


    /* =====================================================
       CLOUDINARY UPLOAD
       ===================================================== */

    uploadedAsset =
      await uploadBuffer(
        req.file.buffer,
        {
          folder:
            "tcem/academy/submissions",

          /*
           * PDF may resolve as image.
           * DOC / DOCX normally resolve as raw.
           */
          resourceType:
            "auto",

          originalFilename:
            req.file.originalname,
        }
      );


    /* =====================================================
       DATABASE
       ===================================================== */

    await AssignmentSubmission.create({
      user:
        req.session.userId,

      course:
        course._id,

      /*
       * Legacy/current submission.
       * DBW V2 will populate this once assignments
       * become CourseResource records.
       */
      resource:
        null,

      assignmentTitle,

      submissionNote,

      file: {
        originalName:
          req.file.originalname,

        fileUrl:
          uploadedAsset.url,

        publicId:
          uploadedAsset.publicId,

        resourceType:
          uploadedAsset.resourceType,

        mimeType:
          req.file.mimetype ||
          "",

        bytes:
          uploadedAsset.bytes ||
          req.file.size ||
          0,
      },

      status:
        "Submitted",
    });


    return res.redirect(
      `/academy/${academy.slug}/documents?submitted=success`
    );
  } catch (error) {

    /*
     * If Cloudinary upload succeeded but MongoDB failed,
     * do not leave an orphaned file consuming storage.
     */
    if (
      uploadedAsset?.publicId
    ) {
      try {
        await deleteAsset(
          uploadedAsset.publicId,

          uploadedAsset.resourceType ||
            "raw"
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "Assignment upload cleanup error:",
          cleanupError
        );
      }
    }


    console.error(
      "Submit assignment error:",
      error
    );


    return res
      .status(500)
      .render(
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