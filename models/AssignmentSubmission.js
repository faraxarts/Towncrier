const mongoose = require("mongoose");

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
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
    },

    status: {
      type: String,
      enum: ["Submitted", "Reviewed", "Accepted", "Needs Revision"],
      default: "Submitted",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);