import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  signInWithEmail, 
  sendEmailOTP, 
  verifyEmailOTP, 
  signInWithGoogle, 
  resetPassword 
} from '@/lib/firebase/api/auth';

export type AuthMode = 'login' | 'signup' | 'forgot_password' | 'otp_sent' | 'otp_sent_signup';
export type AuthMethod = 'password' | 'otp';

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

const getErrorMessage = (error: unknown, defaultMessage: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && 'message' in error && error.message) return String(error.message);
  return defaultMessage;
};

export const useAuthFlow = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimerSeconds, setResendTimerSeconds] = useState(60);

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

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Successfully signed in with Google');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Google sign in failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        if (!businessName.trim()) {
          throw new Error('Business Name is required for signup.');
        }
        AuthStorage.saveSignupData(businessName.trim(), password);
        setResendTimerSeconds(60);
        await sendEmailOTP(emailAddress);
        setAuthMode('otp_sent_signup');
        toast.success('Verification code sent to your email.');
      } else {
        await signInWithEmail(emailAddress, password);
        toast.success('Successfully signed in.');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Authentication failed. Check your credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOTP = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        if (!businessName.trim()) {
           throw new Error('Business Name is required for signup.');
        }
        AuthStorage.saveLoginBusinessName(businessName.trim());
      }
      setResendTimerSeconds(60);
      await sendEmailOTP(emailAddress);
      setAuthMode(authMode === 'signup' ? 'otp_sent_signup' : 'otp_sent');
      toast.success('Verification code sent to your email.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to send verification code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleVerifyOTP = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const isSignupFlow = authMode === 'otp_sent_signup';
      const storedBusinessName = isSignupFlow 
        ? AuthStorage.getSignupData().businessName 
        : AuthStorage.getLoginBusinessName();
      
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
      toast.success('Successfully verified and signed in.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to verify OTP code.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailAddress) {
      toast.error('Please enter your email address first.');
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(emailAddress);
      toast.success('Password reset email sent! Please check your inbox.');
      setAuthMode('login');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to send password reset email.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      await sendEmailOTP(emailAddress);
      setResendTimerSeconds(60);
      toast.success('A new verification code has been sent!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to resend the verification code.'));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    authMode,
    setAuthMode,
    authMethod,
    setAuthMethod,
    emailAddress,
    setEmailAddress,
    password,
    setPassword,
    businessName,
    setBusinessName,
    otpCode,
    setOtpCode,
    isLoading,
    resendTimerSeconds,
    handleGoogleSignIn,
    handlePasswordSubmit,
    handleRequestOTP,
    handleVerifyOTP,
    handleResetPasswordRequest,
    handleResendOTP
  };
};
