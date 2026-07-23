import { useState, useEffect } from "react";
import { CustomerList } from './CustomerList';
import { CustomerProfile } from './CustomerProfile';
import { type Customer, getCustomer, createCustomer, getLatestDocumentNo } from '@/lib/firebase';
import { useAuth } from '../../context/AuthContext';

export interface CRMDashboardProps {
  /** Optional callback to view a specific transaction from the customer's history */
  onViewTransaction?: (txId: string) => void;
  /** Optional Customer ID to load and select by default */
  initialCustomerId?: string | null;
}

/**
 * The Customer Relationship Management (CRM) dashboard.
 * Provides a split-pane view with a searchable customer list and detailed customer profiles.
 */
export const CRMDashboard: React.FC<CRMDashboardProps> = ({ onViewTransaction, initialCustomerId }) => {
  const { profile, user } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addGstin, setAddGstin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          onAddNew={() => setShowAddCustomer(true)}
        />
      </div>
      <div className={`flex-1 flex-col h-full overflow-hidden bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm min-w-0 ${selectedCustomer ? 'flex' : 'hidden md:flex'}`}>
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

      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest p-6 rounded-lg w-full max-w-md shadow-xl border border-outline-variant">
            <h3 className="font-headline-md text-headline-md text-primary mb-4">Add New Customer</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!profile?.store_id) return;
              setIsSubmitting(true);
              try {
                const custId = await getLatestDocumentNo(profile.store_id, 'CUST-');
                await createCustomer(
                  profile.store_id, 
                  custId, 
                  addName, 
                  addPhone, 
                  addAddress, 
                  addGstin, 
                  addEmail, 
                  user?.email || 'System'
                );
                
                // Refresh list or close and select
                setShowAddCustomer(false);
                setAddName('');
                setAddPhone('');
                setAddEmail('');
                setAddAddress('');
                setAddGstin('');
                
                const newCust = await getCustomer(profile.store_id, custId);
                if (newCust) setSelectedCustomer(newCust);
              } catch (err: any) {
                alert("Failed to create customer: " + err.message);
              } finally {
                setIsSubmitting(false);
              }
            }}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-label-md text-secondary mb-1">Name *</label>
                  <input required className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={addName} onChange={e => setAddName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-label-md text-secondary mb-1">Phone *</label>
                  <input required className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={addPhone} onChange={e => setAddPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block text-label-md text-secondary mb-1">Email</label>
                  <input type="email" className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={addEmail} onChange={e => setAddEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-label-md text-secondary mb-1">Address</label>
                  <input className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={addAddress} onChange={e => setAddAddress(e.target.value)} />
                </div>
                <div>
                  <label className="block text-label-md text-secondary mb-1">GSTIN</label>
                  <input className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary uppercase" value={addGstin} onChange={e => setAddGstin(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="px-4 py-2 border border-outline-variant rounded text-secondary hover:bg-surface-container" onClick={() => setShowAddCustomer(false)}>Cancel</button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-on-primary rounded hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
