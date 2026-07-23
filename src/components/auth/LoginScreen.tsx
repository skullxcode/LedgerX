import React, { useState, useEffect } from 'react';
import { 
  signInWithEmail, 
  sendEmailOTP, 
  verifyEmailOTP, 
  signInWithGoogle, 
  resetPassword 
} from '@/lib/firebase';

/**
 * Defines the possible states of the authentication flow.
 * - 'login': Standard sign-in screen
 * - 'signup': New account creation screen
 * - 'forgot_password': Password reset request screen
 * - 'otp_sent': Awaiting OTP confirmation for login
 * - 'otp_sent_signup': Awaiting OTP confirmation for signup
 */
type AuthMode = 'login' | 'signup' | 'forgot_password' | 'otp_sent' | 'otp_sent_signup';

/**
 * Defines the selected authentication mechanism.
 */
type AuthMethod = 'password' | 'otp';

export const LoginScreen: React.FC = () => {
  // --- View State ---
  const [currentMode, setCurrentMode] = useState<AuthMode>('login');
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<AuthMethod>('password');

  // --- Form Data ---
  const [emailAddress, setEmailAddress] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  // --- UI Feedback State ---
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(60);

  /**
   * Manages the countdown timer for resending OTP emails.
   * Decrements every second when in an OTP confirmation mode.
   */
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;
    const isOtpMode = currentMode === 'otp_sent' || currentMode === 'otp_sent_signup';
    
    if (isOtpMode && otpResendTimer > 0) {
      countdownInterval = setInterval(() => setOtpResendTimer(prev => prev - 1), 1000);
    }
    
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [currentMode, otpResendTimer]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Initiates the Google OAuth sign-in flow.
   * Firebase handles the popup/redirect and App.tsx automatically detects the state change.
   */
  const handleGoogleSignIn = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      await signInWithGoogle();
      // Note: On success, AuthContext will update and unmount this component.
    } catch (error: any) {
      setErrorMessage(error.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handles traditional email/password authentication for both login and signup.
   */
  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsProcessing(true);

    try {
      if (currentMode === 'signup') {
        if (!businessName.trim()) {
          throw new Error("Business Name is required for signup.");
        }
        
        // Temporarily store signup details to complete the flow after OTP verification
        window.localStorage.setItem('signup_businessName', businessName.trim());
        window.localStorage.setItem('signup_password', userPassword);
        
        setOtpResendTimer(60);
        await sendEmailOTP(emailAddress);
        setCurrentMode('otp_sent_signup');
      } else {
        await signInWithEmail(emailAddress, userPassword);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Authentication failed. Check your credentials.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Initiates the OTP email flow by requesting a code from the backend API.
   */
  const handleSendOTP = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsProcessing(true);

    try {
      if (currentMode === 'signup') {
        if (!businessName.trim()) {
           throw new Error("Business Name is required for signup.");
        }
        window.localStorage.setItem('otp_businessName', businessName.trim());
      }
      
      setOtpResendTimer(60);
      await sendEmailOTP(emailAddress);
      setCurrentMode(currentMode === 'signup' ? 'otp_sent_signup' : 'otp_sent');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Completes the OTP verification process. 
   * For signups, it also configures the initial user profile.
   */
  const handleOTPComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const storedBusinessName = window.localStorage.getItem(
        currentMode === 'otp_sent_signup' ? 'signup_businessName' : 'otp_businessName'
      ) || undefined;
      
      // Extract owner name from email prefix as a fallback
      const ownerNameFallback = emailAddress.split('@')[0];

      // Verify the code via our custom backend
      const verificationResponse = await verifyEmailOTP(
        emailAddress, 
        verificationCode, 
        storedBusinessName, 
        ownerNameFallback
      );

      if (currentMode === 'otp_sent_signup') {
        // Prevent existing users from completing a signup flow
        if (!verificationResponse.isNewUser) {
           const { getAuth, signOut } = await import('firebase/auth');
           await signOut(getAuth());
           throw new Error("An account with this email already exists. Please log in instead.");
        }

        // Apply the password if it was set during the password signup flow
        const storedPassword = window.localStorage.getItem('signup_password');
        if (storedPassword) {
           const { updatePassword, getAuth } = await import('firebase/auth');
           const auth = getAuth();
           if (auth.currentUser) {
              await updatePassword(auth.currentUser, storedPassword);
           }
        }
        
        // Clean up temporary storage
        window.localStorage.removeItem('signup_businessName');
        window.localStorage.removeItem('signup_password');
      } else {
        window.localStorage.removeItem('otp_businessName');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to verify OTP code.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Requests a password reset email from Firebase Auth.
   */
  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    
    if (!emailAddress) {
      setErrorMessage('Please enter your email address first.');
      return;
    }
    
    setIsProcessing(true);
    try {
      await resetPassword(emailAddress);
      setSuccessMessage('Password reset email sent! Please check your inbox.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to send password reset email.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Resends the OTP email and resets the countdown timer.
   */
  const handleResendOTP = async () => {
    setErrorMessage('');
    setIsProcessing(true);
    try {
      await sendEmailOTP(emailAddress);
      setOtpResendTimer(60);
      setSuccessMessage('A new verification code has been sent!');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to resend the verification code.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // --- Render: Forgot Password View ---
  if (currentMode === 'forgot_password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-8">
          <h2 className="text-2xl font-bold text-primary mb-2">Reset Password</h2>
          <p className="text-on-surface-variant text-sm mb-6">Enter your email and we will send you a link to reset your password.</p>
          
          {errorMessage && <div className="mb-4 p-3 bg-error-container text-on-error-container text-sm rounded-lg">{errorMessage}</div>}
          {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-800 text-sm rounded-lg">{successMessage}</div>}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none p-3"
                placeholder="you@example.com"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing || !emailAddress}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold disabled:opacity-50 transition-opacity"
            >
              {isProcessing ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <button onClick={() => { setCurrentMode('login'); setErrorMessage(''); setSuccessMessage(''); }} className="mt-6 w-full text-center text-primary text-sm font-medium hover:underline">
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  // --- Render: OTP Confirmation View ---
  if (currentMode === 'otp_sent' || currentMode === 'otp_sent_signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-8 text-center">
          <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[32px] text-primary">mark_email_read</span>
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">Check your email</h2>
          <p className="text-on-surface-variant text-sm mb-6">
            We've sent a 6-digit verification code to <span className="font-bold text-on-surface">{emailAddress}</span>.
            <br/><span className="text-[12px] italic mt-2 block text-secondary">Please check spam emails for OTP as it might be delivered there.</span>
          </p>
          
          {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-800 text-sm rounded-lg text-left">{successMessage}</div>}
          {errorMessage && <div className="mb-4 p-3 bg-error-container text-on-error-container text-sm rounded-lg text-left">{errorMessage}</div>}
          
          <form onSubmit={handleOTPComplete} className="space-y-6 mb-6">
            <input
              type="text"
              maxLength={6}
              className="w-full text-center tracking-[1em] font-mono text-3xl border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-4"
              placeholder="000000"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))} // Ensure only numbers
            />
            <button
              type="submit"
              disabled={isProcessing || verificationCode.length !== 6}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold disabled:opacity-50 transition-opacity shadow-sm"
            >
              {isProcessing ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={otpResendTimer > 0 || isProcessing}
              className="w-full mt-4 text-primary text-sm font-medium hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {otpResendTimer > 0 ? `Resend Code in ${otpResendTimer}s` : 'Resend Code'}
            </button>
          </form>

          <button onClick={() => { setCurrentMode('login'); setVerificationCode(''); }} className="text-primary text-sm font-medium hover:underline">
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  // --- Render: Main Authentication View ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-8">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-primary tracking-tight mb-2">LedgerX</h2>
          <p className="text-on-surface-variant text-sm">
            {currentMode === 'login' ? 'Welcome back to your business' : 'Create your business account'}
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-3 bg-error-container text-on-error-container text-sm rounded-lg flex items-start gap-2">
            <span className="material-symbols-outlined text-lg shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Social Authentication */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-3 bg-white border border-outline-variant py-3 px-4 rounded-xl text-on-surface font-medium hover:bg-surface-variant transition-colors shadow-sm disabled:opacity-50 mb-6"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-outline-variant/50"></div>
          <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Or</span>
          <div className="flex-1 h-px bg-outline-variant/50"></div>
        </div>

        {/* Authentication Method Toggle (Password vs OTP) */}
        <div className="flex bg-surface-variant/50 p-1.5 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => setSelectedAuthMethod('password')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${selectedAuthMethod === 'password' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setSelectedAuthMethod('otp')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${selectedAuthMethod === 'otp' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Email Code
          </button>
        </div>

        {/* Credentials Form */}
        <form onSubmit={selectedAuthMethod === 'password' ? handlePasswordSubmit : handleSendOTP} className="space-y-4">
          
          {/* Business Name Field (Signup Only) */}
          {currentMode === 'signup' && (
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

          {/* Email Field (Always Required) */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none p-3 bg-surface"
              placeholder="you@example.com"
              value={emailAddress}
              onChange={e => setEmailAddress(e.target.value)}
            />
          </div>

          {/* Password Field (Only if Password method selected) */}
          {selectedAuthMethod === 'password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-on-surface">Password</label>
                {currentMode === 'login' && (
                  <button type="button" onClick={() => setCurrentMode('forgot_password')} className="text-xs font-medium text-primary hover:underline">
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                className="w-full border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none p-3 bg-surface"
                placeholder="••••••••"
                value={userPassword}
                onChange={e => setUserPassword(e.target.value)}
              />
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isProcessing}
            className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50 mt-2"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (
              selectedAuthMethod === 'password' ? (currentMode === 'login' ? 'Sign In' : 'Create Account') : 'Send 6-Digit Code'
            )}
          </button>
        </form>

        {/* Form Footer (Toggle Login/Signup) */}
        <div className="mt-8 text-center border-t border-outline-variant/30 pt-6">
          <p className="text-sm text-on-surface-variant">
            {currentMode === 'login' ? "Don't have an account?" : "Already have an account?"}
            <button 
              type="button"
              onClick={() => { setCurrentMode(currentMode === 'login' ? 'signup' : 'login'); setErrorMessage(''); }}
              className="ml-2 font-bold text-primary hover:underline"
            >
              {currentMode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};
