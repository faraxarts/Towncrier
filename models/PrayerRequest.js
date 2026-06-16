const mongoose = require("mongoose");

const prayerRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    request: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "prayed", "answered"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PrayerRequest", prayerRequestSchema);