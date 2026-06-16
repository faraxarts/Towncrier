const fs = require("fs");
const path = require("path");
const Course = require("../models/Course");
const Level = require("../models/Level");
const Academy = require("../models/Academy");
const { createCourseNotificationIfNeeded } = require("../services/notificationService");

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

function parseList(value) {
  if (!value) return [];
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseModules(value) {
  if (!value) return [];

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [titlePart, lessonsPart] = line.split("|").map((item) => item.trim());
      return {
        title: titlePart || "Untitled Module",
        lessons: Number(lessonsPart || 0),
      };
    });
}

function toPublicFileUrl(file, folder) {
  return `/uploads/courses/${folder}/${file.filename}`;
}

function mapUploadedFiles(filesArray = [], folder) {
  return filesArray.map((file) => ({
    originalName: file.originalname,
    fileUrl: toPublicFileUrl(file, folder),
  }));
}

function buildAdminRedirect(basePath, academyId = "") {
  return academyId ? `${basePath}?academy=${encodeURIComponent(academyId)}` : basePath;
}

async function removePublicFile(publicUrl) {
  try {
    if (!publicUrl) return;

    const cleanRelativePath = publicUrl.replace(/^\/+/, "");
    const absolutePath = path.join(__dirname, "..", "public", cleanRelativePath);

    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
    }
  } catch (error) {
    console.error("Course file delete error:", error.message);
  }
}

async function removeCourseFiles(course) {
  if (!course) return;

  await removePublicFile(course.featuredImage);

  if (Array.isArray(course.courseDocuments)) {
    for (const doc of course.courseDocuments) {
      await removePublicFile(doc.fileUrl);
    }
  }

  if (Array.isArray(course.courseAudios)) {
    for (const audio of course.courseAudios) {
      await removePublicFile(audio.fileUrl);
    }
  }

  if (course.assignmentDocument && course.assignmentDocument.fileUrl) {
    await removePublicFile(course.assignmentDocument.fileUrl);
  }
}

