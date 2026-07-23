import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useExpenses, useExpenseMutations } from '../../hooks/queries/useExpenses';
import { ExpenseForm } from './ExpenseForm';
import { VendorList } from './VendorList';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import { type Expense } from '@/lib/firebase/types';
import { exportToCSV } from '@/lib/utils/csv';

const formatCurrency = (amount: number) => `₹${amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

export const ExpensesDashboard: React.FC = () => {
  const { profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'EXPENSES' | 'VENDORS'>('EXPENSES');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const { data: expenses = [], isLoading } = useExpenses(profile?.store_id, undefined, undefined, statusFilter);
  const { deleteMutation } = useExpenseMutations(profile?.store_id);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>();

  const handleAdd = () => {
    setEditingExpense(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };

  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const executeDelete = async () => {
    if (expenseToDelete) {
      await deleteMutation.mutateAsync(expenseToDelete);
      setExpenseToDelete(null);
    }
  };

  const totalExpenses = expenses
    .filter(e => e.status === 'PAID')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalPayables = expenses
    .filter(e => e.status === 'UNPAID')
    .reduce((sum, e) => sum + e.amount, 0);

  const handleExportCSV = () => {
    const headers = ['Expense ID', 'Category', 'Vendor Name', 'Amount (₹)', 'Payment Method', 'Status', 'Notes'];
    const rows = expenses.map(e => [
      e.expense_id,
      e.category,
      e.vendor_name || 'N/A',
      e.amount,
      e.payment_method || 'N/A',
      e.status,
      e.notes || ''
    ]);
    exportToCSV('Expenses_Report', headers, rows);
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Header section */}
      <div className="p-4 md:p-8 shrink-0 flex flex-col gap-6 border-b border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-on-surface tracking-tight mb-2">Expenses & Payables</h1>
            <p className="text-on-surface-variant font-medium">Track your business outgoing cash flow and vendors.</p>
          </div>
          {activeTab === 'EXPENSES' && (
            <div className="flex gap-3">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 border border-outline-variant text-on-surface rounded-lg font-medium hover:bg-surface-variant transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export CSV
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Expense
              </button>
            </div>
          )}
        </div>

        {/* Custom Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto border-b border-outline-variant pb-[-1px]">
          <button
            className={`pb-3 text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-colors relative ${activeTab === 'EXPENSES' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => setActiveTab('EXPENSES')}
          >
            Expense Ledger
            {activeTab === 'EXPENSES' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>}
          </button>
          <button
            className={`pb-3 text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-colors relative ${activeTab === 'VENDORS' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => setActiveTab('VENDORS')}
          >
            Vendors & Payees
            {activeTab === 'VENDORS' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>}
          </button>
        </div>
      </div>

      {activeTab === 'EXPENSES' ? (
        <>
          {/* Metrics */}
      <div className="p-4 md:p-8 shrink-0 flex gap-4">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant flex-1 shadow-sm">
          <p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Total Paid (This View)</p>
          <p className="text-3xl font-bold text-on-surface">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-error/30 flex-1 shadow-sm">
          <p className="text-sm font-semibold text-error uppercase tracking-wider mb-2">Pending Payables</p>
          <p className="text-3xl font-bold text-error">{formatCurrency(totalPayables)}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 pb-8">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container/30">
            <h2 className="font-semibold text-on-surface">Recent Expenses</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid Only</option>
              <option value="UNPAID">Unpaid Only</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold">Vendor</th>
                  <th className="p-4 font-semibold">Amount</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                      <div className="flex items-center justify-center gap-3">
                        <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                        Loading expenses...
                      </div>
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                      No expenses found.
                    </td>
                  </tr>
                ) : (
                  expenses.map(expense => {
                    const date = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
                    return (
                      <tr key={expense.expense_id} className="hover:bg-surface-container-low/50 transition-colors group">
                        <td className="p-4 whitespace-nowrap text-on-surface font-medium">
                          {date.toLocaleDateString()}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-surface-container-high rounded text-xs font-medium text-on-surface-variant">
                            {expense.category}
                          </span>
                        </td>
                        <td className="p-4 text-on-surface">
                          {expense.vendor_name || '-'}
                        </td>
                        <td className="p-4 whitespace-nowrap font-bold text-on-surface">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {expense.status === 'PAID' ? (
                            <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">Paid</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-error/10 text-error rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>
                              Unpaid
                            </span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleEdit(expense)}
                            className="p-2 text-on-surface-variant hover:text-primary transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button
                            onClick={() => setExpenseToDelete(expense)}
                            className="p-2 text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
        </>
      ) : (
        <VendorList />
      )}

      <ExpenseForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        initialData={editingExpense} 
      />

      <ConfirmationDialog
        isOpen={!!expenseToDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={executeDelete}
        onCancel={() => setExpenseToDelete(null)}
        isDestructive={true}
      />
    </div>
  );
};
