const Academy =
  require("../models/Academy");

const Course =
  require("../models/course");

const AssignmentSubmission =
  require("../models/AssignmentSubmission");

const AcademyEvent =
  require("../models/AcademyEvent");


/* =========================================================
   ANALYTICS

   Review actions should never fail simply because an
   analytics event could not be written.
   ========================================================= */

async function logReviewEvent({
  submission,
  eventType,
  reviewedBy,
}) {
  try {
    if (
      !submission ||
      !submission.course
    ) {
      return;
    }


    const course =
      submission.course;


    const academyId =
      course.academy?._id ||
      course.academy ||
      null;


    const levelId =
      course.level?._id ||
      course.level ||
      null;


    if (!academyId) {
      return;
    }


    await AcademyEvent.create({
      user:
        submission.user?._id ||
        submission.user,

      academy:
        academyId,

      level:
        levelId,

      course:
        course._id,

      resource:
        submission.resource?._id ||
        submission.resource ||
        null,

      eventType,

      metadata: {
        submissionId:
          String(
            submission._id
          ),

        reviewedBy:
          reviewedBy
            ? String(
                reviewedBy
              )
            : null,

        revisionCount:
          submission.revisionCount ||
          0,
      },

      occurredAt:
        new Date(),

      /*
       * Review events are meaningful permanent history,
       * not temporary engagement telemetry.
       */
      expiresAt:
        null,
    });
  } catch (error) {
    console.error(
      "Assignment review analytics error:",
      error
    );
  }
}


/* =========================================================
   GET ALL ASSIGNMENT SUBMISSIONS
   ========================================================= */

