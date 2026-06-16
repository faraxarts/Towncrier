const Academy = require("../models/Academy");
const AcademyEnrollment = require("../models/AcademyEnrollment");
const Level = require("../models/Level");
const Course = require("../models/course");
const UserLevelAccess = require("../models/UserLevelAccess");
const ManualPaymentRequest = require("../models/ManualPaymentRequest");

function formatCourseForView(course) {
  return {
    ...course.toObject(),
    image: course.featuredImage || "/images/event1.jpg",
    students: String(course.studentsCount ?? 0),
    rating: String(course.averageRating ?? 0),
  };
}

exports.getAcademyIndex = async (req, res) => {
  try {
    const academies = await Academy.find({ isPublished: true }).sort({ createdAt: 1 });
    res.render("academy/index", { academies });
  } catch (error) {
    console.error("Get academy index error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getAcademyHome = async (req, res) => {
  try {
    const academy = req.academy;

    const [levels, courses] = await Promise.all([
      Level.find({
        academy: academy._id,
        isPublished: true,
      }).sort({ order: 1, createdAt: 1 }),

      Course.find({
        academy: academy._id,
        isPublished: true,
      })
        .populate("level")
        .sort({ createdAt: -1 }),
    ]);

    const levelIds = levels.map((level) => level._id);

    let isEnrolledInAcademy = false;
    let unlockedLevelIds = new Set();
    let pendingLevelIds = new Set();

    if (res.locals.isAdmin) {
      isEnrolledInAcademy = true;
    } else if (req.session.userId) {
      const [enrollment, accesses, pendingRequests] = await Promise.all([
        AcademyEnrollment.findOne({
          user: req.session.userId,
          academy: academy._id,
          status: "active",
        }),

        UserLevelAccess.find({
          user: req.session.userId,
          status: "active",
          level: { $in: levelIds },
        }).select("level"),

        ManualPaymentRequest.find({
          user: req.session.userId,
          status: "pending",
          level: { $in: levelIds },
        }).select("level"),
      ]);

      isEnrolledInAcademy = !!enrollment;
      unlockedLevelIds = new Set(accesses.map((item) => String(item.level)));
      pendingLevelIds = new Set(pendingRequests.map((item) => String(item.level)));
    }

    const learningTracks = levels.map((level) => ({
      ...level.toObject(),
      courseCount: courses.filter(
        (course) => course.level && String(course.level._id) === String(level._id)
      ).length,
    }));

    const featuredCourses = courses.slice(0, 3).map((course) => {
      const formattedCourse = formatCourseForView(course);
      const levelId = course.level ? String(course.level._id) : null;
      const canUseAcademy = res.locals.isAdmin || isEnrolledInAcademy;

      return {
        ...formattedCourse,
        isUnlocked:
          canUseAcademy &&
          (!course.level ||
            res.locals.isAdmin ||
            (levelId ? unlockedLevelIds.has(levelId) : false)),
        hasPendingRequest:
          canUseAcademy && levelId ? pendingLevelIds.has(levelId) : false,
      };
    });

    res.render("academy/show", {
      academy,
      levelCount: levels.length,
      courseCount: courses.length,
      learningTracks,
      featuredCourses,
      isEnrolledInAcademy,
      authStatus: req.query.auth || "",
      joinStatus: req.query.join || "",
      joinedStatus: req.query.joined || "",
    });
  } catch (error) {
    console.error("Get academy home error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.postJoinAcademy = async (req, res) => {
  try {
    const academy = req.academy;

    if (!req.session.userId) {
      return res.redirect(`/academy/${academy.slug}?auth=required`);
    }

    if (res.locals.isAdmin) {
      return res.redirect(`/academy/${academy.slug}/courses`);
    }

    await AcademyEnrollment.findOneAndUpdate(
      {
        user: req.session.userId,
        academy: academy._id,
      },
      {
        status: "active",
        joinedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    res.redirect(`/academy/${academy.slug}/courses?joined=success`);
  } catch (error) {
    console.error("Join academy error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getAcademyCourses = async (req, res) => {
  try {
    const academy = req.academy;

    const levels = await Level.find({
      academy: academy._id,
      isPublished: true,
    }).sort({ order: 1, createdAt: 1 });

    const levelIds = levels.map((level) => level._id);

    const dbCourses = await Course.find({
      academy: academy._id,
      isPublished: true,
      level: { $in: levelIds },
    })
      .populate("level")
      .sort({ levelPosition: 1, createdAt: 1 });

    let unlockedLevelIds = new Set();
    let pendingLevelIds = new Set();

    if (req.session.userId) {
      const accesses = await UserLevelAccess.find({
        user: req.session.userId,
        status: "active",
        level: { $in: levelIds },
      }).select("level");

      unlockedLevelIds = new Set(accesses.map((item) => String(item.level)));

      const pendingRequests = await ManualPaymentRequest.find({
        user: req.session.userId,
        status: "pending",
        level: { $in: levelIds },
      }).select("level");

      pendingLevelIds = new Set(pendingRequests.map((item) => String(item.level)));
    }

    const groupedLevels = levels
      .map((level) => {
        const levelCourses = dbCourses
          .filter((course) => course.level && String(course.level._id) === String(level._id))
          .map(formatCourseForView);

        return {
          ...level.toObject(),
          isUnlocked: res.locals.isAdmin || unlockedLevelIds.has(String(level._id)),
          hasPendingRequest: pendingLevelIds.has(String(level._id)),
          courses: levelCourses,
        };
      })
      .filter((level) => level.courses.length);

    res.render("hub/courses", {
      academy,
      groupedLevels,
      payment: req.query.payment || "",
    });
  } catch (error) {
    console.error("Get academy courses error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getAcademyCourseDetails = async (req, res) => {
  try {
    const academy = req.academy;

    const dbCourse = await Course.findOne({
      academy: academy._id,
      slug: req.params.courseSlug,
      isPublished: true,
    }).populate("level");

    if (!dbCourse) {
      return res.status(404).render("404", { message: "Course not found" });
    }

    let hasAccess = false;

    if (!dbCourse.level) {
      hasAccess = true;
    } else if (res.locals.isAdmin) {
      hasAccess = true;
    } else if (req.session.userId) {
      const access = await UserLevelAccess.findOne({
        user: req.session.userId,
        level: dbCourse.level._id,
        status: "active",
      });

      hasAccess = !!access;
    }

    if (!hasAccess) {
      return res.redirect(`/academy/${academy.slug}/courses`);
    }

    const course = formatCourseForView(dbCourse);

    res.render("hub/course-details", {
      academy,
      course,
    });
  } catch (error) {
    console.error("Get academy course details error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};