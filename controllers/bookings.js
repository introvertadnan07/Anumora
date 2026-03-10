const Booking = require("../models/booking");
const Listing = require("../models/listing");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const transporter = require("../configs/nodemailer");
const PDFDocument = require("pdfkit");
const { cloudinary } = require("../cloudConfig");
const { Readable } = require("stream");
const path = require("path");

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

  // ✅ FIXED: Use BASE_URL env variable instead of hardcoded localhost
  const BASE_URL = process.env.BASE_URL || "http://localhost:8080";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    success_url: `${BASE_URL}/bookings/success/${booking._id}`,
    cancel_url: `${BASE_URL}/listings/${booking.listing._id}`,
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

  // ✅ FIXED: Generate PDF in memory and upload to Cloudinary
  // instead of saving to local filesystem (which resets on Render redeploy)
  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(22).fillColor("#111").text("ANUMORA STAY", { align: "center" });
    doc.fontSize(10).fillColor("gray").text("Premium Travel Experience", { align: "center" });
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

    doc.rect(50, doc.y, 500, 70).fillAndStroke("#f7f7f7", "#ddd");
    doc.fillColor("#000").fontSize(12).text(`Price per night: ₹ ${booking.listing.price}`, 60, doc.y + 10);
    doc.fontSize(14).fillColor("#e63946").text(`Total Paid: ₹ ${totalAmount.toLocaleString("en-IN")}`, 60, doc.y + 30);
    doc.moveDown(4);

    doc.fontSize(10).fillColor("gray").text("Thank you for choosing AnumoraStay ❤️", { align: "center" });

    doc.end();
  });

  // Upload PDF buffer to Cloudinary
  const cloudinaryUrl = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "anumora_invoices",
        public_id: `invoice-${booking._id}`,
        resource_type: "raw",
        format: "pdf",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );

    const readableStream = new Readable();
    readableStream.push(pdfBuffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });

  // Save invoice URL to booking so we can retrieve it later
  booking.invoiceUrl = cloudinaryUrl;
  await booking.save();

  // Send Receipt Email
  await transporter.sendMail({
    from: `"AnumoraStay" <${process.env.EMAIL_USER}>`,
    to: booking.user.email,
    subject: "Payment Receipt & Invoice 🧾",
    html: `
      <h2>Payment Successful ✅</h2>
      <p>Your booking has been confirmed.</p>
      <p><strong>${booking.listing.title}</strong></p>
      <p>Total Paid: ₹ ${totalAmount.toLocaleString("en-IN")}</p>
      <p><a href="${cloudinaryUrl}">Click here to download your invoice</a></p>
    `,
  });

  req.flash("success", "Payment successful! Invoice sent to your email.");
  res.redirect("/bookings/dashboard");
};

/* ================= DOWNLOAD INVOICE ================= */
module.exports.downloadInvoice = async (req, res) => {
  const { bookingId } = req.params;

  // ✅ FIXED: Fetch invoice URL from DB (stored on Cloudinary), not local filesystem
  const booking = await Booking.findById(bookingId);

  if (!booking || !booking.invoiceUrl) {
    req.flash("error", "Invoice not found. Please contact support.");
    return res.redirect("/bookings/dashboard");
  }

  res.redirect(booking.invoiceUrl);
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
