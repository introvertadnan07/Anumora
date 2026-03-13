const Booking = require("../models/booking");
const Listing = require("../models/listing");
const User = require("../models/user");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { cloudinary } = require("../cloudConfig");
const { Readable } = require("stream");
const PDFDocument = require("pdfkit");

// ✅ Feature 6: Email notifications
const {
  sendBookingConfirmationToGuest,
  sendBookingAlertToHost,
  sendCancellationToGuest,
} = require("../configs/emailService");

/* ── BOOKING FORM ── */
module.exports.renderBookingForm = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  // ✅ Feature 8: Pass booked date ranges for calendar blocking
  const existingBookings = await Booking.find({ listing: listing._id })
    .select("checkIn checkOut");

  const bookedRanges = existingBookings.map(b => ({
    start: b.checkIn,
    end: b.checkOut,
  }));

  res.render("listings/booking", { listing, bookedRanges });
};

/* ── CREATE BOOKING ── */
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
    req.flash("error", "Selected dates are already booked. Please choose different dates.");
    return res.redirect(`/listings/${id}/bookings/new`);
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

/* ── PAYMENT PAGE ── */
module.exports.renderPaymentPage = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate("listing");
  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/dashboard");
  }

  const nights = Math.ceil(
    (new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)
  );
  const totalAmount = booking.listing.price * nights;

  res.render("bookings/payment", {
    booking,
    stripeKey: process.env.STRIPE_PUBLISHABLE_KEY,
    totalAmount,
    nights,
  });
};

/* ── STRIPE CHECKOUT ── */
module.exports.createCheckoutSession = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate("listing");
  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/dashboard");
  }

  const nights = Math.ceil(
    (new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)
  );
  const totalAmount = booking.listing.price * nights;
  const BASE_URL = process.env.BASE_URL || "http://localhost:8080";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    success_url: `${BASE_URL}/bookings/success/${booking._id}`,
    cancel_url: `${BASE_URL}/listings/${booking.listing._id}`,
    line_items: [{
      price_data: {
        currency: "inr",
        product_data: { name: booking.listing.title },
        unit_amount: totalAmount * 100,
      },
      quantity: 1,
    }],
  });

  res.redirect(303, session.url);
};

/* ── PAYMENT SUCCESS ── */
module.exports.paymentSuccess = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId)
    .populate("listing")
    .populate("user");

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/dashboard");
  }

  const nights = Math.ceil(
    (new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)
  );
  const totalAmount = booking.listing.price * nights;

  // Generate PDF in memory
  const pdfBuffer = await generateInvoicePDF(booking, nights, totalAmount);

  // Upload to Cloudinary
  const cloudinaryUrl = await uploadPDFToCloudinary(pdfBuffer, booking._id);
  booking.invoiceUrl = cloudinaryUrl;
  await booking.save();

  // ✅ Feature 6: Send confirmation email to guest
  try {
    await sendBookingConfirmationToGuest({
      booking,
      listing: booking.listing,
      user: booking.user,
      totalAmount,
      nights,
    });
  } catch (emailErr) {
    console.error("Guest confirmation email failed:", emailErr.message);
  }

  // ✅ Feature 6: Send alert email to host
  try {
    const host = await User.findById(booking.listing.owner);
    if (host && host.email) {
      await sendBookingAlertToHost({
        booking,
        listing: booking.listing,
        guest: booking.user,
        totalAmount,
        nights,
        hostEmail: host.email,
      });
    }
  } catch (emailErr) {
    console.error("Host alert email failed:", emailErr.message);
  }

  req.flash("success", "Payment successful! Confirmation sent to your email.");
  res.redirect("/bookings/dashboard");
};

/* ── DOWNLOAD INVOICE ── */
module.exports.downloadInvoice = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking || !booking.invoiceUrl) {
    req.flash("error", "Invoice not found.");
    return res.redirect("/bookings/dashboard");
  }
  res.redirect(booking.invoiceUrl);
};

/* ── DASHBOARD ── */
module.exports.dashboard = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate("listing")
    .sort({ createdAt: -1 });
  res.render("bookings/dashboard", { bookings });
};

/* ── CANCEL BOOKING ── */
module.exports.cancelBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate("listing");
  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/dashboard");
  }
  if (!booking.user.equals(req.user._id)) {
    req.flash("error", "Unauthorized");
    return res.redirect("/bookings/dashboard");
  }

  // ✅ Feature 6: Send cancellation email before deleting
  try {
    const user = await User.findById(req.user._id);
    await sendCancellationToGuest({ booking, listing: booking.listing, user });
  } catch (emailErr) {
    console.error("Cancellation email failed:", emailErr.message);
  }

  await Booking.findByIdAndDelete(req.params.bookingId);
  req.flash("success", "Booking cancelled. Confirmation sent to your email.");
  res.redirect("/bookings/dashboard");
};

/* ── HELPERS ── */
function generateInvoicePDF(booking, nights, totalAmount) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(22).fillColor("#111").text("ANUMORA STAY", { align: "center" });
    doc.fontSize(10).fillColor("gray").text("Premium Travel Experience", { align: "center" });
    doc.moveDown(2);
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
    doc.fontSize(14).fillColor("#e63946").text(`Total Paid: ₹${totalAmount.toLocaleString("en-IN")}`);
    doc.moveDown(3);
    doc.fontSize(10).fillColor("gray").text("Thank you for choosing AnumoraStay ❤️", { align: "center" });
    doc.end();
  });
}

function uploadPDFToCloudinary(buffer, bookingId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "anumora_invoices", public_id: `invoice-${bookingId}`, resource_type: "raw", format: "pdf" },
      (err, result) => { if (err) reject(err); else resolve(result.secure_url); }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}
