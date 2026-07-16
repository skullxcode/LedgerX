import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut 
} from "firebase/auth";
import { auth, db } from "../config";
import { doc, getDoc, setDoc, writeBatch, Timestamp } from "firebase/firestore";
import { UserProfile } from "../types";

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

export const signUpWithEmail = async (
  email: string, 
  password: string,
  businessName: string,
  ownerName: string,
  phone: string
): Promise<UserProfile> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;

  // Generate a new store_id for a new tenant
  const newStoreId = "STORE_" + Date.now();
  const newUserProfile: UserProfile = {
    uid: user.uid,
    store_id: newStoreId,
    role: 'ADMIN',
    phone: phone,
    name: ownerName,
    is_active: true,
    created_at: Timestamp.now()
  };
  
  // Create user profile FIRST
  const userRef = doc(db, "Users", user.uid);
  await setDoc(userRef, newUserProfile);
  
  // Create initial business profile SECOND
  const settingsRef = doc(db, "Settings", newStoreId);
  await setDoc(settingsRef, {
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

  return newUserProfile;
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "Users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
};

export const signOut = async () => {
  return await firebaseSignOut(auth);
};

const ACTION_CODE_SETTINGS = {
  url: window.location.origin + '/',
  handleCodeInApp: true,
};

export const sendSignInLink = async (email: string): Promise<void> => {
  await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
  // Store the email locally so we can confirm on return
  window.localStorage.setItem('emailForSignIn', email);
};

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

  // New user — create profile
  const newStoreId = "STORE_" + Date.now();
  const newUserProfile: UserProfile = {
    uid: user.uid,
    store_id: newStoreId,
    role: 'ADMIN',
    phone: phone || '',
    name: ownerName || '',
    is_active: true,
    created_at: Timestamp.now()
  };

  await setDoc(userRef, newUserProfile);
  await setDoc(doc(db, "Settings", newStoreId), {
    business_id: newStoreId,
    store_id: newStoreId,
    business_name: businessName || '',
    owner_name: ownerName || '',
    phone: phone || '',
    address: '', gstin: '', upi_id: '', bank_account: '', bank_ifsc: ''
  });

  return { isNewUser: true, profile: newUserProfile };
};

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

  // New user — create profile
  const newStoreId = "STORE_" + Date.now();
  const newUserProfile: UserProfile = {
    uid: user.uid,
    store_id: newStoreId,
    role: 'ADMIN',
    phone: user.phoneNumber || '',
    name: user.displayName || '',
    is_active: true,
    created_at: Timestamp.now()
  };

  await setDoc(userRef, newUserProfile);
  await setDoc(doc(db, "Settings", newStoreId), {
    business_id: newStoreId,
    store_id: newStoreId,
    business_name: user.displayName || 'My Business',
    owner_name: user.displayName || '',
    phone: user.phoneNumber || '',
    address: '', gstin: '', upi_id: '', bank_account: '', bank_ifsc: ''
  });

  return { isNewUser: true, profile: newUserProfile };
};

export const resetPassword = async (email: string): Promise<void> => {
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(auth, email);
};

export const checkIsSignInWithEmailLink = (link: string): boolean => {
  return isSignInWithEmailLink(auth, link);
};

export const sendEmailOTP = async (email: string): Promise<void> => {
  const res = await fetch('http://localhost:4000/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
};

export const verifyEmailOTP = async (
  email: string, 
  code: string,
  businessName?: string,
  ownerName?: string,
  phone?: string
): Promise<{ isNewUser: boolean; profile: UserProfile }> => {
  const res = await fetch('http://localhost:4000/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to verify OTP');

  const { signInWithCustomToken } = await import('firebase/auth');
  const result = await signInWithCustomToken(auth, data.token);
  const user = result.user;

  const userRef = doc(db, "Users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { isNewUser: false, profile: userSnap.data() as UserProfile };
  }

  // New user — create profile
  const newStoreId = "STORE_" + Date.now();
  const newUserProfile: UserProfile = {
    uid: user.uid,
    store_id: newStoreId,
    role: 'ADMIN',
    phone: phone || '',
    name: ownerName || '',
    is_active: true,
    created_at: Timestamp.now()
  };

  await setDoc(userRef, newUserProfile);
  await setDoc(doc(db, "Settings", newStoreId), {
    business_id: newStoreId,
    store_id: newStoreId,
    business_name: businessName || '',
    owner_name: ownerName || '',
    phone: phone || '',
    address: '', gstin: '', upi_id: '', bank_account: '', bank_ifsc: ''
  });

  return { isNewUser: true, profile: newUserProfile };
};
