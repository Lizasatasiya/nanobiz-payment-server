import Razorpay from "razorpay";

export default async function handler(req, res) {


  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET
  });

  const { paymentId } = req.body;

  try {
    const payment = await razorpay.payments.fetch(paymentId);


if (payment.status === "captured") {
  return res.status(200).json({ success: true });
}

console.log("Payment not captured:", payment.status);
return res.status(200).json({ success: false });



   

  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false });
  }
  
}
