const fs = require("fs");
const path = require("path");

const Event = require("../models/Event");

const {
  uploadBuffer,
  deleteAsset,
} = require("../services/cloudinaryService");

const {
  createEventNotificationIfNeeded,
} = require("../services/notificationService");


/* =========================================================
   SLUG
   ========================================================= */

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


/* =========================================================
   CLOUDINARY EVENT IMAGE UPLOAD
   ========================================================= */

async function uploadEventImage(file) {
  if (!file) {
    return null;
  }

  return uploadBuffer(file.buffer, {
    folder: "tcem/events/images",
    resourceType: "image",
    originalFilename: file.originalname,
  });
}


/* =========================================================
   LEGACY LOCAL FILE CLEANUP
   =========================================================
   This is only for old /uploads/... database records.

   New Event images are never written locally.
   ========================================================= */

async function removeLegacyPublicFile(publicUrl) {
  try {
    if (!publicUrl) {
      return;
    }

    /*
     * Do not treat external Cloudinary / HTTPS URLs
     * as local files.
     */
    if (
      /^https?:\/\//i.test(publicUrl)
    ) {
      return;
    }

    const cleanRelativePath =
      publicUrl.replace(/^\/+/, "");

    const absolutePath =
      path.join(
        __dirname,
        "..",
        "public",
        cleanRelativePath
      );

    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(
        absolutePath
      );
    }
  } catch (error) {
    console.error(
      "Legacy Event file delete error:",
      error.message
    );
  }
}


/* =========================================================
   REMOVE STORED EVENT IMAGE
   ========================================================= */

async function removeStoredEventImage(event) {
  if (!event) {
    return;
  }

  /*
   * New Cloudinary image.
   */
  if (event.featuredImagePublicId) {
    try {
      await deleteAsset(
        event.featuredImagePublicId,
        "image"
      );
    } catch (error) {
      console.error(
        "Cloudinary Event image delete error:",
        error.message
      );
    }

    return;
  }

  /*
   * Old Render/local filesystem image.
   */
  if (event.featuredImage) {
    await removeLegacyPublicFile(
      event.featuredImage
    );
  }
}


/* =========================================================
   ALL EVENTS
   ========================================================= */

