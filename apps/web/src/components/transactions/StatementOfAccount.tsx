import React from 'react';
import { type Transaction } from '@ledgerx/firebase-shared';
import { useBusiness } from '../../context/BusinessContext';

interface Props {
  transactions: Transaction[];
  dateRange: string;
}

export const StatementOfAccount: React.FC<Props> = ({ transactions, dateRange }) => {
  const { profile } = useBusiness();

  // Deduce the primary customer from the first transaction, or state "Multiple Customers"
  const customerNames = Array.from(new Set(transactions.map(t => t.customer_id || 'Walk-in')));
  const primaryCustomer = customerNames.length === 1 ? customerNames[0] : 'Multiple Customers';

  const totalCharges = transactions
    .filter(t => t.status !== 'VOIDED' && t.document_type === 'FINAL_SALE')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const totalPayments = transactions
    .filter(t => t.status !== 'VOIDED' && t.document_type === 'FINAL_SALE' && t.payment_status === 'PAID_NOW')
    .reduce((sum, t) => sum + t.total_amount, 0); 

  const closingBalance = totalCharges - totalPayments;

  return (
    <div id="print-statement-of-account" className="hidden print:block text-black bg-white absolute top-0 left-0 w-full min-h-screen z-[99999] p-8 font-sans">
      
      {/* Header Section */}
      <div className="flex justify-between items-start border-b-[3px] border-black pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-black text-white rounded flex items-center justify-center font-bold text-xl">L</div>
            <h1 className="text-3xl font-bold uppercase tracking-widest text-black">{profile?.business_name || 'LedgerX Enterprise'}</h1>
          </div>
          <p className="text-sm text-gray-700 max-w-sm leading-relaxed">{profile?.address}</p>
          <p className="text-sm font-semibold mt-1">
            Phone: {profile?.phone} {profile?.alt_phone ? `| ${profile.alt_phone}` : ''}
          </p>
          {profile?.email && <p className="text-xs text-gray-600 mt-1">Email: {profile.email}</p>}
          {profile?.website && <p className="text-xs text-gray-600 mt-1">Web: {profile.website}</p>}
          {profile?.gstin && <p className="text-xs text-gray-500 mt-1 uppercase">GSTIN: {profile.gstin}</p>}
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="bg-black text-white px-4 py-2 rounded-l-md -mr-8 mb-4 inline-block">
            <h2 className="text-2xl font-bold tracking-widest uppercase">Statement of Account</h2>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-1">Period</p>
            <p className="text-lg font-bold">{dateRange}</p>
            <p className="text-xs text-gray-400 mt-2">Generated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Customer Info & Summary Grid */}
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div className="border border-gray-300 rounded p-5 bg-gray-50/50">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 border-b border-gray-200 pb-2">Bill To</p>
          <p className="font-bold text-xl text-black">{primaryCustomer}</p>
          <p className="text-sm text-gray-600 mt-1">Client / Walk-in Customer</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="border border-gray-300 rounded p-4 flex flex-col justify-center">
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">New Charges (Debit)</p>
            <p className="text-lg font-bold mt-1">₹{totalCharges.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
          <div className="border border-gray-300 rounded p-4 flex flex-col justify-center">
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Payments (Credit)</p>
            <p className="text-lg font-bold mt-1">₹{totalPayments.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
          <div className="col-span-2 border-2 border-black rounded p-5 bg-gray-100 flex justify-between items-center">
            <div>
              <p className="text-xs uppercase font-bold text-gray-600 tracking-widest">Net Batch Balance</p>
              <p className="text-[10px] text-gray-500 mt-1">Difference for this period</p>
            </div>
            <p className="text-3xl font-black">₹{closingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          </div>
        </div>
      </div>

      {/* Itemized Ledger Table */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-gray-100 border-b-2 border-black">
            <tr>
              <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider text-gray-700">Date</th>
              <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider text-gray-700">Ref/Txn ID</th>
              <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider text-gray-700">Description</th>
              <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider text-right text-gray-700">Debit (Charge)</th>
              <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider text-right text-gray-700">Credit (Paid)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.filter(t => t.status !== 'VOIDED' && t.document_type === 'FINAL_SALE').map(tx => (
              <tr key={tx.transaction_id} className="even:bg-gray-50/50">
                <td className="py-3 px-4 text-gray-600 font-medium">{new Date(tx.timestamp.seconds ? tx.timestamp.seconds * 1000 : tx.timestamp).toLocaleDateString()}</td>
                <td className="py-3 px-4 font-mono text-xs font-bold text-gray-800">{tx.custom_doc_no || tx.transaction_id.substring(0,8)}</td>
                <td className="py-3 px-4 text-gray-600">{tx.format_mode === 'INFORMAL' ? 'Untaxed Invoice' : 'Tax Invoice'}</td>
                <td className="py-3 px-4 text-right font-medium">
                  {tx.document_type === 'FINAL_SALE' && tx.payment_status === 'CREDIT' ? `₹${tx.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}` : <span className="text-gray-300">-</span>}
                </td>
                <td className="py-3 px-4 text-right font-medium">
                  {tx.document_type === 'FINAL_SALE' && tx.payment_status === 'PAID_NOW' ? `₹${tx.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}` : <span className="text-gray-300">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Details */}
      <div className="mt-12 flex justify-between items-end">
        <div className="text-xs text-gray-500">
          <p className="font-bold uppercase tracking-wider mb-1 text-black">Terms & Conditions</p>
          <p>1. Errors and omissions excepted (E&OE).</p>
          <p>2. This is a computer-generated statement.</p>
        </div>
        <div className="text-center w-48">
          <div className="border-b border-black mb-2 h-10"></div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
};
