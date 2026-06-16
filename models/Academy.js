const mongoose = require("mongoose");

const academySchema = new mongoose.Schema(
  {
    name: {
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

    shortDescription: {
      type: String,
      trim: true,
      default: "",
    },

    fullDescription: {
      type: String,
      trim: true,
      default: "",
    },

    coverImage: {
      type: String,
      trim: true,
      default: "",
    },

    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Academy", academySchema);