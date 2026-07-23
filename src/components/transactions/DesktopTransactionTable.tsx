import React from 'react';
import { Transaction, DocumentType, PaymentStatus, FormatMode } from '@/lib/firebase';

export interface DesktopTransactionTableProps {
  transactions: Transaction[];
  onViewTransaction?: (txId: string) => void;
}

export const DesktopTransactionTable: React.FC<DesktopTransactionTableProps> = ({ transactions, onViewTransaction }) => {
  return (
    <div className="hidden md:block w-full overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead className="sticky top-0 bg-surface-container-low z-10">
          <tr>
            <th className="px-6 py-4 font-label-md text-secondary uppercase tracking-wider border-b border-outline-variant">ID</th>
            <th className="px-6 py-4 font-label-md text-secondary uppercase tracking-wider border-b border-outline-variant">Date</th>
            <th className="px-6 py-4 font-label-md text-secondary uppercase tracking-wider border-b border-outline-variant">Customer</th>
            <th className="px-6 py-4 font-label-md text-secondary uppercase tracking-wider border-b border-outline-variant">Type</th>
            <th className="px-6 py-4 font-label-md text-secondary uppercase tracking-wider border-b border-outline-variant">Total</th>
            <th className="px-6 py-4 font-label-md text-secondary uppercase tracking-wider text-center border-b border-outline-variant">Status</th>
            <th className="px-6 py-4 font-label-md text-secondary uppercase tracking-wider text-right border-b border-outline-variant">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {transactions.map(tx => (
            <tr
              key={tx.transaction_id}
              className={`hover:bg-surface-container-low transition-colors group cursor-pointer ${tx.status === 'VOIDED' ? 'bg-rose-50/30' : ''}`}
              onClick={() => onViewTransaction?.(tx.transaction_id)}
            >
              <td className="px-6 py-4">
                <div className="font-code text-body-md font-bold text-primary mb-1 truncate">{tx.custom_doc_no || tx.transaction_id.substring(0, 8)}</div>
              </td>
              <td className={`px-6 py-4 text-body-md ${tx.status === 'VOIDED' ? 'text-secondary' : 'text-on-surface'}`}>
                {new Date(tx.timestamp.seconds * 1000).toLocaleDateString()}
              </td>
              <td className={`px-6 py-4 ${tx.status === 'VOIDED' ? 'opacity-60' : ''}`}>
                <div className="flex flex-col">
                  <span className="font-body-md font-semibold text-on-surface">{tx.customer_name || (tx.customer_id === 'WALK_IN' ? 'Walk-in Customer' : tx.customer_id)}</span>
                </div>
              </td>
              <td className={`px-6 py-4 ${tx.status === 'VOIDED' ? 'opacity-60' : ''}`}>
                <span className="font-label-md text-label-md text-secondary truncate">{tx.document_type === DocumentType.QUOTE ? 'Quotation' : tx.format_mode === FormatMode.INFORMAL ? 'Untaxed Invoice' : 'Tax Invoice'}</span>
              </td>
              <td className={`px-6 py-4 font-code ${tx.status === 'VOIDED' ? 'text-secondary line-through' : 'text-primary'}`}>
                ₹{tx.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 text-center">
                {tx.status === 'VOIDED' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase tracking-tight">Voided</span>
                ) : tx.document_type === DocumentType.FINAL_SALE ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${tx.payment_status === PaymentStatus.PAID_NOW ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                    {tx.payment_status === PaymentStatus.PAID_NOW ? 'Paid' : 'Credit'}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant uppercase tracking-tight">
                    -
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    className="p-1.5 hover:bg-surface-container text-secondary hover:text-primary rounded transition-colors"
                    onClick={(e) => { e.stopPropagation(); onViewTransaction?.(tx.transaction_id); }}
                  >
                    <span className="material-symbols-outlined text-[20px]">visibility</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-12 text-secondary font-body-md">
                No transactions found matching your criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
