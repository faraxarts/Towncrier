const Academy =
  require("../models/Academy");

const Course =
  require("../models/course");

const AssignmentSubmission =
  require("../models/AssignmentSubmission");

const AcademyEvent =
  require("../models/AcademyEvent");


const {
  syncAcceptedAssignmentProgress,
} =
  require(
    "../services/academyProgressService"
  );


/* =========================================================
   ANALYTICS

   Review analytics must never prevent the actual review
   action from being saved.
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
       * Assignment review events are meaningful history,
       * so they are not temporary telemetry.
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
         ACADEMIES
         ===================================================== */

      const academies =
        await Academy.find({
          isPublished:
            true,
        }).sort({
          createdAt:
            1,
        });


      /* =====================================================
         COURSE IDS FOR ACADEMY FILTER
         ===================================================== */

      let courseIds =
        null;


      if (
        selectedAcademy
      ) {

        courseIds =
          await Course.find({
            academy:
              selectedAcademy,
          }).distinct(
            "_id"
          );
      }


      /* =====================================================
         SUBMISSION FILTER
         ===================================================== */

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


      /*
       * In the Admin UI, "Submitted" represents everything
       * currently awaiting review.
       *
       * This includes both Submitted and Reviewed records.
       */

      if (
        selectedStatus ===
        "Submitted"
      ) {

        filter.status = {
          $in: [
            "Submitted",
            "Reviewed",
          ],
        };
      }

      else if (
        selectedStatus &&
        allowedStatuses.has(
          selectedStatus
        )
      ) {

        filter.status =
          selectedStatus;
      }


      /* =====================================================
         LOAD SUBMISSIONS
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

         Counts respect the Academy filter but do not depend
         on the selected Status filter.
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
        awaitingCount,
        revisionCount,
        acceptedCount,
      ] =
        await Promise.all([

          AssignmentSubmission
            .countDocuments(
              countFilter
            ),


          AssignmentSubmission
            .countDocuments({
              ...countFilter,

              status: {
                $in: [
                  "Submitted",
                  "Reviewed",
                ],
              },
            }),


          AssignmentSubmission
            .countDocuments({
              ...countFilter,

              status:
                "Needs Revision",
            }),


          AssignmentSubmission
            .countDocuments({
              ...countFilter,

              status:
                "Accepted",
            }),
        ]);


      /* =====================================================
         RENDER
         ===================================================== */

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
              awaitingCount,

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
   REVIEW ASSIGNMENT SUBMISSION
   ========================================================= */

exports.reviewAssignmentSubmission =
  async (
    req,
    res
  ) => {

    try {

      /* =====================================================
         LOAD SUBMISSION
         ===================================================== */

      const submission =
        await AssignmentSubmission
          .findById(
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


      /* =====================================================
         INPUT
         ===================================================== */

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
         RETURN FILTERS
         ===================================================== */

      const buildReturnUrl =
        (
          successCode
        ) => {

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


          if (
            successCode
          ) {

            query.set(
              "success",
              successCode
            );
          }


          const queryString =
            query.toString();


          return queryString
            ? `/admin/assignments?${queryString}`
            : "/admin/assignments";
        };


      /* =====================================================
         REQUEST REVISION
         ===================================================== */

      if (
        action ===
        "revision"
      ) {

        /*
         * Revision feedback is mandatory because the learner
         * needs to know what must be corrected.
         */

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


        return res.redirect(
          buildReturnUrl(
            "revision-requested"
          )
        );
      }


      /* =====================================================
         ACCEPT ASSIGNMENT
         ===================================================== */

      /*
       * Save the previous values so that, in the unlikely
       * event that progress synchronization fails, we can
       * restore the review state rather than leaving the
       * submission Accepted while Course progress remains
       * incomplete.
       */

      const previousReviewState = {
        status:
          submission.status,

        reviewFeedback:
          submission.reviewFeedback,

        reviewedBy:
          submission.reviewedBy,

        reviewedAt:
          submission.reviewedAt,

        acceptedAt:
          submission.acceptedAt,
      };


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


      /* =====================================================
         DBW V2 PROGRESS

         Assignment acceptance is what completes an
         assignment CourseResource under the default V2 rule.

         Legacy submissions have no resource reference and
         therefore skip this step.
         ===================================================== */

      if (
        submission.resource
      ) {

        try {

          await syncAcceptedAssignmentProgress(
            submission
          );

        } catch (
          progressError
        ) {

          console.error(
            "Assignment progress synchronization error:",
            progressError
          );


          /*
           * Restore the original review state so Admin can
           * safely retry after the underlying issue is fixed.
           */

          submission.status =
            previousReviewState.status;


          submission.reviewFeedback =
            previousReviewState
              .reviewFeedback ||
            "";


          submission.reviewedBy =
            previousReviewState
              .reviewedBy ||
            null;


          submission.reviewedAt =
            previousReviewState
              .reviewedAt ||
            null;


          submission.acceptedAt =
            previousReviewState
              .acceptedAt ||
            null;


          await submission.save();


          return res.redirect(
            "/admin/assignments?error=" +
            encodeURIComponent(
              "The assignment could not be accepted because learner progress could not be updated. Please try again."
            )
          );
        }
      }


      /* =====================================================
         ACCEPTANCE EVENT
         ===================================================== */

      await logReviewEvent({
        submission,

        eventType:
          "ASSIGNMENT_ACCEPTED",

        reviewedBy:
          req.session.userId,
      });


      return res.redirect(
        buildReturnUrl(
          "accepted"
        )
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