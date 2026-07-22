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

    const { idToken, businessName, phone, ownerName } = req.body;
    if (!idToken || !businessName) {
      return res.status(400).json({ error: 'idToken and businessName are required' });
    }

    const { getAuth } = await import('firebase-admin/auth');
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const storeId = "STORE_" + Date.now();
    const batch = dbInstance.batch();

    batch.set(dbInstance.collection("Users").doc(uid), {
      uid: uid,
      store_id: storeId,
      role: 'ADMIN',
      phone: phone || ''
    });

    batch.set(dbInstance.collection("Settings").doc(storeId), {
      business_id: storeId,
      store_id: storeId,
      business_name: businessName,
      owner_name: ownerName || '',
      phone: phone || '',
      address: '', gstin: '', upi_id: '', bank_account: '', bank_ifsc: ''
    });

    await batch.commit();

    return res.status(200).json({ success: true, message: 'Profile created' });
  } catch (error) {
    console.error('Error creating profile:', error);
    return res.status(500).json({ error: 'Failed to create profile: ' + error.message });
  }
}
