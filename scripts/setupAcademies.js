require("dotenv").config();
const mongoose = require("mongoose");

const Academy = require("../models/Academy");
const Level = require("../models/Level");
const Course = require("../models/Course");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    let dbwHub = await Academy.findOne({ slug: "dbw-hub" });

    if (!dbwHub) {
      dbwHub = await Academy.create({
        name: "DBW HUB",
        slug: "dbw-hub",
        shortDescription: "Discipleship by the Word digital academy",
        fullDescription:
          "DBW HUB is the ministry’s discipleship and biblical training academy for structured spiritual growth.",
        isPublished: true,
      });
      console.log("✅ DBW HUB academy created");
    } else {
      console.log("ℹ️ DBW HUB academy already exists");
    }

    let davidicHarp = await Academy.findOne({ slug: "davidic-harp" });

    if (!davidicHarp) {
      davidicHarp = await Academy.create({
        name: "Davidic Harp",
        slug: "davidic-harp",
        shortDescription: "Psalmist and songwriting training academy",
        fullDescription:
          "Davidic Harp is the ministry’s music and psalmist training academy for singing, psalm writing, and songwriting development.",
        isPublished: true,
      });
      console.log("✅ Davidic Harp academy created");
    } else {
      console.log("ℹ️ Davidic Harp academy already exists");
    }

    const levelUpdateResult = await Level.updateMany(
      { academy: null },
      { $set: { academy: dbwHub._id } }
    );

    console.log(`✅ Levels assigned to DBW HUB: ${levelUpdateResult.modifiedCount}`);

    const courseUpdateResult = await Course.updateMany(
      { academy: null },
      { $set: { academy: dbwHub._id } }
    );

    console.log(`✅ Courses assigned to DBW HUB: ${courseUpdateResult.modifiedCount}`);

    console.log("🎉 Academy setup complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Setup academies error:", error);
    process.exit(1);
  }
}

run();