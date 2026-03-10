const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isAdmin } = require("../middleware");
const dashboardController = require("../controllers/dashboard");

// ─── USER DASHBOARD ───────────────────────────────────
// GET /dashboard
router.get("/", isLoggedIn, wrapAsync(dashboardController.userDashboard));

// ─── ADMIN DASHBOARD ──────────────────────────────────
// GET /admin/dashboard
router.get("/admin", isAdmin, wrapAsync(dashboardController.adminDashboard));

// Toggle admin role for a user
router.post(
  "/admin/users/:userId/toggle-admin",
  isAdmin,
  wrapAsync(dashboardController.toggleAdmin)
);

// Admin delete listing
router.delete(
  "/admin/listings/:id",
  isAdmin,
  wrapAsync(dashboardController.adminDeleteListing)
);

// Admin delete user
router.delete(
  "/admin/users/:userId",
  isAdmin,
  wrapAsync(dashboardController.adminDeleteUser)
);

module.exports = router;
