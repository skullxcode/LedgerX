import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpense, searchExpenses, updateExpense, deleteExpense } from '@/lib/firebase/api/expenses';
import type { Expense } from '@/lib/firebase/types';
import { VENDORS_QUERY_KEY } from './useVendors';

export const EXPENSES_QUERY_KEY = 'expenses';

export const useExpenses = (
  storeId: string | undefined,
  startDate?: Date,
  endDate?: Date,
  status?: 'PAID' | 'UNPAID' | 'ALL'
) => {
  return useQuery({
    queryKey: [EXPENSES_QUERY_KEY, storeId, startDate?.toISOString(), endDate?.toISOString(), status],
    queryFn: async () => {
      if (!storeId) return [];
      return searchExpenses(storeId, startDate, endDate, status);
    },
    enabled: !!storeId,
  });
};

export const useExpenseMutations = (storeId: string | undefined) => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY, storeId] });
    queryClient.invalidateQueries({ queryKey: [VENDORS_QUERY_KEY, storeId] });
  };

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof addExpense>[1]) => {
      if (!storeId) throw new Error("Store ID required");
      return addExpense(storeId, data);
    },
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ expenseId, updates }: { expenseId: string, updates: Partial<Expense> }) => {
      return updateExpense(expenseId, updates);
    },
    onSuccess: () => invalidate(),
  });
  
  const deleteMutation = useMutation({
    mutationFn: (expense: Expense) => {
      return deleteExpense(expense);
    },
    onSuccess: () => invalidate(),
  });

  return { createMutation, updateMutation, deleteMutation };
};
