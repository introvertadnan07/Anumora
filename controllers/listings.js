const Listing = require("../models/listing");
const Booking = require("../models/booking");
const { CATEGORIES } = require("../schema");

const CATEGORY_META = {
  Beach:       { emoji: "🏖️" }, Mountain:  { emoji: "🏔️" },
  City:        { emoji: "🏙️" }, Farm:      { emoji: "🌾" },
  Castle:      { emoji: "🏰" }, Camping:   { emoji: "⛺" },
  Arctic:      { emoji: "🧊" }, Desert:    { emoji: "🏜️" },
  Lakefront:   { emoji: "🏞️" }, Treehouse: { emoji: "🌳" },
  Countryside: { emoji: "🌿" }, Luxury:    { emoji: "💎" },
};

// ✅ Feature 10: Pagination — 12 listings per page
const PAGE_SIZE = 12;

module.exports.index = async (req, res) => {
  const { category, search, page = 1 } = req.query;
  const currentPage = parseInt(page) || 1;

  let filter = {};
  if (category && CATEGORIES.includes(category)) filter.category = category;
  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [{ title: regex }, { location: regex }, { country: regex }];
  }

  const totalListings = await Listing.countDocuments(filter);
  const totalPages = Math.ceil(totalListings / PAGE_SIZE);

  const allListings = await Listing.find(filter)
    .skip((currentPage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  // ✅ Feature 7: Pass user wishlist IDs so hearts render correctly
  let wishlistIds = [];
  if (req.user) {
    const User = require("../models/user");
    const user = await User.findById(req.user._id).select("wishlist");
    wishlistIds = user.wishlist.map(id => id.toString());
  }

  res.render("listings/index", {
    allListings,
    CATEGORIES,
    CATEGORY_META,
    activeCategory: category || null,
    searchQuery: search || "",
    wishlistIds,
    // Pagination
    currentPage,
    totalPages,
    totalListings,
  });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new", { CATEGORIES, CATEGORY_META });
};

module.exports.createListing = async (req, res) => {
  const listing = new Listing(req.body.listing);
  if (req.file) listing.image = { url: req.file.path, filename: req.file.filename };
  const coordinates = await geocodeLocation(req.body.listing.location, req.body.listing.country);
  listing.geometry = { type: "Point", coordinates };
  listing.owner = req.user._id;
  await listing.save();
  req.flash("success", "New listing created!");
  res.redirect("/listings");
};

module.exports.showListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id)
    .populate("owner")
    .populate({ path: "reviews", populate: { path: "author" } });

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  await Listing.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

  // ✅ Feature 7: Check if this listing is in user's wishlist
  let isWishlisted = false;
  if (req.user) {
    const User = require("../models/user");
    const user = await User.findById(req.user._id).select("wishlist");
    isWishlisted = user.wishlist.some(id => id.toString() === listing._id.toString());
  }

  res.render("listings/show", { listing, CATEGORY_META, isWishlisted });
};

module.exports.renderEditForm = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  res.render("listings/edit", { listing, CATEGORIES, CATEGORY_META });
};

module.exports.updateListing = async (req, res) => {
  const listing = await Listing.findByIdAndUpdate(req.params.id, req.body.listing, { new: true });
  if (req.file) listing.image = { url: req.file.path, filename: req.file.filename };
  const coordinates = await geocodeLocation(req.body.listing.location, req.body.listing.country);
  listing.geometry = { type: "Point", coordinates };
  await listing.save();
  req.flash("success", "Listing updated!");
  res.redirect(`/listings/${listing._id}`);
};

module.exports.destoryListing = async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};

module.exports.renderBookingForm = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  res.render("listings/booking", { listing });
};

module.exports.dashboard = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id }).populate("listing").sort({ createdAt: -1 });
  res.render("bookings/dashboard", { bookings });
};

async function geocodeLocation(locationStr, countryStr) {
  try {
    const query = encodeURIComponent(`${locationStr}, ${countryStr}`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${process.env.MAP_TOKEN}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.features && data.features.length > 0) return data.features[0].geometry.coordinates;
  } catch (err) {
    console.error("Geocoding error:", err.message);
  }
  return [78.9629, 20.5937];
}
