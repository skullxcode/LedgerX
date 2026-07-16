import { useState, useEffect } from "react";
import { type Customer, searchCustomers } from '@/lib/firebase';
import { useAuth } from '../../context/AuthContext';

interface CustomerListProps {
  onSelect: (customer: Customer) => void;
  selectedId?: string;
}

export const CustomerList: React.FC<CustomerListProps> = ({ onSelect, selectedId }) => {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  useEffect(() => {
    const fetchCust = async () => {
      if (profile?.store_id) {
        const res = await searchCustomers(profile.store_id, query);
        setCustomers(res);
      } else {
        setCustomers([]);
      }
    };
    const debounce = setTimeout(fetchCust, 300);
    return () => clearTimeout(debounce);
  }, [query, profile?.store_id]);

  const displayedCustomers = showPendingOnly
    ? customers.filter(c => c.udhaar_balance && c.udhaar_balance > 0)
    : customers;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-4 border-b border-outline-variant bg-surface-container-lowest shrink-0">
        <h2 className="font-headline-md text-headline-md text-primary mb-3">Directory</h2>
        <div className="relative mb-2">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input 
            className="w-full border border-outline-variant rounded py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md transition-colors"
            placeholder="Search customers..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowPendingOnly(p => !p)}
          className={`w-full py-1.5 px-3 rounded text-label-md font-bold transition-colors flex items-center justify-center gap-2 ${
            showPendingOnly 
              ? 'bg-error-container text-error border border-error/30' 
              : 'bg-surface-container text-secondary border border-outline-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">payments</span>
          {showPendingOnly ? 'Showing: Pending Only' : 'Filter: Pending Payments'}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 bg-surface-container-lowest">
        <div className="flex flex-col gap-1">
          {displayedCustomers.map(c => (
            <div 
              key={c.customer_id} 
              className={`p-3 rounded-lg cursor-pointer transition-colors flex flex-col gap-0.5 ${
                selectedId === c.customer_id 
                  ? 'bg-primary-fixed text-on-primary-fixed border border-primary/20 shadow-sm' 
                  : 'hover:bg-surface-container-low text-on-surface border border-transparent'
              }`}
              onClick={() => onSelect(c)}
            >
              <div className="flex justify-between items-start">
                <div className="font-body-md font-bold">{c.name}</div>
                <div className={`font-code text-[10px] font-bold tracking-tight ${selectedId === c.customer_id ? 'text-on-primary-fixed-variant opacity-80' : 'text-secondary opacity-60'}`}>
                  {c.customer_id}
                </div>
              </div>
              <div className={`font-label-md text-label-md ${selectedId === c.customer_id ? 'text-on-primary-fixed-variant' : 'text-secondary'}`}>
                {c.phone}
              </div>
            </div>
          ))}
          {showPendingOnly && displayedCustomers.length === 0 && (
            <div className="text-center p-6 text-secondary font-body-md italic text-sm">No customers with pending balances.</div>
          )}
          {query && !showPendingOnly && displayedCustomers.length === 0 && (
            <div className="text-center p-6 text-secondary font-body-md italic text-sm">No customers found.</div>
          )}
          {!query && !showPendingOnly && displayedCustomers.length === 0 && (
            <div className="text-center p-6 text-secondary font-body-md italic text-sm">Type to search customers</div>
          )}
        </div>
      </div>
    </div>
  );
};
