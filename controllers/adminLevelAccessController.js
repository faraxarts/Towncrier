const Academy = require("../models/Academy");
const Level = require("../models/Level");
const UserLevelAccess = require("../models/UserLevelAccess");

function buildAdminRedirect(basePath, academyId = "") {
  return academyId ? `${basePath}?academy=${encodeURIComponent(academyId)}` : basePath;
}

exports.getAllLevelAccess = async (req, res) => {
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

    const accessRecords = await UserLevelAccess.find(filter)
      .populate("user", "name email")
      .populate({
        path: "level",
        select: "title order price academy",
        populate: {
          path: "academy",
          select: "name slug",
        },
      })
      .sort({ createdAt: -1 });

    res.render("admin/level-access/index", {
      accessRecords,
      academies,
      selectedAcademy,
    });
  } catch (error) {
    console.error("Get level access error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.revokeLevelAccess = async (req, res) => {
  try {
    const redirectAcademy = req.body.redirectAcademy?.trim() || "";
    await UserLevelAccess.findByIdAndDelete(req.params.id);
    res.redirect(buildAdminRedirect("/admin/level-access", redirectAcademy));
  } catch (error) {
    console.error("Revoke level access error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};