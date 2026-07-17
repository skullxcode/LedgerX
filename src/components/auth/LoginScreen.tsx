import React, { useState } from 'react';
import { signInWithEmail, signUpWithEmail, sendEmailOTP, verifyEmailOTP, signInWithGoogle, resetPassword } from '@/lib/firebase';

type AuthMode = 'login' | 'signup' | 'forgot_password' | 'otp_sent' | 'otp_sent_signup';

export const LoginScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [authMethod, setAuthMethod] = useState<'password' | 'otp'>('password');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = React.useState(60);

  React.useEffect(() => {
    let timer: any;
    if ((mode === 'otp_sent' || mode === 'otp_sent_signup') && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [mode, timeLeft]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setGlobalError('');
    try {
      await signInWithGoogle();
      // App.tsx handles auth state changes automatically
    } catch (err: any) {
      setGlobalError(err.message || 'Google sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!businessName) throw new Error("Business Name is required");
        window.localStorage.setItem('signup_businessName', businessName.trim());
        window.localStorage.setItem('signup_password', password);
        setTimeLeft(60);
        await sendEmailOTP(email);
        setMode('otp_sent_signup');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    setLoading(true);
    try {
      if (mode === 'signup' && !businessName) throw new Error("Business Name is required");
      
      if (mode === 'signup') {
        window.localStorage.setItem('otp_businessName', businessName.trim());
      }
      
      setTimeLeft(60);
      await sendEmailOTP(email);
      setMode('otp_sent');
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGlobalError('');
    try {
      if (mode === 'otp_sent_signup') {
        const storedBusinessName = window.localStorage.getItem('signup_businessName') || undefined;
        const storedPassword = window.localStorage.getItem('signup_password');

        const res = await verifyEmailOTP(email, otpCode, storedBusinessName, email.split('@')[0]);
        
        if (!res.isNewUser) {
           const { getAuth, signOut } = await import('firebase/auth');
           await signOut(getAuth());
           throw new Error("An account with this email already exists. Please log in instead.");
        }

        if (storedPassword) {
           const { updatePassword, getAuth } = await import('firebase/auth');
           const auth = getAuth();
           if (auth.currentUser) {
              await updatePassword(auth.currentUser, storedPassword);
           }
        }
        window.localStorage.removeItem('signup_businessName');
        window.localStorage.removeItem('signup_password');
      } else {
        const storedBusinessName = window.localStorage.getItem('otp_businessName') || undefined;
        await verifyEmailOTP(email, otpCode, storedBusinessName, email.split('@')[0]);
        window.localStorage.removeItem('otp_businessName');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to verify OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    setSuccessMsg('');
    if (!email) {
      setGlobalError('Please enter your email first.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccessMsg('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setGlobalError('');
    setLoading(true);
    try {
      await sendEmailOTP(email);
      setTimeLeft(60);
      setSuccessMsg('A new verification code has been sent!');
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Screen ──────────────────────────────────────────────────
  if (mode === 'forgot_password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-8">
          <h2 className="text-2xl font-bold text-primary mb-2">Reset Password</h2>
          <p className="text-on-surface-variant text-sm mb-6">Enter your email and we will send you a link to reset your password.</p>
          
          {globalError && <div className="mb-4 p-3 bg-error-container text-on-error-container text-sm rounded-lg">{globalError}</div>}
          {successMsg && <div className="mb-4 p-3 bg-green-100 text-green-800 text-sm rounded-lg">{successMsg}</div>}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none p-3"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <button onClick={() => { setMode('login'); setGlobalError(''); setSuccessMsg(''); }} className="mt-6 w-full text-center text-primary text-sm font-medium hover:underline">
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  // ── OTP Confirm Screen ────────────────────────────────────────────────────────
  if (mode === 'otp_sent' || mode === 'otp_sent_signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-8 text-center">
          <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[32px] text-primary">mark_email_read</span>
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">Check your email</h2>
          <p className="text-on-surface-variant text-sm mb-6">
            We've sent a 6-digit verification code to <span className="font-bold text-on-surface">{email}</span>.
          </p>
          
          {successMsg && <div className="mb-4 p-3 bg-green-100 text-green-800 text-sm rounded-lg text-left">{successMsg}</div>}
          {globalError && <div className="mb-4 p-3 bg-error-container text-on-error-container text-sm rounded-lg text-left">{globalError}</div>}
          
          <form onSubmit={handleOTPComplete} className="space-y-6 mb-6">
            <input
              type="text"
              maxLength={6}
              className="w-full text-center tracking-[1em] font-mono text-3xl border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-4"
              placeholder="000000"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
            />
            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold disabled:opacity-50 transition-opacity shadow-sm"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={timeLeft > 0 || loading}
              className="w-full mt-4 text-primary text-sm font-medium hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {timeLeft > 0 ? `Resend Code in ${timeLeft}s` : 'Resend Code'}
            </button>
          </form>

          <button onClick={() => { setMode('login'); setOtpCode(''); }} className="text-primary text-sm font-medium hover:underline">
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  // ── Main Auth Screen ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-primary tracking-tight mb-2">LedgerX</h2>
          <p className="text-on-surface-variant text-sm">
            {mode === 'login' ? 'Welcome back to your business' : 'Create your business account'}
          </p>
        </div>

        {globalError && (
          <div className="mb-6 p-3 bg-error-container text-on-error-container text-sm rounded-lg flex items-start gap-2">
            <span className="material-symbols-outlined text-lg shrink-0">error</span>
            <span>{globalError}</span>
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-outline-variant py-3 px-4 rounded-xl text-on-surface font-medium hover:bg-surface-variant transition-colors shadow-sm disabled:opacity-50 mb-6"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-outline-variant/50"></div>
          <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Or</span>
          <div className="flex-1 h-px bg-outline-variant/50"></div>
        </div>

        {/* Auth Method Toggle */}
        <div className="flex bg-surface-variant/50 p-1.5 rounded-xl mb-6">
          <button
            onClick={() => setAuthMethod('password')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${authMethod === 'password' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Password
          </button>
          <button
            onClick={() => setAuthMethod('otp')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${authMethod === 'otp' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Email Code
          </button>
        </div>

        {/* Main Form */}
        <form onSubmit={authMethod === 'password' ? handlePasswordSubmit : handleSendOTP} className="space-y-4">
          
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Business Name</label>
              <input
                type="text"
                required
                className="w-full border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none p-3 bg-surface"
                placeholder="Acme Corp"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none p-3 bg-surface"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {authMethod === 'password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-on-surface">Password</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => setMode('forgot_password')} className="text-xs font-medium text-primary hover:underline">
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                className="w-full border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none p-3 bg-surface"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (
              authMethod === 'password' ? (mode === 'login' ? 'Sign In' : 'Create Account') : 'Send 6-Digit Code'
            )}
          </button>
        </form>

        {/* Footer Toggle */}
        <div className="mt-8 text-center border-t border-outline-variant/30 pt-6">
          <p className="text-sm text-on-surface-variant">
            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setGlobalError(''); }}
              className="ml-2 font-bold text-primary hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};
