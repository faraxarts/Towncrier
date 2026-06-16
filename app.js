require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const academyRoutes = require("./routes/academyRoutes");
const hubDocumentRoutes = require("./routes/hubDocumentRoutes");
const manualPaymentRoutes = require("./routes/manualPaymentRoutes");
const adminAssignmentRoutes = require("./routes/adminAssignmentRoutes");
const adminEventRoutes = require("./routes/adminEventRoutes");
const adminLevelRoutes = require("./routes/adminLevelRoutes");
const adminLevelAccessRoutes = require("./routes/adminLevelAccessRoutes");
const adminManualPaymentRoutes = require("./routes/adminManualPaymentRoutes");
const adminCourseRoutes = require("./routes/adminCourseRoutes");
const contactRoutes = require("./routes/contactRoutes");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const AcademyEnrollment = require("./models/AcademyEnrollment");
const Notification = require("./models/Notification");
const UserNotification = require("./models/UserNotification");

const Academy = require("./models/Academy");
const Event = require("./models/Event");
const User = require("./models/user");
const ministryLead = require("./data/ministryLead");

const app = express();

// App config
app.set("view engine", "ejs");
app.set("views", "./views");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "keyboardcat",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: false,
    },
  })
);

// Prevent stale cached pages for logged-in users
app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
  next();
});

// Shared view data
app.use(async (req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.isLoggedIn = !!req.session.userId;
  res.locals.userId = req.session.userId || null;
  res.locals.currentUser = null;
  res.locals.isAdmin = false;
  res.locals.publishedAcademies = [];
  res.locals.unreadNotificationCount = 0;
  res.locals.headerNotifications = [];
  res.locals.ministryLead = ministryLead;

  try {
    const academies = await Academy.find({ isPublished: true })
      .select("name slug")
      .sort({ createdAt: 1 });

    res.locals.publishedAcademies = academies;

    if (!req.session.userId) {
      return next();
    }

    const user = await User.findById(req.session.userId).select("-password");

    if (!user) {
      return next();
    }

    res.locals.currentUser = user;
    res.locals.isAdmin = user.role === "admin";

    let notificationFilter = { isPublished: true };

    if (!res.locals.isAdmin) {
      const academyIds = await AcademyEnrollment.find({
        user: req.session.userId,
        status: "active",
      }).distinct("academy");

      notificationFilter = {
        isPublished: true,
        $or: [{ audience: "all" }],
      };

      if (academyIds.length) {
        notificationFilter.$or.push({
          audience: "academy",
          academy: { $in: academyIds },
        });
      }
    }

    const [recentNotifications, allRelevantNotifications] = await Promise.all([
      Notification.find(notificationFilter)
        .populate("academy", "name slug")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      Notification.find(notificationFilter)
        .select("_id")
        .lean(),
    ]);

    const allNotificationObjectIds = allRelevantNotifications.map((item) => item._id);
    const allNotificationIds = allRelevantNotifications.map((item) => String(item._id));

    if (!allNotificationObjectIds.length) {
      res.locals.unreadNotificationCount = 0;
      res.locals.headerNotifications = [];
      return next();
    }

    const readRecords = await UserNotification.find({
      user: req.session.userId,
      notification: { $in: allNotificationObjectIds },
      isRead: true,
    }).select("notification");

    const readSet = new Set(readRecords.map((item) => String(item.notification)));
    const unreadCount = allNotificationIds.filter((id) => !readSet.has(id)).length;

    res.locals.unreadNotificationCount = unreadCount;
    res.locals.headerNotifications = recentNotifications.map((item) => ({
      ...item,
      isRead: readSet.has(String(item._id)),
    }));
  } catch (error) {
    console.error("Error loading shared view data:", error);
  }

  next();
});

// Website pages
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/about", (req, res) => {
  res.render("about", {
    leadProfile: ministryLead,
    ministryVideoTitle: "Discover the Heart of Town Crier Ministry",
    ministryVideoText:
      "Watch these videos to learn more about the history, vision, mission, and spiritual burden of the ministry.",
    ministryVideos: [
      {
        title: "Ministry Story",
        embedUrl: "https://www.youtube.com/embed/zYRWIhwqEY8",
      },
      {
        title: "Vision and Mission",
        embedUrl: "https://www.youtube.com/embed/z18KVGnIoAI",
      },
      {
        title: "Ministry Journey",
        embedUrl: "https://www.youtube.com/embed/z18KVGnIoAI",
      },
    ],
  });
});

app.get("/livingstone-akinadewo", (req, res) => {
  res.render("ministry-lead", {
    leadProfile: ministryLead,
  });
});

