import React from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { useAuthFlow } from '../../hooks/useAuthFlow';

interface ForgotPasswordFormProps {
  flow: ReturnType<typeof useAuthFlow>;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ flow }) => {
  const {
    emailAddress,
    setEmailAddress,
    isLoading,
    handleResetPasswordRequest,
    setAuthMode
  } = flow;

  return (
    <>
      <h2 className="text-2xl font-bold text-primary mb-2">Reset Password</h2>
      <p className="text-on-surface-variant text-sm mb-6">
        Enter your email and we will send you a link to reset your password.
      </p>

      <form onSubmit={handleResetPasswordRequest} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          required
          placeholder="you@example.com"
          value={emailAddress}
          onChange={e => setEmailAddress(e.target.value)}
          fullWidth
          leftIcon={<span className="material-symbols-outlined text-[20px]">mail</span>}
        />
        
        <Button
          type="submit"
          fullWidth
          disabled={!emailAddress}
          isLoading={isLoading}
          className="mt-2 h-12"
        >
          Send Reset Link
        </Button>
      </form>

      <button 
        onClick={() => setAuthMode('login')} 
        className="mt-6 w-full text-center text-primary text-sm font-medium hover:underline"
      >
        &larr; Back to login
      </button>
    </>
  );
};
