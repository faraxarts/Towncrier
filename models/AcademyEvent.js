const mongoose = require("mongoose");


const academyEventSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true,

        index: true,
      },


      academy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Academy",

        required: true,

        index: true,
      },


      level: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Level",

        default: null,

        index: true,
      },


      course: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Course",

        default: null,

        index: true,
      },


      resource: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "CourseResource",

        default: null,

        index: true,
      },


      eventType: {
        type: String,

        required: true,

        enum: [
          "COURSE_STARTED",
          "COURSE_COMPLETED",

          "RESOURCE_OPENED",
          "RESOURCE_COMPLETED",

          "AUDIO_STARTED",
          "AUDIO_25_PERCENT",
          "AUDIO_50_PERCENT",
          "AUDIO_75_PERCENT",
          "AUDIO_THRESHOLD_REACHED",
          "AUDIO_COMPLETED",
          "AUDIO_DOWNLOADED",

          "DOCUMENT_OPENED",
          "DOCUMENT_DOWNLOADED",
          "DOCUMENT_COMPLETED",

          "ASSIGNMENT_OPENED",
          "ASSIGNMENT_SUBMITTED",
          "ASSIGNMENT_REVISION_REQUIRED",
          "ASSIGNMENT_ACCEPTED",

          "EXTERNAL_RESOURCE_VISITED",

          "LEVEL_COMPLETED",
        ],

        index: true,
      },


      metadata: {
        type:
          mongoose.Schema.Types.Mixed,

        default: {},
      },


      occurredAt: {
        type: Date,
        default: Date.now,
        index: true,
      },


      /*
       * Optional automatic deletion date.
       *
       * We can later make low-value analytics events
       * expire after, for example, 180 days.
       *
       * Important milestone data can omit this field.
       */
      expiresAt: {
        type: Date,
        default: null,
      },
    },

    {
      timestamps: true,
    }
  );


/* =========================================================
   ANALYTICS INDEXES
   ========================================================= */

academyEventSchema.index({
  academy: 1,
  occurredAt: -1,
});


academyEventSchema.index({
  course: 1,
  eventType: 1,
  occurredAt: -1,
});


academyEventSchema.index({
  user: 1,
  occurredAt: -1,
});


/* =========================================================
   OPTIONAL TTL CLEANUP

   MongoDB automatically removes events once expiresAt
   is reached.

   Documents where expiresAt is null remain unaffected.
   ========================================================= */

academyEventSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);


module.exports =
  mongoose.model(
    "AcademyEvent",
    academyEventSchema
  );