import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  // 🔐 AUTH
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false });
  }

  const token = authHeader.split("Bearer ")[1];

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ success: false });
  }

  const { businessId } = req.body;

  try {
    const db = admin.firestore();

    const ref = db.collection("businesses").doc(businessId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ success: false });
    }

    const data = snap.data();

    if (data.ownerId !== decoded.uid) {
      return res.status(403).json({ success: false });
    }

    const now = new Date();

    if (
      !data.planExpiresAt ||
      now < data.planExpiresAt.toDate()
    ) {
      return res.status(200).json({ success: false });
    }

    if (!data.upcomingPlanId) {
      return res.status(200).json({ success: false });
    }

    await ref.update({
      planId: data.upcomingPlanId,
      planStartAt: data.upcomingPlanStartAt,
      planExpiresAt: data.upcomingPlanExpiresAt,

      upcomingPlanId: admin.firestore.FieldValue.delete(),
      upcomingPlanStartAt: admin.firestore.FieldValue.delete(),
      upcomingPlanExpiresAt: admin.firestore.FieldValue.delete(),

      paymentStatus: "paid",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true });

  } catch (e) {
    console.log(e);
    return res.status(500).json({ success: false });
  }
}