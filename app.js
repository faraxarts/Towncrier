require("dotenv").config();
const express = require("express");
const path = require("path");
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
app.disable("x-powered-by");
const SITE_URL = process.env.SITE_URL || "https://towncrier-jtbc.onrender.com";

app.set("trust proxy", 1);

// Force HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    const proto = req.headers["x-forwarded-proto"];
    if (proto && proto !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
  }
  next();
});

// Redirect uppercase page URLs to lowercase, but do not touch assets/files
app.use((req, res, next) => {
  const hasFileExtension = /\.[a-z0-9]+$/i.test(req.path);
  const isAssetPath =
    req.path.startsWith("/images/") ||
    req.path.startsWith("/css/") ||
    req.path.startsWith("/js/") ||
    req.path.startsWith("/uploads/") ||
    hasFileExtension;

  if (!isAssetPath && /[A-Z]/.test(req.path)) {
    const loweredPath = req.path.toLowerCase();
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(301, `${loweredPath}${query}`);
  }

  next();
});

// Shared SEO locals + basic security headers
app.use((req, res, next) => {
  const noisyQueryParams = [
    "type",
    "target",
    "auth",
    "joined"
  ];

  const hasNoisyQuery =
    Object.keys(req.query).some((key) =>
      noisyQueryParams.includes(key)
    );

  res.locals.siteUrl = SITE_URL;

  res.locals.pathWithoutQuery =
    req.originalUrl.split("?")[0];

  res.locals.canonicalUrl =
    `${SITE_URL}${req.path}`;

  res.locals.metaDescription =
    res.locals.metaDescription ||
    "Town Crier Evangelical Ministries exists to proclaim Christ, raise disciples, and serve communities through prayer, sound doctrine, and evangelistic missions.";

  res.locals.noindex =
    hasNoisyQuery;


  /* =========================================
     SECURITY HEADERS
     ========================================= */

  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "X-Frame-Options",
    "SAMEORIGIN"
  );

  res.setHeader(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );


  /* =========================================
     CONTENT SECURITY POLICY
     ========================================= */

  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",

      "img-src 'self' data: https:",

      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

      "font-src 'self' https://fonts.gstatic.com data:",

      /*
       * YouTube IFrame API must be allowed here.
       *
       * Without https://www.youtube.com,
       * /iframe_api is blocked and the carousel
       * cannot detect play / pause events.
       */
      "script-src 'self' 'unsafe-inline' https://www.youtube.com",

      /*
       * Allows the actual embedded YouTube
       * video players.
       */
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",

      "object-src 'none'",

      "base-uri 'self'",

      "form-action 'self'",

      "frame-ancestors 'self'"
    ].join("; ")
  );


  next();
});

// App config
app.set("view engine", "ejs");
app.set("views", "./views");

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be configured in production.");
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "development-only-session-secret-change-me",

    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),

    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
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
  res.render("index", {
    metaDescription:
      "Discover Town Crier Evangelical Ministries, its evangelical missions, discipleship ministries, upcoming events, academy programmes, and ministry leadership.",
  });
});

app.get("/about", (req, res) => {
  res.render("about", {
    metaDescription:
      "Learn about Town Crier Evangelical Ministries, its mission, vision, discipleship mandate, ministry history, and evangelical outreach.",

    leadProfile: ministryLead,

    ministryVideoTitle:
      "Discover the Heart of Town Crier Ministry",

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
    metaDescription:
      "Meet Livingstone Akinadewo, Lead Evangelist and President of Town Crier Evangelical Ministries, and learn about his ministry focus and calling.",
    leadProfile: ministryLead,
  });
});

