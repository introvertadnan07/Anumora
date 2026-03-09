const Listing = require("../models/listing");
const Review = require("../models/review");


module.exports.createReview = async (req, res) => {    
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      throw new ExpressError(404, "Listing not found");
    }
    
    // Create and save the new review
    const newReview = new Review(req.body.review);
    newReview.author = req.user._id;

    listing.reviews.push(newReview);
    
    await newReview.save();
    await listing.save();
    
    req.flash("success", "New Review Created!");
    
    // Redirect using req.params.id
    res.redirect(`/listings/${req.params.id}`);
  };

  module.exports.destroyReview = async (req, res) => {
    const { id, reviewId } = req.params; 
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    
    req.flash("success", "Review Deleted!");
    res.redirect(`/listings/${id}`);
  };