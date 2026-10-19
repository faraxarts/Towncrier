const mongoose =
  require("mongoose");


const courseProgressSchema =
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


      /* =====================================================
         REQUIRED MATERIAL SUMMARY
         ===================================================== */

      requiredResources: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },


      completedRequiredResources: {
        type:
          Number,

        default:
          0,

        min:
          0,
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
         RESUME LEARNING
         ===================================================== */

      lastResource: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "CourseResource",

        default:
          null,
      },


      /* =====================================================
         DATES
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
    },

    {
      timestamps:
        true,
    }
  );


/* =========================================================
   ONE COURSE PROGRESS RECORD PER LEARNER
   ========================================================= */

courseProgressSchema.index(
  {
    user:
      1,

    course:
      1,
  },

  {
    unique:
      true,
  }
);


/* =========================================================
   RESUME LEARNING LOOKUPS
   ========================================================= */

courseProgressSchema.index({
  user:
    1,

  lastActivityAt:
    -1,
});


module.exports =
  mongoose.model(
    "CourseProgress",
    courseProgressSchema
  );