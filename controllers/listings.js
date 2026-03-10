const Listing = require("../models/listing");
const Booking = require("../models/booking");

// ✅ FIXED: Helper to geocode a location string using Mapbox Geocoding API
async function geocodeLocation(locationStr, countryStr) {
  try {
    const query = encodeURIComponent(`${locationStr}, ${countryStr}`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${process.env.MAP_TOKEN}&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      return data.features[0].geometry.coordinates; // [lng, lat]
    }
  } catch (err) {
    console.error("Geocoding error:", err.message);
  }

  // Fallback: center of India if geocoding fails
  return [78.9629, 20.5937];
}

// INDEX
module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index", { allListings });
};

// NEW FORM
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new");
};

// CREATE
module.exports.createListing = async (req, res) => {
  const listing = new Listing(req.body.listing);

  if (req.file) {
    listing.image = {
      url: req.file.path,
      filename: req.file.filename,
    };
  }

  // ✅ FIXED: Geocode the actual location instead of hardcoding Mumbai
  const coordinates = await geocodeLocation(
    req.body.listing.location,
    req.body.listing.country
  );

  listing.geometry = {
    type: "Point",
    coordinates,
  };

  listing.owner = req.user._id;

  await listing.save();
  req.flash("success", "New listing created!");
  res.redirect("/listings");
};

// SHOW
module.exports.showListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id)
    .populate("owner")
    .populate({
      path: "reviews",
      populate: { path: "author" },
    });

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  res.render("listings/show", { listing });
};

// EDIT FORM
module.exports.renderEditForm = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  res.render("listings/edit", { listing });
};

// UPDATE
module.exports.updateListing = async (req, res) => {
  const listing = await Listing.findByIdAndUpdate(
    req.params.id,
    req.body.listing,
    { new: true }
  );

  if (req.file) {
    listing.image = {
      url: req.file.path,
      filename: req.file.filename,
    };
  }

  // ✅ FIXED: Re-geocode when listing is updated too
  const coordinates = await geocodeLocation(
    req.body.listing.location,
    req.body.listing.country
  );

  listing.geometry = {
    type: "Point",
    coordinates,
  };

  await listing.save();
  req.flash("success", "Listing updated!");
  res.redirect(`/listings/${listing._id}`);
};

// DELETE
module.exports.destoryListing = async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};

// BOOKING FORM
module.exports.renderBookingForm = async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  res.render("listings/booking", { listing });
};

// USER DASHBOARD
module.exports.dashboard = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate("listing")
    .sort({ createdAt: -1 });

  res.render("bookings/dashboard", { bookings });
};
