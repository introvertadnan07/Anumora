const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { isLoggedIn } = require("../middleware");

// ✅ Feature 7: Toggle wishlist — POST /wishlist/:listingId
// Returns JSON so the heart button can update without page reload
router.post("/:listingId", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { listingId } = req.params;

    const alreadySaved = user.wishlist.some(id => id.toString() === listingId);

    if (alreadySaved) {
      // Remove from wishlist
      user.wishlist = user.wishlist.filter(id => id.toString() !== listingId);
      await user.save();
      return res.json({ saved: false, message: "Removed from wishlist" });
    } else {
      // Add to wishlist
      user.wishlist.push(listingId);
      await user.save();
      return res.json({ saved: true, message: "Saved to wishlist" });
    }
  } catch (err) {
    console.error("Wishlist error:", err.message);
    res.status(500).json({ error: "Failed to update wishlist" });
  }
});

// GET /wishlist — show all saved listings
router.get("/", isLoggedIn, async (req, res) => {
  const user = await User.findById(req.user._id).populate("wishlist");
  res.render("users/wishlist", { wishlistListings: user.wishlist });
});

module.exports = router;
