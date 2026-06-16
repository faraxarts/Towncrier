const crypto = require("crypto");
const Level = require("../models/Level");
const UserLevelAccess = require("../models/UserLevelAccess");
const ManualPaymentRequest = require("../models/ManualPaymentRequest");

function generateReference(level, userId) {
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  const levelPart = String(level.order || 1).padStart(2, "0");
  const userPart = String(userId).slice(-6).toUpperCase();
  return `TCM-L${levelPart}-${userPart}-${random}`;
}

exports.getManualPaymentPage = async (req, res) => {
  try {
    const academy = req.academy;

    const level = await Level.findOne({
      _id: req.params.levelId,
      academy: academy._id,
      isPublished: true,
    });

    if (!level) {
      return res.status(404).send("Level not found");
    }

    const existingAccess = await UserLevelAccess.findOne({
      user: req.session.userId,
      level: level._id,
      status: "active",
    });

    if (existingAccess) {
      return res.redirect(`/academy/${academy.slug}/courses?payment=already-unlocked`);
    }

    let paymentRequest = await ManualPaymentRequest.findOne({
      user: req.session.userId,
      level: level._id,
      status: { $in: ["initiated", "pending"] },
    }).sort({ createdAt: -1 });

    if (!paymentRequest) {
      paymentRequest = await ManualPaymentRequest.create({
        user: req.session.userId,
        level: level._id,
        reference: generateReference(level, req.session.userId),
        amountLabel: level.price || "",
        status: "initiated",
      });
    }

    res.render("hub/manual-level-payment", {
      academy,
      level,
      paymentRequest,
      bankName: process.env.MANUAL_PAYMENT_BANK_NAME || "",
      accountName: process.env.MANUAL_PAYMENT_ACCOUNT_NAME || "",
      accountNumber: process.env.MANUAL_PAYMENT_ACCOUNT_NUMBER || "",
    });
  } catch (error) {
    console.error("Get manual payment page error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.submitManualPaymentRequest = async (req, res) => {
  try {
    const academy = req.academy;

    const level = await Level.findOne({
      _id: req.params.levelId,
      academy: academy._id,
    });

    if (!level) {
      return res.status(404).send("Level not found");
    }

    const requestId = req.body.requestId?.trim();
    const payerName = req.body.payerName?.trim();
    const transactionNumber = req.body.transactionNumber?.trim();
    const note = req.body.note?.trim() || "";

    if (!requestId || !payerName || !transactionNumber) {
      return res.status(400).send("Please fill in all required payment fields.");
    }

    const paymentRequest = await ManualPaymentRequest.findOne({
      _id: requestId,
      user: req.session.userId,
      level: level._id,
    });

    if (!paymentRequest) {
      return res.status(404).send("Payment request not found.");
    }

    paymentRequest.payerName = payerName;
    paymentRequest.transactionNumber = transactionNumber;
    paymentRequest.note = note;
    paymentRequest.status = "pending";

    if (req.file) {
      paymentRequest.proofUrl = `/uploads/payment-proofs/${req.file.filename}`;
    }

    await paymentRequest.save();

    res.redirect(`/academy/${academy.slug}/courses?payment=pending`);
  } catch (error) {
    console.error("Submit manual payment request error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};