const Course =
  require("../models/course");

const CourseResource =
  require("../models/CourseResource");

const Academy =
  require("../models/Academy");

const Level =
  require("../models/Level");

const {
  uploadBuffer,
  deleteAsset,
} =
  require("../services/cloudinaryService");

const {
  createCourseNotificationIfNeeded,
} =
  require("../services/notificationService");


/* =========================================================
   HELPERS
   ========================================================= */

function slugify(text = "") {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");
}


function parseList(value = "") {
  return value
    .split("\n")
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);
}


async function createUniqueSlug(
  value,
  excludeCourseId = null
) {
  let base =
    slugify(value);


  if (!base) {
    base =
      `course-${Date.now()}`;
  }


  let slug =
    base;


  let counter =
    1;


  while (true) {
    const filter = {
      slug,
    };


    if (excludeCourseId) {
      filter._id = {
        $ne:
          excludeCourseId,
      };
    }


    const exists =
      await Course.exists(
        filter
      );


    if (!exists) {
      return slug;
    }


    counter += 1;


    slug =
      `${base}-${counter}`;
  }
}


async function getAcademiesAndLevels() {
  const [
    academies,
    levels,
  ] =
    await Promise.all([
      Academy.find({
        isPublished: true,
      }).sort({
        createdAt: 1,
      }),

      Level.find({
        isPublished: true,
      })
        .populate(
          "academy"
        )
        .sort({
          order: 1,
          createdAt: 1,
        }),
    ]);


  return {
    academies,
    levels,
  };
}


async function verifyLevel(
  academyId,
  levelId
) {
  if (
    !academyId ||
    !levelId
  ) {
    return null;
  }


  return Level.findOne({
    _id:
      levelId,

    academy:
      academyId,

    isPublished:
      true,
  });
}


async function uploadFeaturedImage(
  file
) {
  if (!file) {
    return null;
  }


  return uploadBuffer(
    file.buffer,
    {
      folder:
        "tcem/courses/images",

      resourceType:
        "image",

      originalFilename:
        file.originalname,
    }
  );
}


async function removeAsset(
  publicId,
  resourceType = "image"
) {
  if (!publicId) {
    return;
  }


  try {
    await deleteAsset(
      publicId,
      {
        resource_type:
          resourceType,
      }
    );
  } catch (error) {
    /*
     * Compatibility with the current service signature.
     */
    try {
      await deleteAsset(
        publicId,
        resourceType
      );
    } catch (
      cleanupError
    ) {
      console.error(
        "Course Builder Cloudinary cleanup error:",
        cleanupError
      );
    }
  }
}


/* =========================================================
   COURSE TEMPLATES
   ========================================================= */

function getTemplateResources(
  template,
  courseTitle
) {
  const audio = {
    type:
      "audio",

    title:
      `${courseTitle} — Audio Teaching`,

    description:
      "",

    required:
      true,

    status:
      "draft",

    access: {
      allowOnline:
        true,

      allowDownload:
        true,

      openInNewTab:
        false,
    },

    completion: {
      method:
        "audio_percentage",

      threshold:
        80,
    },
  };


  const document = {
    type:
      "document",

    title:
      `${courseTitle} — Study Material`,

    description:
      "",

    required:
      true,

    status:
      "draft",

    access: {
      /*
       * We don't know whether the eventual file
       * will be PDF or DOCX yet.
       */
      allowOnline:
        false,

      allowDownload:
        true,

      openInNewTab:
        true,
    },

    completion: {
      method:
        "manual_confirmation",

      threshold:
        100,
    },
  };


  const assignment = {
    type:
      "assignment",

    title:
      `${courseTitle} — Assignment`,

    description:
      "",

    required:
      true,

    status:
      "draft",

    access: {
      allowOnline:
        false,

      allowDownload:
        true,

      openInNewTab:
        true,
    },

    completion: {
      method:
        "assignment_accepted",

      threshold:
        100,
    },

    assignmentSettings: {
      submissionRequired:
        true,

      acceptedFormats: [
        "pdf",
        "doc",
        "docx",
      ],
    },
  };


  switch (template) {
    case "audio-document":
      return [
        audio,
        document,
      ];


    case "audio-document-assignment":
      return [
        audio,
        document,
        assignment,
      ];


    case "audio-only":
      return [
        audio,
      ];


    case "document-only":
      return [
        document,
      ];


    default:
      return [];
  }
}


async function createTemplateResources(
  course,
  template
) {
  const resources =
    getTemplateResources(
      template,
      course.title
    );


  if (!resources.length) {
    return;
  }


  await CourseResource.insertMany(
    resources.map(
      (
        resource,
        index
      ) => ({
        ...resource,

        course:
          course._id,

        order:
          index + 1,

        createdBy:
          null,
      })
    )
  );
}


/* =========================================================
   START PAGE
   ========================================================= */

