import React from 'react';
import { useAuthFlow } from '../../hooks/useAuthFlow';
import { Card } from '../ui/Card';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { OtpVerificationForm } from './OtpVerificationForm';

export const LoginScreen: React.FC = () => {
  const flow = useAuthFlow();
  const { authMode } = flow;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-xl border-outline-variant/30 p-8" noBorder={false}>
        {authMode === 'login' && <LoginForm flow={flow} />}
        {authMode === 'signup' && <SignupForm flow={flow} />}
        {authMode === 'forgot_password' && <ForgotPasswordForm flow={flow} />}
        {(authMode === 'otp_sent' || authMode === 'otp_sent_signup') && <OtpVerificationForm flow={flow} />}
      </Card>
    </div>
  );
};
