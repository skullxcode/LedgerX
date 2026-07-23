import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  searchInventory, 
  addInventoryItem, 
  updateInventoryItem, 
  softDeleteInventoryItem 
} from '@/lib/firebase/api/inventory';
import type { InventoryItem } from '@/lib/firebase';

export const INVENTORY_QUERY_KEY = 'inventory';

export const useInventory = (storeId: string | undefined) => {
  return useQuery({
    queryKey: [INVENTORY_QUERY_KEY, storeId],
    queryFn: () => {
      if (!storeId) return Promise.resolve([]);
      return searchInventory(storeId, '');
    },
    enabled: !!storeId,
  });
};

export const useInventoryMutations = (storeId: string | undefined) => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY, storeId] });
  };

  const addMutation = useMutation({
    mutationFn: (item: Omit<InventoryItem, 'item_id'>) => {
      if (!storeId) throw new Error("No store ID");
      return addInventoryItem(storeId, item);
    },
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, updates }: { itemId: string; updates: Partial<InventoryItem> }) => {
      return updateInventoryItem(itemId, updates);
    },
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => softDeleteInventoryItem(itemId),
    onSuccess: () => invalidate(),
  });

  return {
    addMutation,
    updateMutation,
    deleteMutation
  };
};