exports.getBuilderStartForm =
  async (
    req,
    res
  ) => {
    try {
      const {
        academies,
        levels,
      } =
        await getAcademiesAndLevels();


      return res.render(
        "admin/courses/builder-start",
        {
          academies,
          levels,
        }
      );
    } catch (error) {
      console.error(
        "Get Course Builder start error:",
        error
      );


      return res
        .status(500)
        .render(
          "500",
          {
            pageTitle:
              "Server Error",

            message:
              "Unable to open the Course Builder.",
          }
        );
    }
  };


/* =========================================================
   CREATE PERSISTENT DRAFT
   ========================================================= */

exports.startBuilder =
  async (
    req,
    res
  ) => {
    let uploadedImage =
      null;


    try {
      const academyId =
        req.body
          .academy
          ?.trim();


      const levelId =
        req.body
          .level
          ?.trim();


      const title =
        req.body
          .title
          ?.trim();


      const description =
        req.body
          .description
          ?.trim();


      if (
        !academyId ||
        !levelId ||
        !title ||
        !description
      ) {
        return res
          .status(400)
          .send(
            "Academy, Level, Course title, and description are required."
          );
      }


      const academy =
        await Academy.findById(
          academyId
        );


      if (!academy) {
        return res
          .status(400)
          .send(
            "Selected Academy does not exist."
          );
      }


      const level =
        await verifyLevel(
          academyId,
          levelId
        );


      if (!level) {
        return res
          .status(400)
          .send(
            "Selected Level does not belong to this Academy."
          );
      }


      const slug =
        await createUniqueSlug(
          req.body.slug?.trim() ||
          title
        );


      if (req.file) {
        uploadedImage =
          await uploadFeaturedImage(
            req.file
          );
      }


      const course =
        await Course.create({
          academy:
            academyId,

          level:
            levelId,

          levelPosition:
            Number(
              req.body
                .levelPosition ||
              1
            ),

          title,

          slug,

          description,

          overview:
            req.body
              .overview
              ?.trim() ||
            "",

          instructor:
            req.body
              .instructor
              ?.trim() ||
            "",

          duration:
            req.body
              .duration
              ?.trim() ||
            "",

          whatYouWillLearn:
            parseList(
              req.body
                .whatYouWillLearn ||
              ""
            ),

          featuredImage:
            uploadedImage
              ?.url ||
            "",

          featuredImagePublicId:
            uploadedImage
              ?.publicId ||
            "",

          featuredImageResourceType:
            uploadedImage
              ?.resourceType ||
            "",

          /*
           * DBW V2
           */
          contentMode:
            "resources",

          status:
            "draft",

          isPublished:
            false,

          completionRule:
            "all_required_resources",

          accessRule:
            "level_access",

          nextCourseMode:
            "auto",

          nextCourse:
            null,
        });


      await createTemplateResources(
        course,
        req.body.template ||
        "blank"
      );


      return res.redirect(
        `/admin/courses/${course._id}/builder/2`
      );
    } catch (error) {

      if (
        uploadedImage
          ?.publicId
      ) {
        await removeAsset(
          uploadedImage.publicId,
          uploadedImage.resourceType
        );
      }


      console.error(
        "Start Course Builder error:",
        error
      );


      return res
        .status(500)
        .render(
          "500",
          {
            pageTitle:
              "Server Error",

            message:
              "Unable to create the Course draft.",
          }
        );
    }
  };


/* =========================================================
   BUILDER PAGE
   ========================================================= */

exports.getBuilder =
  async (
    req,
    res
  ) => {
    try {
      const step =
        Math.max(
          1,
          Math.min(
            4,
            Number(
              req.params.step ||
              1
            )
          )
        );


      const course =
        await Course.findById(
          req.params.id
        )
          .populate(
            "academy"
          )
          .populate(
            "level"
          )
          .populate(
            "nextCourse",
            "title slug"
          );


      if (!course) {
        return res
          .status(404)
          .send(
            "Course not found."
          );
      }


      if (
        course.contentMode !==
        "resources"
      ) {
        return res.redirect(
          `/admin/courses/${course._id}/edit`
        );
      }


      const [
        referenceData,
        resources,
      ] =
        await Promise.all([
          getAcademiesAndLevels(),

          CourseResource.find({
            course:
              course._id,
          }).sort({
            order: 1,
            createdAt: 1,
          }),
        ]);


      let nextCourseOptions =
        [];


      if (course.level) {
        nextCourseOptions =
          await Course.find({
            _id: {
              $ne:
                course._id,
            },

            academy:
              course.academy
                ?._id,

            level:
              course.level
                ?._id,
          })
            .select(
              "title slug levelPosition"
            )
            .sort({
              levelPosition: 1,
            });
      }


      return res.render(
        "admin/courses/builder",
        {
          course,
          resources,

          academies:
            referenceData
              .academies,

          levels:
            referenceData
              .levels,

          nextCourseOptions,

          step,

          error:
            req.query.error ||
            "",

          success:
            req.query.success ||
            "",
        }
      );
    } catch (error) {
      console.error(
        "Get Course Builder error:",
        error
      );


      return res
        .status(500)
        .render(
          "500",
          {
            pageTitle:
              "Server Error",

            message:
              "Unable to load the Course Builder.",
          }
        );
    }
  };


