const ProgramRegistration = require("../models/ProgramRegistration");
const ContactMessage = require("../models/ContactMessage");
const PrayerRequest = require("../models/PrayerRequest");
const AssignmentSubmission = require("../models/AssignmentSubmission");
const Course = require("../models/Course");
const Level = require("../models/Level");
const Event = require("../models/Event");
const ManualPaymentRequest = require("../models/ManualPaymentRequest");
const UserLevelAccess = require("../models/UserLevelAccess");

exports.getAdminDashboard = async (req, res) => {
  try {
    const [
      registrationCount,
      contactCount,
      prayerCount,
      assignmentCount,
      courseCount,
      levelCount,
      eventCount,
      pendingPaymentCount,
      levelAccessCount,
      recentAssignments,
      recentPayments,
      recentEvents,
    ] = await Promise.all([
      ProgramRegistration.countDocuments(),
      ContactMessage.countDocuments(),
      PrayerRequest.countDocuments(),
      AssignmentSubmission.countDocuments(),
      Course.countDocuments(),
      Level.countDocuments(),
      Event.countDocuments(),
      ManualPaymentRequest.countDocuments({ status: "pending" }),
      UserLevelAccess.countDocuments({ status: "active" }),

      AssignmentSubmission.find()
        .populate("user", "name email")
        .populate({
          path: "course",
          select: "title academy",
          populate: {
            path: "academy",
            select: "name",
          },
        })
        .sort({ createdAt: -1 })
        .limit(5),

      ManualPaymentRequest.find({ status: "pending" })
        .populate("user", "name email")
        .populate({
          path: "level",
          select: "title academy",
          populate: {
            path: "academy",
            select: "name",
          },
        })
        .sort({ createdAt: -1 })
        .limit(5),

      Event.find()
        .sort({ createdAt: -1 })
        .limit(4),
    ]);

    res.render("admin/index", {
      registrationCount,
      contactCount,
      prayerCount,
      assignmentCount,
      courseCount,
      levelCount,
      eventCount,
      pendingPaymentCount,
      levelAccessCount,
      recentAssignments,
      recentPayments,
      recentEvents,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getRegistrations = async (req, res) => {
  try {
    const registrations = await ProgramRegistration.find().sort({ createdAt: -1 });
    res.render("admin/registrations", { registrations });
  } catch (error) {
    console.error("Get registrations error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getContactMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.render("admin/contact-messages", { messages });
  } catch (error) {
    console.error("Get contact messages error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};

exports.getPrayerRequests = async (req, res) => {
  try {
    const prayerRequests = await PrayerRequest.find().sort({ createdAt: -1 });
    res.render("admin/prayer-requests", { prayerRequests });
  } catch (error) {
    console.error("Get prayer requests error:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "Something unexpected happened while processing that request. Please try again shortly.",
    });
  }
};