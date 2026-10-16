require("dotenv").config();

const mongoose =
  require("mongoose");

const path =
  require("path");

const Academy =
  require("../models/Academy");

const Course =
  require("../models/course");

const CourseResource =
  require("../models/CourseResource");


/* =========================================================
   COMMAND-LINE OPTIONS
   ========================================================= */

const args =
  process.argv.slice(2);


function getArgValue(
  name,
  fallback = ""
) {
  const prefix =
    `--${name}=`;

  const item =
    args.find(
      (arg) =>
        arg.startsWith(
          prefix
        )
    );

  if (!item) {
    return fallback;
  }

  return item.slice(
    prefix.length
  );
}


const APPLY =
  args.includes(
    "--apply"
  );


const ACADEMY_SLUG =
  getArgValue(
    "academy",
    "dbw-hub"
  );


const COURSE_SLUG =
  getArgValue(
    "course",
    ""
  );


/* =========================================================
   HELPERS
   ========================================================= */

function cleanFileName(
  fileName = ""
) {
  if (!fileName) {
    return "";
  }

  const extension =
    path.extname(
      fileName
    );

  return path
    .basename(
      fileName,
      extension
    )
    .replace(
      /[-_]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function getExtension(
  fileName = ""
) {
  return path
    .extname(
      fileName
    )
    .replace(
      ".",
      ""
    )
    .toLowerCase();
}


function isPdf(
  fileName = ""
) {
  return (
    getExtension(
      fileName
    ) === "pdf"
  );
}


function getCourseStatus(
  course
) {
  if (
    course.status ===
      "archived"
  ) {
    return "archived";
  }

  if (
    course.status ===
      "draft"
  ) {
    return "draft";
  }

  if (
    course.status ===
      "published"
  ) {
    return "published";
  }

  return course.isPublished
    ? "published"
    : "draft";
}


/* =========================================================
   CREATE RESOURCE SAFELY

   legacyMigrationKey makes this idempotent.

   Running this script again will not duplicate
   already-created CourseResource records.
   ========================================================= */

async function createResourceIfMissing(
  data,
  stats
) {
  const existing =
    await CourseResource.findOne({
      legacyMigrationKey:
        data.legacyMigrationKey,
    });


  if (existing) {
    stats.skipped += 1;

    console.log(
      `   ↷ Already migrated: ${data.title}`
    );

    return existing;
  }


  if (!APPLY) {
    stats.wouldCreate += 1;

    console.log(
      `   ○ Would create: ${data.title}`
    );

    return null;
  }


  const resource =
    await CourseResource.create(
      data
    );


  stats.created += 1;


  console.log(
    `   ✅ Created: ${resource.title}`
  );


  return resource;
}


/* =========================================================
   MIGRATE ONE COURSE
   ========================================================= */

async function migrateCourse(
  course,
  stats
) {
  console.log("");
  console.log(
    `📘 ${course.title}`
  );

  console.log(
    `   slug: ${course.slug}`
  );


  let order = 1;


  const resourceStatus =
    getCourseStatus(
      course
    );


  /* =====================================================
     AUDIO FILES
     ===================================================== */

  const audios =
    Array.isArray(
      course.courseAudios
    )
      ? course.courseAudios
      : [];


  for (
    let index = 0;
    index < audios.length;
    index += 1
  ) {
    const audio =
      audios[index];


    if (
      !audio ||
      !audio.fileUrl
    ) {
      console.log(
        `   ⚠ Skipping empty audio ${index + 1}`
      );

      continue;
    }


    const title =
      audios.length === 1
        ? `${course.title} — Audio Teaching`
        : `${course.title} — Audio ${index + 1}`;


    await createResourceIfMissing(
      {
        course:
          course._id,

        type:
          "audio",

        title,

        description:
          "",

        order,

        required:
          true,

        status:
          resourceStatus,

        file: {
          originalName:
            audio.originalName ||
            "",

          fileUrl:
            audio.fileUrl,

          publicId:
            audio.publicId ||
            "",

          resourceType:
            audio.resourceType ||
            "video",

          mimeType:
            "",

          bytes:
            0,
        },

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

        legacyMigrationKey:
          `${course._id}:audio:${index}`,
      },

      stats
    );


    order += 1;
  }


  /* =====================================================
     DOCUMENT FILES
     ===================================================== */

  const documents =
    Array.isArray(
      course.courseDocuments
    )
      ? course.courseDocuments
      : [];


  for (
    let index = 0;
    index < documents.length;
    index += 1
  ) {
    const document =
      documents[index];


    if (
      !document ||
      !document.fileUrl
    ) {
      console.log(
        `   ⚠ Skipping empty document ${index + 1}`
      );

      continue;
    }


    const cleanedName =
      cleanFileName(
        document.originalName
      );


    const title =
      cleanedName ||
      (
        documents.length === 1
          ? `${course.title} — Study Material`
          : `${course.title} — Study Material ${index + 1}`
      );


    const pdf =
      isPdf(
        document.originalName
      );


    await createResourceIfMissing(
      {
        course:
          course._id,

        type:
          "document",

        title,

        description:
          "",

        order,

        required:
          true,

        status:
          resourceStatus,

        file: {
          originalName:
            document.originalName ||
            "",

          fileUrl:
            document.fileUrl,

          publicId:
            document.publicId ||
            "",

          resourceType:
            document.resourceType ||
            "",

          mimeType:
            "",

          bytes:
            0,
        },

        access: {
          /*
           * PDF can be offered through the future
           * online reader.
           *
           * DOC/DOCX remain download-only initially.
           */
          allowOnline:
            pdf,

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

        legacyMigrationKey:
          `${course._id}:document:${index}`,
      },

      stats
    );


    order += 1;
  }


  /* =====================================================
     ASSIGNMENT DOCUMENT
     ===================================================== */

  const assignment =
    course.assignmentDocument;


  if (
    assignment &&
    assignment.fileUrl
  ) {
    const title =
      `${course.title} — Assignment`;


    const pdf =
      isPdf(
        assignment.originalName
      );


    await createResourceIfMissing(
      {
        course:
          course._id,

        type:
          "assignment",

        title,

        description:
          "",

        order,

        required:
          true,

        status:
          resourceStatus,

        file: {
          originalName:
            assignment.originalName ||
            "",

          fileUrl:
            assignment.fileUrl,

          publicId:
            assignment.publicId ||
            "",

          resourceType:
            assignment.resourceType ||
            "",

          mimeType:
            "",

          bytes:
            0,
        },

        access: {
          allowOnline:
            pdf,

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

        legacyMigrationKey:
          `${course._id}:assignment:0`,
      },

      stats
    );


    order += 1;
  }


  const totalLegacyResources =
    audios.filter(
      (item) =>
        item?.fileUrl
    ).length +
    documents.filter(
      (item) =>
        item?.fileUrl
    ).length +
    (
      assignment?.fileUrl
        ? 1
        : 0
    );


  if (
    totalLegacyResources === 0
  ) {
    console.log(
      "   ℹ No legacy learning materials found."
    );
  }


  stats.coursesProcessed += 1;
}


/* =========================================================
   MAIN
   ========================================================= */

async function run() {
  const stats = {
    coursesProcessed:
      0,

    wouldCreate:
      0,

    created:
      0,

    skipped:
      0,
  };


  try {
    if (
      !process.env.MONGO_URI
    ) {
      throw new Error(
        "MONGO_URI is missing from the environment."
      );
    }


    console.log("");
    console.log(
      "=============================================="
    );

    console.log(
      " DBW V2 LEGACY COURSE RESOURCE MIGRATION"
    );

    console.log(
      "=============================================="
    );

    console.log("");


    console.log(
      `Mode: ${
        APPLY
          ? "APPLY CHANGES"
          : "DRY RUN"
      }`
    );


    console.log(
      `Academy: ${ACADEMY_SLUG}`
    );


    if (
      COURSE_SLUG
    ) {
      console.log(
        `Course filter: ${COURSE_SLUG}`
      );
    }


    if (!APPLY) {
      console.log("");
      console.log(
        "ℹ No database changes will be made."
      );

      console.log(
        "  Add --apply when you are ready."
      );
    }


    console.log("");


    await mongoose.connect(
      process.env.MONGO_URI
    );


    console.log(
      "✅ MongoDB connected"
    );


    /* =====================================================
       FIND ACADEMY
       ===================================================== */

    const academy =
      await Academy.findOne({
        slug:
          ACADEMY_SLUG,
      });


    if (!academy) {
      throw new Error(
        `Academy "${ACADEMY_SLUG}" was not found.`
      );
    }


    /* =====================================================
       FIND COURSES
       ===================================================== */

    const courseFilter = {
      academy:
        academy._id,
    };


    if (
      COURSE_SLUG
    ) {
      courseFilter.slug =
        COURSE_SLUG;
    }


    const courses =
      await Course.find(
        courseFilter
      ).sort({
        levelPosition:
          1,

        createdAt:
          1,
      });


    if (
      courses.length === 0
    ) {
      console.log(
        "ℹ No matching Courses found."
      );

      return;
    }


    console.log(
      `📚 Courses found: ${courses.length}`
    );


    /* =====================================================
       MIGRATE
       ===================================================== */

    for (
      const course
      of courses
    ) {
      await migrateCourse(
        course,
        stats
      );
    }


    /* =====================================================
       SUMMARY
       ===================================================== */

    console.log("");
    console.log(
      "=============================================="
    );

    console.log(
      " MIGRATION SUMMARY"
    );

    console.log(
      "=============================================="
    );

    console.log(
      `Courses processed: ${stats.coursesProcessed}`
    );


    if (APPLY) {
      console.log(
        `Resources created: ${stats.created}`
      );
    } else {
      console.log(
        `Resources that would be created: ${stats.wouldCreate}`
      );
    }


    console.log(
      `Already migrated / skipped: ${stats.skipped}`
    );


    console.log("");


    if (APPLY) {
      console.log(
        "✅ Migration completed."
      );

      console.log(
        "ℹ Course contentMode has NOT been changed."
      );

      console.log(
        "  The live site is still using legacy Course fields."
      );
    } else {
      console.log(
        "✅ Dry run completed."
      );

      console.log(
        "ℹ Review the output before running with --apply."
      );
    }
  } catch (error) {
    console.error("");
    console.error(
      "❌ Migration error:",
      error
    );

    process.exitCode = 1;
  } finally {
    await mongoose
      .disconnect()
      .catch(
        () => {}
      );
  }
}


run();