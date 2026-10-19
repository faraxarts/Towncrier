const Course =
  require("../models/course");

const CourseResource =
  require("../models/CourseResource");

const ResourceProgress =
  require("../models/ResourceProgress");

const CourseProgress =
  require("../models/CourseProgress");

const AcademyEvent =
  require("../models/AcademyEvent");


/* =========================================================
   SAFE ANALYTICS

   Analytics must never stop a learner's progress from
   being saved.
   ========================================================= */

async function logProgressEvent({
  userId,
  course,
  resource = null,
  eventType,
  metadata = {},
}) {
  try {
    if (
      !userId ||
      !course ||
      !course._id
    ) {
      return;
    }


    await AcademyEvent.create({
      user:
        userId,

      academy:
        course.academy?._id ||
        course.academy,

      level:
        course.level?._id ||
        course.level ||
        null,

      course:
        course._id,

      resource:
        resource?._id ||
        resource ||
        null,

      eventType,

      metadata,

      occurredAt:
        new Date(),
    });
  } catch (error) {
    console.error(
      "Progress analytics error:",
      error.message
    );
  }
}


/* =========================================================
   GET / CREATE RESOURCE PROGRESS
   ========================================================= */

async function getOrCreateResourceProgress({
  userId,
  courseId,
  resourceId,
}) {
  let progress =
    await ResourceProgress.findOne({
      user:
        userId,

      resource:
        resourceId,
    });


  if (!progress) {
    progress =
      await ResourceProgress.create({
        user:
          userId,

        course:
          courseId,

        resource:
          resourceId,

        status:
          "not_started",

        progressPercentage:
          0,
      });
  }


  return progress;
}


/* =========================================================
   RECALCULATE COURSE PROGRESS

   ResourceProgress is the detailed learner state.

   CourseProgress is the summary/cache used for the Course
   cards, progress bar and Resume Learning.
   ========================================================= */

async function recalculateCourseProgress(
  userId,
  courseId
) {
  const course =
    await Course.findById(
      courseId
    );


  if (!course) {
    return null;
  }


  /* =======================================================
     REQUIRED PUBLISHED MATERIALS
     ======================================================= */

  const requiredResources =
    await CourseResource.find({
      course:
        courseId,

      status:
        "published",

      required:
        true,
    })
      .select(
        "_id"
      )
      .lean();


  const requiredIds =
    requiredResources.map(
      (resource) =>
        resource._id
    );


  /* =======================================================
     COMPLETED REQUIRED MATERIALS
     ======================================================= */

  let completedCount =
    0;


  if (
    requiredIds.length
  ) {
    completedCount =
      await ResourceProgress.countDocuments({
        user:
          userId,

        resource: {
          $in:
            requiredIds,
        },

        status:
          "completed",
      });
  }


  const percentage =
    requiredIds.length
      ? Math.round(
          (
            completedCount /
            requiredIds.length
          ) *
            100
        )
      : 0;


  /* =======================================================
     EXISTING COURSE PROGRESS
     ======================================================= */

  let progress =
    await CourseProgress.findOne({
      user:
        userId,

      course:
        courseId,
    });


  const wasCompleted =
    progress?.status ===
    "completed";


  if (!progress) {
    progress =
      new CourseProgress({
        user:
          userId,

        course:
          courseId,
      });
  }


  /* =======================================================
     DETERMINE WHETHER LEARNING HAS STARTED
     ======================================================= */

  const anyProgress =
    await ResourceProgress.exists({
      user:
        userId,

      course:
        courseId,

      status: {
        $in: [
          "in_progress",
          "completed",
        ],
      },
    });


  progress.requiredResources =
    requiredIds.length;


  progress.completedRequiredResources =
    completedCount;


  progress.progressPercentage =
    percentage;


  /* =======================================================
     STATUS
     ======================================================= */

  if (
    requiredIds.length > 0 &&
    completedCount ===
      requiredIds.length
  ) {
    progress.status =
      "completed";


    if (
      !progress.completedAt
    ) {
      progress.completedAt =
        new Date();
    }
  }

  else if (
    anyProgress
  ) {
    progress.status =
      "in_progress";


    progress.completedAt =
      null;
  }

  else {
    progress.status =
      "not_started";


    progress.completedAt =
      null;
  }


  if (
    anyProgress &&
    !progress.startedAt
  ) {
    progress.startedAt =
      new Date();
  }


  if (
    anyProgress
  ) {
    progress.lastActivityAt =
      new Date();
  }


  await progress.save();


  /* =======================================================
     COURSE COMPLETION EVENT

     Log only when transitioning into completion.
     ======================================================= */

  if (
    progress.status ===
      "completed" &&
    !wasCompleted
  ) {
    await logProgressEvent({
      userId,

      course,

      eventType:
        "COURSE_COMPLETED",

      metadata: {
        requiredResources:
          requiredIds.length,

        completedRequiredResources:
          completedCount,

        progressPercentage:
          100,
      },
    });
  }


  return progress;
}