exports.getAllAssignmentSubmissions =
  async (
    req,
    res
  ) => {
    try {
      const selectedAcademy =
        req.query
          .academy
          ?.trim() ||
        "";


      const selectedStatus =
        req.query
          .status
          ?.trim() ||
        "";


      const allowedStatuses =
        new Set([
          "Submitted",
          "Reviewed",
          "Accepted",
          "Needs Revision",
        ]);


      /* =====================================================
         ACADEMIES + COURSE FILTER
         ===================================================== */

      const [
        academies,
        courseIds,
      ] =
        await Promise.all([
          Academy.find({
            isPublished:
              true,
          }).sort({
            createdAt:
              1,
          }),

          selectedAcademy
            ? Course.find({
                academy:
                  selectedAcademy,
              }).distinct(
                "_id"
              )
            : Promise.resolve(
                null
              ),
        ]);


      const filter =
        {};


      if (
        selectedAcademy
      ) {
        filter.course = {
          $in:
            courseIds ||
            [],
        };
      }


      if (
        selectedStatus &&
        allowedStatuses.has(
          selectedStatus
        )
      ) {
        filter.status =
          selectedStatus;
      }


      /* =====================================================
         SUBMISSIONS
         ===================================================== */

      const submissions =
        await AssignmentSubmission.find(
          filter
        )
          .populate(
            "user",
            "name email"
          )
          .populate(
            "reviewedBy",
            "name email"
          )
          .populate({
            path:
              "course",

            select:
              "title slug academy level contentMode",

            populate: [
              {
                path:
                  "academy",

                select:
                  "name slug",
              },

              {
                path:
                  "level",

                select:
                  "title name",
              },
            ],
          })
          .populate(
            "resource",
            "title type required completion"
          )
          .sort({
            updatedAt:
              -1,
          });


      /* =====================================================
         COUNTS

         Counts respect the selected Academy, but not the
         selected status tab.
         ===================================================== */

      const countFilter =
        {};


      if (
        selectedAcademy
      ) {
        countFilter.course = {
          $in:
            courseIds ||
            [],
        };
      }


      const [
        allCount,
        submittedCount,
        revisionCount,
        acceptedCount,
      ] =
        await Promise.all([
          AssignmentSubmission.countDocuments(
            countFilter
          ),

          AssignmentSubmission.countDocuments({
            ...countFilter,

            status: {
              $in: [
                "Submitted",
                "Reviewed",
              ],
            },
          }),

          AssignmentSubmission.countDocuments({
            ...countFilter,

            status:
              "Needs Revision",
          }),

          AssignmentSubmission.countDocuments({
            ...countFilter,

            status:
              "Accepted",
          }),
        ]);


      return res.render(
        "admin/assignments/index",
        {
          submissions,

          academies,

          selectedAcademy,

          selectedStatus,

          counts: {
            all:
              allCount,

            awaiting:
              submittedCount,

            revision:
              revisionCount,

            accepted:
              acceptedCount,
          },

          success:
            req.query.success ||
            "",

          error:
            req.query.error ||
            "",
        }
      );
    } catch (error) {
      console.error(
        "Get assignment submissions error:",
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
   REVIEW ASSIGNMENT
   ========================================================= */

exports.reviewAssignmentSubmission =
  async (
    req,
    res
  ) => {
    try {
      const submission =
        await AssignmentSubmission.findById(
          req.params.id
        )
          .populate(
            "user",
            "name email"
          )
          .populate({
            path:
              "course",

            select:
              "title slug academy level",

            populate: [
              {
                path:
                  "academy",

                select:
                  "name slug",
              },

              {
                path:
                  "level",

                select:
                  "title name",
              },
            ],
          })
          .populate(
            "resource",
            "title type completion"
          );


      if (!submission) {
        return res.redirect(
          "/admin/assignments?error=" +
          encodeURIComponent(
            "Assignment submission not found."
          )
        );
      }


      const action =
        req.body
          .action
          ?.trim();


      const feedback =
        req.body
          .reviewFeedback
          ?.trim() ||
        "";


      if (
        action !==
          "accept" &&
        action !==
          "revision"
      ) {
        return res.redirect(
          "/admin/assignments?error=" +
          encodeURIComponent(
            "Invalid review action."
          )
        );
      }


      /* =====================================================
         REQUEST REVISION
         ===================================================== */

      if (
        action ===
        "revision"
      ) {
        if (!feedback) {
          return res.redirect(
            "/admin/assignments?error=" +
            encodeURIComponent(
              "Please provide feedback explaining what the learner should revise."
            )
          );
        }


        submission.status =
          "Needs Revision";


        submission.reviewFeedback =
          feedback;


        submission.reviewedBy =
          req.session.userId;


        submission.reviewedAt =
          new Date();


        submission.acceptedAt =
          null;


        await submission.save();


        await logReviewEvent({
          submission,

          eventType:
            "ASSIGNMENT_REVISION_REQUIRED",

          reviewedBy:
            req.session.userId,
        });


        const query =
          new URLSearchParams();


        if (
          req.body
            .returnAcademy
        ) {
          query.set(
            "academy",

            req.body
              .returnAcademy
          );
        }


        if (
          req.body
            .returnStatus
        ) {
          query.set(
            "status",

            req.body
              .returnStatus
          );
        }


        query.set(
          "success",
          "revision-requested"
        );


        return res.redirect(
          `/admin/assignments?${query.toString()}`
        );
      }


      /* =====================================================
         ACCEPT ASSIGNMENT
         ===================================================== */

      submission.status =
        "Accepted";


      submission.reviewFeedback =
        feedback;


      submission.reviewedBy =
        req.session.userId;


      submission.reviewedAt =
        new Date();


      submission.acceptedAt =
        new Date();


      await submission.save();


      await logReviewEvent({
        submission,

        eventType:
          "ASSIGNMENT_ACCEPTED",

        reviewedBy:
          req.session.userId,
      });


      const query =
        new URLSearchParams();


      if (
        req.body
          .returnAcademy
      ) {
        query.set(
          "academy",

          req.body
            .returnAcademy
        );
      }


      if (
        req.body
          .returnStatus
      ) {
        query.set(
          "status",

          req.body
            .returnStatus
        );
      }


      query.set(
        "success",
        "accepted"
      );


      return res.redirect(
        `/admin/assignments?${query.toString()}`
      );
    } catch (error) {
      console.error(
        "Review assignment submission error:",
        error
      );


      return res.redirect(
        "/admin/assignments?error=" +
        encodeURIComponent(
          "Unable to review the assignment."
        )
      );
    }
  };