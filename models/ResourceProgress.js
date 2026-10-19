const mongoose =
  require("mongoose");


const resourceProgressSchema =
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
         LEARNING MATERIAL
         ===================================================== */

      resource: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "CourseResource",

        required:
          true,

        index:
          true,
      },


      /* =====================================================
         STATUS
         ===================================================== */

      status: {
        type:
          String,

        enum: [
          "not_started",
          "in_progress",
          "completed",
        ],

        default:
          "not_started",

        index:
          true,
      },


      progressPercentage: {
        type:
          Number,

        default:
          0,

        min:
          0,

        max:
          100,
      },


      /* =====================================================
         AUDIO POSITION

         lastPositionSeconds:
         where playback should resume.

         furthestPositionSeconds:
         highest point physically reached.

         engagedSeconds:
         approximate meaningful playback time.
         ===================================================== */

      lastPositionSeconds: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },


      furthestPositionSeconds: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },


      engagedSeconds: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },


      durationSeconds: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },


      /* =====================================================
         ACTIVITY DATES
         ===================================================== */

      startedAt: {
        type:
          Date,

        default:
          null,
      },


      lastActivityAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },


      completedAt: {
        type:
          Date,

        default:
          null,
      },


      /* =====================================================
         COMPLETION SOURCE
         ===================================================== */

      completionSource: {
        type:
          String,

        enum: [
          "audio_percentage",
          "manual_confirmation",
          "resource_opened",
          "assignment_submitted",
          "assignment_accepted",
          "external_visit",
          "admin",
          "none",
        ],

        default:
          "none",
      },
    },

    {
      timestamps:
        true,
    }
  );


/* =========================================================
   ONE PROGRESS RECORD PER LEARNER + RESOURCE
   ========================================================= */

resourceProgressSchema.index(
  {
    user:
      1,

    resource:
      1,
  },

  {
    unique:
      true,
  }
);


/* =========================================================
   COURSE PROGRESS LOOKUPS
   ========================================================= */

resourceProgressSchema.index({
  user:
    1,

  course:
    1,

  status:
    1,
});


module.exports =
  mongoose.model(
    "ResourceProgress",
    resourceProgressSchema
  );