exports.getAllEvents = async (
  req,
  res
) => {
  try {
    const events =
      await Event.find()
        .sort({
          createdAt: -1,
        });

    res.render(
      "admin/events/index",
      {
        events,
      }
    );
  } catch (error) {
    console.error(
      "Get events error:",
      error
    );

    res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   NEW EVENT FORM
   ========================================================= */

exports.getNewEventForm = (
  req,
  res
) => {
  res.render(
    "admin/events/new"
  );
};


/* =========================================================
   CREATE EVENT
   ========================================================= */

exports.createEvent = async (
  req,
  res
) => {
  let uploadedImage = null;

  try {
    const title =
      req.body.title?.trim();

    const shortDescription =
      req.body.shortDescription?.trim();

    if (
      !title ||
      !shortDescription
    ) {
      return res
        .status(400)
        .send(
          "Title and short description are required."
        );
    }


    /* -----------------------------------------
       SLUG
       ----------------------------------------- */

    let slug =
      req.body.slug?.trim() ||
      slugify(title);

    const existingSlug =
      await Event.findOne({
        slug,
      });

    if (existingSlug) {
      slug =
        `${slug}-${Date.now()}`;
    }


    /* -----------------------------------------
       CLOUDINARY UPLOAD
       ----------------------------------------- */

    if (req.file) {
      uploadedImage =
        await uploadEventImage(
          req.file
        );
    }


    /* -----------------------------------------
       CREATE DATABASE RECORD
       ----------------------------------------- */

    const event =
      new Event({
        title,

        slug,

        featuredImage:
          uploadedImage
            ? uploadedImage.url
            : "",

        featuredImagePublicId:
          uploadedImage
            ? uploadedImage.publicId
            : "",

        shortDescription,

        fullDescription:
          req.body.fullDescription?.trim() ||
          "",

        eventDate:
          req.body.eventDate?.trim() ||
          "",

        eventTime:
          req.body.eventTime?.trim() ||
          "",

        location:
          req.body.location?.trim() ||
          "",

        category:
          req.body.category?.trim() ||
          "General Event",

        buttonText:
          req.body.buttonText?.trim() ||
          "Learn More",

        isPublished:
          req.body.isPublished ===
          "on",
      });


    await event.save();


    /* -----------------------------------------
       NOTIFICATION
       ----------------------------------------- */

    if (event.isPublished) {
      await createEventNotificationIfNeeded(
        event._id
      );
    }


    return res.redirect(
      "/admin/events"
    );
  } catch (error) {
    /*
     * If Cloudinary upload succeeded but MongoDB
     * creation failed, remove the newly uploaded
     * file so it doesn't become an orphan.
     */
    if (
      uploadedImage &&
      uploadedImage.publicId
    ) {
      try {
        await deleteAsset(
          uploadedImage.publicId,
          "image"
        );
      } catch (cleanupError) {
        console.error(
          "Create Event cleanup error:",
          cleanupError.message
        );
      }
    }


    console.error(
      "Create event error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   EDIT FORM
   ========================================================= */

exports.getEditEventForm = async (
  req,
  res
) => {
  try {
    const event =
      await Event.findById(
        req.params.id
      );

    if (!event) {
      return res
        .status(404)
        .send(
          "Event not found"
        );
    }


    return res.render(
      "admin/events/edit",
      {
        event,
      }
    );
  } catch (error) {
    console.error(
      "Get edit event error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   UPDATE EVENT
   ========================================================= */

exports.updateEvent = async (
  req,
  res
) => {
  let newUploadedImage = null;

  try {
    const event =
      await Event.findById(
        req.params.id
      );

    if (!event) {
      return res
        .status(404)
        .send(
          "Event not found"
        );
    }


    const wasPublished =
      event.isPublished;


    const title =
      req.body.title?.trim();

    const shortDescription =
      req.body.shortDescription?.trim();


    if (
      !title ||
      !shortDescription
    ) {
      return res
        .status(400)
        .send(
          "Title and short description are required."
        );
    }


    /* -----------------------------------------
       SLUG
       ----------------------------------------- */

    let slug =
      req.body.slug?.trim() ||
      slugify(title);

    const existingSlug =
      await Event.findOne({
        slug,

        _id: {
          $ne: event._id,
        },
      });


    if (existingSlug) {
      slug =
        `${slug}-${Date.now()}`;
    }


    /* -----------------------------------------
       PRESERVE OLD IMAGE DETAILS
       ----------------------------------------- */

    const oldImage = {
      url:
        event.featuredImage,

      publicId:
        event.featuredImagePublicId,
    };


    /* -----------------------------------------
       UPLOAD NEW IMAGE FIRST
       -----------------------------------------
       We don't delete the old image until the
       database successfully saves the new one.
       ----------------------------------------- */

    if (req.file) {
      newUploadedImage =
        await uploadEventImage(
          req.file
        );
    }


    /* -----------------------------------------
       UPDATE FIELDS
       ----------------------------------------- */

    event.title =
      title;

    event.slug =
      slug;

    event.shortDescription =
      shortDescription;

    event.fullDescription =
      req.body.fullDescription?.trim() ||
      "";

    event.eventDate =
      req.body.eventDate?.trim() ||
      "";

    event.eventTime =
      req.body.eventTime?.trim() ||
      "";

    event.location =
      req.body.location?.trim() ||
      "";

    event.category =
      req.body.category?.trim() ||
      "General Event";

    event.buttonText =
      req.body.buttonText?.trim() ||
      "Learn More";

    event.isPublished =
      req.body.isPublished ===
      "on";


    if (newUploadedImage) {
      event.featuredImage =
        newUploadedImage.url;

      event.featuredImagePublicId =
        newUploadedImage.publicId;
    }


    /* -----------------------------------------
       SAVE DATABASE FIRST
       ----------------------------------------- */

    await event.save();


    /* -----------------------------------------
       DELETE OLD IMAGE AFTER SUCCESSFUL SAVE
       ----------------------------------------- */

    if (newUploadedImage) {
      if (oldImage.publicId) {
        try {
          await deleteAsset(
            oldImage.publicId,
            "image"
          );
        } catch (deleteError) {
          console.error(
            "Old Cloudinary Event image cleanup error:",
            deleteError.message
          );
        }
      } else if (oldImage.url) {
        await removeLegacyPublicFile(
          oldImage.url
        );
      }
    }


    /* -----------------------------------------
       NOTIFICATION
       ----------------------------------------- */

    if (
      !wasPublished &&
      event.isPublished
    ) {
      await createEventNotificationIfNeeded(
        event._id
      );
    }


    return res.redirect(
      "/admin/events"
    );
  } catch (error) {
    /*
     * New upload happened, but database update
     * failed. Delete only the newly uploaded image.
     *
     * The old image remains untouched.
     */
    if (
      newUploadedImage &&
      newUploadedImage.publicId
    ) {
      try {
        await deleteAsset(
          newUploadedImage.publicId,
          "image"
        );
      } catch (cleanupError) {
        console.error(
          "Update Event cleanup error:",
          cleanupError.message
        );
      }
    }


    console.error(
      "Update event error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   DELETE EVENT
   ========================================================= */

exports.deleteEvent = async (
  req,
  res
) => {
  try {
    const event =
      await Event.findById(
        req.params.id
      );

    if (!event) {
      return res
        .status(404)
        .send(
          "Event not found"
        );
    }


    /*
     * Save image information before deleting
     * the MongoDB Event record.
     */
    const storedImage = {
      url:
        event.featuredImage,

      publicId:
        event.featuredImagePublicId,
    };


    /*
     * Database deletion first.
     *
     * If Cloudinary cleanup later fails,
     * the worst result is an orphaned cloud asset,
     * rather than an existing Event suddenly having
     * a broken image.
     */
    await Event.findByIdAndDelete(
      req.params.id
    );


    if (storedImage.publicId) {
      try {
        await deleteAsset(
          storedImage.publicId,
          "image"
        );
      } catch (deleteError) {
        console.error(
          "Deleted Event Cloudinary cleanup error:",
          deleteError.message
        );
      }
    } else if (storedImage.url) {
      await removeLegacyPublicFile(
        storedImage.url
      );
    }


    return res.redirect(
      "/admin/events"
    );
  } catch (error) {
    console.error(
      "Delete event error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};


/* =========================================================
   TOGGLE PUBLISH
   ========================================================= */

exports.togglePublishEvent = async (
  req,
  res
) => {
  try {
    const event =
      await Event.findById(
        req.params.id
      );

    if (!event) {
      return res
        .status(404)
        .send(
          "Event not found"
        );
    }


    event.isPublished =
      !event.isPublished;


    await event.save();


    
    if (event.isPublished) {
      await createEventNotificationIfNeeded(
        event._id
      );
    }


    return res.redirect(
      "/admin/events"
    );
  } catch (error) {
    console.error(
      "Toggle publish event error:",
      error
    );


    return res.status(500).render(
      "500",
      {
        pageTitle:
          "Server Error",

        message:
          "Something unexpected happened while processing that request. Please try again shortly.",
      }
    );
  }
};