const Academy = require("../models/Academy");
const Course = require("../models/course");
const AssignmentSubmission = require("../models/AssignmentSubmission");

exports.getAllAssignmentSubmissions = async (req, res) => {
  try {
    const selectedAcademy = req.query.academy?.trim() || "";
    const [academies, courseIds] = await Promise.all([
      Academy.find({ isPublished: true }).sort({ createdAt: 1 }),
      selectedAcademy
        ? Course.find({ academy: selectedAcademy }).distinct("_id")
        : Promise.resolve(null),
    ]);

    const filter = {};
    if (selectedAcademy) {
      filter.course = { $in: courseIds || [] };
    }

    const submissions = await AssignmentSubmission.find(filter)
      .populate("user", "name email")
      .populate({
        path: "course",
        select: "title slug academy",
        populate: {
          path: "academy",
          select: "name slug",
        },
      })
      .sort({ createdAt: -1 });

    res.render("admin/assignments/index", {
      submissions,
      academies,
      selectedAcademy,
    });
  } catch (error) {
    console.error("Get assignment submissions error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};