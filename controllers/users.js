const User = require("../models/user");
const { sendWelcomeEmail } = require("../configs/emailService");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

// ✅ FIX: Express 5 — wrap req.login in a Promise instead of callback
module.exports.signup = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);

    // Send welcome email (non-blocking)
    try {
      await sendWelcomeEmail({ user: registeredUser });
    } catch (emailErr) {
      console.error("Welcome email failed:", emailErr.message);
    }

    // ✅ FIX: Promise-wrap req.login for Express 5 compatibility
    await new Promise((resolve, reject) => {
      req.login(registeredUser, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    req.flash("success", "Welcome to AnumoraStay!");
    res.redirect("/listings");

  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back to AnumoraStay!");
  const redirectUrl = res.locals.redirectUrl || "/listings";
  res.redirect(redirectUrl);
};

// ✅ FIX: Promise-wrap req.logout for Express 5 compatibility
module.exports.logout = async (req, res, next) => {
  try {
    await new Promise((resolve, reject) => {
      req.logout((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    req.flash("success", "You are logged out!");
    res.redirect("/listings");
  } catch (err) {
    next(err);
  }
};
