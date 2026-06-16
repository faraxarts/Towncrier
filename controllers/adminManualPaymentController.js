const Academy = require("../models/Academy");
const Level = require("../models/Level");
const ManualPaymentRequest = require("../models/ManualPaymentRequest");
const UserLevelAccess = require("../models/UserLevelAccess");

function buildAdminRedirect(basePath, academyId = "") {
  return academyId ? `${basePath}?academy=${encodeURIComponent(academyId)}` : basePath;
}

exports.getAllManualPaymentRequests = async (req, res) => {
  try {
    const selectedAcademy = req.query.academy?.trim() || "";
    const [academies, levelIds] = await Promise.all([
      Academy.find({ isPublished: true }).sort({ createdAt: 1 }),
      selectedAcademy
        ? Level.find({ academy: selectedAcademy }).distinct("_id")
        : Promise.resolve(null),
    ]);

    const filter = {};
    if (selectedAcademy) {
      filter.level = { $in: levelIds || [] };
    }

    const requests = await ManualPaymentRequest.find(filter)
      .populate("user", "name email")
      .populate({
        path: "level",
        select: "title price order academy",
        populate: {
          path: "academy",
          select: "name slug",
        },
      })
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    res.render("admin/manual-payments/index", {
      requests,
      academies,
      selectedAcademy,
    });
  } catch (error) {
    console.error("Get manual payment requests error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.approveManualPaymentRequest = async (req, res) => {
  try {
    const redirectAcademy = req.body.redirectAcademy?.trim() || "";
    const request = await ManualPaymentRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).send("Payment request not found");
    }

    request.status = "approved";
    request.reviewedBy = req.session.userId;
    request.reviewedAt = new Date();
    await request.save();

    await UserLevelAccess.findOneAndUpdate(
      { user: request.user, level: request.level },
      {
        status: "active",
        source: "manual",
        grantedBy: req.session.userId,
        grantedAt: new Date(),
        transactionRef: request.reference,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    res.redirect(buildAdminRedirect("/admin/manual-payments", redirectAcademy));
  } catch (error) {
    console.error("Approve manual payment error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.rejectManualPaymentRequest = async (req, res) => {
  try {
    const redirectAcademy = req.body.redirectAcademy?.trim() || "";
    const request = await ManualPaymentRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).send("Payment request not found");
    }

    request.status = "rejected";
    request.reviewedBy = req.session.userId;
    request.reviewedAt = new Date();
    request.adminNote = req.body.adminNote?.trim() || "";
    await request.save();

    res.redirect(buildAdminRedirect("/admin/manual-payments", redirectAcademy));
  } catch (error) {
    console.error("Reject manual payment error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};