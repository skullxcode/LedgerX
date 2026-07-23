import React from 'react';
import { DocumentType, PaymentStatus } from '@/lib/firebase/types';
import type { DatePreset } from './TransactionsDashboard';

export interface TransactionFilterBarProps {
  query: string;
  setQuery: (q: string) => void;
  docFilter: DocumentType | 'ALL';
  setDocFilter: (f: DocumentType | 'ALL') => void;
  paymentFilter: PaymentStatus | 'ALL';
  setPaymentFilter: (f: PaymentStatus | 'ALL') => void;
  statusFilter: 'ACTIVE' | 'VOIDED' | 'ALL';
  setStatusFilter: (f: 'ACTIVE' | 'VOIDED' | 'ALL') => void;
  datePreset: DatePreset;
  setDatePreset: (p: DatePreset) => void;
  customStartDate: string;
  setCustomStartDate: (d: string) => void;
  customEndDate: string;
  setCustomEndDate: (d: string) => void;
  onClearFilters: () => void;
}

export const TransactionFilterBar: React.FC<TransactionFilterBarProps> = ({
  query, setQuery,
  docFilter, setDocFilter,
  paymentFilter, setPaymentFilter,
  statusFilter, setStatusFilter,
  datePreset, setDatePreset,
  customStartDate, setCustomStartDate,
  customEndDate, setCustomEndDate,
  onClearFilters
}) => {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant p-4 md:p-6 mb-4 md:mb-8 flex flex-col gap-4 rounded-lg shadow-sm shrink-0">
      
      {/* Top Row: Search and Quick Filters */}
      <div className="grid grid-cols-1 md:flex md:flex-wrap items-center gap-4">
        
        {/* Search */}
        <div className="flex-1 w-full md:w-auto md:min-w-[250px] relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded py-2 pl-10 pr-4 text-body-md focus:outline-none focus:border-primary transition-all"
            placeholder="Search transactions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 md:flex gap-4 w-full md:w-auto">
          {/* Date Preset */}
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
                <option value="CUSTOM">Custom Range</option>
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
                <option value="ALL">All Payment</option>
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
          onClick={onClearFilters}
        >
          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
          Clear
        </button>
      </div>

      {/* Custom Date Range Row */}
      {datePreset === 'CUSTOM' && (
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-outline-variant animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary">From:</label>
            <input 
              type="date" 
              className="bg-surface-container-lowest border border-outline-variant rounded py-1.5 px-3 text-body-md focus:outline-none focus:border-primary"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary">To:</label>
            <input 
              type="date" 
              className="bg-surface-container-lowest border border-outline-variant rounded py-1.5 px-3 text-body-md focus:outline-none focus:border-primary"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
            />
          </div>
        </div>
      )}

    </div>
  );
};
