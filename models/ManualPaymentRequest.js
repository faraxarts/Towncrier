const mongoose = require("mongoose");

const manualPaymentRequestSchema = new mongoose.Schema(
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

    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    amountLabel: {
      type: String,
      trim: true,
      default: "",
    },

    payerName: {
      type: String,
      trim: true,
      default: "",
    },

    transferDate: {
      type: String,
      trim: true,
      default: "",
    },

    transactionNumber: {
      type: String,
      trim: true,
      default: "",
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    proofUrl: {
      type: String,
      trim: true,
      default: "",
    },

    proofPublicId: {
  type: String,
  trim: true,
  default: "",
},

proofResourceType: {
  type: String,
  trim: true,
  default: "",
},

proofOriginalName: {
  type: String,
  trim: true,
  default: "",
},

proofMimeType: {
  type: String,
  trim: true,
  default: "",
},

proofBytes: {
  type: Number,
  min: 0,
  default: 0,
},

    status: {
      type: String,
      enum: ["initiated", "pending", "approved", "rejected"],
      default: "initiated",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    adminNote: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ManualPaymentRequest", manualPaymentRequestSchema);