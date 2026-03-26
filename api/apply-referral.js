import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  // 🔐 AUTH
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false });
  }

  const idToken = authHeader.split("Bearer ")[1];

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ success: false });
  }

  const { referralCode, businessId } = req.body;

  try {
    const db = admin.firestore();

    const refDoc = await db
      .collection("referral_codes")
      .doc(referralCode)
      .get();

    if (!refDoc.exists) {
      return res.status(404).json({ success: false });
    }

    const refData = refDoc.data();

    if (refData.count < 1) {
      return res.status(400).json({ success: false, message: "Not enough referrals" });
    }

    if (refData.used === true) {
      return res.status(400).json({ success: false, message: "Already used" });
    }

    const businessRef = db.collection("businesses").doc(businessId);
    const snap = await businessRef.get();

    if (!snap.exists) {
      return res.status(404).json({ success: false });
    }

    const business = snap.data();

    // 🔒 OWNER CHECK
    if (business.ownerId !== decoded.uid) {
      return res.status(403).json({ success: false });
    }

    const now = new Date();

    // 🎯 APPLY FEATURED PLAN
    if (!business.planId || business.planId !== "featured") {
      await businessRef.update({
        planId: "featured",
        planStartAt: now,
        planExpiresAt: new Date(now.getTime() + 30 * 86400000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else if (!business.upcomingPlanStartAt) {
      await businessRef.update({
        upcomingPlanId: "featured",
        upcomingPlanStartAt: business.planExpiresAt,
        upcomingPlanExpiresAt: new Date(
          business.planExpiresAt.toDate().getTime() + 30 * 86400000
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Already has upcoming plan"
      });
    }

    // ✅ MARK USED
    await db.collection("referral_codes").doc(referralCode).update({
      used: true,
    });

    return res.status(200).json({ success: true });

  } catch (e) {
    console.log(e);
    return res.status(500).json({ success: false });
  }
}