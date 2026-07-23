import { useQuery } from '@tanstack/react-query';
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
      
      const notifications: NotificationItem[] = [];

      // 1. Low Stock
      try {
        const invQ = query(collection(db, 'Inventory'), where('store_id', '==', storeId));
        const invSnap = await getDocs(invQ);
        invSnap.docs.forEach(doc => {
          const item = doc.data() as InventoryItem;
          if (item && !item.is_deleted && item.is_active !== false) {
             const stock = item.current_stock ?? 0;
             const min = item.min_stock ?? 5;
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
      } catch (e) {
        console.warn("Error fetching inventory notifications:", e);
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

      // Sort by createdAt desc
      notifications.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      
      return notifications;
    },
    enabled: !!storeId,
    refetchInterval: 1000 * 60 * 5,
    retry: false
  });
};
