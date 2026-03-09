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

const User = require("./models/user");

const listingRouter = require("./routes/listing");
const reviewRouter = require("./routes/reviews");
const userRouter = require("./routes/user");
const aiRouter = require("./routes/ai");
const chatRouter = require("./routes/chat");
const bookingRouter = require("./routes/bookings");

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
// MIDDLEWARE
// ======================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// ======================
// SESSION
// ======================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysupersecretcode",
    resave: false,
    saveUninitialized: true,
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
app.get("/", (req, res) => {
  res.redirect("/listings");
});

// ======================
// ROUTES
// ======================
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/ai", aiRouter);
app.use("/chat", chatRouter);

app.use("/bookings", bookingRouter);
app.use("/listings/:id/bookings", bookingRouter);

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
// SERVER START
// ======================

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});