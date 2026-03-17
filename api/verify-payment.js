const Razorpay = require("razorpay");

export default async function handler(req, res) {

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET
  });

  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  const { paymentId } = req.body;

  try {

    const payment = await razorpay.payments.fetch(paymentId);

    if (payment.status === "captured") {
      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: false });

  } catch (err) {
    return res.status(500).json({ success: false });
  }

}