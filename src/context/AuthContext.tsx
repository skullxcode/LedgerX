import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { getUserProfile } from '@/lib/firebase/api/auth';
import type { UserProfile } from '@/lib/firebase/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Defines the shape of the global Authentication context.
 */
interface AuthContextType {
  /** The raw Firebase Auth user object, if authenticated */
  user: User | null;
  /** The business profile associated with the user, fetched from Firestore */
  profile: UserProfile | null;
  /** True while initial auth state is being determined */
  loading: boolean;
}

// ============================================================================
// CONTEXT SETUP
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provides global authentication state to the application.
 * Listens to Firebase Auth state changes and automatically fetches the user's
 * business profile from Firestore upon successful login.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Effects ---
  useEffect(() => {
    // Subscribe to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Fetch additional profile data from Firestore
          const userProfile = await getUserProfile(firebaseUser.uid);
          setProfile(userProfile);
        } catch (error) {
          console.error("AuthContext: Failed to fetch user profile", error);
        }
      } else {
        // Clear profile if user logs out
        setProfile(null);
      }
      
      setLoading(false);
    });
    
    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ============================================================================
// CUSTOM HOOK
// ============================================================================

/**
 * Custom hook to consume the AuthContext safely.
 * Throws an error if used outside of an AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
