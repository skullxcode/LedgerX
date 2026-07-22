require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin Initialized');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
  }
}

const db = admin.firestore();
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper to generate 6 digit code
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in Firestore
    await db.collection('OTP_Codes').doc(email.toLowerCase()).set({
      code,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      attempts: 0
    });

    // Send email
    await resend.emails.send({
      from: 'LedgerX Auth <onboarding@resend.dev>',
      to: email,
      subject: 'Your LedgerX Login Code',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; text-align: center;">
          <h2 style="color: #0056b3;">Welcome back to LedgerX</h2>
          <p>Your single-use sign in code is:</p>
          <div style="background-color: #f4f4f5; padding: 16px; font-size: 32px; font-weight: bold; letter-spacing: 4px; border-radius: 8px; margin: 24px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
        </div>
      `
    });

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  try {
    const docRef = db.collection('OTP_Codes').doc(email.toLowerCase());
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(400).json({ error: 'No OTP requested for this email' });
    }

    const data = doc.data();

    // Check expiration
    if (data.expiresAt.toDate() < new Date()) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Check attempts
    if (data.attempts >= 3) {
      return res.status(400).json({ error: 'Too many failed attempts. Request a new code.' });
    }

    // Verify code
    if (data.code !== code) {
      await docRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    // Success! Delete the code
    await docRef.delete();

    // Generate Firebase Custom Token
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
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
