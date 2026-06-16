const mongoose = require("mongoose");

const academyEnrollmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

academyEnrollmentSchema.index({ user: 1, academy: 1 }, { unique: true });

module.exports = mongoose.model("AcademyEnrollment", academyEnrollmentSchema);