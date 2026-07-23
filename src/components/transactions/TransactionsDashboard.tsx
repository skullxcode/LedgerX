import { useState, useEffect, useMemo } from "react";
import { type Transaction, DocumentType, PaymentStatus, FormatMode } from '@/lib/firebase';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useTransactions } from '../../hooks/queries/useTransactions';
import { useDebounce } from '../../hooks/useDebounce';
import { StatementOfAccount } from './StatementOfAccount';
import { generatePDF, sharePDF } from '../../lib/utils/pdf';
import { TransactionFilterBar } from './TransactionFilterBar';
import { DesktopTransactionTable } from './DesktopTransactionTable';
import { MobileTransactionList } from './MobileTransactionList';

export type DatePreset = 'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH' | 'CUSTOM';

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
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const debouncedQuery = useDebounce(query, 300);  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCursors, setPageCursors] = useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
  const PAGE_SIZE = 50;

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(0);
    setPageCursors([null]);
  }, [debouncedQuery, docFilter, paymentFilter, statusFilter, datePreset, customStartDate, customEndDate]);

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
    } else if (datePreset === 'CUSTOM') {
      if (customStartDate) start = new Date(customStartDate);
      if (customEndDate) {
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
      }
    }
    return { startDate: start, endDate: end };
  }, [datePreset, customStartDate, customEndDate]);

  const { data, isLoading } = useTransactions(
    profile?.store_id,
    debouncedQuery,
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
    setCustomStartDate('');
    setCustomEndDate('');
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
      <TransactionFilterBar 
        query={query} setQuery={setQuery}
        docFilter={docFilter} setDocFilter={setDocFilter}
        paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        datePreset={datePreset} setDatePreset={setDatePreset}
        customStartDate={customStartDate} setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate} setCustomEndDate={setCustomEndDate}
        onClearFilters={handleClearFilters}
      />

      {/* Data Table Container */}
      <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-sm min-h-[400px]">
        <div className="flex-1 overflow-auto bg-surface-container-lowest">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-secondary font-body-md">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
              <span className="material-symbols-outlined text-secondary text-5xl mb-4">receipt_long</span>
              <p className="text-body-lg font-medium text-on-surface mb-2">No transactions found</p>
              <p className="text-secondary text-body-md mb-6 max-w-md">Try adjusting your search criteria, dates, or filters to find what you're looking for.</p>
              {(query || datePreset !== 'ALL' || docFilter !== 'ALL' || paymentFilter !== 'ALL' || statusFilter !== 'ACTIVE') && (
                <button
                  onClick={handleClearFilters}
                  className="px-6 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full font-label-md transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <MobileTransactionList transactions={transactions} onViewTransaction={onViewTransaction} />
              <DesktopTransactionTable transactions={transactions} onViewTransaction={onViewTransaction} />
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
          <div className="font-headline-md text-headline-md text-primary">₹{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
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
