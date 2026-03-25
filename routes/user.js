const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const crypto = require("crypto");

const { saveRedirectUrl } = require("../middleware.js");
const userController = require("../controllers/users.js");

// ======================
// SIGNUP
// ======================
router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(userController.signup); // ✅ FIX: removed wrapAsync — controller has its own try/catch

// ======================
// LOGIN
// ======================
router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.login
  );

// ======================
// LOGOUT
// ======================
router.get("/logout", userController.logout);

// ======================
// FORGOT PASSWORD
// ======================
router.get("/forgot", (req, res) => {
  res.render("users/forgot");
});

router.post(
  "/forgot",
  wrapAsync(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.flash("error", "No account with that email");
      return res.redirect("/forgot");
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 15;
    await user.save();

    console.log("RESET TOKEN:", token);
    req.flash("success", "Reset link generated. Check console.");
    res.redirect("/login");
  })
);

// ======================
// RESET PASSWORD
// ======================
router.get(
  "/reset/:token",
  wrapAsync(async (req, res) => {
    const { token } = req.params;
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      req.flash("error", "Token expired or invalid");
      return res.redirect("/forgot");
    }

    res.render("users/reset", { token });
  })
);

router.post(
  "/reset/:token",
  wrapAsync(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      req.flash("error", "Token expired or invalid");
      return res.redirect("/forgot");
    }

    await user.setPassword(password);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    req.flash("success", "Password reset successful");
    res.redirect("/login");
  })
);

module.exports = router;