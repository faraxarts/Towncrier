const User = require("../models/user");

/**
 * Restricts every Davidic Harp route to administrators.
 *
 * This is registered as an Express router parameter middleware,
 * so academySlug is supplied as the fourth argument.
 */
async function restrictDavidicHarpAccess(
  req,
  res,
  next,
  academySlug
) {
  const normalizedSlug = String(academySlug || "")
    .trim()
    .toLowerCase();

  // Other academies continue normally.
  if (normalizedSlug !== "davidic-harp") {
    return next();
  }

  try {
    const userId = req.session?.userId;

    // Anonymous visitors return to the Academy page.
    if (!userId) {
      return res.redirect(
        303,
        "/academy#davidic-harp-coming-soon"
      );
    }

    const user = await User.findById(userId)
      .select("role")
      .lean();

    // Only administrators may continue.
    if (user && user.role === "admin") {
      req.user = req.user || user;
      return next();
    }

    return res.redirect(
      303,
      "/academy#davidic-harp-coming-soon"
    );
  } catch (error) {
    console.error(
      "Davidic Harp access middleware error:",
      error
    );

    return next(error);
  }
}

module.exports = {
  restrictDavidicHarpAccess,
};