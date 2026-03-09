const express = require("express");
const router = express.Router({ mergeParams: true });

const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const bookingController = require("../controllers/bookings");

/* ================= BOOKING FORM ================= */
router.get("/new", isLoggedIn, wrapAsync(bookingController.renderBookingForm));

/* ================= CREATE BOOKING ================= */
router.post("/", isLoggedIn, wrapAsync(bookingController.createBooking));

/* ================= DASHBOARD ================= */
router.get("/dashboard", isLoggedIn, wrapAsync(bookingController.dashboard));

/* ================= PAYMENT ================= */
router.get("/:bookingId/payment", isLoggedIn, wrapAsync(bookingController.renderPaymentPage));

router.post("/:bookingId/pay", isLoggedIn, wrapAsync(bookingController.createCheckoutSession));

/* ================= SUCCESS ================= */
router.get("/success/:bookingId", wrapAsync(bookingController.paymentSuccess));

/* ================= INVOICE ================= */
router.get("/invoice/:bookingId", isLoggedIn, wrapAsync(bookingController.downloadInvoice));

/* ================= CANCEL ================= */
router.delete("/:bookingId", isLoggedIn, wrapAsync(bookingController.cancelBooking));

module.exports = router;