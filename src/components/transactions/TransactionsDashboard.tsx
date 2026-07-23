import { useState, useEffect, useMemo } from "react";
import { type Transaction, DocumentType, PaymentStatus, FormatMode } from '@/lib/firebase';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useTransactions } from '../../hooks/queries/useTransactions';
import { StatementOfAccount } from './StatementOfAccount';
import { generatePDF, sharePDF } from '../../lib/utils/pdf';

type DatePreset = 'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH';

export interface TransactionsDashboardProps {
  /** Optional callback triggered to view a transaction detail modal */
  onViewTransaction?: (txId: string) => void;
}

/**
 * Dashboard for browsing, searching, and filtering the global transaction ledger.
 * Renders both a responsive UI and a printable Statement of Account.
 */
export const TransactionsDashboard: React.FC<TransactionsDashboardProps> = ({ onViewTransaction }) => {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  
  const [docFilter, setDocFilter] = useState<DocumentType | 'ALL'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'VOIDED' | 'ALL'>('ACTIVE');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  

  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCursors, setPageCursors] = useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
  const PAGE_SIZE = 50;

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(0);
    setPageCursors([null]);
  }, [query, docFilter, paymentFilter, statusFilter, datePreset]);

  const { startDate, endDate } = useMemo(() => {
    let start: Date | undefined;
    let end: Date | undefined;
    
    const now = new Date();
    if (datePreset === 'TODAY') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (datePreset === 'LAST_7') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
    } else if (datePreset === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
    }
    return { startDate: start, endDate: end };
  }, [datePreset]);

  const { data, isLoading } = useTransactions(
    profile?.store_id,
    query,
    docFilter,
    paymentFilter,
    startDate,
    endDate,
    statusFilter,
    PAGE_SIZE,
    pageCursors[currentPage]
  );

  const transactions = data?.data || [];
  const hasMore = transactions.length >= PAGE_SIZE;

  // Sync next page cursor when data loads
  useEffect(() => {
    if (data?.lastDoc && hasMore) {
      setPageCursors(prev => {
        const newCursors = [...prev];
        newCursors[currentPage + 1] = data.lastDoc;
        return newCursors;
      });
    }
  }, [data?.lastDoc, hasMore, currentPage]);



  const handleClearFilters = () => {
    setQuery('');
    setDocFilter('ALL');
    setPaymentFilter('ALL');
    setStatusFilter('ACTIVE');
    setDatePreset('ALL');
  };

  const activeTransactions = transactions.filter(t => t.status !== 'VOIDED');
  const totalGross = activeTransactions.reduce((acc, t) => acc + t.total_amount, 0);

  const getDateRangeString = () => {
    if (datePreset === 'TODAY') return 'Today';
    if (datePreset === 'LAST_7') return 'Last 7 Days';
    if (datePreset === 'THIS_MONTH') return 'This Month';
    return 'All Time';
  };

  return (
    <div className="max-w-container-max mx-auto p-4 md:p-margin-desktop min-h-[calc(100dvh-4rem)] flex flex-col overflow-y-auto overflow-x-hidden">
      
      {/* Statement of Account for Printing */}
      <StatementOfAccount transactions={transactions} dateRange={getDateRangeString()} />
      {/* Header & Stats Bento */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 shrink-0">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary mb-1">Transactions Ledger</h1>
          <p className="text-body-md text-secondary">Comprehensive history of all enterprise document movements.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            className="bg-surface-container-lowest border border-outline-variant px-4 py-2 flex items-center gap-2 font-label-md hover:bg-surface-container transition-colors rounded"
            onClick={() => window.print()}
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print Batch
          </button>
          <button 
            className="bg-surface-container-lowest border border-outline-variant px-4 py-2 flex items-center gap-2 font-label-md hover:bg-surface-container transition-colors rounded text-primary"
            onClick={() => generatePDF('print-statement-of-account', `Statement_${new Date().toISOString().split('T')[0]}`)}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download PDF
          </button>
          <button 
            className="bg-surface-container-lowest border border-outline-variant px-4 py-2 flex items-center gap-2 font-label-md hover:bg-surface-container transition-colors rounded text-primary"
            onClick={() => sharePDF('print-statement-of-account', `Statement_${new Date().toISOString().split('T')[0]}`, 'Statement of Account', 'Here is your Statement of Account.')}
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            Share
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant p-4 md:p-6 mb-4 md:mb-8 grid grid-cols-1 md:flex md:flex-wrap items-center gap-4 rounded-lg shadow-sm shrink-0">
        <div className="flex-1 w-full md:w-auto md:min-w-[250px] relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input 
            className="w-full bg-surface-container-low border border-outline-variant rounded py-2 pl-10 pr-4 text-body-md focus:outline-none focus:border-primary transition-all" 
            placeholder="Search transactions..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 md:flex gap-4 w-full md:w-auto">
          <div className="flex flex-col gap-1.5 w-full md:w-auto md:min-w-[160px]">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[14px]">calendar_today</span>
              <select 
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-2 pl-9 pr-8 text-body-md focus:border-primary appearance-none outline-none"
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="LAST_7">Last 7 Days</option>
                <option value="THIS_MONTH">This Month</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5 w-full md:w-auto md:min-w-[160px]">
            <div className="relative">
              <select 
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-2 px-3 text-body-md focus:border-primary appearance-none outline-none"
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value as any)}
              >
                <option value="ALL">All Docs</option>
                <option value={DocumentType.FINAL_SALE}>Sale</option>
                <option value={DocumentType.QUOTE}>Quote</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full md:w-auto md:min-w-[160px]">
            <div className="relative">
              <select 
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-2 px-3 text-body-md focus:border-primary appearance-none outline-none"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
              >
                <option value="ALL">All Pymt</option>
                <option value={PaymentStatus.PAID_NOW}>Paid</option>
                <option value={PaymentStatus.CREDIT}>Udhaar</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full md:w-auto md:min-w-[160px]">
            <div className="relative">
              <select 
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-2 px-3 text-body-md focus:border-primary appearance-none outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ACTIVE">Active</option>
                <option value="VOIDED">Voided</option>
                <option value="ALL">All</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
        </div>

        <button 
          className="h-[40px] px-2 text-secondary hover:text-error transition-colors flex items-center gap-1 font-label-md"
          onClick={handleClearFilters}
        >
          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
          Clear
        </button>
      </div>

      {/* Data Table Container */}
      <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-sm min-h-[400px]">
        <div className="flex-1 overflow-auto bg-surface-container-lowest">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-secondary font-body-md">Loading transactions...</div>
          ) : (
            <>
              {/* Mobile Card View */}
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
                          ₹{tx.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </div>
                        <div className="mt-1 flex justify-end">
                          {tx.status === 'VOIDED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 uppercase tracking-tight">Voided</span>
                          ) : tx.document_type === DocumentType.FINAL_SALE ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight ${
                              tx.payment_status === PaymentStatus.PAID_NOW ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
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

              {/* Desktop Table View */}
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
                          ₹{tx.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {tx.status === 'VOIDED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase tracking-tight">Voided</span>
                          ) : tx.document_type === DocumentType.FINAL_SALE ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                              tx.payment_status === PaymentStatus.PAID_NOW ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
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
            </>
          )}
        </div>
        
        {/* Pagination controls */}
        <div className="px-6 py-4 bg-surface-container-lowest border-t border-outline-variant flex items-center justify-between shrink-0">
          <span className="font-label-md text-secondary">
            Page {currentPage + 1} • Showing {transactions.length} transactions
          </span>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 0 || isLoading}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="px-4 py-2 border border-outline-variant rounded font-label-md text-primary hover:bg-surface-container disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <button 
              disabled={!hasMore || isLoading}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="px-4 py-2 border border-outline-variant rounded font-label-md text-primary hover:bg-surface-container disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* System Status Summary Footer */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-secondary font-label-md tracking-widest uppercase">Visible Gross</span>
            <span className="material-symbols-outlined text-on-tertiary-container text-[20px]">trending_up</span>
          </div>
          <div className="font-headline-md text-headline-md text-primary">₹{totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-secondary font-label-md tracking-widest uppercase">Page Items</span>
            <span className="material-symbols-outlined text-on-secondary-container text-[20px]">description</span>
          </div>
          <div className="font-headline-md text-headline-md text-primary">{transactions.length}</div>
        </div>
      </div>
    </div>
  );
};
