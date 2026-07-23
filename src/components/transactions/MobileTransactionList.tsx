import React from 'react';
import { Transaction, DocumentType, PaymentStatus, FormatMode } from '@/lib/firebase';

export interface MobileTransactionListProps {
  transactions: Transaction[];
  onViewTransaction?: (txId: string) => void;
}

export const MobileTransactionList: React.FC<MobileTransactionListProps> = ({ transactions, onViewTransaction }) => {
  return (
    <div className="md:hidden flex flex-col gap-4 p-4">
      {transactions.map(tx => (
        <div
          key={tx.transaction_id}
          className={`bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm flex flex-col gap-3 cursor-pointer ${tx.status === 'VOIDED' ? 'bg-rose-50/30 border-rose-200' : ''}`}
          onClick={() => onViewTransaction?.(tx.transaction_id)}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="font-code text-body-md font-bold text-primary truncate">{tx.custom_doc_no || tx.transaction_id.substring(0, 8)}</div>
              <div className="text-[10px] text-secondary mt-1">{new Date(tx.timestamp.seconds * 1000).toLocaleDateString()}</div>
            </div>
            <div className="text-right">
              <div className={`font-code font-bold ${tx.status === 'VOIDED' ? 'text-secondary line-through' : 'text-primary'}`}>
                ₹{tx.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-1 flex justify-end">
                {tx.status === 'VOIDED' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 uppercase tracking-tight">Voided</span>
                ) : tx.document_type === DocumentType.FINAL_SALE ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight ${tx.payment_status === PaymentStatus.PAID_NOW ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                    {tx.payment_status === PaymentStatus.PAID_NOW ? 'Paid' : 'Credit'}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low/50 rounded-lg p-3">
            <p className="text-[10px] text-secondary uppercase tracking-wider mb-1">Customer</p>
            <span className={`font-body-md font-semibold text-on-surface ${tx.status === 'VOIDED' ? 'opacity-60' : ''}`}>
              {tx.customer_name || (tx.customer_id === 'WALK_IN' ? 'Walk-in Customer' : tx.customer_id)}
            </span>
            <p className="text-[10px] text-secondary mt-1">{tx.document_type === DocumentType.QUOTE ? 'Quotation' : tx.format_mode === FormatMode.INFORMAL ? 'Untaxed Invoice' : 'Tax Invoice'}</p>
          </div>
        </div>
      ))}
      {transactions.length === 0 && (
        <div className="text-center py-12 text-secondary font-body-md">
          No transactions found matching your criteria.
        </div>
      )}
    </div>
  );
};
