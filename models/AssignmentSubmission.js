const mongoose = require("mongoose");


const assignmentSubmissionSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true,

        index: true,
      },


      course: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Course",

        required: true,

        index: true,
      },


      /*
       * New DBW V2 assignment resource.
       *
       * Nullable temporarily so legacy/test submissions
       * remain compatible during migration.
       */
      resource: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "CourseResource",

        default: null,

        index: true,
      },


      assignmentTitle: {
        type: String,
        required: true,
        trim: true,
      },


      submissionNote: {
        type: String,
        trim: true,
        default: "",
      },


      /* =====================================================
         CURRENT SUBMISSION FILE ONLY

         We intentionally do NOT retain previous uploaded
         revision files.
         ===================================================== */

      file: {
        originalName: {
          type: String,
          required: true,
          trim: true,
        },

        fileUrl: {
          type: String,
          required: true,
          trim: true,
        },

        publicId: {
          type: String,
          trim: true,
          default: "",
        },

        resourceType: {
          type: String,
          trim: true,
          default: "",
        },

        mimeType: {
          type: String,
          trim: true,
          default: "",
        },

        bytes: {
          type: Number,
          min: 0,
          default: 0,
        },
      },


      status: {
        type: String,

        enum: [
          "Submitted",
          "Reviewed",
          "Accepted",
          "Needs Revision",
        ],

        default: "Submitted",

        index: true,
      },


      /*
       * How many times a learner has replaced the
       * submission after revision was requested.
       *
       * This preserves tiny metadata, not old files.
       */
      revisionCount: {
        type: Number,
        min: 0,
        default: 0,
      },


      /* =====================================================
         ADMIN REVIEW
         ===================================================== */

      reviewFeedback: {
        type: String,
        trim: true,
        default: "",
      },


      reviewedBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        default: null,
      },


      reviewedAt: {
        type: Date,
        default: null,
      },


      acceptedAt: {
        type: Date,
        default: null,
      },
    },

    {
      timestamps: true,
    }
  );


/* =========================================================
   NEW SYSTEM:

   One current AssignmentSubmission per
   learner + assignment resource.

   Legacy records where resource is null are excluded
   from this uniqueness rule.
   ========================================================= */

assignmentSubmissionSchema.index(
  {
    user: 1,
    resource: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      resource: {
        $type: "objectId",
      },
    },
  }
);


assignmentSubmissionSchema.index({
  course: 1,
  status: 1,
});


module.exports =
  mongoose.model(
    "AssignmentSubmission",
    assignmentSubmissionSchema
  );