/* =========================================================
   STEP 1 — UPDATE DETAILS
   ========================================================= */

exports.updateBuilderDetails =
  async (
    req,
    res
  ) => {
    let newImage =
      null;


    try {
      const course =
        await Course.findById(
          req.params.id
        );


      if (
        !course ||
        course.contentMode !==
          "resources"
      ) {
        return res
          .status(404)
          .send(
            "DBW V2 Course not found."
          );
      }


      const academyId =
        req.body
          .academy
          ?.trim();


      const levelId =
        req.body
          .level
          ?.trim();


      const title =
        req.body
          .title
          ?.trim();


      const description =
        req.body
          .description
          ?.trim();


      if (
        !academyId ||
        !levelId ||
        !title ||
        !description
      ) {
        return res
          .status(400)
          .send(
            "Academy, Level, title, and description are required."
          );
      }


      const level =
        await verifyLevel(
          academyId,
          levelId
        );


      if (!level) {
        return res
          .status(400)
          .send(
            "Selected Level does not belong to this Academy."
          );
      }


      const slug =
        await createUniqueSlug(
          req.body.slug?.trim() ||
          title,

          course._id
        );


      const oldImage = {
        publicId:
          course
            .featuredImagePublicId,

        resourceType:
          course
            .featuredImageResourceType ||
          "image",
      };


      if (req.file) {
        newImage =
          await uploadFeaturedImage(
            req.file
          );


        course.featuredImage =
          newImage.url;


        course.featuredImagePublicId =
          newImage.publicId;


        course.featuredImageResourceType =
          newImage.resourceType;
      }


      course.academy =
        academyId;


      course.level =
        levelId;


      course.levelPosition =
        Number(
          req.body
            .levelPosition ||
          1
        );


      course.title =
        title;


      course.slug =
        slug;


      course.description =
        description;


      course.overview =
        req.body
          .overview
          ?.trim() ||
        "";


      course.instructor =
        req.body
          .instructor
          ?.trim() ||
        "";


      course.duration =
        req.body
          .duration
          ?.trim() ||
        "";


      course.whatYouWillLearn =
        parseList(
          req.body
            .whatYouWillLearn ||
          ""
        );


      await course.save();


      if (
        newImage &&
        oldImage.publicId &&
        oldImage.publicId !==
          newImage.publicId
      ) {
        await removeAsset(
          oldImage.publicId,
          oldImage.resourceType
        );
      }


      return res.redirect(
        `/admin/courses/${course._id}/builder/2?success=details-saved`
      );
    } catch (error) {

      if (
        newImage?.publicId
      ) {
        await removeAsset(
          newImage.publicId,
          newImage.resourceType
        );
      }


      console.error(
        "Update Course Builder details error:",
        error
      );


      return res
        .status(500)
        .send(
          "Unable to save Course details."
        );
    }
  };


/* =========================================================
   STEP 3 — COURSE RULES
   ========================================================= */

exports.updateBuilderRules =
  async (
    req,
    res
  ) => {
    try {
      const course =
        await Course.findById(
          req.params.id
        );


      if (
        !course ||
        course.contentMode !==
          "resources"
      ) {
        return res
          .status(404)
          .send(
            "DBW V2 Course not found."
          );
      }


      const completionRules =
        new Set([
          "all_required_resources",
          "admin_approval",
          "none",
        ]);


      const accessRules =
        new Set([
          "level_access",
          "previous_course_complete",
        ]);


      const nextModes =
        new Set([
          "auto",
          "manual",
          "none",
        ]);


      const completionRule =
        completionRules.has(
          req.body
            .completionRule
        )
          ? req.body
              .completionRule
          : "all_required_resources";


      const accessRule =
        accessRules.has(
          req.body
            .accessRule
        )
          ? req.body
              .accessRule
          : "level_access";


      const nextCourseMode =
        nextModes.has(
          req.body
            .nextCourseMode
        )
          ? req.body
              .nextCourseMode
          : "auto";


      let nextCourse =
        null;


      if (
        nextCourseMode ===
        "manual"
      ) {
        const nextCourseId =
          req.body
            .nextCourse
            ?.trim();


        if (nextCourseId) {
          const candidate =
            await Course.findOne({
              _id:
                nextCourseId,

              academy:
                course.academy,

              level:
                course.level,
            });


          if (!candidate) {
            return res
              .status(400)
              .send(
                "Selected next Course is invalid."
              );
          }


          nextCourse =
            candidate._id;
        }
      }


      course.completionRule =
        completionRule;


      course.accessRule =
        accessRule;


      course.nextCourseMode =
        nextCourseMode;


      course.nextCourse =
        nextCourse;


      await course.save();


      return res.redirect(
        `/admin/courses/${course._id}/builder/4?success=rules-saved`
      );
    } catch (error) {
      console.error(
        "Update Course Builder rules error:",
        error
      );


      return res
        .status(500)
        .send(
          "Unable to save Course rules."
        );
    }
  };


