import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useExpenseMutations } from '../../hooks/queries/useExpenses';
import { ExpenseCategory, type Expense } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Expense;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ isOpen, onClose, initialData }) => {
  const { profile } = useAuth();
  const { createMutation, updateMutation } = useExpenseMutations(profile?.store_id);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(ExpenseCategory.PROCUREMENT);
  const [vendorName, setVendorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState<'PAID' | 'UNPAID'>('PAID');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setAmount(initialData.amount.toString());
      setCategory(initialData.category);
      setVendorName(initialData.vendor_name || '');
      setPaymentMethod(initialData.payment_method || '');
      setStatus(initialData.status);
      setNotes(initialData.notes || '');
    } else {
      setAmount('');
      setCategory(ExpenseCategory.PROCUREMENT);
      setVendorName('');
      setPaymentMethod('CASH');
      setStatus('PAID');
      setNotes('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.store_id) return;

    try {
      if (initialData) {
        await updateMutation.mutateAsync({
          expenseId: initialData.expense_id,
          updates: {
            amount: parseFloat(amount),
            category,
            vendor_name: vendorName,
            payment_method: paymentMethod,
            status,
            notes
          }
        });
      } else {
        await createMutation.mutateAsync({
          amount: parseFloat(amount),
          category,
          vendor_name: vendorName,
          payment_method: paymentMethod,
          status,
          notes,
          date: new Date()
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to save expense", error);
      alert("Failed to save expense");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Expense" : "Add Expense"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <Input
          label="Amount (₹)"
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
          min="0"
          step="0.01"
        />

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-surface border border-outline rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {Object.values(ExpenseCategory).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'PAID' | 'UNPAID')}
            className="w-full bg-surface border border-outline rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid (Payable)</option>
          </select>
        </div>

        <Input
          label="Vendor / Payee Name"
          value={vendorName}
          onChange={e => setVendorName(e.target.value)}
          placeholder="e.g. Supplier XYZ"
        />

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-surface border border-outline rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CREDIT_CARD">Credit Card</option>
          </select>
        </div>

        <Input
          label="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
