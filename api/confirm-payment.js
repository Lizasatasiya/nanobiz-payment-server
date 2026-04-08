import Razorpay from "razorpay";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}




  export default async function handler(req, res) {

  // ✅ ADD THIS BLOCK
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
res.setHeader(
  "Access-Control-Allow-Headers",
  "Content-Type, Authorization"
);

  // ✅ HANDLE PREFLIGHT
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  const authHeader = req.headers.authorization;

if (!authHeader || !authHeader.startsWith("Bearer ")) {
  return res.status(401).json({ success: false, message: "Unauthorized" });
}

const idToken = authHeader.split("Bearer ")[1];

let decoded;

try {
  decoded = await admin.auth().verifyIdToken(idToken);
} catch (e) {
  return res.status(401).json({ success: false, message: "Invalid token" });
}

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET
  });

 const { paymentId, businessId, planId, action } = req.body;

  try {
    let payment = await razorpay.payments.fetch(paymentId);

   
if (payment.status === "authorized") {
  try {
    await razorpay.payments.capture(paymentId, payment.amount);
     payment = await razorpay.payments.fetch(paymentId);
    

if (payment.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: "Capture failed"
      });
    }

  }  catch (err) {
  if (err.error && err.error.description?.includes("already captured")) {
  payment = await razorpay.payments.fetch(paymentId); 
} else {
  console.log("Capture error:", err);
  return res.status(400).json({
    success: false,
    message: "Capture failed"
  });
}
}
}


if (payment.status !== "captured") {
  return res.status(400).json({
    success: false,
    message: "Payment not completed"
  });
}

if (payment.notes?.businessId !== businessId) {
  return res.status(400).json({
    success: false,
    message: "Payment mismatch"
  });
}

    

    const db = admin.firestore();

    const businessRef = db.collection("businesses").doc(businessId);
    const snap = await businessRef.get();

    if (!snap.exists) {
  return res.status(404).json({ success: false });
}

const businessData = snap.data();

if (businessData.ownerId !== decoded.uid) {
  return res.status(403).json({ success: false, message: "Forbidden" });
}

    

    const now = new Date();
    const settingsSnap = await db.collection("settings").doc("app").get();
const settings = settingsSnap.data();

let durationDays = 30;

if (planId === "standard") {
  durationDays = settings.standardDuration || 30;
} else if (planId === "featured") {
  durationDays = settings.featuredDuration || 30;
}

    const currentData = snap.data();
const currentExpiry = currentData.planExpiresAt?.toDate();

let startDate;
let endDate;

const isExpired = !currentExpiry || currentExpiry < now;

if (action === "upgrade" || isExpired) {
  // 🔥 immediate activation
  startDate = now;
  endDate = new Date(now.getTime() + durationDays * 86400000);

  await businessRef.update({
    planId: planId,
    planStartAt: startDate,
    planExpiresAt: endDate,

     status: "active",

    // clear upcoming
    upcomingPlanId: admin.firestore.FieldValue.delete(),
    upcomingPlanStartAt: admin.firestore.FieldValue.delete(),
    upcomingPlanExpiresAt: admin.firestore.FieldValue.delete(),

    paymentStatus: "paid",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

} else {
  // 🔵 renew / downgrade → schedule

  let baseDate = now;

  if (currentExpiry && currentExpiry > now) {
    baseDate = currentExpiry;
  }

  startDate = baseDate;
  endDate = new Date(baseDate.getTime() + durationDays * 86400000);

  await businessRef.update({
    upcomingPlanId: planId,
    upcomingPlanStartAt: startDate,
    upcomingPlanExpiresAt: endDate,
 status: "active",
    paymentStatus: "paid",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

    return res.status(200).json({ success: true });

  } catch (e) {
    console.log(e);
    return res.status(500).json({ success: false });
  }
}