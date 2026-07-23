import React from 'react';
import { Button } from '../ui/Button';
import type { useAuthFlow } from '../../hooks/useAuthFlow';

interface OtpVerificationFormProps {
  flow: ReturnType<typeof useAuthFlow>;
}

export const OtpVerificationForm: React.FC<OtpVerificationFormProps> = ({ flow }) => {
  const {
    emailAddress,
    otpCode,
    setOtpCode,
    isLoading,
    resendTimerSeconds,
    handleVerifyOTP,
    handleResendOTP,
    setAuthMode
  } = flow;

  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-[32px] text-primary">mark_email_read</span>
      </div>
      
      <h2 className="text-2xl font-bold text-primary mb-2">Check your email</h2>
      <p className="text-on-surface-variant text-sm mb-6">
        We've sent a 6-digit verification code to <span className="font-bold text-on-surface">{emailAddress}</span>.
        <br/>
        <span className="text-[12px] italic mt-2 block text-secondary">
          Please check spam emails for OTP as it might be delivered there.
        </span>
      </p>
      
      <form onSubmit={handleVerifyOTP} className="space-y-6 mb-6">
        <input
          type="text"
          maxLength={6}
          className="w-full text-center tracking-[1em] font-mono text-3xl border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-4"
          placeholder="000000"
          value={otpCode}
          onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} // Ensure only numeric input
        />
        <Button
          type="submit"
          fullWidth
          disabled={otpCode.length !== 6}
          isLoading={isLoading}
          className="h-12 shadow-sm"
        >
          Verify & Sign In
        </Button>
        <button
          type="button"
          onClick={handleResendOTP}
          disabled={resendTimerSeconds > 0 || isLoading}
          className="w-full mt-4 text-primary text-sm font-medium hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {resendTimerSeconds > 0 ? `Resend Code in ${resendTimerSeconds}s` : 'Resend Code'}
        </button>
      </form>

      <button 
        onClick={() => { setAuthMode('login'); setOtpCode(''); }} 
        className="text-primary text-sm font-medium hover:underline"
      >
        &larr; Back to login
      </button>
    </div>
  );
};
