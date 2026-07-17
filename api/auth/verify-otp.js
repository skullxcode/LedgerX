let db;

const initFirebase = async () => {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  
  if (!getApps().length) {
    try {
      let rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (rawKey && rawKey.startsWith("'") && rawKey.endsWith("'")) {
        rawKey = rawKey.slice(1, -1);
      }
      const serviceAccount = JSON.parse(rawKey);
      initializeApp({
        credential: cert(serviceAccount)
      });
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error.message);
      throw new Error('Firebase Admin initialization failed. Check FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
    }
  }
  if (!db) db = getFirestore();
  return db;
};

export default async function handler(req, res) {
  try {
    const dbInstance = await initFirebase();

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body || {};
    const { email, code } = body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

    const docRef = dbInstance.collection('OTP_Codes').doc(email.toLowerCase());
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

    const { FieldValue } = await import('firebase-admin/firestore');

    if (data.code !== code) {
      await docRef.update({ attempts: FieldValue.increment(1) });
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    await docRef.delete();

    const { getAuth } = await import('firebase-admin/auth');
    let userRecord;
    try {
      userRecord = await getAuth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await getAuth().createUser({ email });
      } else {
        throw error;
      }
    }

    const customToken = await getAuth().createCustomToken(userRecord.uid);
    res.json({ success: true, token: customToken });

  } catch (error) {
    console.error('Unhandled Server Error in verify-otp:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
