const express = require("express");
const {
  getAcademyIndex,
  getAcademyHome,
  postJoinAcademy,
  getAcademyCourses,
  getAcademyCourseDetails,
} = require("../controllers/academyController");

const {
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
} = require("../middleware/academyEnrollmentMiddleware");

const router = express.Router();

router.get("/", getAcademyIndex);

router.get(
  "/:academySlug/courses/:courseSlug",
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
  getAcademyCourseDetails
);

router.get(
  "/:academySlug/courses",
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
  getAcademyCourses
);

router.post("/:academySlug/join", loadAcademyBySlug, postJoinAcademy);

router.get("/:academySlug", loadAcademyBySlug, getAcademyHome);

module.exports = router;