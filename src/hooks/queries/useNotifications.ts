import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { InventoryItem, JobCard, Customer, Vendor } from '@/lib/firebase/types';

export type NotificationType = 'LOW_STOCK' | 'REPAIR_ACTIVE' | 'UNPAID_BILL_CUSTOMER' | 'UNPAID_BILL_VENDOR';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  actionUrl?: string; // e.g. 'CRM' or 'REPAIRS' or 'INVENTORY'
  actionId?: string; // e.g. customer_id
  createdAt: Date;
  isRead: boolean;
}

export const NOTIFICATIONS_QUERY_KEY = 'notifications';

export const useNotifications = (storeId: string | undefined) => {
  return useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) return [];
      
      // Retrieve dismissed notification IDs from localStorage
      const dismissedIds = JSON.parse(localStorage.getItem('ledgerx_dismissed_notifications') || '[]');
      
      const notifications: NotificationItem[] = [];

      // 1. Low Stock
      try {
        const invQ = query(collection(db, 'Inventory'), where('store_id', '==', storeId));
        const invSnap = await getDocs(invQ);
        invSnap.docs.forEach(doc => {
          const item = doc.data() as InventoryItem;
          if (item && !item.is_deleted && item.is_active !== false) {
             const stock = Number(item.current_stock || 0);
             const min = Number(item.min_stock || 5);
             if (stock <= min) {
               notifications.push({
                 id: `stock-${item.item_id || doc.id}`,
                 type: 'LOW_STOCK',
                 title: 'Low Stock Alert',
                 description: `${item.name || 'Item'} is running low (${stock} left).`,
                 actionUrl: 'INVENTORY',
                 createdAt: new Date(),
                 isRead: false
               });
             }
          }
        });
      } catch (e: any) {
        console.warn("Error fetching inventory notifications:", e);
        notifications.push({
          id: 'error-inv', type: 'LOW_STOCK', title: 'Inventory Error', description: e.message || String(e), createdAt: new Date(), isRead: false
        });
      }

      // 2. Active Repairs
      try {
        const jobQ = query(collection(db, 'JobCards'), where('store_id', '==', storeId));
        const jobSnap = await getDocs(jobQ);
        jobSnap.docs.forEach(doc => {
          const job = doc.data() as JobCard;
          if (job && !job.is_deleted) {
            const rawStatus = job.status ? String(job.status) : 'ACTIVE';
            notifications.push({
               id: `job-${job.job_id || doc.id}`,
               type: 'REPAIR_ACTIVE',
               title: `Repair: ${rawStatus.replace(/_/g, ' ')}`,
               description: `${job.device || 'Device'} for ${job.customer_name || 'Customer'}.`,
               actionUrl: 'REPAIRS',
               actionId: job.job_id,
               createdAt: job.updated_at?.toDate ? job.updated_at.toDate() : new Date(),
               isRead: false
            });
          }
        });
      } catch (e) {
        console.warn("Error fetching repair notifications:", e);
      }

      // 3. Unpaid Bills (Customers)
      try {
        const custQ = query(collection(db, 'Customers'), where('store_id', '==', storeId));
        const custSnap = await getDocs(custQ);
        custSnap.docs.forEach(doc => {
          const cust = doc.data() as Customer;
          if (cust && !cust.is_deleted && Number(cust.udhaar_balance || 0) > 0) {
            const amount = Number(cust.udhaar_balance || 0);
            notifications.push({
               id: `cust-${cust.customer_id || doc.id}`,
               type: 'UNPAID_BILL_CUSTOMER',
               title: 'Pending Payment (Customer)',
               description: `${cust.name || 'Customer'} owes ₹${amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}.`,
               actionUrl: 'CRM',
               actionId: cust.customer_id,
               createdAt: new Date(),
               isRead: false
            });
          }
        });
      } catch (e) {
        console.warn("Error fetching customer notifications:", e);
      }

      // 4. Unpaid Bills (Vendors)
      try {
        const vendQ = query(collection(db, 'Vendors'), where('store_id', '==', storeId));
        const vendSnap = await getDocs(vendQ);
        vendSnap.docs.forEach(doc => {
          const vend = doc.data() as Vendor;
          if (vend && Number(vend.payable_balance || 0) > 0) {
            const amount = Number(vend.payable_balance || 0);
            notifications.push({
               id: `vend-${vend.vendor_id || doc.id}`,
               type: 'UNPAID_BILL_VENDOR',
               title: 'Payable Due (Vendor)',
               description: `You owe ₹${amount.toLocaleString('en-IN', {minimumFractionDigits: 2})} to ${vend.name || 'Vendor'}.`,
               actionUrl: 'EXPENSES',
               createdAt: new Date(),
               isRead: false
            });
          }
        });
      } catch (e) {
        console.warn("Error fetching vendor notifications:", e);
      }

      // Filter out dismissed notifications before returning
      const finalNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

      // Sort by createdAt desc
      finalNotifications.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      
      return finalNotifications;
    },
    enabled: !!storeId,
    refetchInterval: 1000 * 60 * 5,
    retry: false
  });
};

export const useNotificationActions = () => {
  const queryClient = useQueryClient();

  const dismissNotification = (id: string, storeId: string | undefined) => {
    if (!storeId) return;
    
    // 1. Add to local storage
    const dismissedIds = JSON.parse(localStorage.getItem('ledgerx_dismissed_notifications') || '[]');
    if (!dismissedIds.includes(id)) {
      dismissedIds.push(id);
      localStorage.setItem('ledgerx_dismissed_notifications', JSON.stringify(dismissedIds));
    }

    // 2. Optimistically update the cache
    queryClient.setQueryData<NotificationItem[]>([NOTIFICATIONS_QUERY_KEY, storeId], (oldData) => {
      if (!oldData) return [];
      return oldData.filter(n => n.id !== id);
    });
  };

  return { dismissNotification };
};

