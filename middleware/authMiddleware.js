function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  return res.status(401).json({ message: "Unauthorized. Please login." });
}

function requireAuthPage(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  return res.redirect("/hub");
}

module.exports = { isAuthenticated, requireAuthPage };