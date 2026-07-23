import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { BusinessProfile } from '@/lib/firebase/types';
import { getBusinessProfile } from '@/lib/firebase/api/settings';
import { useAuth } from './AuthContext';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Defines the shape of the global Business context.
 */
interface BusinessContextType {
  /** The detailed business profile from Firestore */
  profile: BusinessProfile | null;
  /** True while the profile is being fetched */
  loading: boolean;
  /** Manually triggers a re-fetch of the business profile */
  refreshProfile: () => Promise<void>;
}

// ============================================================================
// CONTEXT SETUP
// ============================================================================

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

/**
 * Provides global business settings and profile data to the application.
 * Automatically fetches the profile when the authenticated user's store_id becomes available.
 */
export const BusinessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile: authProfile } = useAuth();
  
  // --- State ---
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Data Fetching ---
  const fetchProfile = useCallback(async () => {
    // If no store_id is available (e.g., user logged out or profile incomplete), reset state
    if (!authProfile?.store_id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const fetchedProfile = await getBusinessProfile(authProfile.store_id);
      setProfile(fetchedProfile);
    } catch (error) {
      console.error("BusinessContext: Failed to load business profile", error);
    } finally {
      setLoading(false);
    }
  }, [authProfile?.store_id]);

  // --- Effects ---
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <BusinessContext.Provider value={{ profile, loading, refreshProfile: fetchProfile }}>
      {children}
    </BusinessContext.Provider>
  );
};

// ============================================================================
// CUSTOM HOOK
// ============================================================================

/**
 * Custom hook to consume the BusinessContext safely.
 * Throws an error if used outside of a BusinessProvider.
 */
export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};
