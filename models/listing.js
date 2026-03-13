const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// ✅ All supported categories
const CATEGORIES = [
  "Beach",
  "Mountain",
  "City",
  "Farm",
  "Castle",
  "Camping",
  "Arctic",
  "Desert",
  "Lakefront",
  "Treehouse",
  "Countryside",
  "Luxury",
];

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  description: String,

  image: {
    url: String,
    filename: String,
  },

  price: Number,
  location: String,
  country: String,

  // ✅ NEW: Category field
  category: {
    type: String,
    enum: CATEGORIES,
    default: "City",
  },

  // ✅ NEW: View count for analytics (Tier 3)
  views: {
    type: Number,
    default: 0,
  },

  geometry: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: [Number],
    },
  },

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],

  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
});

// Export categories so routes/views can use the same list
listingSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model("Listing", listingSchema);
