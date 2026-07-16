import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  try {
    const docRef = db.collection('OTP_Codes').doc(email.toLowerCase());
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(400).json({ error: 'No OTP requested for this email' });
    }

    const data = doc.data();

    if (data.expiresAt.toDate() < new Date()) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (data.attempts >= 3) {
      return res.status(400).json({ error: 'Too many failed attempts. Request a new code.' });
    }

    if (data.code !== code) {
      await docRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    await docRef.delete();

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({ email });
      } else {
        throw error;
      }
    }

    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    res.json({ success: true, token: customToken });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
}
