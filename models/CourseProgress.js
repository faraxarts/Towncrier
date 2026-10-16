const mongoose = require("mongoose");


const courseProgressSchema =
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


      status: {
        type: String,

        enum: [
          "in_progress",
          "completed",
        ],

        default: "in_progress",

        index: true,
      },


      requiredResources: {
        type: Number,
        min: 0,
        default: 0,
      },


      completedRequiredResources: {
        type: Number,
        min: 0,
        default: 0,
      },


      progressPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },


      /*
       * Powers "Resume Learning".
       */
      lastResource: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "CourseResource",

        default: null,
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
          "resources",
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
   ONE COURSE PROGRESS RECORD PER LEARNER
   ========================================================= */

courseProgressSchema.index(
  {
    user: 1,
    course: 1,
  },
  {
    unique: true,
  }
);


module.exports =
  mongoose.model(
    "CourseProgress",
    courseProgressSchema
  );