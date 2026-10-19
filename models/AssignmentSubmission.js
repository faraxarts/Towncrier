const mongoose =
  require("mongoose");


const assignmentSubmissionSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         LEARNER
         ===================================================== */

      user: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "User",

        required:
          true,

        index:
          true,
      },


      /* =====================================================
         COURSE
         ===================================================== */

      course: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "Course",

        required:
          true,

        index:
          true,
      },


      /* =====================================================
         DBW V2 ASSIGNMENT RESOURCE

         null remains valid for old legacy submissions.
         ===================================================== */

      resource: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "CourseResource",

        default:
          null,

        index:
          true,
      },


      assignmentTitle: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },


      submissionNote: {
        type:
          String,

        trim:
          true,

        default:
          "",
      },


      /* =====================================================
         CURRENT SUBMISSION FILE

         We keep only the current revision file.

         When the learner uploads a replacement revision,
         the previous Cloudinary asset is permanently deleted.
         ===================================================== */

      file: {
        originalName: {
          type:
            String,

          required:
            true,

          trim:
            true,
        },


        fileUrl: {
          type:
            String,

          required:
            true,

          trim:
            true,
        },


        publicId: {
          type:
            String,

          trim:
            true,

          default:
            "",
        },


        resourceType: {
          type:
            String,

          trim:
            true,

          default:
            "",
        },


        mimeType: {
          type:
            String,

          trim:
            true,

          default:
            "",
        },


        bytes: {
          type:
            Number,

          default:
            0,

          min:
            0,
        },
      },


      /* =====================================================
         REVIEW STATUS
         ===================================================== */

      status: {
        type:
          String,

        enum: [
          "Submitted",
          "Reviewed",
          "Accepted",
          "Needs Revision",
        ],

        default:
          "Submitted",

        index:
          true,
      },


      /* =====================================================
         ADMIN REVIEW
         ===================================================== */

      reviewFeedback: {
        type:
          String,

        trim:
          true,

        default:
          "",
      },


      reviewedBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "User",

        default:
          null,
      },


      reviewedAt: {
        type:
          Date,

        default:
          null,
      },


      acceptedAt: {
        type:
          Date,

        default:
          null,
      },


      /* =====================================================
         REVISION COUNT

         We don't preserve every historical Cloudinary file.
         We simply record how many revision uploads occurred.
         ===================================================== */

      revisionCount: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },
    },

    {
      timestamps:
        true,
    }
  );


/* =========================================================
   USEFUL QUERY INDEX
   ========================================================= */

assignmentSubmissionSchema.index({
  user:
    1,

  resource:
    1,
});


module.exports =
  mongoose.model(
    "AssignmentSubmission",
    assignmentSubmissionSchema
  );