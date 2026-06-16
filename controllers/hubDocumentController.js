const Course = require("../models/course");
const AssignmentSubmission = require("../models/AssignmentSubmission");
const UserLevelAccess = require("../models/UserLevelAccess");

exports.getDocumentsPage = async (req, res) => {
  try {
    const academy = req.academy;

    const accesses = await UserLevelAccess.find({
      user: req.session.userId,
      status: "active",
    }).select("level");

    const unlockedLevelIds = accesses.map((item) => item.level);

    const courses = await Course.find({
      academy: academy._id,
      isPublished: true,
      level: { $in: unlockedLevelIds },
    })
      .select("title slug")
      .sort({ levelPosition: 1, createdAt: 1 });

    const dbSubmissions = await AssignmentSubmission.find({
      user: req.session.userId,
    })
      .populate("course", "title slug academy")
      .sort({ createdAt: -1 });

    const submissions = dbSubmissions
      .filter((item) => item.course && String(item.course.academy) === String(academy._id))
      .map((item) => ({
        assignmentTitle: item.assignmentTitle,
        courseTitle: item.course ? item.course.title : "Unknown Course",
        status: item.status || "Submitted",
        submittedAt: new Date(item.createdAt).toLocaleString(),
        submissionNote: item.submissionNote,
        fileUrl: item.file.fileUrl,
      }));

    res.render("hub/documents", {
      academy,
      courses,
      submissions,
      submitted: req.query.submitted || "",
    });
  } catch (error) {
    console.error("Get documents page error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.submitAssignment = async (req, res) => {
  try {
    const academy = req.academy;
    const courseId = req.body.courseId?.trim();
    const assignmentTitle = req.body.assignmentTitle?.trim();
    const submissionNote = req.body.submissionNote?.trim() || "";

    if (!courseId || !assignmentTitle || !req.file) {
      return res.status(400).send("Course, assignment title, and file are required.");
    }

    const course = await Course.findOne({
      _id: courseId,
      academy: academy._id,
    });

    if (!course) {
      return res.status(404).send("Selected course not found.");
    }

    const hasAccess = await UserLevelAccess.findOne({
      user: req.session.userId,
      level: course.level,
      status: "active",
    });

    if (!hasAccess) {
      return res.status(403).send("You do not have access to this course level.");
    }

    await AssignmentSubmission.create({
      user: req.session.userId,
      course: course._id,
      assignmentTitle,
      submissionNote,
      file: {
        originalName: req.file.originalname,
        fileUrl: `/uploads/submissions/${req.file.filename}`,
      },
      status: "Submitted",
    });

    res.redirect(`/academy/${academy.slug}/documents?submitted=success`);
  } catch (error) {
    console.error("Submit assignment error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};