const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET
});

app.post("/verify-payment", async (req, res) => {

  const { paymentId } = req.body;

  try {

    const payment = await razorpay.payments.fetch(paymentId);

    if (payment.status === "captured") {
      return res.json({ success: true });
    }

    res.json({ success: false });

  } catch (err) {
    res.json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});