const Booking = require("../models/booking");
const Listing = require("../models/listing");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const transporter = require("../configs/nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// Ensure invoices directory exists
const invoicesDir = path.join(__dirname, "../invoices");
if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir);
}

/* ================= BOOKING FORM ================= */
module.exports.renderBookingForm = async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  res.render("listings/booking", { listing });
};

/* ================= CREATE BOOKING ================= */
module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut, guests } = req.body;

  if (!checkIn || !checkOut || !guests) {
    req.flash("error", "All booking fields required");
    return res.redirect(`/listings/${id}/bookings/new`);
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    req.flash("error", "Check-out must be after check-in");
    return res.redirect(`/listings/${id}/bookings/new`);
  }

  // Prevent overlapping bookings
  const existingBooking = await Booking.findOne({
    listing: id,
    checkIn: { $lte: new Date(checkOut) },
    checkOut: { $gte: new Date(checkIn) },
  });

  if (existingBooking) {
    req.flash("error", "Selected dates already booked");
    return res.redirect(`/listings/${id}`);
  }

  const booking = new Booking({
    listing: id,
    user: req.user._id,
    checkIn,
    checkOut,
    guests,
  });

  await booking.save();

  res.redirect(`/listings/${id}/bookings/${booking._id}/payment`);
};

/* ================= PAYMENT PAGE ================= */
module.exports.renderPaymentPage = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate("listing");

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/dashboard");
  }

  const nights =
    (new Date(booking.checkOut) - new Date(booking.checkIn)) /
    (1000 * 60 * 60 * 24);

  const totalAmount = booking.listing.price * nights;

  res.render("bookings/payment", {
    booking,
    stripeKey: process.env.STRIPE_PUBLISHABLE_KEY,
    totalAmount,
    nights,
  });
};

/* ================= STRIPE CHECKOUT ================= */
module.exports.createCheckoutSession = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate("listing");

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/dashboard");
  }

  const nights =
    (new Date(booking.checkOut) - new Date(booking.checkIn)) /
    (1000 * 60 * 60 * 24);

  const totalAmount = booking.listing.price * nights;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    success_url: `http://localhost:8080/bookings/success/${booking._id}`,
    cancel_url: `http://localhost:8080/listings/${booking.listing._id}`,
    line_items: [
      {
        price_data: {
          currency: "inr",
          product_data: { name: booking.listing.title },
          unit_amount: totalAmount * 100,
        },
        quantity: 1,
      },
    ],
  });

  res.redirect(303, session.url);
};

/* ================= PAYMENT SUCCESS ================= */
module.exports.paymentSuccess = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId)
    .populate("listing")
    .populate("user");

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/dashboard");
  }

  const nights =
    (new Date(booking.checkOut) - new Date(booking.checkIn)) /
    (1000 * 60 * 60 * 24);

  const totalAmount = booking.listing.price * nights;

  /* ✅ Generate Premium PDF Invoice */
  const invoicePath = path.join(invoicesDir, `invoice-${booking._id}.pdf`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(invoicePath));

  // Header
  doc
    .fontSize(22)
    .fillColor("#111")
    .text("WANDERLUST", { align: "center" });

  doc
    .fontSize(10)
    .fillColor("gray")
    .text("Premium Travel Experience", { align: "center" });

  doc.moveDown(2);

  // Title
  doc.fontSize(18).fillColor("#000").text("INVOICE", { underline: true });

  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Invoice ID: ${booking._id}`);
  doc.text(`Date: ${new Date().toDateString()}`);

  doc.moveDown();

  doc.fontSize(14).text("Billed To:", { underline: true });
  doc.fontSize(12);
  doc.text(booking.user.username);
  doc.text(booking.user.email);

  doc.moveDown();

  doc.fontSize(14).text("Booking Details:", { underline: true });
  doc.fontSize(12);
  doc.text(`Hotel: ${booking.listing.title}`);
  doc.text(`Location: ${booking.listing.location}, ${booking.listing.country}`);
  doc.text(`Check-In: ${booking.checkIn.toDateString()}`);
  doc.text(`Check-Out: ${booking.checkOut.toDateString()}`);
  doc.text(`Guests: ${booking.guests}`);
  doc.text(`Nights: ${nights}`);

  doc.moveDown();

  // Price Box
  doc
    .rect(50, doc.y, 500, 60)
    .fillAndStroke("#f7f7f7", "#ddd");

  doc
    .fillColor("#000")
    .fontSize(12)
    .text(`Price per night: ₹ ${booking.listing.price}`, 60, doc.y + 10);

  doc
    .fontSize(14)
    .fillColor("#e63946")
    .text(`Total Paid: ₹ ${totalAmount.toLocaleString("en-IN")}`, 60, doc.y + 30);

  doc.moveDown(4);

  // Footer
  doc
    .fontSize(10)
    .fillColor("gray")
    .text("Thank you for choosing Wanderlust ❤️", { align: "center" });

  doc.end();

  /* ✅ Send Receipt Email */
  await transporter.sendMail({
    from: `"Wanderlust" <${process.env.EMAIL_USER}>`,
    to: booking.user.email,
    subject: "Payment Receipt & Invoice 🧾",
    html: `
      <h2>Payment Successful ✅</h2>
      <p>Your booking has been confirmed.</p>
      <p><strong>${booking.listing.title}</strong></p>
      <p>Total Paid: ₹ ${totalAmount.toLocaleString("en-IN")}</p>
      <p>Please find your invoice attached.</p>
    `,
    attachments: [
      {
        filename: `invoice-${booking._id}.pdf`,
        path: invoicePath,
      },
    ],
  });

  req.flash("success", "Payment successful! Invoice sent to email.");
  res.redirect("/bookings/dashboard");
};

/* ================= DOWNLOAD INVOICE ================= */
module.exports.downloadInvoice = async (req, res) => {
  const { bookingId } = req.params;
  const invoicePath = path.join(invoicesDir, `invoice-${bookingId}.pdf`);

  if (!fs.existsSync(invoicePath)) {
    req.flash("error", "Invoice not found");
    return res.redirect("/bookings/dashboard");
  }

  res.download(invoicePath);
};

/* ================= DASHBOARD ================= */
module.exports.dashboard = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate("listing")
    .sort({ createdAt: -1 });

  res.render("bookings/dashboard", { bookings });
};

/* ================= CANCEL BOOKING ================= */
module.exports.cancelBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/dashboard");
  }

  if (!booking.user.equals(req.user._id)) {
    req.flash("error", "Unauthorized");
    return res.redirect("/bookings/dashboard");
  }

  await Booking.findByIdAndDelete(req.params.bookingId);

  req.flash("success", "Booking cancelled");
  res.redirect("/bookings/dashboard");
};