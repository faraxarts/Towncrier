const mongoose = require("mongoose");


/* =========================================================
   STORED FILE
   ========================================================= */

const fileItemSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      trim: true,
      default: "",
    },

    fileUrl: {
      type: String,
      trim: true,
      required: true,
    },

    /*
     * Cloudinary public ID.
     *
     * Empty for legacy /uploads/... records.
     */
    publicId: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * Usually:
     * image
     * video
     * raw
     */
    resourceType: {
      type: String,
      trim: true,
      default: "",
    },
  },

  {
    _id: false,
  }
);


/* =========================================================
   MODULE
   ========================================================= */

const moduleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
    },

    lessons: {
      type: Number,
      default: 0,
    },
  },

  {
    _id: false,
  }
);


/* =========================================================
   COURSE
   ========================================================= */

const courseSchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Level",
      default: null,
    },

    levelPosition: {
      type: Number,
      default: 1,
    },
    
    /* =====================================================
   DBW V2 CONTENT SYSTEM
   ===================================================== */

/*
 * legacy:
 * Current courseAudios / courseDocuments /
 * assignmentDocument system.
 *
 * resources:
 * New CourseResource architecture.
 */
contentMode: {
  type: String,

  enum: [
    "legacy",
    "resources",
  ],

  default: "legacy",
},


/*
 * New publishing lifecycle.
 *
 * Existing isPublished is intentionally retained
 * during migration.
 */
status: {
  type: String,

  enum: [
    "draft",
    "published",
    "archived",
  ],

  default: "published",
},


/*
 * Determines when the Course itself is completed.
 */
completionRule: {
  type: String,

  enum: [
    "all_required_resources",
    "admin_approval",
    "none",
  ],

  default:
    "all_required_resources",
},


/*
 * level_access:
 * Any learner who has unlocked this Level can
 * access the Course.
 *
 * previous_course_complete:
 * Reserved for optional sequential learning.
 */
accessRule: {
  type: String,

  enum: [
    "level_access",
    "previous_course_complete",
  ],

  default: "level_access",
},


/*
 * Determines what we recommend after completion.
 */
nextCourseMode: {
  type: String,

  enum: [
    "auto",
    "manual",
    "none",
  ],

  default: "auto",
},


nextCourse: {
  type:
    mongoose.Schema.Types.ObjectId,

  ref: "Course",

  default: null,
},

    /* =====================================================
       FEATURED IMAGE
       ===================================================== */

    featuredImage: {
      type: String,
      trim: true,
      default: "",
    },

    featuredImagePublicId: {
      type: String,
      trim: true,
      default: "",
    },

    featuredImageResourceType: {
      type: String,
      trim: true,
      default: "",
    },


    description: {
      type: String,
      required: true,
      trim: true,
    },

    overview: {
      type: String,
      trim: true,
      default: "",
    },

    duration: {
      type: String,
      trim: true,
      default: "",
    },

    lessons: {
      type: String,
      trim: true,
      default: "",
    },

    instructor: {
      type: String,
      trim: true,
      default: "",
    },

    price: {
      type: String,
      trim: true,
      default: "",
    },

    buttonText: {
      type: String,
      trim: true,
      default: "View Course",
    },

    buttonClass: {
      type: String,
      trim: true,
      default:
        "bg-[#4F46E5] hover:bg-indigo-700",
    },


    /* =====================================================
       DOCUMENTS
       ===================================================== */

    courseDocuments: {
      type: [fileItemSchema],
      default: [],
    },


    /* =====================================================
       AUDIOS
       ===================================================== */

    courseAudios: {
      type: [fileItemSchema],
      default: [],
    },


    /* =====================================================
       ASSIGNMENT DOCUMENT
       ===================================================== */

    assignmentDocument: {
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

      resourceType: {
        type: String,
        trim: true,
        default: "",
      },
    },


    whatYouWillLearn: {
      type: [String],
      default: [],
    },

    modules: {
      type: [moduleSchema],
      default: [],
    },

    requirements: {
      type: [String],
      default: [],
    },

    audience: {
      type: [String],
      default: [],
    },

    studentsCount: {
      type: Number,
      default: 0,
    },

    averageRating: {
      type: Number,
      default: 0,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },
  },

  {
    timestamps: true,
  }
);


module.exports =
  mongoose.model(
    "Course",
    courseSchema
  );