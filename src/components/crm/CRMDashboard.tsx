import { useState, useEffect } from "react";
import { CustomerList } from './CustomerList';
import { CustomerProfile } from './CustomerProfile';
import { UdhaarDashboard } from './UdhaarDashboard';
import { type Customer, getCustomer, createCustomer, getLatestDocumentNo } from '@/lib/firebase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export interface CRMDashboardProps {
  /** Optional callback to view a specific transaction from the customer's history */
  onViewTransaction?: (txId: string) => void;
  /** Optional Customer ID to load and select by default */
  initialCustomerId?: string | null;
}

type CRMTab = 'DIRECTORY' | 'UDHAAR';

/**
 * The Customer Relationship Management (CRM) dashboard.
 * Provides a split-pane directory view and a dedicated Udhaar collection view.
 */
export const CRMDashboard: React.FC<CRMDashboardProps> = ({ onViewTransaction, initialCustomerId }) => {
  const { profile, user } = useAuth();
  const [crmTab, setCrmTab] = useState<CRMTab>('DIRECTORY');
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
    <div className="max-w-container-max mx-auto flex flex-col h-full">

      {/* Top Tab Bar */}
      <div className="flex gap-2 mb-4 border-b border-outline-variant pb-1 shrink-0">
        <button
          onClick={() => setCrmTab('DIRECTORY')}
          className={`px-5 py-2.5 rounded-t-lg font-semibold text-sm transition-colors flex items-center gap-2 ${
            crmTab === 'DIRECTORY'
              ? 'bg-primary text-on-primary'
              : 'text-secondary hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">group</span>
          Customer Directory
        </button>
        <button
          onClick={() => { setCrmTab('UDHAAR'); setSelectedCustomer(null); }}
          className={`px-5 py-2.5 rounded-t-lg font-semibold text-sm transition-colors flex items-center gap-2 ${
            crmTab === 'UDHAAR'
              ? 'bg-error text-white'
              : 'text-secondary hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">payments</span>
          Udhaar Collection
        </button>
      </div>

      {/* Tab Content */}
      {crmTab === 'UDHAAR' ? (
        <div className="flex-1 overflow-y-auto">
          <UdhaarDashboard />
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden min-h-0">
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
        </div>
      )}

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
                setShowAddCustomer(false);
                setAddName(''); setAddPhone(''); setAddEmail(''); setAddAddress(''); setAddGstin('');
                const newCust = await getCustomer(profile.store_id, custId);
                if (newCust) setSelectedCustomer(newCust);
              } catch (err: any) {
                toast.error("Failed to create customer: " + err.message);
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
