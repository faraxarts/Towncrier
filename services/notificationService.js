const Notification = require("../models/Notification");
const Course = require("../models/course");
const Event = require("../models/Event");

async function createCourseNotificationIfNeeded(courseId) {
  const course = await Course.findById(courseId).populate("academy");

  if (!course || !course.isPublished || !course.academy) {
    return;
  }

  const existingNotification = await Notification.findOne({
    type: "course",
    course: course._id,
  });

  if (existingNotification) {
    return;
  }

  await Notification.create({
    title: `New course available in ${course.academy.name}`,
    message: `${course.title} is now available. Tap to view the course details.`,
    type: "course",
    audience: "academy",
    academy: course.academy._id,
    course: course._id,
    targetUrl: `/academy/${course.academy.slug}/courses/${course.slug}`,
    isPublished: true,
  });
}

async function createEventNotificationIfNeeded(eventId) {
  const event = await Event.findById(eventId);

  if (!event || !event.isPublished) {
    return;
  }

  const existingNotification = await Notification.findOne({
    type: "event",
    event: event._id,
  });

  if (existingNotification) {
    return;
  }

  await Notification.create({
    title: "New upcoming event",
    message: `${event.title} has been added. Tap to view the event details.`,
    type: "event",
    audience: "all",
    event: event._id,
    targetUrl: `/events/${event.slug}`,
    isPublished: true,
  });
}

module.exports = {
  createCourseNotificationIfNeeded,
  createEventNotificationIfNeeded,
};