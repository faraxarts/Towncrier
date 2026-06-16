const mongoose = require("mongoose");

const levelSchema = new mongoose.Schema(
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

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Legacy display field kept so existing pages don't break
    price: {
      type: String,
      trim: true,
      default: "",
    },

    priceNaira: {
      type: Number,
      default: 15000,
    },

    priceUsd: {
      type: Number,
      default: 0,
    },

    order: {
      type: Number,
      default: 1,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Level", levelSchema);