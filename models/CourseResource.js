const mongoose = require("mongoose");


/* =========================================================
   RESOURCE FILE
   ========================================================= */

const resourceFileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      trim: true,
      default: "",
    },

    fileUrl: {
      type: String,
      trim: true,
      default: "",
    },

    publicId: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * Cloudinary normally returns:
     * image
     * video
     * raw
     */
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
  {
    _id: false,
  }
);


/* =========================================================
   LEARNER ACCESS SETTINGS
   ========================================================= */

const accessSchema = new mongoose.Schema(
  {
    allowOnline: {
      type: Boolean,
      default: true,
    },

    allowDownload: {
      type: Boolean,
      default: true,
    },

    openInNewTab: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);


/* =========================================================
   COMPLETION SETTINGS
   ========================================================= */

const completionSchema = new mongoose.Schema(
  {
    method: {
      type: String,

      enum: [
        "audio_percentage",
        "manual_confirmation",
        "resource_opened",
        "assignment_submitted",
        "assignment_accepted",
        "external_visit",
        "none",
      ],

      default: "none",
    },

    /*
     * Primarily used for audio.
     *
     * Example:
     * 80 = learner must reach 80%.
     */
    threshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
  },
  {
    _id: false,
  }
);


/* =========================================================
   ASSIGNMENT SETTINGS
   ========================================================= */

const assignmentSettingsSchema =
  new mongoose.Schema(
    {
      submissionRequired: {
        type: Boolean,
        default: true,
      },

      acceptedFormats: {
        type: [
          {
            type: String,
            enum: [
              "pdf",
              "doc",
              "docx",
            ],
          },
        ],

        default: () => [
          "pdf",
          "doc",
          "docx",
        ],
      },
    },
    {
      _id: false,
    }
  );


/* =========================================================
   COURSE RESOURCE
   ========================================================= */

const courseResourceSchema =
  new mongoose.Schema(
    {
      course: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Course",

        required: true,

        index: true,
      },


      /* =====================================================
         RESOURCE TYPE
         ===================================================== */

      type: {
        type: String,

        enum: [
          "audio",
          "document",
          "assignment",
          "written",
          "external",
          "video",
        ],

        required: true,

        index: true,
      },


      title: {
        type: String,
        required: true,
        trim: true,
      },


      description: {
        type: String,
        trim: true,
        default: "",
      },


      /*
       * Used by written resources.
       */
      content: {
        type: String,
        default: "",
      },


      /*
       * Used by external resources.
       */
      externalUrl: {
        type: String,
        trim: true,
        default: "",
      },


      /* =====================================================
         DISPLAY ORDER
         ===================================================== */

      order: {
        type: Number,
        min: 1,
        default: 1,
      },


      /* =====================================================
         REQUIREMENT
         ===================================================== */

      required: {
        type: Boolean,
        default: true,
      },


      /* =====================================================
         RESOURCE STATUS
         ===================================================== */

      status: {
        type: String,

        enum: [
          "draft",
          "published",
          "archived",
        ],

        default: "draft",

        index: true,
      },


      /* =====================================================
         FILE
         ===================================================== */

      file: {
        type: resourceFileSchema,

        default: () => ({}),
      },


      /* =====================================================
         LEARNER ACCESS
         ===================================================== */

      access: {
        type: accessSchema,

        default: () => ({}),
      },


      /* =====================================================
         COMPLETION
         ===================================================== */

      completion: {
        type: completionSchema,

        default: () => ({}),
      },


      /* =====================================================
         ASSIGNMENT-SPECIFIC SETTINGS
         ===================================================== */

      assignmentSettings: {
        type:
          assignmentSettingsSchema,

        default: () => ({}),
      },


      /* =====================================================
         MIGRATION IDENTIFIER

         Only populated for resources generated from the
         existing legacy Course fields.

         This allows the migration script to be safely
         re-run without creating duplicate resources.
         ===================================================== */

      legacyMigrationKey: {
        type: String,
        trim: true,
      },


      createdBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        default: null,
      },
    },

    {
      timestamps: true,
    }
  );


/* =========================================================
   INDEXES
   ========================================================= */

courseResourceSchema.index({
  course: 1,
  order: 1,
});


courseResourceSchema.index({
  course: 1,
  status: 1,
  order: 1,
});


courseResourceSchema.index(
  {
    legacyMigrationKey: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      legacyMigrationKey: {
        $type: "string",
      },
    },
  }
);


module.exports =
  mongoose.model(
    "CourseResource",
    courseResourceSchema
  );