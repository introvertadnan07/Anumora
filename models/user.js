const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },

  // ✅ NEW: Admin field — set manually in DB or via seed script
  isAdmin: {
    type: Boolean,
    default: false,
  },

  // Password reset fields
  resetToken: String,
  resetTokenExpiry: Date,
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