/* =========================================================
   PUBLICATION VALIDATION
   ========================================================= */

function validateResourceForPublish(
  resource
) {
  if (!resource.title?.trim()) {
    return "One Learning Material is missing a title.";
  }


  if (
    resource.required &&
    resource.completion?.method ===
      "none"
  ) {
    return (
      `"${resource.title}" is required but has no ` +
      "completion method."
    );
  }


  if (
    resource.type ===
      "audio" &&
    !resource.file?.fileUrl
  ) {
    return (
      `"${resource.title}" needs an audio file before publication.`
    );
  }


  if (
    resource.type ===
      "document" &&
    !resource.file?.fileUrl
  ) {
    return (
      `"${resource.title}" needs a document before publication.`
    );
  }


  if (
    resource.type ===
      "assignment" &&
    !resource.file?.fileUrl &&
    !resource.description?.trim()
  ) {
    return (
      `"${resource.title}" needs assignment instructions or an attached document.`
    );
  }


  if (
    resource.type ===
      "written" &&
    !resource.content?.trim()
  ) {
    return (
      `"${resource.title}" has no written content.`
    );
  }


  if (
    resource.type ===
      "external" &&
    !resource.externalUrl?.trim()
  ) {
    return (
      `"${resource.title}" needs an external URL.`
    );
  }


  return "";
}


async function validateCourseForPublish(
  course
) {
  if (
    !course.academy ||
    !course.level ||
    !course.title ||
    !course.description
  ) {
    return {
      valid:
        false,

      message:
        "Course details are incomplete.",
    };
  }


  const resources =
    await CourseResource.find({
      course:
        course._id,

      status: {
        $ne:
          "archived",
      },
    }).sort({
      order: 1,
    });


  if (!resources.length) {
    return {
      valid:
        false,

      message:
        "Add at least one Learning Material before publishing this Course.",
    };
  }


  for (
    const resource
    of resources
  ) {
    const error =
      validateResourceForPublish(
        resource
      );


    if (error) {
      return {
        valid:
          false,

        message:
          error,
      };
    }
  }


  return {
    valid:
      true,

    resources,
  };
}


/* =========================================================
   SAVE AS DRAFT
   ========================================================= */

exports.saveBuilderDraft =
  async (
    req,
    res
  ) => {
    try {
      const course =
        await Course.findById(
          req.params.id
        );


      if (
        !course ||
        course.contentMode !==
          "resources"
      ) {
        return res
          .status(404)
          .send(
            "Course not found."
          );
      }


      course.status =
        "draft";


      course.isPublished =
        false;


      await course.save();


      return res.redirect(
        "/admin/courses"
      );
    } catch (error) {
      console.error(
        "Save Course draft error:",
        error
      );


      return res
        .status(500)
        .send(
          "Unable to save the Course draft."
        );
    }
  };


/* =========================================================
   PUBLISH
   ========================================================= */

exports.publishBuilderCourse =
  async (
    req,
    res
  ) => {
    try {
      const course =
        await Course.findById(
          req.params.id
        );


      if (
        !course ||
        course.contentMode !==
          "resources"
      ) {
        return res
          .status(404)
          .send(
            "DBW V2 Course not found."
          );
      }


      const validation =
        await validateCourseForPublish(
          course
        );


      if (
        !validation.valid
      ) {
        return res.redirect(
          `/admin/courses/${course._id}/builder/4?error=${encodeURIComponent(
            validation.message
          )}`
        );
      }


      const wasPublished =
        course.isPublished;


      /*
       * Draft Learning Materials become published
       * together with the Course.
       */
      await CourseResource.updateMany(
        {
          course:
            course._id,

          status:
            "draft",
        },

        {
          $set: {
            status:
              "published",
          },
        }
      );


      course.status =
        "published";


      course.isPublished =
        true;


      await course.save();


      if (!wasPublished) {
        await createCourseNotificationIfNeeded(
          course._id
        );
      }


      return res.redirect(
        `/admin/courses?academy=${course.academy}`
      );
    } catch (error) {
      console.error(
        "Publish DBW V2 Course error:",
        error
      );


      return res
        .status(500)
        .send(
          "Unable to publish the Course."
        );
    }
  };