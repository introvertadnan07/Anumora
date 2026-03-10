const express = require("express");
const router = express.Router();
const OpenAI = require("openai");
const Listing = require("../models/listing");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/ask/:id", async (req, res) => {
  try {
    const { question } = req.body;
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const context = `
      You are a helpful assistant for a hotel/stay listing platform called AnumoraStay.
      Here is the listing the user is asking about:
      - Title: ${listing.title}
      - Location: ${listing.location}, ${listing.country}
      - Price: ₹${listing.price} per night
      - Description: ${listing.description || "No description provided"}
      Answer the user's question based on this listing. Keep responses short and helpful.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: context },
        { role: "user", content: question },
      ],
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "AI failed to respond" });
  }
});

module.exports = router;
