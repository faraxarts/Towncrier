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

const {
  restrictDavidicHarpAccess,
} = require("../middleware/davidicHarpAccessMiddleware");

const router = express.Router();

/*
 * Run the Davidic Harp restriction for every route
 * in this router containing :academySlug.
 */
router.param(
  "academySlug",
  restrictDavidicHarpAccess
);

/*
 * Public Academy listing page.
 */
router.get("/", getAcademyIndex);

/*
 * Individual course details.
 */
router.get(
  "/:academySlug/courses/:courseSlug",
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
  getAcademyCourseDetails
);

/*
 * Academy course listing.
 */
router.get(
  "/:academySlug/courses",
  loadAcademyBySlug,
  requireAcademyEnrollmentPage,
  getAcademyCourses
);

/*
 * Join an academy.
 */
router.post(
  "/:academySlug/join",
  loadAcademyBySlug,
  postJoinAcademy
);

/*
 * Academy landing page.
 */
router.get(
  "/:academySlug",
  loadAcademyBySlug,
  getAcademyHome
);

module.exports = router;