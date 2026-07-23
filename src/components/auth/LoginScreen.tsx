import React, { useState, useEffect } from 'react';
import { 
  signInWithEmail, 
  sendEmailOTP, 
  verifyEmailOTP, 
  signInWithGoogle, 
  resetPassword 
} from '@/lib/firebase';

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Manages temporary storage of user data during multi-step authentication flows.
 * This ensures data is preserved between steps (e.g., before and after OTP verification)
 * since the flow might be interrupted or reloaded.
 */
const AuthStorage = {
  saveSignupData: (businessName: string, password?: string) => {
    window.localStorage.setItem('signup_businessName', businessName);
    if (password) {
      window.localStorage.setItem('signup_password', password);
    }
  },
  
  getSignupData: () => ({
    businessName: window.localStorage.getItem('signup_businessName') || undefined,
    password: window.localStorage.getItem('signup_password') || undefined
  }),
  
  clearSignupData: () => {
    window.localStorage.removeItem('signup_businessName');
    window.localStorage.removeItem('signup_password');
  },
  
  saveLoginBusinessName: (businessName: string) => {
    window.localStorage.setItem('otp_businessName', businessName);
  },
  
  getLoginBusinessName: () => {
    return window.localStorage.getItem('otp_businessName') || undefined;
  },
  
  clearLoginBusinessName: () => {
    window.localStorage.removeItem('otp_businessName');
  }
};

/**
 * Helper to safely extract error messages from unknown error objects.
 */
