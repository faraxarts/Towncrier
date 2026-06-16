const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const Academy = require("../models/Academy");
const AcademyEnrollment = require("../models/AcademyEnrollment");

const router = express.Router();

async function resolveAcademy(academySlug) {
  if (!academySlug) return null;

  return Academy.findOne({
    slug: academySlug,
    isPublished: true,
  });
}

async function getLoginRedirect(userId, academySlug, fallback = "/") {
  const academy = await resolveAcademy(academySlug);

  if (!academy) {
    return fallback || "/";
  }

  const enrollment = await AcademyEnrollment.findOne({
    user: userId,
    academy: academy._id,
    status: "active",
  });

  if (enrollment) {
    return `/academy/${academy.slug}/courses`;
  }

  return `/academy/${academy.slug}`;
}

async function getSignupRedirect(userId, academySlug, fallback = "/") {
  const academy = await resolveAcademy(academySlug);

  if (!academy) {
    return fallback || "/";
  }

  await AcademyEnrollment.findOneAndUpdate(
    {
      user: userId,
      academy: academy._id,
    },
    {
      status: "active",
      joinedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return `/academy/${academy.slug}/courses`;
}

// LOGIN ROUTE
router.post("/login", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();
    const academySlug = req.body.academySlug?.trim().toLowerCase() || "";
    const redirectAfterAuth = req.body.redirectAfterAuth?.trim() || "/";

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    req.session.userId = user._id;

    const redirectTo = await getLoginRedirect(user._id, academySlug, redirectAfterAuth);

    res.json({
      message: "Login successful",
      redirectTo,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// SIGNUP ROUTE
router.post("/signup", async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();
    const academySlug = req.body.academySlug?.trim().toLowerCase() || "";
    const redirectAfterAuth = req.body.redirectAfterAuth?.trim() || "/";

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists. Please sign in instead.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    req.session.userId = newUser._id;

    const redirectTo = await getSignupRedirect(newUser._id, academySlug, redirectAfterAuth);

    res.status(201).json({
      message: "User registered successfully",
      redirectTo,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// LOGOUT ROUTE
router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ message: "Could not log out" });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "Logout successful" });
  });
});

module.exports = router;