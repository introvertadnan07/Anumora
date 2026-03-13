const Listing = require("../models/listing");
const Review = require("../models/review");
const User = require("../models/user");
const ExpressError = require("../utils/ExpressError");

// ✅ Feature 6: Review notification email
const { sendReviewNotificationToHost } = require("../configs/emailService");

module.exports.createReview = async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate("owner");
  if (!listing) throw new ExpressError(404, "Listing not found");

  const newReview = new Review(req.body.review);
  newReview.author = req.user._id;

  listing.reviews.push(newReview);
  await newReview.save();
  await listing.save();

  // ✅ Feature 6: Notify host about new review
  try {
    if (listing.owner && listing.owner.email) {
      const reviewer = await User.findById(req.user._id);
      await sendReviewNotificationToHost({
        review: newReview,
        listing,
        reviewer,
        hostEmail: listing.owner.email,
      });
    }
  } catch (err) {
    console.error("Review notification email failed:", err.message);
  }

  req.flash("success", "Review added!");
  res.redirect(`/listings/${req.params.id}`);
};

module.exports.destroyReview = async (req, res) => {
  const { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "Review deleted!");
  res.redirect(`/listings/${id}`);
};
