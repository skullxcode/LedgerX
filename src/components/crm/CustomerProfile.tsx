import { useEffect, useState } from "react";
import { type Customer, type Transaction, type JobCard, getTransactionsByCustomer, getJobCardsByCustomer, updateCustomer, deleteCustomer, updateCustomerUdhaarBalance } from '@/lib/firebase';
import { useAuth } from '../../context/AuthContext';

interface CustomerProfileProps {
  customer: Customer;
  onViewTransaction?: (txId: string) => void;
  onBack?: () => void;
}

export const CustomerProfile: React.FC<CustomerProfileProps> = ({ customer, onViewTransaction, onBack }) => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isAddingUdhaar, setIsAddingUdhaar] = useState(false);
  const [udhaarAmount, setUdhaarAmount] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.store_id) return;
      setLoading(true);
      try {
        const [txs, jobs] = await Promise.all([
          getTransactionsByCustomer(profile.store_id, customer.customer_id),
          getJobCardsByCustomer(profile.store_id, customer.customer_id)
        ]);
        setTransactions(txs);
        setJobCards(jobs.filter(j => j.status !== 'READY')); // Only active
      } catch (e) {
        console.error("Failed to load customer data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [customer.customer_id, profile?.store_id]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 md:p-8 border-b border-outline-variant bg-surface-container-lowest shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          {onBack && (
            <button 
              onClick={onBack}
              className="md:hidden flex items-center gap-1 text-primary font-label-md mb-4 hover:bg-surface-container p-1 pr-3 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to List
            </button>
          )}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-headline-md font-bold uppercase">
              {customer.name.substring(0, 2)}
            </div>
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary">{customer.name}</h2>
              <div className="font-body-md text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">call</span>
                {customer.phone}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button 
              className="px-4 py-1.5 border border-outline-variant rounded font-label-md text-label-md text-secondary hover:bg-surface-container transition-colors"
              onClick={() => {
                setEditName(customer.name);
                setEditPhone(customer.phone);
                setEditAddress(customer.address || '');
                setEditGstin(customer.gstin || '');
                setEditEmail(customer.email || '');
                setIsEditing(true);
              }}
            >
              Edit Profile
            </button>
            <button 
              className="px-4 py-1.5 border border-rose-200 rounded font-label-md text-label-md text-error hover:bg-rose-50 transition-colors"
              onClick={async () => {
                if (window.confirm("Are you sure you want to delete this customer?")) {
                  if (profile?.store_id) {
                    await deleteCustomer(profile.store_id, customer.customer_id);
                    window.location.reload(); // Refresh the page to reset the list
                  }
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
        
        <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant min-w-[200px] shadow-sm">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="font-label-md text-label-md text-secondary tracking-widest uppercase mb-1">Udhaar Balance</div>
              <div className="font-headline-lg text-headline-lg text-error font-bold flex items-center gap-2">
                ₹{customer.udhaar_balance?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <button 
                onClick={() => setIsAddingUdhaar(true)}
                className="bg-amber-50 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded font-label-md text-label-md transition-colors border border-amber-200 whitespace-nowrap w-full text-center"
              >
                Add Udhaar
              </button>
              {customer.udhaar_balance > 0 && (
                <button 
                  onClick={() => setIsRecordingPayment(true)}
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded font-label-md text-label-md transition-colors border border-emerald-200 whitespace-nowrap w-full text-center"
                >
                  Receive Payment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-surface-container-lowest">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          <div className="flex flex-col gap-4">
            <h3 className="font-headline-md text-headline-md text-primary border-b border-outline-variant pb-2">Active Repairs</h3>
            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="text-secondary font-body-md py-4">Loading...</div>
              ) : null}
              {!loading && jobCards.length === 0 ? (
                <div className="bg-surface-container-low p-6 rounded text-secondary font-body-md text-center italic border border-outline-variant border-dashed">
                  No active repairs found.
                </div>
              ) : null}
              {jobCards.map(job => (
                <div key={job.job_id} className="bg-white border border-outline-variant p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-headline-md text-primary font-bold">{job.device}</div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-tight">
                      {job.status}
                    </span>
                  </div>
                  <div className="font-body-md text-secondary mb-3">{job.reported_issue}</div>
                  <div className="flex justify-between items-center text-label-md text-outline">
                    <span>Job ID: <span className="font-code">{job.job_id.substring(0, 8)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-headline-md text-headline-md text-primary border-b border-outline-variant pb-2">Transaction History</h3>
            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="text-secondary font-body-md py-4">Loading...</div>
              ) : null}
              {!loading && transactions.length === 0 ? (
                <div className="bg-surface-container-low p-6 rounded text-secondary font-body-md text-center italic border border-outline-variant border-dashed">
                  No past transactions.
                </div>
              ) : null}
              {transactions.map(tx => (
                <div 
                  key={tx.transaction_id} 
                  className={`bg-white border p-4 rounded-lg flex items-center justify-between cursor-pointer transition-colors group ${
                    tx.status === 'VOIDED' ? 'border-rose-200 bg-rose-50/30 opacity-70' : 'border-outline-variant hover:border-primary shadow-sm'
                  }`}
                  onClick={() => onViewTransaction?.(tx.transaction_id)}
                >
                  <div>
                    <div className={`font-code font-bold mb-1 ${tx.status === 'VOIDED' ? 'line-through text-error' : 'text-primary'}`}>
                      {tx.custom_doc_no || tx.transaction_id.substring(0, 8)}
                    </div>
                    <div className="font-label-md text-label-md text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      {new Date(tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : tx.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`font-headline-md font-bold ${tx.status === 'VOIDED' ? 'text-secondary line-through' : 'text-primary'}`}>
                      ₹{tx.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>
                    {tx.status === 'VOIDED' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 uppercase tracking-tight">Voided</span>
                    ) : (
                      <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-[18px]">chevron_right</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl border border-outline-variant">
            <h3 className="font-headline-md text-headline-md text-primary mb-4">Edit Customer</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-label-md text-secondary mb-1">Name</label>
                <input className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-label-md text-secondary mb-1">Phone</label>
                <input className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-label-md text-secondary mb-1">Address</label>
                <input className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
              </div>
              <div>
                <label className="block text-label-md text-secondary mb-1">Email</label>
                <input type="email" className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-label-md text-secondary mb-1">GSTIN</label>
                <input className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary uppercase" value={editGstin} onChange={e => setEditGstin(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-outline-variant rounded text-secondary hover:bg-surface-container" onClick={() => setIsEditing(false)}>Cancel</button>
              <button 
                className="px-4 py-2 bg-primary text-white rounded hover:opacity-90"
                onClick={async () => {
                  if (profile?.store_id) {
                    await updateCustomer(profile.store_id, customer.customer_id, {
                      name: editName,
                      phone: editPhone,
                      address: editAddress,
                      gstin: editGstin,
                      email: editEmail
                    });
                    window.location.reload();
                  }
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isRecordingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm shadow-xl border border-outline-variant">
            <h3 className="font-headline-md text-headline-md text-primary mb-4">Record Payment</h3>
            <div className="mb-6">
              <label className="block text-label-md text-secondary mb-1">Amount Received (₹)</label>
              <input 
                type="number"
                className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary text-headline-md font-bold text-primary" 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(e.target.value)} 
                placeholder="0.00"
                autoFocus
              />
              <p className="text-[11px] text-secondary mt-2">This will reduce the customer's outstanding Udhaar balance by the entered amount.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-outline-variant rounded text-secondary hover:bg-surface-container" onClick={() => { setIsRecordingPayment(false); setPaymentAmount(''); }}>Cancel</button>
              <button 
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                disabled={!paymentAmount || isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0}
                onClick={async () => {
                  const amount = parseFloat(paymentAmount);
                  if (profile?.store_id && amount > 0) {
                    try {
                      await updateCustomerUdhaarBalance(profile.store_id, customer.customer_id, -amount);
                      window.location.reload();
                    } catch (e) {
                      alert("Failed to record payment");
                    }
                  }
                }}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Udhaar Modal */}
      {isAddingUdhaar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm shadow-xl border border-outline-variant">
            <h3 className="font-headline-md text-headline-md text-primary mb-4">Add Udhaar</h3>
            <div className="mb-6">
              <label className="block text-label-md text-secondary mb-1">Udhaar Amount (₹)</label>
              <input 
                type="number"
                className="w-full border border-outline-variant rounded p-2 outline-none focus:border-primary text-headline-md font-bold text-error" 
                value={udhaarAmount} 
                onChange={e => setUdhaarAmount(e.target.value)} 
                placeholder="0.00"
                autoFocus
              />
              <p className="text-[11px] text-secondary mt-2">This will manually increase the customer's outstanding Udhaar balance.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-outline-variant rounded text-secondary hover:bg-surface-container" onClick={() => { setIsAddingUdhaar(false); setUdhaarAmount(''); }}>Cancel</button>
              <button 
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                disabled={!udhaarAmount || isNaN(parseFloat(udhaarAmount)) || parseFloat(udhaarAmount) <= 0}
                onClick={async () => {
                  const amount = parseFloat(udhaarAmount);
                  if (profile?.store_id && amount > 0) {
                    try {
                      await updateCustomerUdhaarBalance(profile.store_id, customer.customer_id, amount);
                      window.location.reload();
                    } catch (e) {
                      alert("Failed to add udhaar");
                    }
                  }
                }}
              >
                Add Udhaar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
