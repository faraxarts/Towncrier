const ContactMessage = require("../models/ContactMessage");
const ProgramRegistration = require("../models/ProgramRegistration");
const PrayerRequest = require("../models/PrayerRequest");

exports.submitContactForm = async (req, res) => {
  try {
    const fullName = req.body.fullName?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const phone = req.body.phone?.trim() || "";
    const category = req.body.category?.trim();
    const programTarget = req.body.programTarget?.trim() || "";
    const subject = req.body.subject?.trim();
    const message = req.body.message?.trim();

    if (!fullName || !email || !category || !subject || !message) {
      return res.status(400).send("All required fields must be filled.");
    }

    if (category === "Registration") {
      if (!programTarget) {
        return res.status(400).send("Please select a program for registration.");
      }

      await ProgramRegistration.create({
        fullName,
        email,
        phone,
        category,
        programTarget,
        subject,
        message,
      });

      return res.redirect(
        `/contact?type=registration&target=${encodeURIComponent(programTarget)}&submitted=success`
      );
    }

    if (category === "Prayer Request") {
      await PrayerRequest.create({
        name: fullName,
        email,
        request: message,
      });

      return res.redirect("/contact?submitted=success&category=prayer");
    }

    await ContactMessage.create({
      fullName,
      email,
      phone,
      category,
      subject,
      message,
    });

    return res.redirect("/contact?submitted=success");
  } catch (error) {
    console.error("Contact form submission error:", error);
    return res.status(500).send("Server error. Please try again.");
  }
};