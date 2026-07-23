import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchCustomers, getCustomer, createCustomer, updateCustomer } from '@/lib/firebase/api/customers';
import type { Customer } from '@/lib/firebase';

export const CUSTOMERS_QUERY_KEY = 'customers';
export const CUSTOMER_DETAIL_QUERY_KEY = 'customer_detail';

export const useCustomers = (storeId: string | undefined, searchTerm: string = '') => {
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, storeId, searchTerm],
    queryFn: async () => {
      if (!storeId) return [];
      return searchCustomers(storeId, searchTerm);
    },
    enabled: !!storeId,
  });
};

export const useCustomer = (storeId: string | undefined, customerId: string | undefined) => {
  return useQuery({
    queryKey: [CUSTOMER_DETAIL_QUERY_KEY, storeId, customerId],
    queryFn: async () => {
      if (!storeId || !customerId) return null;
      return getCustomer(storeId, customerId);
    },
    enabled: !!storeId && !!customerId,
  });
};

export const useCustomerMutations = (storeId: string | undefined) => {
  const queryClient = useQueryClient();

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY, storeId] });
  };

  const createMutation = useMutation({
    mutationFn: (data: Omit<Customer, 'customer_id' | 'created_at' | 'updated_at'>) => {
      if (!storeId) throw new Error("Store ID required");
      return createCustomer(storeId, data);
    },
    onSuccess: () => invalidateList(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ customerId, updates }: { customerId: string, updates: Partial<Customer> }) => {
      if (!storeId) throw new Error("Store ID required");
      return updateCustomer(storeId, customerId, updates);
    },
    onSuccess: (_, variables) => {
      invalidateList();
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_DETAIL_QUERY_KEY, storeId, variables.customerId] });
    },
  });

  return { createMutation, updateMutation };
};