const getErrorMessage = (error: unknown, defaultMessage: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && 'message' in error && error.message) return String(error.message);
  return defaultMessage;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const LoginScreen: React.FC = () => {
  // --- View State ---
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');

  // --- Form State ---
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  // --- UI Feedback State ---
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimerSeconds, setResendTimerSeconds] = useState(60);

  /**
   * Effect: Manages the countdown timer for resending OTP emails.
   * Only active when the user is on the OTP confirmation screens.
   */
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;
    const isWaitingForOtp = authMode === 'otp_sent' || authMode === 'otp_sent_signup';
    
    if (isWaitingForOtp && resendTimerSeconds > 0) {
      countdownInterval = setInterval(() => setResendTimerSeconds(prev => prev - 1), 1000);
    }
    
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [authMode, resendTimerSeconds]);

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  /**
   * Resets all status messages (errors and successes).
   */
  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  /**
   * Initiates the Google OAuth sign-in flow.
   * Firebase handles the popup/redirect and external components (like App.tsx) 
   * detect the global auth state change.
   */
  const handleGoogleSignIn = async () => {
    clearMessages();
    setIsLoading(true);
    
    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Google sign in failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles traditional email/password authentication (both login and signup).
   */
  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        if (!businessName.trim()) {
          throw new Error('Business Name is required for signup.');
        }
        
        // Temporarily store signup details to complete the flow after OTP verification
        AuthStorage.saveSignupData(businessName.trim(), password);
        
        setResendTimerSeconds(60);
        await sendEmailOTP(emailAddress);
        setAuthMode('otp_sent_signup');
      } else {
        await signInWithEmail(emailAddress, password);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Authentication failed. Check your credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Initiates the OTP email flow by requesting a code from the backend.
   */
  const handleRequestOTP = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        if (!businessName.trim()) {
           throw new Error('Business Name is required for signup.');
        }
        // Save business name to complete signup on the OTP verification screen
        AuthStorage.saveLoginBusinessName(businessName.trim());
      }
      
      setResendTimerSeconds(60);
      await sendEmailOTP(emailAddress);
      setAuthMode(authMode === 'signup' ? 'otp_sent_signup' : 'otp_sent');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to send verification code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Completes the OTP verification process. 
   * Configures the initial user profile for signups.
   */
  const handleVerifyOTP = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      const isSignupFlow = authMode === 'otp_sent_signup';
      const storedBusinessName = isSignupFlow 
        ? AuthStorage.getSignupData().businessName 
        : AuthStorage.getLoginBusinessName();
      
      // Fallback: Use the portion of the email before the '@' as the owner name
      const ownerNameFallback = emailAddress.split('@')[0];

      const verificationResponse = await verifyEmailOTP(
        emailAddress, 
        otpCode, 
        storedBusinessName, 
        ownerNameFallback
      );

      if (isSignupFlow) {
        await finalizeSignupAfterOTP(verificationResponse.isNewUser);
      } else {
        AuthStorage.clearLoginBusinessName();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to verify OTP code.'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Finalizes the signup process after successful OTP verification.
   * Ensures the user is new, applies any previously stored password, and cleans up storage.
   */
  const finalizeSignupAfterOTP = async (isNewUser: boolean) => {
    if (!isNewUser) {
      const { getAuth, signOut } = await import('firebase/auth');
      await signOut(getAuth());
      throw new Error('An account with this email already exists. Please log in instead.');
    }

    const { password: storedPassword } = AuthStorage.getSignupData();
    if (storedPassword) {
      const { updatePassword, getAuth } = await import('firebase/auth');
      const auth = getAuth();
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, storedPassword);
      }
    }
    
    AuthStorage.clearSignupData();
  };

  /**
   * Requests a password reset email.
   */
  const handleResetPasswordRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    
    if (!emailAddress) {
      setErrorMessage('Please enter your email address first.');
      return;
    }
    
    setIsLoading(true);
    try {
      await resetPassword(emailAddress);
      setSuccessMessage('Password reset email sent! Please check your inbox.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to send password reset email.'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resends the OTP email and restarts the countdown timer.
   */
  const handleResendOTP = async () => {
    clearMessages();
    setIsLoading(true);
    
    try {
      await sendEmailOTP(emailAddress);
      setResendTimerSeconds(60);
      setSuccessMessage('A new verification code has been sent!');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Failed to resend the verification code.'));
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * Renders the generic error/success message banner to ensure consistent styling.
   */
  const renderMessageBanner = (className: string = 'mb-6') => {
    if (errorMessage) {
      return (
        <div className={`${className} p-3 bg-error-container text-on-error-container text-sm rounded-lg flex items-start gap-2 text-left`}>
          <span className="material-symbols-outlined text-lg shrink-0">error</span>
          <span>{errorMessage}</span>
        </div>
      );
    }
    if (successMessage) {
      return (
        <div className={`${className} p-3 bg-green-100 text-green-800 text-sm rounded-lg text-left`}>
          {successMessage}
        </div>
      );
    }
    return null;
  };

  // --- Render: Forgot Password View ---
  if (authMode === 'forgot_password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-8">
          <h2 className="text-2xl font-bold text-primary mb-2">Reset Password</h2>
          <p className="text-on-surface-variant text-sm mb-6">
            Enter your email and we will send you a link to reset your password.
          </p>
          
          {renderMessageBanner('mb-4')}

          <form onSubmit={handleResetPasswordRequest} className="space-y-4">
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
              disabled={isLoading || !emailAddress}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold disabled:opacity-50 transition-opacity"
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <button 
            onClick={() => { setAuthMode('login'); clearMessages(); }} 
            className="mt-6 w-full text-center text-primary text-sm font-medium hover:underline"
          >
            &larr; Back to login
          </button>
        </div>
      </div>
    );
  }

  // --- Render: OTP Confirmation View ---
  if (authMode === 'otp_sent' || authMode === 'otp_sent_signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-8 text-center">
          
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
          
          {renderMessageBanner('mb-4')}
          
          <form onSubmit={handleVerifyOTP} className="space-y-6 mb-6">
            <input
              type="text"
              maxLength={6}
              className="w-full text-center tracking-[1em] font-mono text-3xl border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-4"
              placeholder="000000"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} // Ensure only numeric input
            />
            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold disabled:opacity-50 transition-opacity shadow-sm"
            >
              {isLoading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
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
      </div>
    );
  }

  // --- Render: Main Authentication View (Login / Signup) ---
  const isSignupMode = authMode === 'signup';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-8">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-primary tracking-tight mb-2">LedgerX</h2>
          <p className="text-on-surface-variant text-sm">
            {isSignupMode ? 'Create your business account' : 'Welcome back to your business'}
          </p>
        </div>

        {renderMessageBanner()}

        {/* Social Authentication */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
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

        {/* Authentication Method Toggle */}
        <div className="flex bg-surface-variant/50 p-1.5 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => setAuthMethod('password')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              authMethod === 'password' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod('otp')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              authMethod === 'otp' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Email Code
          </button>
        </div>

        {/* Credentials Form */}
        <form onSubmit={authMethod === 'password' ? handlePasswordSubmit : handleRequestOTP} className="space-y-4">
          
          {/* Business Name Field (Signup Only) */}
          {isSignupMode && (
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

          {/* Password Field (Only for Password Auth Method) */}
          {authMethod === 'password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-on-surface">Password</label>
                {!isSignupMode && (
                  <button 
                    type="button" 
                    onClick={() => { setAuthMode('forgot_password'); clearMessages(); }} 
                    className="text-xs font-medium text-primary hover:underline"
                  >
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

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (
              authMethod === 'password' 
                ? (isSignupMode ? 'Create Account' : 'Sign In') 
                : 'Send 6-Digit Code'
            )}
          </button>
        </form>

        {/* Form Footer (Toggle Login/Signup Mode) */}
        <div className="mt-8 text-center border-t border-outline-variant/30 pt-6">
          <p className="text-sm text-on-surface-variant">
            {isSignupMode ? 'Already have an account?' : "Don't have an account?"}
            <button 
              type="button"
              onClick={() => { setAuthMode(isSignupMode ? 'login' : 'signup'); clearMessages(); }}
              className="ml-2 font-bold text-primary hover:underline"
            >
              {isSignupMode ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};
