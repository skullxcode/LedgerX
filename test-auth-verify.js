import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: 'server/.env' });

import handler from './api/auth/verify-otp.js';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';

const test = async () => {
  console.log("Setting up mock OTP in Firestore...");
  
  // Init admin manually to write the mock OTP
  let rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawKey && rawKey.startsWith("'") && rawKey.endsWith("'")) {
    rawKey = rawKey.slice(1, -1);
  }
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(rawKey)) });
  }
  const db = getFirestore();
  
  const email = 'test_verify_function@example.com';
  const code = '123456';
  
  await db.collection('OTP_Codes').doc(email).set({
    code,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)),
    attempts: 0
  });

  console.log("Calling handler...");
  const req = {
    method: 'POST',
    body: { email, code }
  };

  const res = {
    status: (statusCode) => {
      console.log('Response Status:', statusCode);
      return res;
    },
    json: (data) => {
      console.log('Response JSON:', data);
    }
  };

  await handler(req, res);
  console.log("Done.");
  process.exit(0);
};

test().catch(console.error);
