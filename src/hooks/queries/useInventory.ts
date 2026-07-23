import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  searchInventory, 
  addInventoryItem, 
  updateInventoryItem, 
  softDeleteInventoryItem,
  adjustStock
} from '@/lib/firebase/api/inventory';
import type { InventoryItem, AdjustmentReason } from '@/lib/firebase/types';
import { NOTIFICATIONS_QUERY_KEY } from './useNotifications';

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

  const adjustMutation = useMutation({
    mutationFn: ({ itemId, previousStock, adjustedStock, reason, adjustedBy, minStock }: { itemId: string; previousStock: number; adjustedStock: number; reason: AdjustmentReason; adjustedBy?: string; minStock?: number }) => {
      if (!storeId) throw new Error("No store ID");
      return adjustStock(storeId, itemId, previousStock, adjustedStock, reason, adjustedBy);
    },
    onSuccess: (_data, variables) => {
      // 1. Invalidate inventory cache
      invalidate();

      // 2. Invalidate notifications cache so new low-stock alerts surface immediately
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY, storeId] });

      // 3. If the new stock is at or below the min threshold, remove the dismissed ID
      //    so the notification fires again instead of staying silently suppressed
      const threshold = variables.minStock ?? 5;
      if (variables.adjustedStock <= threshold) {
        const notifId = `stock-${variables.itemId}`;
        try {
          const dismissedIds: string[] = JSON.parse(localStorage.getItem('ledgerx_dismissed_notifications') || '[]');
          const filtered = dismissedIds.filter(id => id !== notifId);
          localStorage.setItem('ledgerx_dismissed_notifications', JSON.stringify(filtered));
          window.dispatchEvent(new Event('ledgerx_notifications_dismissed'));
        } catch (_) { /* ignore storage errors */ }
      }
    },
  });

  return {
    addMutation,
    updateMutation,
    deleteMutation,
    adjustMutation
  };
};
