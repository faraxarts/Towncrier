const Academy = require("../models/Academy");
const AcademyEnrollment = require("../models/AcademyEnrollment");

async function loadAcademyBySlug(req, res, next) {
  try {
    const academy = await Academy.findOne({
      slug: req.params.academySlug,
      isPublished: true,
    });

    if (!academy) {
      return res.status(404).render("404", { message: "Academy not found" });
    }

    req.academy = academy;
    res.locals.currentAcademy = academy;
    next();
  } catch (error) {
    console.error("Load academy error:", error);
    res.status(500).send("Server error");
  }
}

async function requireAcademyEnrollmentPage(req, res, next) {
  try {
    const academy =
      req.academy ||
      (await Academy.findOne({
        slug: req.params.academySlug,
        isPublished: true,
      }));

    if (!academy) {
      return res.status(404).render("404", { message: "Academy not found" });
    }

    if (res.locals.isAdmin) {
      return next();
    }

    if (!req.session.userId) {
      return res.redirect(`/academy/${academy.slug}?auth=required`);
    }

    const enrollment = await AcademyEnrollment.findOne({
      user: req.session.userId,
      academy: academy._id,
      status: "active",
    });

    if (!enrollment) {
      return res.redirect(`/academy/${academy.slug}?join=required`);
    }

    req.academyEnrollment = enrollment;
    next();
  } catch (error) {
    console.error("Academy enrollment middleware error:", error);
    res.status(500).send("Server error");
  }
}

module.exports = {
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
};