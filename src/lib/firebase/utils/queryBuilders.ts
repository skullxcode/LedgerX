import { 
  collection, 
  query, 
  where, 
  orderBy, 
  QueryConstraint,
  and,
  or,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

/**
 * Query builders for optimized queries using new indexes
 * These ensure queries hit the correct composite indexes
 */

// ============================================================================
// CUSTOMER QUERIES
// ============================================================================

export function buildCustomerQueries(storeId: string) {
  return {
    /**
     * Get all active customers, sorted by creation date
     */
    getActiveCustomers: (): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('is_deleted', '==', false),
      orderBy('created_at', 'desc'),
    ],

    /**
     * Search customers by search term
     */
    searchCustomers: (searchTerm: string): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('search_terms', 'array-contains', searchTerm.toLowerCase()),
      where('is_deleted', '==', false),
    ],

    /**
     * Get customers by credit status
     */
    getCustomersWithCredit: (): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('is_deleted', '==', false),
      orderBy('created_at', 'desc'),
    ],

    /**
     * Get recently active customers (by last transaction)
     */
    getRecentCustomers: (days: number = 30): QueryConstraint[] => {
      const cutoffDate = Timestamp.fromDate(
        new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      );
      return [
        where('store_id', '==', storeId),
        where('last_transaction_at', '>=', cutoffDate),
        where('is_deleted', '==', false),
        orderBy('last_transaction_at', 'desc'),
      ];
    },
  };
}

// ============================================================================
// INVENTORY QUERIES
// ============================================================================

export function buildInventoryQueries(storeId: string) {
  return {
    /**
     * Get all active inventory items
     */
    getActiveInventory: (): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('is_active', '==', true),
      where('is_deleted', '==', false),
    ],

    /**
     * Search inventory by search term
     */
    searchInventory: (searchTerm: string): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('search_terms', 'array-contains', searchTerm.toLowerCase()),
      where('is_active', '==', true),
      where('is_deleted', '==', false),
    ],

    /**
     * Get low stock items
     */
    getLowStockItems: (): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('is_active', '==', true),
      where('current_stock', '<=', 10), // Adjust threshold as needed
    ],

    /**
     * Get items by category
     */
    getByCategory: (category: string): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('category', '==', category),
      where('is_active', '==', true),
      where('is_deleted', '==', false),
    ],
  };
}

// ============================================================================
// TRANSACTION QUERIES
// ============================================================================

export function buildTransactionQueries(storeId: string) {
  return {
    /**
     * Get all completed transactions
     */
    getCompletedTransactions: (): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('status', '==', 'COMPLETED'),
      where('is_deleted', '==', false),
      orderBy('created_at', 'desc'),
    ],

    /**
     * Get transactions for a specific customer
     */
    getCustomerTransactions: (customerId: string): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('customer_id', '==', customerId),
      orderBy('created_at', 'desc'),
    ],

    /**
     * Search transactions
     */
    searchTransactions: (searchTerm: string): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('search_terms', 'array-contains', searchTerm.toLowerCase()),
      orderBy('created_at', 'desc'),
    ],

    /**
     * Get transactions in a date range
     */
    getTransactionsByDateRange: (
      startDate: Timestamp,
      endDate: Timestamp
    ): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('created_at', '>=', startDate),
      where('created_at', '<=', endDate),
      where('is_deleted', '==', false),
      orderBy('created_at', 'desc'),
    ],

    /**
     * Get voided transactions for audit trail
     */
    getVoidedTransactions: (): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('status', '==', 'VOIDED'),
      orderBy('created_at', 'desc'),
    ],
  };
}

// ============================================================================
// JOB CARD QUERIES
// ============================================================================

export function buildJobCardQueries(storeId: string) {
  return {
    /**
     * Get all active job cards
     */
    getActiveJobCards: (): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('is_deleted', '==', false),
      orderBy('created_at', 'desc'),
    ],

    /**
     * Get job cards by status
     */
    getJobCardsByStatus: (status: string): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('status', '==', status),
      orderBy('created_at', 'desc'),
    ],

    /**
     * Get job cards for a specific customer
     */
    getCustomerJobCards: (customerId: string): QueryConstraint[] => [
      where('store_id', '==', storeId),
      where('customer_id', '==', customerId),
      orderBy('created_at', 'desc'),
    ],

    /**
     * Get recently created job cards
     */
    getRecentJobCards: (days: number = 7): QueryConstraint[] => {
      const cutoffDate = Timestamp.fromDate(
        new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      );
      return [
        where('store_id', '==', storeId),
        where('created_at', '>=', cutoffDate),
        where('is_deleted', '==', false),
        orderBy('created_at', 'desc'),
      ];
    },
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Exclude soft-deleted documents from queries
 * Add this constraint to any query to filter out deleted documents
 */
export function excludeDeleted(): QueryConstraint {
  return where('is_deleted', '==', false);
}

/**
 * Order by creation date descending (most recent first)
 */
export function orderByNewest(): QueryConstraint {
  return orderBy('created_at', 'desc');
}

/**
 * Order by creation date ascending (oldest first)
 */
export function orderByOldest(): QueryConstraint {
  return orderBy('created_at', 'asc');
}

/**
 * Limit results
 */
export function limitResults(n: number): QueryConstraint {
  const { limit } = require('firebase/firestore');
  return limit(n);
}
