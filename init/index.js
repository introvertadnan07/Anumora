require("dotenv").config();
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const DB_URL = process.env.ATLAS_DB_URL;

mongoose.connect(DB_URL)
  .then(() => console.log("Connected to MongoDB Atlas (SEED)"))
  .catch(err => console.log(err));

const OWNER_ID = "69860fa5d1ba18de9e8dd40a"; // ✅ REAL USER ID

const initDB = async () => {
  await Listing.deleteMany({});

  const listings = initData.data.map(listing => ({
    ...listing,
    owner: OWNER_ID,
  }));

  await Listing.insertMany(listings);
  console.log("✅ SAMPLE LISTINGS INSERTED:", listings.length);

  mongoose.connection.close();
};

initDB();
