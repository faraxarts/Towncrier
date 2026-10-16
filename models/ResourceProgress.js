const mongoose = require("mongoose");


const resourceProgressSchema =
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


      resource: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "CourseResource",

        required: true,

        index: true,
      },


      /* =====================================================
         STATUS

         No database record is required for "Not Started".
         If this document exists, the learner has interacted
         with the resource.
         ===================================================== */

      status: {
        type: String,

        enum: [
          "in_progress",
          "completed",
        ],

        default: "in_progress",

        index: true,
      },


      /* =====================================================
         GENERAL PROGRESS
         ===================================================== */

      progressPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },


      /* =====================================================
         AUDIO POSITION

         lastPositionSeconds:
         Where playback should resume.

         furthestPositionSeconds:
         Furthest meaningful position reached.
         ===================================================== */

      lastPositionSeconds: {
        type: Number,
        min: 0,
        default: 0,
      },


      furthestPositionSeconds: {
        type: Number,
        min: 0,
        default: 0,
      },


      /*
       * Approximate real active engagement.
       *
       * Useful later for audio analytics without
       * storing a database event every 20 seconds.
       */
      engagedSeconds: {
        type: Number,
        min: 0,
        default: 0,
      },


      startedAt: {
        type: Date,
        default: Date.now,
      },


      lastActivityAt: {
        type: Date,
        default: Date.now,
        index: true,
      },


      completedAt: {
        type: Date,
        default: null,
      },


      completionSource: {
        type: String,

        enum: [
          "audio_threshold",
          "manual_confirmation",
          "resource_opened",
          "assignment_submitted",
          "assignment_accepted",
          "external_visit",
          "admin",
          "system",
        ],

        default: null,
      },
    },

    {
      timestamps: true,
    }
  );


/* =========================================================
   ONE PROGRESS RECORD PER USER + RESOURCE
   ========================================================= */

resourceProgressSchema.index(
  {
    user: 1,
    resource: 1,
  },
  {
    unique: true,
  }
);


resourceProgressSchema.index({
  user: 1,
  course: 1,
});


module.exports =
  mongoose.model(
    "ResourceProgress",
    resourceProgressSchema
  );