app.get("/events", async (req, res) => {
  try {
    const events = await Event.find({ isPublished: true }).sort({ createdAt: -1 });
    res.render("events", { events });
  } catch (error) {
    console.error("Error loading events:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "We couldn’t load the events page right now. Please try again in a moment.",
    });
  }
});

app.get("/events/:slug", async (req, res) => {
  try {
    const event = await Event.findOne({
      slug: req.params.slug,
      isPublished: true,
    });

    if (!event) {
      return res.status(404).render("404", { message: "Event not found" });
    }

    res.render("event-details", { event });
  } catch (error) {
    console.error("Error loading event details:", error);
    res.status(500).render("500", {
      pageTitle: "Server Error",
      message: "We couldn’t load that event right now. Please try again shortly.",
    });
  }
});

app.get("/contact", (req, res) => {
  res.render("contact", {
    submitted: req.query.submitted || "",
  });
});

app.get("/ministries/dbw", (req, res) => {
  res.render("ministries/dbw");
});

app.get("/ministries/bootcamp", (req, res) => {
  res.render("ministries/bootcamp");
});

app.get("/ministries/arrows", (req, res) => {
  res.render("ministries/arrows");
});

// Legacy redirects
app.get("/hub", (req, res) => {
  res.redirect("/academy/dbw-hub");
});

app.get("/hub/courses", (req, res) => {
  res.redirect("/academy/dbw-hub/courses");
});

app.get("/hub/documents", (req, res) => {
  res.redirect("/academy/dbw-hub/documents");
});

app.get("/hub/courses/:slug", (req, res) => {
  res.redirect(`/academy/dbw-hub/courses/${req.params.slug}`);
});

app.get("/ministry-lead", (req, res) => {
  res.render("ministry-lead", {
    leadProfile: {
      name: "Livingstone Akinadewo",
      role: "Lead Evangelist / President",
      heroKicker: "Meet Our Ministry Lead",
      heroText:
        "Discover the heart, burden, and vision behind the ministry through the story, calling, and leadership journey of Livingstone Akinadewo.",
      paragraphs: [
        "Livingstone F. Akinadewo, popularly known as TheTownCrier was born in Lagos State, Nigeria. He is a missionary and Bible teacher. He is committed to proclaimin a message centered on the restoration of true Christian living as reflected in the Apostles' doctrine; a calling he has faithfully stewarded since his days as an on-campus revivalist.",
        "He is an alumnus of the renowned Kwara State University, where he graduated from the Deartment of Aeronautical and Astronautical Engineering, Class of 2023. Now, with great enthusiasm, he ventures into the world of agriculture as he futhers his academic journey.",
        "He is the President and Lead Evangelist of Town Crier Evangelical Ministries (TCEM), and umbrella body overseeing several sub-ministries, including DBW Academy, Cast The Net Worldwide (C.T.N.W), Davidic Harp, The Deborahs, and Discipleship Hub Network. He is also the Chief Executive Officer of Egghead Research & Analytics, a consultancy focused on academic and research development.",
        "A profilic writer with so many arcticles, artist, and clergyman, he continues to impact livies through ministry, scholorship, and creative expressions. He ministers the Word with a strong prphetic anoiting, raising genuine mission-minded Christians across campuses and cities in Western Nigeria through evangelism and the systematic teaching of sound doctrine."
      ],
      highlights: [
        "Lead Evangelist",
        "Ministry President",
        "Discipleship Teacher",
        "Kingdom Builder",
        "Revival Burden",
        "Prayer Advocate",
        "Evangelism Focus",
        "Leadership Development"
      ],
      ctaText:
        "Want to connect with the ministry, invite Livingstone Akinadewo, or learn more about Town Crier’s mission and vision? Reach out through the contact page or explore upcoming ministry events."
    }
  });
});

// Public academy routes
app.use("/academy", academyRoutes);
app.use("/academy/:academySlug/documents", hubDocumentRoutes);
app.use("/academy/:academySlug/manual-payment", manualPaymentRoutes);

// Backend routes
app.use("/auth", authRoutes);
app.use("/notifications", notificationRoutes);
app.use("/messages", messageRoutes);
app.use("/contact", contactRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/courses", adminCourseRoutes);
app.use("/admin/assignments", adminAssignmentRoutes);
app.use("/admin/events", adminEventRoutes);
app.use("/admin/levels", adminLevelRoutes);
app.use("/admin/level-access", adminLevelAccessRoutes);
app.use("/admin/manual-payments", adminManualPaymentRoutes);

app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", {
    message: "The page you are looking for could not be found.",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(err.status || 500).render("500", {
    pageTitle: "Server Error",
    message:
      "Something unexpected happened while loading this page. Please refresh or try again shortly.",
  });
});

// Start server only after MongoDB connects
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error.message);
  });
