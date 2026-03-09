const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/create-checkout-session", async (req, res) => {
  const { amount } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "inr",
          product_data: {
            name: "Hotel Booking",
          },
          unit_amount: amount * 100, // paise
        },
        quantity: 1,
      },
    ],
    success_url: "http://localhost:8080/payment/success",
    cancel_url: "http://localhost:8080/payment/cancel",
  });

  res.json({ id: session.id });
});

router.get("/success", (req, res) => {
  res.render("payments/success");
});

router.get("/cancel", (req, res) => {
  res.render("payments/cancel");
});

module.exports = router;