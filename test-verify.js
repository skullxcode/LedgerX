import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: 'server/.env' });

import handler from './api/auth/verify-otp.js';

const req = {
  method: 'POST',
  body: { email: 'test@example.com', code: '123456' }
};

const res = {
  status: (code) => {
    console.log('Status:', code);
    return res;
  },
  json: (data) => {
    console.log('JSON:', data);
  }
};

handler(req, res).catch(console.error);
