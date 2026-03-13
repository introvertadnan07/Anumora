const transporter = require("./nodemailer");

/* ─────────────────────────────────────────
   All email notification functions
   Import this anywhere you need to send mail
───────────────────────────────────────── */

// Helper: base HTML wrapper for all emails
function emailBase(title, body) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#F7F7F7; font-family:'Helvetica Neue',Arial,sans-serif; }
    .wrap { max-width:580px; margin:32px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#FF385C; padding:28px 32px; text-align:center; }
    .header .logo { color:white; font-size:22px; font-weight:700; letter-spacing:-0.5px; }
    .header .logo span { opacity:0.8; }
    .body { padding:32px; }
    .title { font-size:20px; font-weight:700; color:#222; margin-bottom:8px; }
    .subtitle { font-size:14px; color:#717171; margin-bottom:24px; }
    .detail-box { background:#F7F7F7; border-radius:10px; padding:18px 20px; margin:20px 0; }
    .detail-row { display:flex; justify-content:space-between; padding:6px 0; font-size:14px; border-bottom:1px solid #EBEBEB; }
    .detail-row:last-child { border-bottom:none; }
    .detail-row .label { color:#717171; }
    .detail-row .value { font-weight:600; color:#222; }
    .btn { display:inline-block; background:#FF385C; color:white; padding:12px 28px; border-radius:24px; text-decoration:none; font-size:14px; font-weight:700; margin:20px 0; }
    .divider { border:none; border-top:1.5px solid #EBEBEB; margin:24px 0; }
    .footer { background:#F7F7F7; padding:20px 32px; text-align:center; font-size:12px; color:#B0B0B0; }
    .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; }
    .badge-green { background:#EDFAF0; color:#008A05; }
    .badge-red { background:#FFF0F2; color:#FF385C; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">Anumora<span>Stay</span></div>
    </div>
    <div class="body">
      <div class="title">${title}</div>
      ${body}
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} AnumoraStay · You're receiving this because you have an account with us.
    </div>
  </div>
</body>
</html>`;
}

/* ── 1. BOOKING CONFIRMATION → Guest ── */
async function sendBookingConfirmationToGuest({ booking, listing, user, totalAmount, nights }) {
  const html = emailBase("Booking Confirmed! 🎉", `
    <div class="subtitle">Your stay has been booked successfully.</div>
    <div class="detail-box">
      <div class="detail-row"><span class="label">Property</span><span class="value">${listing.title}</span></div>
      <div class="detail-row"><span class="label">Location</span><span class="value">${listing.location}, ${listing.country}</span></div>
      <div class="detail-row"><span class="label">Check-In</span><span class="value">${new Date(booking.checkIn).toDateString()}</span></div>
      <div class="detail-row"><span class="label">Check-Out</span><span class="value">${new Date(booking.checkOut).toDateString()}</span></div>
      <div class="detail-row"><span class="label">Nights</span><span class="value">${nights}</span></div>
      <div class="detail-row"><span class="label">Guests</span><span class="value">${booking.guests}</span></div>
      <div class="detail-row"><span class="label">Total Paid</span><span class="value">₹${totalAmount.toLocaleString("en-IN")}</span></div>
    </div>
    <span class="badge badge-green">✓ Confirmed</span>
    <hr class="divider">
    <p style="font-size:14px;color:#444">Need help? Reply to this email and our support team will assist you within 24 hours.</p>
  `);

  await transporter.sendMail({
    from: `"AnumoraStay" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `Booking Confirmed — ${listing.title} 🏠`,
    html,
  });
}

/* ── 2. BOOKING ALERT → Host ── */
async function sendBookingAlertToHost({ booking, listing, guest, totalAmount, nights, hostEmail }) {
  const html = emailBase("New Booking Received! 📬", `
    <div class="subtitle">Someone just booked your property.</div>
    <div class="detail-box">
      <div class="detail-row"><span class="label">Property</span><span class="value">${listing.title}</span></div>
      <div class="detail-row"><span class="label">Guest</span><span class="value">${guest.username}</span></div>
      <div class="detail-row"><span class="label">Check-In</span><span class="value">${new Date(booking.checkIn).toDateString()}</span></div>
      <div class="detail-row"><span class="label">Check-Out</span><span class="value">${new Date(booking.checkOut).toDateString()}</span></div>
      <div class="detail-row"><span class="label">Nights</span><span class="value">${nights}</span></div>
      <div class="detail-row"><span class="label">Guests</span><span class="value">${booking.guests}</span></div>
      <div class="detail-row"><span class="label">Revenue</span><span class="value" style="color:#008A05">₹${totalAmount.toLocaleString("en-IN")}</span></div>
    </div>
    <span class="badge badge-green">✓ Payment Received</span>
  `);

  await transporter.sendMail({
    from: `"AnumoraStay" <${process.env.EMAIL_USER}>`,
    to: hostEmail,
    subject: `New Booking — ${guest.username} booked ${listing.title}`,
    html,
  });
}

/* ── 3. REVIEW NOTIFICATION → Host ── */
async function sendReviewNotificationToHost({ review, listing, reviewer, hostEmail }) {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const html = emailBase("New Review on Your Listing ⭐", `
    <div class="subtitle">A guest left a review on <b>${listing.title}</b>.</div>
    <div class="detail-box">
      <div class="detail-row"><span class="label">Reviewer</span><span class="value">${reviewer.username}</span></div>
      <div class="detail-row"><span class="label">Rating</span><span class="value" style="color:#FFB400">${stars} (${review.rating}/5)</span></div>
      <div class="detail-row"><span class="label">Comment</span><span class="value">"${review.comment}"</span></div>
      <div class="detail-row"><span class="label">Date</span><span class="value">${new Date(review.createdAt).toDateString()}</span></div>
    </div>
  `);

  await transporter.sendMail({
    from: `"AnumoraStay" <${process.env.EMAIL_USER}>`,
    to: hostEmail,
    subject: `New ${review.rating}★ Review on ${listing.title}`,
    html,
  });
}

/* ── 4. CANCELLATION NOTICE → Guest ── */
async function sendCancellationToGuest({ booking, listing, user }) {
  const html = emailBase("Booking Cancelled", `
    <div class="subtitle">Your booking has been cancelled as requested.</div>
    <div class="detail-box">
      <div class="detail-row"><span class="label">Property</span><span class="value">${listing ? listing.title : "N/A"}</span></div>
      <div class="detail-row"><span class="label">Check-In</span><span class="value">${new Date(booking.checkIn).toDateString()}</span></div>
      <div class="detail-row"><span class="label">Check-Out</span><span class="value">${new Date(booking.checkOut).toDateString()}</span></div>
    </div>
    <span class="badge badge-red">Cancelled</span>
    <hr class="divider">
    <p style="font-size:14px;color:#444">If you didn't request this cancellation, please contact support immediately.</p>
  `);

  await transporter.sendMail({
    from: `"AnumoraStay" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `Booking Cancelled — ${listing ? listing.title : "Your stay"}`,
    html,
  });
}

/* ── 5. WELCOME EMAIL → New User ── */
async function sendWelcomeEmail({ user }) {
  const html = emailBase("Welcome to AnumoraStay! 🏠", `
    <div class="subtitle">We're excited to have you on board, <b>${user.username}</b>!</div>
    <p style="font-size:14px;color:#444;line-height:1.6">
      AnumoraStay connects travellers with unique stays across India. 
      You can browse listings, book stays, and even list your own property.
    </p>
    <div class="detail-box">
      <div class="detail-row"><span class="label">Username</span><span class="value">${user.username}</span></div>
      <div class="detail-row"><span class="label">Email</span><span class="value">${user.email}</span></div>
    </div>
    <a href="${process.env.BASE_URL || "http://localhost:8080"}/listings" class="btn">Explore Listings →</a>
  `);

  await transporter.sendMail({
    from: `"AnumoraStay" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: "Welcome to AnumoraStay! 🎉",
    html,
  });
}

module.exports = {
  sendBookingConfirmationToGuest,
  sendBookingAlertToHost,
  sendReviewNotificationToHost,
  sendCancellationToGuest,
  sendWelcomeEmail,
};
