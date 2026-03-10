const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");
const User = require("../models/user");

/* ─────────────────────────────────────────────
   USER DASHBOARD
   Route: GET /dashboard
   Shows logged-in user's own stats
───────────────────────────────────────────── */
module.exports.userDashboard = async (req, res) => {
  const userId = req.user._id;

  // My bookings (as a guest)
  const myBookings = await Booking.find({ user: userId })
    .populate("listing")
    .sort({ createdAt: -1 });

  // My listings (as a host)
  const myListings = await Listing.find({ owner: userId });

  // Reviews received on my listings
  const myListingIds = myListings.map((l) => l._id);
  const myReviews = await Review.find({ _id: { $in: myListings.flatMap((l) => l.reviews) } })
    .populate("author")
    .sort({ createdAt: -1 });

  // Bookings received on my listings (as host)
  const hostBookings = await Booking.find({ listing: { $in: myListingIds } })
    .populate("listing")
    .sort({ createdAt: -1 });

  // Revenue: sum of (price * nights) for all host bookings
  let totalRevenue = 0;
  const monthlyRevenue = {}; // { "Nov 2024": 14200, ... }

  for (const booking of hostBookings) {
    if (!booking.listing) continue;
    const nights = Math.ceil(
      (new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)
    );
    const amount = booking.listing.price * nights;
    totalRevenue += amount;

    const monthKey = new Date(booking.createdAt).toLocaleString("en-IN", {
      month: "short",
      year: "numeric",
    });
    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + amount;
  }

  // Average rating across all my listings
  let totalRating = 0;
  let reviewCount = 0;
  for (const review of myReviews) {
    if (review.rating) {
      totalRating += review.rating;
      reviewCount++;
    }
  }
  const avgRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : "—";

  // Last 6 months for chart
  const last6Months = getLast6Months();
  const revenueChart = last6Months.map((m) => ({
    month: m,
    amount: monthlyRevenue[m] || 0,
  }));

  res.render("bookings/dashboard", {
    // User bookings (as guest)
    myBookings,

    // Host data
    myListings,
    hostBookings,
    myReviews,

    // Stats
    totalRevenue,
    avgRating,
    reviewCount,
    revenueChart,

    // Flags
    isAdmin: req.user.isAdmin,
  });
};

/* ─────────────────────────────────────────────
   ADMIN DASHBOARD
   Route: GET /admin/dashboard
   Shows platform-wide stats
───────────────────────────────────────────── */
module.exports.adminDashboard = async (req, res) => {
  // Platform totals
  const totalUsers = await User.countDocuments();
  const totalListings = await Listing.countDocuments();
  const totalBookings = await Booking.countDocuments();

  // All bookings with listing for revenue calculation
  const allBookings = await Booking.find({})
    .populate("listing")
    .populate("user")
    .sort({ createdAt: -1 });

  // Platform revenue
  let platformRevenue = 0;
  const monthlyRevenue = {};

  for (const booking of allBookings) {
    if (!booking.listing) continue;
    const nights = Math.ceil(
      (new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)
    );
    const amount = booking.listing.price * nights;
    platformRevenue += amount;

    const monthKey = new Date(booking.createdAt).toLocaleString("en-IN", {
      month: "short",
      year: "numeric",
    });
    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + amount;
  }

  // Last 6 months chart
  const last6Months = getLast6Months();
  const revenueChart = last6Months.map((m) => ({
    month: m,
    amount: monthlyRevenue[m] || 0,
  }));

  // All users (recent 50)
  const allUsers = await User.find({}).sort({ _id: -1 }).limit(50);

  // All listings with owner
  const allListings = await Listing.find({}).populate("owner").sort({ _id: -1 });

  // All reviews (recent 20)
  const allReviews = await Review.find({})
    .populate("author")
    .sort({ createdAt: -1 })
    .limit(20);

  // Top locations by listing count
  const locationAgg = await Listing.aggregate([
    { $group: { _id: "$location", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  // Recent activity (last 10 bookings as activity)
  const recentActivity = allBookings.slice(0, 10);

  res.render("bookings/admin-dashboard", {
    totalUsers,
    totalListings,
    totalBookings,
    platformRevenue,
    revenueChart,
    allUsers,
    allListings,
    allBookings: allBookings.slice(0, 50),
    allReviews,
    locationAgg,
    recentActivity,
  });
};

/* ─────────────────────────────────────────────
   ADMIN: Toggle isAdmin for a user
   Route: POST /admin/users/:userId/toggle-admin
───────────────────────────────────────────── */
module.exports.toggleAdmin = async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) {
    req.flash("error", "User not found");
    return res.redirect("/admin/dashboard");
  }
  user.isAdmin = !user.isAdmin;
  await user.save();
  req.flash("success", `${user.username} is now ${user.isAdmin ? "an Admin" : "a regular user"}`);
  res.redirect("/admin/dashboard");
};

/* ─────────────────────────────────────────────
   ADMIN: Delete any listing
   Route: DELETE /admin/listings/:id
───────────────────────────────────────────── */
module.exports.adminDeleteListing = async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  req.flash("success", "Listing removed by admin");
  res.redirect("/admin/dashboard");
};

/* ─────────────────────────────────────────────
   ADMIN: Delete any user
   Route: DELETE /admin/users/:userId
───────────────────────────────────────────── */
module.exports.adminDeleteUser = async (req, res) => {
  await User.findByIdAndDelete(req.params.userId);
  req.flash("success", "User removed");
  res.redirect("/admin/dashboard");
};

// Helper: last 6 month keys like ["Jun 2024", ..., "Nov 2024"]
function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      d.toLocaleString("en-IN", { month: "short", year: "numeric" })
    );
  }
  return months;
}
