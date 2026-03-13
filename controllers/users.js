const User = require("../models/user");
const { sendWelcomeEmail } = require("../configs/emailService");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);

    // ✅ Feature 6: Send welcome email
    try {
      await sendWelcomeEmail({ user: registeredUser });
    } catch (emailErr) {
      console.error("Welcome email failed:", emailErr.message);
    }

    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome to AnumoraStay!");
      res.redirect("/listings");
    });
  } catch (e) {
    req.flash("error", e.message);
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

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You are logged out!");
    res.redirect("/listings");
  });
};
