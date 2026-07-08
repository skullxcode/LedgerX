import { useState, useEffect } from "react";
import { CustomerList } from './CustomerList';
import { CustomerProfile } from './CustomerProfile';
import { type Customer, getCustomer } from '@ledgerx/firebase-shared';
import { useAuth } from '../../context/AuthContext';

interface CRMDashboardProps {
  onViewTransaction?: (txId: string) => void;
  initialCustomerId?: string | null;
}

export const CRMDashboard: React.FC<CRMDashboardProps> = ({ onViewTransaction, initialCustomerId }) => {
  const { profile } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const load = async () => {
      if (initialCustomerId && profile?.store_id) {
        const cust = await getCustomer(profile.store_id, initialCustomerId);
        if (cust) setSelectedCustomer(cust);
      }
    };
    load();
  }, [initialCustomerId, profile?.store_id]);

  return (
    <div className="max-w-container-max mx-auto p-4 md:p-margin-desktop h-[calc(100dvh-4rem)] flex flex-col md:flex-row gap-6 overflow-hidden">
      <div className={`w-full md:w-1/3 md:max-w-sm flex-col h-full shrink-0 ${selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
        <CustomerList 
          onSelect={setSelectedCustomer} 
          selectedId={selectedCustomer?.customer_id} 
        />
      </div>
      <div className={`flex-1 flex-col h-full overflow-hidden bg-white rounded-lg border border-outline-variant shadow-sm min-w-0 ${selectedCustomer ? 'flex' : 'hidden md:flex'}`}>
        {selectedCustomer ? (
          <CustomerProfile 
            customer={selectedCustomer} 
            onViewTransaction={onViewTransaction} 
            onBack={() => setSelectedCustomer(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-secondary font-body-md italic text-center p-8">
              <span className="material-symbols-outlined block text-[48px] text-outline-variant mb-4 mx-auto">group</span>
              Select a customer from the list to view their complete profile, Udhaar balance, active repairs, and transaction history.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
