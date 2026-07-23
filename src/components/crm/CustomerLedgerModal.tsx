import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { type Customer, type Transaction } from '@/lib/firebase';
import { getTransactionsByCustomer } from '@/lib/firebase/api/transactions';
import { useAuth } from '../../context/AuthContext';

interface CustomerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

const formatCurrency = (amount: number) => `₹${amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({ isOpen, onClose, customer }) => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (isOpen && customer && profile?.store_id) {
        setIsLoading(true);
        try {
          const res = await getTransactionsByCustomer(profile.store_id, customer.customer_id);
          setTransactions(res);
        } catch (err) {
          console.error("Failed to load customer transactions", err);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadData();
  }, [isOpen, customer, profile?.store_id]);

  if (!customer) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ledger History — ${customer.name}`}>
      <div className="space-y-4">
        
        {/* Customer Balance summary header */}
        <div className="flex justify-between items-center p-3 rounded-lg bg-surface-container border border-outline-variant">
          <div>
            <p className="text-xs uppercase font-bold text-secondary">Phone: {customer.phone || 'N/A'}</p>
            {customer.gstin && <p className="text-xs text-outline mt-0.5">GSTIN: {customer.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase font-bold text-secondary">Udhaar Balance</p>
            <p className={`text-lg font-bold ${customer.udhaar_balance > 0 ? 'text-error' : 'text-primary'}`}>
              {formatCurrency(customer.udhaar_balance)}
            </p>
          </div>
        </div>

        {/* Timeline List */}
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined animate-spin mr-2">sync</span> Loading history...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-secondary text-sm">
              No transactions recorded for this customer.
            </div>
          ) : (
            transactions.map(tx => (
              <div key={tx.transaction_id} className="p-3 bg-surface-container-lowest border border-outline-variant rounded-lg flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-on-surface">{tx.custom_doc_no || tx.transaction_id.substring(0, 8)}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      tx.document_type === 'FINAL_SALE' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {tx.document_type}
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-1">
                    {tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleDateString() : 'N/A'} • {tx.payment_status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-on-surface text-sm">{formatCurrency(tx.total_amount)}</p>
                  <span className={`text-xs ${tx.status === 'VOIDED' ? 'text-error line-through' : 'text-emerald-600 font-semibold'}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-outline-variant">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-lg font-medium hover:bg-surface-variant/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
