const Academy = require("../models/Academy");
const AcademyEnrollment = require("../models/AcademyEnrollment");
const Notification = require("../models/Notification");
const UserNotification = require("../models/UserNotification");

async function getNotificationFilterForUser(userId, isAdmin = false) {
  if (isAdmin) {
    return { isPublished: true };
  }

  const academyIds = await AcademyEnrollment.find({
    user: userId,
    status: "active",
  }).distinct("academy");

  const filter = {
    isPublished: true,
    $or: [{ audience: "all" }],
  };

  if (academyIds.length) {
    filter.$or.push({
      audience: "academy",
      academy: { $in: academyIds },
    });
  }

  return filter;
}

exports.getUserNotifications = async (req, res) => {
  try {
    const filter = await getNotificationFilterForUser(
      req.session.userId,
      res.locals.isAdmin
    );

    const notifications = await Notification.find(filter)
      .populate("academy", "name slug")
      .sort({ createdAt: -1 });

    const notificationIds = notifications.map((item) => item._id);

    const readRecords = await UserNotification.find({
      user: req.session.userId,
      notification: { $in: notificationIds },
      isRead: true,
    }).select("notification");

    const readSet = new Set(readRecords.map((item) => String(item.notification)));

    const mappedNotifications = notifications.map((item) => ({
      ...item.toObject(),
      isRead: readSet.has(String(item._id)),
      createdAtFormatted: new Date(item.createdAt).toLocaleString(),
    }));

    res.render("notifications/index", {
      notifications: mappedNotifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.openNotification = async (req, res) => {
  try {
    const filter = await getNotificationFilterForUser(
      req.session.userId,
      res.locals.isAdmin
    );

    const notification = await Notification.findOne({
      ...filter,
      _id: req.params.id,
    });

    if (!notification) {
      return res.status(404).send("Notification not found");
    }

    await UserNotification.findOneAndUpdate(
      {
        user: req.session.userId,
        notification: notification._id,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    res.redirect(notification.targetUrl || "/notifications");
  } catch (error) {
    console.error("Open notification error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const filter = await getNotificationFilterForUser(
      req.session.userId,
      res.locals.isAdmin
    );

    const notifications = await Notification.find(filter).select("_id");
    const now = new Date();

    for (const item of notifications) {
      await UserNotification.findOneAndUpdate(
        {
          user: req.session.userId,
          notification: item._id,
        },
        {
          isRead: true,
          readAt: now,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    }

    res.redirect("/notifications");
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};