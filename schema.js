const Joi = require("joi");

const CATEGORIES = [
  "Beach", "Mountain", "City", "Farm", "Castle",
  "Camping", "Arctic", "Desert", "Lakefront",
  "Treehouse", "Countryside", "Luxury",
];

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
    price: Joi.number().required().min(0),
    image: Joi.string().allow("", null),
    // ✅ NEW: category is optional (defaults to "City" in model)
    category: Joi.string().valid(...CATEGORIES).allow("", null),
  }).required(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
});

module.exports.CATEGORIES = CATEGORIES;
