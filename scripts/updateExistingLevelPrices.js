require("dotenv").config();
const mongoose = require("mongoose");
const Level = require("../models/Level");

const DEFAULT_NAIRA_PRICE = 15000;

// Replace this with the client-approved USD amount when you have it
const DEFAULT_USD_PRICE = 0;

function formatCurrency(amount, symbol) {
  if (!amount) return "";
  return `${symbol}${Number(amount).toLocaleString()}`;
}

function buildLevelPriceLabel(priceNaira, priceUsd) {
  const parts = [];

  if (priceNaira) {
    parts.push(formatCurrency(priceNaira, "₦"));
  }

  if (priceUsd) {
    parts.push(formatCurrency(priceUsd, "$"));
  }

  return parts.join(" / ");
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const levels = await Level.find();

    for (const level of levels) {
      level.priceNaira = level.priceNaira || DEFAULT_NAIRA_PRICE;
      level.priceUsd = level.priceUsd || DEFAULT_USD_PRICE;
      level.price = buildLevelPriceLabel(level.priceNaira, level.priceUsd);

      await level.save();
      console.log(`Updated level: ${level.title} -> ${level.price}`);
    }

    console.log("✅ Existing levels updated successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Update existing level prices error:", error);
    process.exit(1);
  }
}

run();