import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCustomers } from '../../hooks/queries/useCustomers';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import type { Customer } from '@/lib/firebase';
import { updateCustomer } from '@/lib/firebase/api/customers';
import { addTransaction } from '@/lib/firebase/api/transactions';
import { useQueryClient } from '@tanstack/react-query';
import { CUSTOMERS_QUERY_KEY } from '../../hooks/queries/useCustomers';
import toast from 'react-hot-toast';

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Udhaar Collection Dashboard.
 * Displays all customers with an outstanding credit (udhaar) balance,
 * sorted by highest balance. Allows collecting partial or full payments inline.
 */
export const UdhaarDashboard: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch ALL customers, then filter client-side for those with udhaar_balance > 0
  const { data: allCustomers = [], isLoading } = useCustomers(profile?.store_id, '');

  const [searchTerm, setSearchTerm] = useState('');
  const [collectingFor, setCollectingFor] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const debtors = allCustomers
    .filter(c => c.udhaar_balance > 0)
    .filter(c => !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))
    .sort((a, b) => b.udhaar_balance - a.udhaar_balance);

  const totalUdhaar = debtors.reduce((sum, c) => sum + c.udhaar_balance, 0);

  const openCollectModal = (customer: Customer) => {
    setCollectingFor(customer);
    setPayAmount(customer.udhaar_balance.toString());
    setPayMethod('CASH');
    setPayNotes('');
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingFor || !profile?.store_id) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0 || amount > collectingFor.udhaar_balance) {
      toast.error('Please enter a valid amount');
      return;
    }
    setIsProcessing(true);
    try {
      const newBalance = parseFloat((collectingFor.udhaar_balance - amount).toFixed(2));
      await updateCustomer(profile.store_id, collectingFor.customer_id, {
        udhaar_balance: newBalance,
      });
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY, profile.store_id] });
      toast.success(`Collected ${formatCurrency(amount)} from ${collectingFor.name}`);
      setCollectingFor(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to record collection. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-secondary">
        <span className="material-symbols-outlined animate-spin mr-2">sync</span>
        Loading udhaar data...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-error/10 border border-error/20 rounded-2xl p-5">
          <p className="text-xs uppercase font-bold tracking-wider text-error/70 mb-1">Total Outstanding</p>
          <p className="text-2xl font-bold text-error">{formatCurrency(totalUdhaar)}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <p className="text-xs uppercase font-bold tracking-wider text-secondary mb-1">Debtors</p>
          <p className="text-2xl font-bold text-on-surface">{debtors.length}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <p className="text-xs uppercase font-bold tracking-wider text-secondary mb-1">Avg. Balance</p>
          <p className="text-2xl font-bold text-on-surface">
            {debtors.length > 0 ? formatCurrency(totalUdhaar / debtors.length) : '₹0.00'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          icon="search"
        />
      </div>

      {/* Debtors Table */}
      {debtors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-primary mb-3">verified</span>
          <p className="text-lg font-bold text-on-surface">All Clear!</p>
          <p className="text-secondary text-sm mt-1">No customers have an outstanding udhaar balance.</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 text-xs uppercase font-bold tracking-wider text-secondary">#</th>
                  <th className="px-6 py-4 text-xs uppercase font-bold tracking-wider text-secondary">Customer</th>
                  <th className="px-6 py-4 text-xs uppercase font-bold tracking-wider text-secondary">Phone</th>
                  <th className="px-6 py-4 text-xs uppercase font-bold tracking-wider text-secondary text-right">Balance</th>
                  <th className="px-6 py-4 text-xs uppercase font-bold tracking-wider text-secondary text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {debtors.map((c, i) => (
                  <tr key={c.customer_id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-secondary">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-on-surface">{c.name}</div>
                      <div className="text-xs text-secondary font-code">{c.customer_id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{c.phone}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-error font-code text-base">{formatCurrency(c.udhaar_balance)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openCollectModal(c)}
                        className="px-4 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary rounded-full text-sm font-bold transition-colors"
                      >
                        Collect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-container-low border-t border-outline-variant">
                <tr>
                  <td colSpan={3} className="px-6 py-4 font-bold text-secondary uppercase text-xs tracking-wider">Grand Total</td>
                  <td className="px-6 py-4 text-right font-bold text-error font-code text-base">{formatCurrency(totalUdhaar)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col divide-y divide-outline-variant">
            {debtors.map(c => (
              <div key={c.customer_id} className="p-4 flex justify-between items-center gap-4">
                <div>
                  <p className="font-semibold text-on-surface">{c.name}</p>
                  <p className="text-xs text-secondary">{c.phone}</p>
                  <p className="font-bold text-error font-code mt-1">{formatCurrency(c.udhaar_balance)}</p>
                </div>
                <button
                  onClick={() => openCollectModal(c)}
                  className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary rounded-full text-sm font-bold transition-colors shrink-0"
                >
                  Collect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {collectingFor && (
        <Modal isOpen={true} onClose={() => setCollectingFor(null)} title={`Collect from ${collectingFor.name}`}>
          <form onSubmit={handleCollectPayment} className="space-y-4">
            <div className="bg-error/10 text-error rounded-xl p-4 flex justify-between font-bold text-sm">
              <span>Outstanding Balance:</span>
              <span>{formatCurrency(collectingFor.udhaar_balance)}</span>
            </div>
            <Input
              label="Collection Amount (₹)"
              type="number"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              required
              min="1"
              step="0.01"
            />
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Payment Method</label>
              <select
                className="w-full bg-surface border border-outline rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={payMethod}
                onChange={e => setPayMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <Input
              label="Notes / Reference (Optional)"
              value={payNotes}
              onChange={e => setPayNotes(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
              <button type="button" onClick={() => setCollectingFor(null)} className="px-4 py-2 text-secondary hover:bg-surface-variant rounded-lg transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-6 py-2 bg-primary text-on-primary rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Confirm Collection'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
