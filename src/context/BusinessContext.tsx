/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { type BusinessProfile, getBusinessProfile } from '@/lib/firebase';
import { useAuth } from './AuthContext';

interface BusinessContextType {
  profile: BusinessProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!authProfile?.store_id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await getBusinessProfile(authProfile.store_id);
      setProfile(p);
    } catch (e) {
      console.error("Failed to load business profile", e);
    } finally {
      setLoading(false);
    }
  }, [authProfile?.store_id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <BusinessContext.Provider value={{ profile, loading, refreshProfile: fetchProfile }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};