exports.getAllCourses = async (req, res) => {
  try {
    const selectedAcademy = req.query.academy?.trim() || "";
    const filter = {};

    if (selectedAcademy) {
      filter.academy = selectedAcademy;
    }

    const [academies, courses] = await Promise.all([
      Academy.find({ isPublished: true }).sort({ createdAt: 1 }),
      Course.find(filter)
        .populate("academy")
        .populate("level")
        .sort({ createdAt: -1 }),
    ]);

    res.render("admin/courses/index", {
      courses,
      academies,
      selectedAcademy,
    });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getNewCourseForm = async (req, res) => {
  try {
    const academies = await Academy.find({ isPublished: true }).sort({ createdAt: 1 });
    const levels = await Level.find({ isPublished: true })
      .populate("academy")
      .sort({ order: 1, createdAt: 1 });

    res.render("admin/courses/new", { academies, levels });
  } catch (error) {
    console.error("Get new course form error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const academyId = req.body.academy?.trim();
    const title = req.body.title?.trim();
    const description = req.body.description?.trim();

    if (!academyId || !title || !description) {
      return res.status(400).send("Academy, title, and description are required.");
    }

    const academy = await Academy.findById(academyId);
    if (!academy) {
      return res.status(400).send("Selected academy does not exist.");
    }

    let slug = req.body.slug?.trim() || slugify(title);
    const existingSlug = await Course.findOne({ slug });

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const levelId = req.body.level?.trim() || null;
    const levelPosition = Number(req.body.levelPosition || 1);

    if (levelId) {
      const levelExists = await Level.findOne({
        _id: levelId,
        academy: academyId,
      });

      if (!levelExists) {
        return res.status(400).send("Selected level does not belong to the selected academy.");
      }
    }

    const featuredImageFile = req.files?.featuredImage?.[0];
    const assignmentFile = req.files?.assignmentDocument?.[0];
    const documentFiles = req.files?.courseDocuments || [];
    const audioFiles = req.files?.courseAudios || [];

    const course = new Course({
      academy: academyId,
      title,
      slug,
      level: levelId,
      levelPosition,
      featuredImage: featuredImageFile
        ? toPublicFileUrl(featuredImageFile, "images")
        : "",
      description,
      overview: req.body.overview?.trim() || "",
      duration: req.body.duration?.trim() || "",
      lessons: req.body.lessons?.trim() || "",
      instructor: req.body.instructor?.trim() || "",
      price: req.body.price?.trim() || "",
      buttonText: req.body.buttonText?.trim() || "View Course",
      buttonClass: req.body.buttonClass?.trim() || "bg-[#4F46E5] hover:bg-indigo-700",
      courseDocuments: mapUploadedFiles(documentFiles, "documents"),
      courseAudios: mapUploadedFiles(audioFiles, "audios"),
      assignmentDocument: assignmentFile
        ? {
            originalName: assignmentFile.originalname,
            fileUrl: toPublicFileUrl(assignmentFile, "assignments"),
          }
        : {
            originalName: "",
            fileUrl: "",
          },
      whatYouWillLearn: parseList(req.body.whatYouWillLearn),
      modules: parseModules(req.body.modules),
      requirements: parseList(req.body.requirements),
      audience: parseList(req.body.audience),
      isPublished: req.body.isPublished === "on",
    });

    await course.save();

    if (course.isPublished) {
      await createCourseNotificationIfNeeded(course._id);
    }

    res.redirect(buildAdminRedirect("/admin/courses", academyId));
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getEditCourseForm = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).send("Course not found");
    }

    const academies = await Academy.find({ isPublished: true }).sort({ createdAt: 1 });
    const levels = await Level.find({ isPublished: true })
      .populate("academy")
      .sort({ order: 1, createdAt: 1 });

    res.render("admin/courses/edit", {
      course,
      academies,
      levels,
      selectedAcademy: req.query.academy?.trim() || "",
    });
  } catch (error) {
    console.error("Get edit course error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).send("Course not found");
    }

    const wasPublished = course.isPublished;

    const academyId = req.body.academy?.trim();
    const title = req.body.title?.trim();
    const description = req.body.description?.trim();
    const redirectAcademy = req.body.redirectAcademy?.trim() || academyId || "";

    if (!academyId || !title || !description) {
      return res.status(400).send("Academy, title, and description are required.");
    }

    const academy = await Academy.findById(academyId);
    if (!academy) {
      return res.status(400).send("Selected academy does not exist.");
    }

    let slug = req.body.slug?.trim() || slugify(title);
    const existingSlug = await Course.findOne({
      slug,
      _id: { $ne: course._id },
    });

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const levelId = req.body.level?.trim() || null;
    const levelPosition = Number(req.body.levelPosition || 1);

    if (levelId) {
      const levelExists = await Level.findOne({
        _id: levelId,
        academy: academyId,
      });

      if (!levelExists) {
        return res.status(400).send("Selected level does not belong to the selected academy.");
      }
    }

    const featuredImageFile = req.files?.featuredImage?.[0];
    const assignmentFile = req.files?.assignmentDocument?.[0];
    const documentFiles = req.files?.courseDocuments || [];
    const audioFiles = req.files?.courseAudios || [];

    course.academy = academyId;
    course.title = title;
    course.slug = slug;
    course.level = levelId;
    course.levelPosition = levelPosition;
    course.description = description;
    course.overview = req.body.overview?.trim() || "";
    course.duration = req.body.duration?.trim() || "";
    course.lessons = req.body.lessons?.trim() || "";
    course.instructor = req.body.instructor?.trim() || "";
    course.price = req.body.price?.trim() || "";
    course.buttonText = req.body.buttonText?.trim() || "View Course";
    course.buttonClass = req.body.buttonClass?.trim() || "bg-[#4F46E5] hover:bg-indigo-700";
    course.whatYouWillLearn = parseList(req.body.whatYouWillLearn);
    course.modules = parseModules(req.body.modules);
    course.requirements = parseList(req.body.requirements);
    course.audience = parseList(req.body.audience);
    course.isPublished = req.body.isPublished === "on";

    if (featuredImageFile) {
      await removePublicFile(course.featuredImage);
      course.featuredImage = toPublicFileUrl(featuredImageFile, "images");
    }

    if (documentFiles.length) {
      course.courseDocuments = [
        ...course.courseDocuments,
        ...mapUploadedFiles(documentFiles, "documents"),
      ];
    }

    if (audioFiles.length) {
      course.courseAudios = [
        ...course.courseAudios,
        ...mapUploadedFiles(audioFiles, "audios"),
      ];
    }

    if (assignmentFile) {
      if (course.assignmentDocument && course.assignmentDocument.fileUrl) {
        await removePublicFile(course.assignmentDocument.fileUrl);
      }

      course.assignmentDocument = {
        originalName: assignmentFile.originalname,
        fileUrl: toPublicFileUrl(assignmentFile, "assignments"),
      };
    }

    await course.save();

    if (!wasPublished && course.isPublished) {
      await createCourseNotificationIfNeeded(course._id);
    }

    res.redirect(buildAdminRedirect("/admin/courses", redirectAcademy));
  } catch (error) {
    console.error("Update course error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const redirectAcademy = req.body.redirectAcademy?.trim() || "";
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).send("Course not found");
    }

    await removeCourseFiles(course);
    await Course.findByIdAndDelete(req.params.id);

    res.redirect(buildAdminRedirect("/admin/courses", redirectAcademy));
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.togglePublishCourse = async (req, res) => {
  try {
    const redirectAcademy = req.body.redirectAcademy?.trim() || "";
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).send("Course not found");
    }

    course.isPublished = !course.isPublished;
    await course.save();

    if (course.isPublished) {
      await createCourseNotificationIfNeeded(course._id);
    }

    res.redirect(buildAdminRedirect("/admin/courses", redirectAcademy));
  } catch (error) {
    console.error("Toggle publish error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};