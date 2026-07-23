import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut 
} from "firebase/auth";
import { auth, db } from "../config";
import { doc, getDoc, writeBatch, Timestamp } from "firebase/firestore";
import type { UserProfile } from "../types";

// ============================================================================
// CONSTANTS
// ============================================================================

const ACTION_CODE_SETTINGS = {
  url: window.location.origin + '/',
  handleCodeInApp: true,
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Helper to initialize tenant infrastructure (User Profile & Settings) for a new user.
 */
const initializeNewTenant = async (
  uid: string,
  businessName: string,
  ownerName: string,
  phone: string
): Promise<UserProfile> => {
  const newStoreId = "STORE_" + Date.now();
  const newUserProfile: UserProfile = {
    uid: uid,
    store_id: newStoreId,
    role: 'ADMIN',
    phone: phone,
    name: ownerName,
    is_active: true,
    created_at: Timestamp.now()
  };

  const batch = writeBatch(db);
  batch.set(doc(db, "Users", uid), newUserProfile);
  batch.set(doc(db, "Settings", newStoreId), {
    business_id: newStoreId,
    store_id: newStoreId,
    business_name: businessName,
    owner_name: ownerName,
    phone: phone,
    address: '',
    gstin: '',
    upi_id: '',
    bank_account: '',
    bank_ifsc: ''
  });

  await batch.commit();
  return newUserProfile;
};

// ============================================================================
// EMAIL / PASSWORD AUTHENTICATION
// ============================================================================

/**
 * Signs in a user using their email and password.
 * 
 * @param email - The user's email address.
 * @param password - The user's password.
 * @returns The associated UserProfile from Firestore.
 * @throws Error if authentication fails or if the user profile does not exist.
 */
export const signInWithEmail = async (email: string, password: string): Promise<UserProfile> => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const user = result.user;

  const userRef = doc(db, "Users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("User profile not found. Please sign up first.");
  }

  return userSnap.data() as UserProfile;
};

/**
 * Creates a new user account with email and password, and initializes 
 * their tenant infrastructure (Store ID, Settings, Profile) in Firestore.
 * 
 * @param email - The user's email address.
 * @param password - The user's desired password.
 * @param businessName - The name of the business.
 * @param ownerName - The owner's name.
 * @param phone - The business contact number.
 * @returns The newly created UserProfile.
 */
export const signUpWithEmail = async (
  email: string, 
  password: string,
  businessName: string,
  ownerName: string,
  phone: string
): Promise<UserProfile> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;

  return await initializeNewTenant(user.uid, businessName, ownerName, phone);
};

// ============================================================================
// MAGIC LINK AUTHENTICATION
// ============================================================================

/**
 * Sends a magic sign-in link to the provided email address.
 */
export const sendSignInLink = async (email: string): Promise<void> => {
  await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
  // Store the email locally so we can confirm it upon redirect return
  window.localStorage.setItem('emailForSignIn', email);
};

/**
 * Validates if a given URL string contains a valid Firebase Email Link.
 */
export const checkIsSignInWithEmailLink = (link: string): boolean => {
  return isSignInWithEmailLink(auth, link);
};

/**
 * Completes the authentication process using an email magic link.
 * If the user is new, their tenant infrastructure is created automatically.
 */
export const completeSignInWithLink = async (
  email: string,
  link: string,
  businessName?: string,
  ownerName?: string,
  phone?: string
): Promise<{ isNewUser: boolean; profile: UserProfile }> => {
  if (!isSignInWithEmailLink(auth, link)) {
    throw new Error('Invalid sign-in link.');
  }
  
  const result = await signInWithEmailLink(auth, email, link);
  const user = result.user;
  window.localStorage.removeItem('emailForSignIn');

  const userRef = doc(db, "Users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { isNewUser: false, profile: userSnap.data() as UserProfile };
  }

  // Handle New User
  const newUserProfile = await initializeNewTenant(
    user.uid, 
    businessName || '', 
    ownerName || '', 
    phone || ''
  );

  return { isNewUser: true, profile: newUserProfile };
};

// ============================================================================
// OTP AUTHENTICATION
// ============================================================================

/**
 * Requests the backend to send a 6-digit OTP to the provided email.
 */
export const sendEmailOTP = async (email: string): Promise<void> => {
  const response = await fetch('/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to send OTP verification code.');
  }
};

/**
 * Verifies an OTP code via the backend API and logs the user in using a Custom Token.
 */
export const verifyEmailOTP = async (
  email: string, 
  code: string,
  _businessName?: string,
  _ownerName?: string,
  _phone?: string
): Promise<{ isNewUser: boolean; profile: UserProfile | null }> => {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
  
  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (error) {
    throw new Error(`Server returned an invalid response: ${rawText.substring(0, 200)}...`);
  }
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to verify OTP code.');
  }

  // Authenticate the client using the Custom Token from the backend
  const { signInWithCustomToken } = await import('firebase/auth');
  const result = await signInWithCustomToken(auth, data.token);
  const user = result.user;

  // Retrieve the profile if it exists
  const userRef = doc(db, "Users", user.uid);
  const userSnap = await getDoc(userRef);

  return { 
    isNewUser: data.isNewUser, 
    profile: userSnap.exists() ? userSnap.data() as UserProfile : null 
  };
};

// ============================================================================
// OAUTH & SOCIAL AUTHENTICATION
// ============================================================================

/**
 * Initiates Google OAuth popup flow.
 * If the user is new, creates their tenant infrastructure.
 */
export const signInWithGoogle = async (): Promise<{ isNewUser: boolean; profile: UserProfile }> => {
  const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const userRef = doc(db, "Users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { isNewUser: false, profile: userSnap.data() as UserProfile };
  }

  // Handle New User
  const newUserProfile = await initializeNewTenant(
    user.uid,
    user.displayName || 'My Business',
    user.displayName || '',
    user.phoneNumber || ''
  );

  return { isNewUser: true, profile: newUserProfile };
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Fetches the user profile from Firestore by User ID.
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "Users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
};

/**
 * Initiates the password reset flow.
 */
export const resetPassword = async (email: string): Promise<void> => {
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(auth, email);
};

/**
 * Signs out the currently authenticated user.
 */
export const signOut = async (): Promise<void> => {
  return await firebaseSignOut(auth);
};
