const mongoose = require("mongoose");

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
  },
  { _id: false }
);

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
  { _id: false }
);

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

    featuredImage: {
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
      default: "bg-[#4F46E5] hover:bg-indigo-700",
    },

    courseDocuments: {
      type: [fileItemSchema],
      default: [],
    },

    courseAudios: {
      type: [fileItemSchema],
      default: [],
    },

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
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);