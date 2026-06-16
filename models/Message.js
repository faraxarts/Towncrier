const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    preacher: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    mediaType: {
      type: String,
      enum: ["audio", "video", "image", "pdf", "text"],
      required: true,
      lowercase: true,
      trim: true,
    },

    mediaUrl: {
      type: String,
      required: true,
      trim: true,
    },

    eventDate: {
      type: Date,
      required: false,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);