app.get("/events", async (req, res) => {
  try {
    const events = await Event.find({ isPublished: true }).sort({ createdAt: -1 });
    res.render("events", {
  events,
  metaDescription:
    "Explore upcoming conferences, prayer meetings, discipleship gatherings, outreach programmes, and ministry events organised by Town Crier Evangelical Ministries.",
});
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
  return res.status(404).render("404", {
    pageTitle: "Event Not Found",
    message: "The requested event could not be found.",
    metaDescription:
      "The requested event could not be found on the Town Crier Evangelical Ministries website.",
    noindex: true,
  });
}

    res.render("event-details", {
  event,
  metaDescription:
    event.shortDescription ||
    `View details for ${event.title}, including its date, time, location, and programme information.`,
});
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
    metaDescription:
      "Contact Town Crier Evangelical Ministries for enquiries, fellowship, academy registration, ministry support, and prayer requests.",
  });
});

app.get("/ministries/dbw", (req, res) => {
  res.render("ministries/dbw", {
    metaDescription:
      "Learn about Discipleship by the Word, a structured Town Crier ministry for biblical study, prayer, spiritual growth, and practical discipleship.",
  });
});

app.get("/ministries/bootcamp", (req, res) => {
  res.render("ministries/bootcamp", {
    metaDescription:
      "Discover the Town Crier Discipleship Bootcamp, an intensive programme of biblical teaching, prayer, consecration, revival, and ministry training.",
  });
});

app.get("/ministries/arrows", (req, res) => {
  res.render("ministries/arrows", {
    metaDescription:
      "Learn about Arrows in the Quiver, Town Crier Evangelical Ministries’ outreach and discipleship initiative for children and teenagers.",
  });
});

// Legacy redirects
app.get("/hub", (req, res) => {
  return res.redirect(301, "/academy/dbw-hub");
});

app.get("/hub/courses", (req, res) => {
  return res.redirect(301, "/academy/dbw-hub/courses");
});

app.get("/hub/documents", (req, res) => {
  return res.redirect(301, "/academy/dbw-hub/documents");
});

app.get("/hub/courses/:slug", (req, res) => {
  return res.redirect(
    301,
    `/academy/dbw-hub/courses/${encodeURIComponent(req.params.slug)}`
  );
});

app.get("/ministry-lead", (req, res) => {
  return res.redirect(301, "/livingstone-akinadewo");
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

app.get("/sitemap.xml", async (req, res, next) => {
  try {
    const [academies, events] = await Promise.all([
      Academy.find({ isPublished: true })
        .select("slug updatedAt")
        .lean(),

      Event.find({ isPublished: true })
        .select("slug updatedAt")
        .lean(),
    ]);

    const staticPages = [
      "/",
      "/about",
      "/livingstone-akinadewo",
      "/events",
      "/contact",
      "/ministries/dbw",
      "/ministries/bootcamp",
      "/ministries/arrows",
      "/academy",
    ];

    const urlEntries = [
      ...staticPages.map((pagePath) => ({
        url: `${SITE_URL}${pagePath}`,
        lastModified: null,
      })),

      ...academies.map((academy) => ({
        url: `${SITE_URL}/academy/${encodeURIComponent(academy.slug)}`,
        lastModified: academy.updatedAt,
      })),

      ...events.map((event) => ({
        url: `${SITE_URL}/events/${encodeURIComponent(event.slug)}`,
        lastModified: event.updatedAt,
      })),
    ];

    const sitemapItems = urlEntries
      .map(({ url, lastModified }) => {
        const lastmod = lastModified
          ? `<lastmod>${new Date(lastModified).toISOString()}</lastmod>`
          : "";

        return `
  <url>
    <loc>${url}</loc>
    ${lastmod}
  </url>`;
      })
      .join("");

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapItems}
</urlset>`;

    res.type("application/xml");
    return res.send(sitemap);
  } catch (error) {
    return next(error);
  }
});

app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", {
    pageTitle: "Page Not Found",
    message: "The page you are looking for could not be found.",
    metaDescription:
      "The requested page could not be found on the Town Crier Evangelical Ministries website.",
    noindex: true,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  res.status(err.status || 500).render("500", {
    pageTitle: "Server Error",
    message:
      "Something unexpected happened while loading this page. Please refresh or try again shortly.",
    metaDescription:
      "An unexpected error occurred while loading the Town Crier Evangelical Ministries website.",
    noindex: true,
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