/* =========================================================
   TOUCH RESOURCE

   Used when the learner meaningfully interacts with a
   resource without completing it.
   ========================================================= */

async function touchResource({
  userId,
  courseId,
  resourceId,
}) {
  const now =
    new Date();


  const resourceProgress =
    await getOrCreateResourceProgress({
      userId,
      courseId,
      resourceId,
    });


  if (
    resourceProgress.status ===
    "not_started"
  ) {
    resourceProgress.status =
      "in_progress";


    resourceProgress.startedAt =
      now;
  }


  resourceProgress.lastActivityAt =
    now;


  await resourceProgress.save();


  /* =======================================================
     COURSE SUMMARY
     ======================================================= */

  let courseProgress =
    await CourseProgress.findOne({
      user:
        userId,

      course:
        courseId,
    });


  if (!courseProgress) {
    courseProgress =
      new CourseProgress({
        user:
          userId,

        course:
          courseId,

        status:
          "in_progress",

        startedAt:
          now,
      });
  }


  if (
    courseProgress.status ===
    "not_started"
  ) {
    courseProgress.status =
      "in_progress";
  }


  if (
    !courseProgress.startedAt
  ) {
    courseProgress.startedAt =
      now;
  }


  courseProgress.lastResource =
    resourceId;


  courseProgress.lastActivityAt =
    now;


  await courseProgress.save();


  return resourceProgress;
}


/* =========================================================
   COMPLETE RESOURCE
   ========================================================= */

async function completeResource({
  userId,
  courseId,
  resourceId,
  source,
  percentage = 100,
}) {
  const progress =
    await getOrCreateResourceProgress({
      userId,
      courseId,
      resourceId,
    });


  const wasCompleted =
    progress.status ===
    "completed";


  const now =
    new Date();


  if (
    !progress.startedAt
  ) {
    progress.startedAt =
      now;
  }


  progress.status =
    "completed";


  progress.progressPercentage =
    Math.max(
      progress.progressPercentage ||
        0,

      Math.min(
        100,
        Number(
          percentage
        ) ||
          100
      )
    );


  progress.lastActivityAt =
    now;


  if (
    !progress.completedAt
  ) {
    progress.completedAt =
      now;
  }


  progress.completionSource =
    source;


  await progress.save();


  /* =======================================================
     RESOURCE COMPLETION EVENT
     ======================================================= */

  if (!wasCompleted) {
    const course =
      await Course.findById(
        courseId
      );


    if (course) {
      await logProgressEvent({
        userId,

        course,

        resource:
          resourceId,

        eventType:
          "RESOURCE_COMPLETED",

        metadata: {
          completionSource:
            source,

          progressPercentage:
            progress.progressPercentage,
        },
      });
    }
  }


  /* =======================================================
     COURSE RECALCULATION
     ======================================================= */

  const courseProgress =
    await recalculateCourseProgress(
      userId,
      courseId
    );


  if (
    courseProgress
  ) {
    courseProgress.lastResource =
      resourceId;


    courseProgress.lastActivityAt =
      now;


    await courseProgress.save();
  }


  return {
    resourceProgress:
      progress,

    courseProgress,
  };
}


/* =========================================================
   MANUAL COMPLETION

   Used primarily by:
   - E-books/documents
   - Written materials

   Only resources explicitly configured for manual
   confirmation can use this.
   ========================================================= */

async function manuallyCompleteResource({
  userId,
  resource,
}) {
  if (!resource) {
    throw new Error(
      "Learning Material not found."
    );
  }


  if (
    resource.completion
      ?.method !==
    "manual_confirmation"
  ) {
    throw new Error(
      "This Learning Material cannot be manually completed."
    );
  }


  return completeResource({
    userId,

    courseId:
      resource.course,

    resourceId:
      resource._id,

    source:
      "manual_confirmation",

    percentage:
      100,
  });
}


/* =========================================================
   AUDIO PROGRESS

   Audio completion is based primarily on accumulated
   meaningful listening time rather than currentTime alone.

   Seeking near the end therefore does not instantly grant
   completion.
   ========================================================= */

