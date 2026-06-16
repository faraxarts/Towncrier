const mongoose = require("mongoose");

const userLevelAccessSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Level",
      required: true,
    },

    status: {
      type: String,
      enum: ["active"],
      default: "active",
    },

    source: {
      type: String,
      enum: ["manual", "payment"],
      default: "manual",
    },

    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    grantedAt: {
      type: Date,
      default: Date.now,
    },

    transactionRef: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

userLevelAccessSchema.index({ user: 1, level: 1 }, { unique: true });

module.exports = mongoose.model("UserLevelAccess", userLevelAccessSchema);