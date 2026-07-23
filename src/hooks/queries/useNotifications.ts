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

      try {
        // 1. Low Stock
        const invQ = query(collection(db, 'Inventory'), where('store_id', '==', storeId), where('is_active', '==', true));
        const invSnap = await getDocs(invQ);
        invSnap.docs.forEach(doc => {
          const item = doc.data() as InventoryItem;
          if (!item.is_deleted) {
             const min = item.min_stock || 5;
             if (item.current_stock <= min) {
               notifications.push({
                 id: `stock-${item.item_id}`,
                 type: 'LOW_STOCK',
                 title: 'Low Stock Alert',
                 description: `${item.name} is running low (${item.current_stock} left).`,
                 actionUrl: 'INVENTORY',
                 createdAt: new Date(),
                 isRead: false
               });
             }
          }
        });

        // 2. Active Repairs
        const jobQ = query(collection(db, 'JobCards'), where('store_id', '==', storeId), where('is_deleted', '==', false));
        const jobSnap = await getDocs(jobQ);
        jobSnap.docs.forEach(doc => {
          const job = doc.data() as JobCard;
          notifications.push({
             id: `job-${job.job_id}`,
             type: 'REPAIR_ACTIVE',
             title: `Repair: ${job.status.replace('_', ' ')}`,
             description: `${job.device} for ${job.customer_name || 'Customer'}.`,
             actionUrl: 'REPAIRS',
             actionId: job.job_id,
             createdAt: job.updated_at?.toDate ? job.updated_at.toDate() : new Date(),
             isRead: false
          });
        });

        // 3. Unpaid Bills (Customers)
        const custQ = query(collection(db, 'Customers'), where('store_id', '==', storeId), where('is_deleted', '==', false));
        const custSnap = await getDocs(custQ);
        custSnap.docs.forEach(doc => {
          const cust = doc.data() as Customer;
          if (cust.udhaar_balance > 0) {
            notifications.push({
               id: `cust-${cust.customer_id}`,
               type: 'UNPAID_BILL_CUSTOMER',
               title: 'Pending Payment (Customer)',
               description: `${cust.name} owes ₹${cust.udhaar_balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}.`,
               actionUrl: 'CRM',
               actionId: cust.customer_id,
               createdAt: new Date(),
               isRead: false
            });
          }
        });

        // 4. Unpaid Bills (Vendors)
        const vendQ = query(collection(db, 'Vendors'), where('store_id', '==', storeId));
        const vendSnap = await getDocs(vendQ);
        vendSnap.docs.forEach(doc => {
          const vend = doc.data() as Vendor;
          if (vend.payable_balance > 0) {
            notifications.push({
               id: `vend-${vend.vendor_id}`,
               type: 'UNPAID_BILL_VENDOR',
               title: 'Payable Due (Vendor)',
               description: `You owe ₹${vend.payable_balance.toLocaleString('en-IN', {minimumFractionDigits: 2})} to ${vend.name}.`,
               actionUrl: 'EXPENSES',
               createdAt: new Date(),
               isRead: false
            });
          }
        });

      } catch (err) {
        console.error("Error fetching notifications", err);
      }

      // Sort by createdAt desc
      notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return notifications;
    },
    enabled: !!storeId,
    refetchInterval: 1000 * 60 * 5 // Auto refresh every 5 mins
  });
};
