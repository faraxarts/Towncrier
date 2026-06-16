const mongoose = require("mongoose");

const programRegistrationSchema = new mongoose.Schema(
  {
    fullName: {
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

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      enum: ["Registration"],
      default: "Registration",
    },

    programTarget: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "Discipleship by the Word",
        "Discipleship Bootcamp",
        "Arrows in the Quiver",
        "DBW HUB",
      ],
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "reviewed", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProgramRegistration", programRegistrationSchema);