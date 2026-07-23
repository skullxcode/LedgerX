import React from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { useAuthFlow } from '../../hooks/useAuthFlow';

interface SignupFormProps {
  flow: ReturnType<typeof useAuthFlow>;
}

export const SignupForm: React.FC<SignupFormProps> = ({ flow }) => {
  const {
    authMethod,
    setAuthMethod,
    businessName,
    setBusinessName,
    emailAddress,
    setEmailAddress,
    password,
    setPassword,
    isLoading,
    handlePasswordSubmit,
    handleRequestOTP,
    setAuthMode,
    handleGoogleSignIn
  } = flow;

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary tracking-tight mb-2">LedgerX</h2>
        <p className="text-on-surface-variant text-sm">Create your business account</p>
      </div>

      <Button
        type="button"
        variant="secondary"
        fullWidth
        onClick={handleGoogleSignIn}
        isLoading={isLoading}
        className="mb-6 h-12"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 mr-3" />
        Continue with Google
      </Button>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-outline-variant/50"></div>
        <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Or</span>
        <div className="flex-1 h-px bg-outline-variant/50"></div>
      </div>

      <div className="flex bg-surface-variant/50 p-1.5 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => setAuthMethod('password')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            authMethod === 'password' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setAuthMethod('otp')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            authMethod === 'otp' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          Email Code
        </button>
      </div>

      <form onSubmit={authMethod === 'password' ? handlePasswordSubmit : handleRequestOTP} className="space-y-4">
        <Input
          label="Business Name"
          type="text"
          required
          placeholder="Acme Corp"
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          fullWidth
          leftIcon={<span className="material-symbols-outlined text-[20px]">storefront</span>}
        />

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

        {authMethod === 'password' && (
          <Input
            label="Password"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            fullWidth
            leftIcon={<span className="material-symbols-outlined text-[20px]">lock</span>}
          />
        )}

        <Button
          type="submit"
          fullWidth
          isLoading={isLoading}
          className="mt-2 h-12"
        >
          {authMethod === 'password' ? 'Create Account' : 'Send 6-Digit Code'}
        </Button>
      </form>

      <div className="mt-8 text-center border-t border-outline-variant/30 pt-6">
        <p className="text-sm text-on-surface-variant">
          Already have an account?
          <button 
            type="button"
            onClick={() => setAuthMode('login')}
            className="ml-2 font-bold text-primary hover:underline"
          >
            Log in
          </button>
        </p>
      </div>
    </>
  );
};
