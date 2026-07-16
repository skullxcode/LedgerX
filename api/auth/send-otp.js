import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

let db;
let transporter;

const initFirebase = () => {
  if (!getApps().length) {
    try {
      let rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      // Strip surrounding quotes if user accidentally pasted them
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
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default async function handler(req, res) {
  try {
    initFirebase();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.collection('OTP_Codes').doc(email.toLowerCase()).set({
      code,
      expiresAt: Timestamp.fromDate(expiresAt),
      attempts: 0
    });

    await transporter.sendMail({
      from: `"LedgerX Auth" <${process.env.GMAIL_EMAIL}>`,
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
}