async function updateAudioProgress({
  userId,
  resource,
  positionSeconds,
  durationSeconds,
  engagedDeltaSeconds,
}) {
  if (
    !resource ||
    resource.type !==
      "audio"
  ) {
    throw new Error(
      "Audio Learning Material not found."
    );
  }


  const courseId =
    resource.course;


  const progress =
    await getOrCreateResourceProgress({
      userId,

      courseId,

      resourceId:
        resource._id,
    });


  const now =
    new Date();


  if (
    !progress.startedAt
  ) {
    progress.startedAt =
      now;
  }


  if (
    progress.status ===
    "not_started"
  ) {
    progress.status =
      "in_progress";
  }


  /* =======================================================
     SANITIZE CLIENT VALUES
     ======================================================= */

  const safePosition =
    Math.max(
      0,

      Number(
        positionSeconds
      ) ||
        0
    );


  const safeDuration =
    Math.max(
      0,

      Number(
        durationSeconds
      ) ||
        0
    );


  /*
   * Our browser normally reports roughly 20-30 seconds
   * between progress writes.
   *
   * Capping this prevents one request from claiming an
   * unreasonable amount of listening time.
   */
  const safeEngagedDelta =
    Math.min(
      45,

      Math.max(
        0,

        Number(
          engagedDeltaSeconds
        ) ||
          0
      )
    );


  /* =======================================================
     PLAYBACK POSITION
     ======================================================= */

  progress.lastPositionSeconds =
    safePosition;


  progress.furthestPositionSeconds =
    Math.max(
      progress.furthestPositionSeconds ||
        0,

      safePosition
    );


  if (
    safeDuration > 0
  ) {
    progress.durationSeconds =
      safeDuration;
  }


  const effectiveDuration =
    safeDuration ||
    progress.durationSeconds ||
    0;


  /* =======================================================
     MEANINGFUL LISTENING PERCENTAGE
     ======================================================= */

  if (
    effectiveDuration > 0
  ) {
    progress.engagedSeconds =
      Math.min(
        effectiveDuration,

        (
          progress.engagedSeconds ||
          0
        ) +
          safeEngagedDelta
      );


    const listenedPercentage =
      Math.min(
        100,

        Math.round(
          (
            progress.engagedSeconds /
            effectiveDuration
          ) *
            100
        )
      );


    /*
     * Progress should never decrease because the learner
     * rewound the audio.
     */
    progress.progressPercentage =
      Math.max(
        progress.progressPercentage ||
          0,

        listenedPercentage
      );
  }


  progress.lastActivityAt =
    now;


  /* =======================================================
     COMPLETION THRESHOLD
     ======================================================= */

  const configuredThreshold =
    Number(
      resource.completion
        ?.threshold
    );


  const threshold =
    Math.max(
      1,

      Math.min(
        100,

        Number.isFinite(
          configuredThreshold
        )
          ? configuredThreshold
          : 80
      )
    );


  const shouldComplete =
    resource.completion
      ?.method ===
      "audio_percentage" &&
    progress.progressPercentage >=
      threshold;


  /* =======================================================
     COMPLETE AUDIO
     ======================================================= */

  if (
    shouldComplete &&
    progress.status !==
      "completed"
  ) {
    /*
     * Save the latest audio telemetry first.
     */
    await progress.save();


    return completeResource({
      userId,

      courseId,

      resourceId:
        resource._id,

      source:
        "audio_percentage",

      percentage:
        progress.progressPercentage,
    });
  }


  await progress.save();


  /* =======================================================
     UPDATE COURSE RESUME STATE
     ======================================================= */

  let courseProgress =
    await CourseProgress.findOne({
      user:
        userId,

      course:
        courseId,
    });


  if (!courseProgress) {
    courseProgress =
      new CourseProgress({
        user:
          userId,

        course:
          courseId,

        status:
          "in_progress",

        startedAt:
          now,
      });
  }


  if (
    courseProgress.status ===
    "not_started"
  ) {
    courseProgress.status =
      "in_progress";
  }


  if (
    !courseProgress.startedAt
  ) {
    courseProgress.startedAt =
      now;
  }


  courseProgress.lastResource =
    resource._id;


  courseProgress.lastActivityAt =
    now;


  await courseProgress.save();


  /*
   * Recalculate required-material totals while preserving
   * the last-resource information above.
   */
  courseProgress =
    await recalculateCourseProgress(
      userId,
      courseId
    );


  if (
    courseProgress
  ) {
    courseProgress.lastResource =
      resource._id;


    courseProgress.lastActivityAt =
      now;


    await courseProgress.save();
  }


  return {
    resourceProgress:
      progress,

    courseProgress,
  };
}


/* =========================================================
   ASSIGNMENT ACCEPTANCE

   Admin acceptance is what completes an Assignment resource.
   ========================================================= */

async function syncAcceptedAssignmentProgress(
  submission
) {
  if (!submission) {
    return null;
  }


  if (
    submission.status !==
    "Accepted"
  ) {
    return null;
  }


  if (
    !submission.resource ||
    !submission.user ||
    !submission.course
  ) {
    /*
     * Legacy submissions have no CourseResource relation.
     * They are intentionally ignored by DBW V2 progress.
     */
    return null;
  }


  const resourceId =
    submission.resource?._id ||
    submission.resource;


  const userId =
    submission.user?._id ||
    submission.user;


  const courseId =
    submission.course?._id ||
    submission.course;


  return completeResource({
    userId,

    courseId,

    resourceId,

    source:
      "assignment_accepted",

    percentage:
      100,
  });
}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {
  getOrCreateResourceProgress,

  recalculateCourseProgress,

  touchResource,

  completeResource,

  manuallyCompleteResource,

  updateAudioProgress,

  syncAcceptedAssignmentProgress,
};