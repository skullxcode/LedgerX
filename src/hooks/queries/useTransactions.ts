import { useQuery } from '@tanstack/react-query';
import { searchTransactions } from '@/lib/firebase/api/transactions';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { DocumentType, PaymentStatus } from '@/lib/firebase/types';

export const TRANSACTIONS_QUERY_KEY = 'transactions';

export const useTransactions = (
  storeId: string | undefined,
  searchTerm: string, 
  docType?: DocumentType | 'ALL', 
  payStatus?: PaymentStatus | 'ALL',
  startDate?: Date,
  endDate?: Date,
  statusFilter: 'ACTIVE' | 'VOIDED' | 'ALL' = 'ACTIVE',
  pageSize: number = 50,
  startAfterDoc?: QueryDocumentSnapshot<DocumentData> | null
) => {
  return useQuery({
    queryKey: [
      TRANSACTIONS_QUERY_KEY, storeId, searchTerm, docType, payStatus, 
      startDate?.toISOString(), endDate?.toISOString(), statusFilter, pageSize, startAfterDoc?.id
    ],
    queryFn: async () => {
      if (!storeId) return { data: [], lastDoc: null };
      const res = await searchTransactions(
        storeId, searchTerm, docType, payStatus, startDate, endDate, statusFilter, pageSize, startAfterDoc
      );
      return { data: res.transactions, lastDoc: res.lastDoc };
    },
    enabled: !!storeId,
  });
};
