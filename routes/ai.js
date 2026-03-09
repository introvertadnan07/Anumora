const express = require("express");
const router = express.Router();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are a helpful hotel assistant." },
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices[0].message.content;

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI error" });
  }
});

module.exports = router;