import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addVendor, searchVendors, updateVendor, updateVendorBalance, deleteVendor } from '@/lib/firebase/api/vendors';
import { addExpense } from '@/lib/firebase/api/expenses';
import { ExpenseCategory, type Vendor } from '@/lib/firebase';
import { EXPENSES_QUERY_KEY } from './useExpenses';

export const VENDORS_QUERY_KEY = 'vendors';

export const useVendors = (storeId: string | undefined, searchTerm?: string) => {
  return useQuery({
    queryKey: [VENDORS_QUERY_KEY, storeId, searchTerm],
    queryFn: async () => {
      if (!storeId) return [];
      return searchVendors(storeId, searchTerm);
    },
    enabled: !!storeId,
  });
};

export const useVendorMutations = (storeId: string | undefined) => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [VENDORS_QUERY_KEY, storeId] });
  };

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof addVendor>[1]) => {
      if (!storeId) throw new Error("Store ID required");
      return addVendor(storeId, data);
    },
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ vendorId, updates }: { vendorId: string, updates: Partial<Vendor> }) => {
      return updateVendor(vendorId, updates);
    },
    onSuccess: () => invalidate(),
  });
  
  // Custom mutation to record a payment to a vendor, updating their balance and creating an expense audit trail
  const recordPaymentMutation = useMutation({
    mutationFn: async ({ vendorId, vendorName, amount, paymentMethod, notes }: { vendorId: string, vendorName: string, amount: number, paymentMethod: string, notes?: string }) => {
      if (!storeId) throw new Error("Store ID required");
      // Decrease payable balance
      await updateVendorBalance(vendorId, -amount);
      
      // Create Audit Expense
      await addExpense(storeId, {
        amount,
        category: ExpenseCategory.VENDOR_PAYMENT,
        vendor_id: vendorId,
        vendor_name: vendorName,
        status: 'PAID',
        payment_method: paymentMethod,
        notes: notes || `Payment to ${vendorName}`,
        date: new Date()
      });
    },
    onSuccess: () => {
      invalidate();
      // Also invalidate expenses since we created a new one
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY, storeId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (vendorId: string) => deleteVendor(vendorId),
    onSuccess: () => invalidate(),
  });

  return { createMutation, updateMutation, deleteMutation, recordPaymentMutation };
};
