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

// ✅ Feature 8 (Security): Helmet — secure HTTP headers
const helmet = require("helmet");

// ✅ Feature 8 (Security): Rate limiting — prevent brute force
const rateLimit = require("express-rate-limit");

// ✅ Feature 8 (Security): Mongo sanitize — prevent NoSQL injection
const mongoSanitize = require("express-mongo-sanitize");

const User = require("./models/user");
const listingRouter   = require("./routes/listing");
const reviewRouter    = require("./routes/reviews");
const userRouter      = require("./routes/user");
const aiRouter        = require("./routes/ai");
const chatRouter      = require("./routes/chat");
const bookingRouter   = require("./routes/bookings");
const dashboardRouter = require("./routes/dashboard");
const wishlistRouter  = require("./routes/wishlist"); // ✅ Feature 7

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

// ======================
// SECURITY MIDDLEWARE
// ======================

// ✅ Feature 8: Helmet — sets 14 secure HTTP headers in one call
// Content Security Policy configured to allow Bootstrap, Mapbox, Cloudinary etc.
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
          "'unsafe-inline'", // needed for inline scripts in EJS
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

// ✅ Feature 8: Rate limiting on auth routes — max 20 attempts per 15 mins
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: "Too many login attempts. Please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ Feature 8: General API rate limit — max 100 req per 10 mins per IP
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

// ✅ Feature 8: Mongo sanitize — strips $ and . from req.body/params/query
app.use(mongoSanitize());

// ======================
// SESSION
// ======================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysupersecretcode",
    resave: false,
    saveUninitialized: false, // ✅ Changed to false — don't save empty sessions
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
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
// ✅ Feature 8: Apply auth rate limiter to login/signup only
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
app.use("/wishlist", wishlistRouter); // ✅ Feature 7

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
f