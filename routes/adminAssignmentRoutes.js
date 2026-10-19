const express =
  require("express");


const {
  getAllAssignmentSubmissions,
  reviewAssignmentSubmission,
} =
  require(
    "../controllers/adminAssignmentController"
  );


const {
  isAuthenticated,
} =
  require(
    "../middleware/authMiddleware"
  );


const {
  isAdmin,
} =
  require(
    "../middleware/adminMiddleware"
  );


const router =
  express.Router();


/* =========================================================
   SECURITY
   ========================================================= */

router.use(
  isAuthenticated,
  isAdmin
);


/* =========================================================
   ASSIGNMENT REVIEW
   ========================================================= */

router.get(
  "/",
  getAllAssignmentSubmissions
);


router.post(
  "/:id/review",
  reviewAssignmentSubmission
);


module.exports =
  router;