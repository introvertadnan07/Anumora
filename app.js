if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const User = require("./models/user");
const listingRouter   = require("./routes/listing");
const reviewRouter    = require("./routes/reviews");
const userRouter      = require("./routes/user");
const aiRouter        = require("./routes/ai");
const chatRouter      = require("./routes/chat");
const bookingRouter   = require("./routes/bookings");
const dashboardRouter = require("./routes/dashboard");
const wishlistRouter  = require("./routes/wishlist");

// ======================
// DATABASE
// ======================
mongoose
  .connect(process.env.ATLAS_DB_URL)
  .then(() => console.log("✅ Connected to DB"))
  .catch((err) => console.log(err));

// ======================
// APP CONFIG
// ======================
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ✅ FIX: Trust Render's reverse proxy — required for secure cookies to work
app.set("trust proxy", 1);

// ======================
// SECURITY MIDDLEWARE
// ======================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://api.mapbox.com",
          "https://js.stripe.com",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'",
        ],
        styleSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://api.mapbox.com",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://res.cloudinary.com",
          "https://images.unsplash.com",
          "https://placehold.co",
          "https://via.placeholder.com",
          "https://api.mapbox.com",
          "https://events.mapbox.com",
        ],
        connectSrc: [
          "'self'",
          "https://api.mapbox.com",
          "https://events.mapbox.com",
        ],
        workerSrc: ["blob:"],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        frameSrc: ["https://js.stripe.com"],
      },
    },
  })
);

// Rate limiting — auth routes (max 20 per 15 mins)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts. Please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting — general (max 100 per 10 mins)
const generalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// ======================
// MIDDLEWARE
// ======================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// NOTE: express-mongo-sanitize removed — incompatible with Express 5
// Mongoose schema validation provides sufficient input protection

// ======================
// SESSION
// ======================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysupersecretcode",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // ✅ FIX: sameSite "none" required for Render cross-origin cookie handling
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

app.use(flash());

// ======================
// PASSPORT
// ======================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ======================
// GLOBAL LOCALS
// ======================
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// ======================
// HOME
// ======================
app.get("/", (req, res) => res.redirect("/listings"));

// ======================
// ROUTES
// ======================
app.use("/login",  authLimiter);
app.use("/signup", authLimiter);

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/ai", aiRouter);
app.use("/chat", chatRouter);
app.use("/bookings", bookingRouter);
app.use("/listings/:id/bookings", bookingRouter);
app.use("/dashboard", dashboardRouter);
app.use("/wishlist", wishlistRouter);

// ======================
// ERROR HANDLING
// ======================
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error", { message });
});

// ======================
// SERVER
// ======================
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
