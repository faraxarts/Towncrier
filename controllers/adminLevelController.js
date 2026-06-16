const Level = require("../models/Level");
const Course = require("../models/Course");
const UserLevelAccess = require("../models/UserLevelAccess");
const Academy = require("../models/Academy");

function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");
}

function buildAdminRedirect(basePath, academyId = "") {
  return academyId ? `${basePath}?academy=${encodeURIComponent(academyId)}` : basePath;
}

function sanitizeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;

  const cleaned = String(value).replace(/[^\d.]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(amount, symbol) {
  if (!amount) return "";
  return `${symbol}${Number(amount).toLocaleString()}`;
}

function buildLevelPriceLabel(priceNaira, priceUsd) {
  const parts = [];

  if (priceNaira) {
    parts.push(formatCurrency(priceNaira, "₦"));
  }

  if (priceUsd) {
    parts.push(formatCurrency(priceUsd, "$"));
  }

  return parts.join(" / ");
}

exports.getAllLevels = async (req, res) => {
  try {
    const selectedAcademy = req.query.academy?.trim() || "";
    const filter = {};

    if (selectedAcademy) {
      filter.academy = selectedAcademy;
    }

    const [academies, levels] = await Promise.all([
      Academy.find({ isPublished: true }).sort({ createdAt: 1 }),
      Level.find(filter)
        .populate("academy")
        .sort({ order: 1, createdAt: 1 }),
    ]);

    res.render("admin/levels/index", {
      levels,
      academies,
      selectedAcademy,
    });
  } catch (error) {
    console.error("Get levels error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getNewLevelForm = async (req, res) => {
  try {
    const academies = await Academy.find({ isPublished: true }).sort({ createdAt: 1 });
    res.render("admin/levels/new", { academies });
  } catch (error) {
    console.error("Get new level form error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.createLevel = async (req, res) => {
  try {
    const academyId = req.body.academy?.trim();
    const title = req.body.title?.trim();

    if (!academyId || !title) {
      return res.status(400).send("Academy and level title are required.");
    }

    const academy = await Academy.findById(academyId);
    if (!academy) {
      return res.status(400).send("Selected academy does not exist.");
    }

    let slug = req.body.slug?.trim() || slugify(title);
    const existingSlug = await Level.findOne({ slug });

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const priceNaira = sanitizeNumber(req.body.priceNaira, 15000);
    const priceUsd = sanitizeNumber(req.body.priceUsd, 0);
    const price = buildLevelPriceLabel(priceNaira, priceUsd);

    const level = new Level({
      academy: academyId,
      title,
      slug,
      description: req.body.description?.trim() || "",
      price,
      priceNaira,
      priceUsd,
      order: Number(req.body.order || 1),
      isPublished: req.body.isPublished === "on",
    });

    await level.save();
    res.redirect(buildAdminRedirect("/admin/levels", academyId));
  } catch (error) {
    console.error("Create level error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getEditLevelForm = async (req, res) => {
  try {
    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).send("Level not found");
    }

    const academies = await Academy.find({ isPublished: true }).sort({ createdAt: 1 });

    res.render("admin/levels/edit", {
      level,
      academies,
      selectedAcademy: req.query.academy?.trim() || "",
    });
  } catch (error) {
    console.error("Get edit level error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.updateLevel = async (req, res) => {
  try {
    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).send("Level not found");
    }

    const academyId = req.body.academy?.trim();
    const title = req.body.title?.trim();
    const redirectAcademy = req.body.redirectAcademy?.trim() || academyId || "";

    if (!academyId || !title) {
      return res.status(400).send("Academy and level title are required.");
    }

    const academy = await Academy.findById(academyId);
    if (!academy) {
      return res.status(400).send("Selected academy does not exist.");
    }

    let slug = req.body.slug?.trim() || slugify(title);
    const existingSlug = await Level.findOne({
      slug,
      _id: { $ne: level._id },
    });

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const priceNaira = sanitizeNumber(req.body.priceNaira, 15000);
    const priceUsd = sanitizeNumber(req.body.priceUsd, 0);
    const price = buildLevelPriceLabel(priceNaira, priceUsd);

    level.academy = academyId;
    level.title = title;
    level.slug = slug;
    level.description = req.body.description?.trim() || "";
    level.price = price;
    level.priceNaira = priceNaira;
    level.priceUsd = priceUsd;
    level.order = Number(req.body.order || 1);
    level.isPublished = req.body.isPublished === "on";

    await level.save();

    await Course.updateMany(
      { level: level._id },
      { $set: { academy: academyId } }
    );

    res.redirect(buildAdminRedirect("/admin/levels", redirectAcademy));
  } catch (error) {
    console.error("Update level error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.deleteLevel = async (req, res) => {
  try {
    const redirectAcademy = req.body.redirectAcademy?.trim() || "";
    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).send("Level not found");
    }

    await Course.updateMany(
      { level: level._id },
      { $set: { level: null, levelPosition: 1 } }
    );

    await UserLevelAccess.deleteMany({ level: level._id });
    await Level.findByIdAndDelete(level._id);

    res.redirect(buildAdminRedirect("/admin/levels", redirectAcademy));
  } catch (error) {
    console.error("Delete level error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.togglePublishLevel = async (req, res) => {
  try {
    const redirectAcademy = req.body.redirectAcademy?.trim() || "";
    const level = await Level.findById(req.params.id);

    if (!level) {
      return res.status(404).send("Level not found");
    }

    level.isPublished = !level.isPublished;
    await level.save();

    res.redirect(buildAdminRedirect("/admin/levels", redirectAcademy));
  } catch (error) {
    console.error("Toggle publish level error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};