const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
  email: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },

  // ✅ Feature 7: Wishlist — array of saved listing IDs
  wishlist: [{
    type: Schema.Types.ObjectId,
    ref: "Listing",
  }],

  resetToken: String,
  resetTokenExpiry: Date,
});

userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", userSchema);
