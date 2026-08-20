const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
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

    /*
     * Permanent delivery URL.
     *
     * Old records may still contain:
     * /uploads/events/images/...
     *
     * New records will contain:
     * https://res.cloudinary.com/...
     */
    featuredImage: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * Cloudinary identifier used when replacing or
     * deleting the image.
     *
     * Optional so existing Event records continue
     * working without a migration.
     */
    featuredImagePublicId: {
      type: String,
      trim: true,
      default: "",
    },

    shortDescription: {
      type: String,
      required: true,
      trim: true,
    },

    fullDescription: {
      type: String,
      trim: true,
      default: "",
    },

    eventDate: {
      type: String,
      trim: true,
      default: "",
    },

    eventTime: {
      type: String,
      trim: true,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      trim: true,
      default: "General Event",
    },

    buttonText: {
      type: String,
      trim: true,
      default: "Learn More",
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

module.exports = mongoose.model(
  "Event",
  eventSchema
);