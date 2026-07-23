import { useState, useEffect } from "react";
import { type Customer } from '@/lib/firebase/types';
import { useAuth } from '../../context/AuthContext';
import { useCustomers } from '../../hooks/queries/useCustomers';
import { Skeleton } from '../ui/Skeleton';
import { exportToCSV } from '@/lib/utils/csv';
import { CustomerLedgerModal } from './CustomerLedgerModal';

interface CustomerListProps {
  onSelect: (customer: Customer) => void;
  onAddNew?: () => void;
  selectedId?: string;
}

export const CustomerList: React.FC<CustomerListProps> = ({ onSelect, onAddNew, selectedId }) => {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const { data: searchResponse, isLoading } = useCustomers(profile?.store_id, query, pageSize);
  const allCustomers = searchResponse?.data || [];
  const hasMore = allCustomers.length >= pageSize;

  const displayedCustomers = showPendingOnly
    ? allCustomers.filter(c => c.udhaar_balance && c.udhaar_balance > 0)
    : allCustomers;

  const handleExportCSV = () => {
    const headers = ['Customer ID', 'Name', 'Phone', 'GSTIN', 'Address', 'Udhaar Balance (₹)'];
    const rows = displayedCustomers.map(c => [
      c.customer_id,
      c.name,
      c.phone || 'N/A',
      c.gstin || 'N/A',
      c.address || 'N/A',
      c.udhaar_balance || 0
    ]);
    exportToCSV('Customer_Directory', headers, rows);
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-4 border-b border-outline-variant bg-surface-container-lowest shrink-0">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-headline-md text-headline-md text-primary">Directory</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="w-8 h-8 flex items-center justify-center border border-outline-variant text-secondary rounded-full hover:bg-surface-container transition-colors"
              title="Export CSV"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
            </button>
            {onAddNew && (
              <button 
                onClick={onAddNew}
                className="w-8 h-8 flex items-center justify-center bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors shadow-sm"
                title="Add New Customer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
            )}
          </div>
        </div>
        <div className="relative mb-2">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input 
            className="w-full border border-outline-variant rounded py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md transition-colors"
            placeholder="Search customers..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPageSize(50);
            }}
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
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-transparent">
                <div className="flex justify-between items-start mb-1">
                  <Skeleton className="w-1/2 h-5" />
                  <Skeleton className="w-1/4 h-3" />
                </div>
                <Skeleton className="w-1/3 h-4" />
              </div>
            ))
          ) : displayedCustomers.map(c => (
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLedgerCustomer(c);
                    }}
                    className="p-1 hover:bg-surface-variant rounded text-secondary hover:text-primary transition-colors"
                    title="View Ledger History"
                  >
                    <span className="material-symbols-outlined text-[16px]">history</span>
                  </button>
                  <div className={`font-code text-[10px] font-bold tracking-tight ${selectedId === c.customer_id ? 'text-on-primary-fixed-variant opacity-80' : 'text-secondary opacity-60'}`}>
                    {c.customer_id}
                  </div>
                </div>
              </div>
              <div className={`font-label-md text-label-md ${selectedId === c.customer_id ? 'text-on-primary-fixed-variant' : 'text-secondary'}`}>
                {c.phone}
              </div>
            </div>
          ))}
          {!isLoading && showPendingOnly && displayedCustomers.length === 0 && (
            <div className="text-center p-6 text-secondary font-body-md italic text-sm">No customers with pending balances.</div>
          )}
          {!isLoading && query && !showPendingOnly && displayedCustomers.length === 0 && (
            <div className="text-center p-6 text-secondary font-body-md italic text-sm">No customers found.</div>
          )}
          {!isLoading && !query && !showPendingOnly && displayedCustomers.length === 0 && (
            <div className="text-center p-6 text-secondary font-body-md italic text-sm">Type to search customers</div>
          )}
          {!isLoading && hasMore && !showPendingOnly && (
            <button
              onClick={() => setPageSize(p => p + 50)}
              className="mt-4 py-2 w-full bg-surface-container-high hover:bg-surface-container rounded font-label-md text-primary transition-colors border border-outline-variant"
            >
              Load More
            </button>
          )}
        </div>
      </div>

      <CustomerLedgerModal 
        isOpen={!!ledgerCustomer}
        onClose={() => setLedgerCustomer(null)}
        customer={ledgerCustomer}
      />
    </div>
  );
};
