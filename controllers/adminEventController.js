const fs = require("fs");
const path = require("path");
const Event = require("../models/Event");
const { createEventNotificationIfNeeded } = require("../services/notificationService");

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

function toPublicImageUrl(file) {
  return `/uploads/events/images/${file.filename}`;
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
    console.error("File delete error:", error.message);
  }
}

exports.getAllEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.render("admin/events/index", { events });
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getNewEventForm = (req, res) => {
  res.render("admin/events/new");
};

exports.createEvent = async (req, res) => {
  try {
    const title = req.body.title?.trim();
    const shortDescription = req.body.shortDescription?.trim();

    if (!title || !shortDescription) {
      return res.status(400).send("Title and short description are required.");
    }

    let slug = req.body.slug?.trim() || slugify(title);
    const existingSlug = await Event.findOne({ slug });

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const featuredImageFile = req.file;

    const event = new Event({
      title,
      slug,
      featuredImage: featuredImageFile ? toPublicImageUrl(featuredImageFile) : "",
      shortDescription,
      fullDescription: req.body.fullDescription?.trim() || "",
      eventDate: req.body.eventDate?.trim() || "",
      eventTime: req.body.eventTime?.trim() || "",
      location: req.body.location?.trim() || "",
      category: req.body.category?.trim() || "General Event",
      buttonText: req.body.buttonText?.trim() || "Learn More",
      isPublished: req.body.isPublished === "on",
    });

    await event.save();

    if (event.isPublished) {
      await createEventNotificationIfNeeded(event._id);
    }

    res.redirect("/admin/events");
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getEditEventForm = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).send("Event not found");
    }

    res.render("admin/events/edit", { event });
  } catch (error) {
    console.error("Get edit event error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).send("Event not found");
    }

    const wasPublished = event.isPublished;

    const title = req.body.title?.trim();
    const shortDescription = req.body.shortDescription?.trim();

    if (!title || !shortDescription) {
      return res.status(400).send("Title and short description are required.");
    }

    let slug = req.body.slug?.trim() || slugify(title);
    const existingSlug = await Event.findOne({
      slug,
      _id: { $ne: event._id },
    });

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    event.title = title;
    event.slug = slug;
    event.shortDescription = shortDescription;
    event.fullDescription = req.body.fullDescription?.trim() || "";
    event.eventDate = req.body.eventDate?.trim() || "";
    event.eventTime = req.body.eventTime?.trim() || "";
    event.location = req.body.location?.trim() || "";
    event.category = req.body.category?.trim() || "General Event";
    event.buttonText = req.body.buttonText?.trim() || "Learn More";
    event.isPublished = req.body.isPublished === "on";

    if (req.file) {
      await removePublicFile(event.featuredImage);
      event.featuredImage = toPublicImageUrl(req.file);
    }

    await event.save();

    if (!wasPublished && event.isPublished) {
      await createEventNotificationIfNeeded(event._id);
    }

    res.redirect("/admin/events");
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).send("Event not found");
    }

    await removePublicFile(event.featuredImage);
    await Event.findByIdAndDelete(req.params.id);

    res.redirect("/admin/events");
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.togglePublishEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).send("Event not found");
    }

    event.isPublished = !event.isPublished;
    await event.save();

    if (event.isPublished) {
      await createEventNotificationIfNeeded(event._id);
    }

    res.redirect("/admin/events");
  } catch (error) {
    console.error("Toggle publish event error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};