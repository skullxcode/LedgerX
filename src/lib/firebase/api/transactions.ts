import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  QueryConstraint, 
  runTransaction, 
  Timestamp, 
  limit 
} from "firebase/firestore";
import { db } from "../config";
import { DocumentType, PaymentStatus, type Transaction, type VoidLog } from "../types";
import { prepareTransactionForFirestore } from "../utils/search";

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Searches and filters transactions for a specific store.
 * Filters are applied in-memory after fetching recent transactions to bypass
 * complex Firestore composite index limitations.
 */
export const searchTransactions = async (
  storeId: string,
  searchTerm: string, 
  docType?: DocumentType | 'ALL', 
  payStatus?: PaymentStatus | 'ALL',
  startDate?: Date,
  endDate?: Date,
  statusFilter: 'ACTIVE' | 'VOIDED' | 'ALL' = 'ACTIVE'
): Promise<Transaction[]> => {
  
  const constraints: QueryConstraint[] = [
    where("store_id", "==", storeId)
  ];

  const q = query(collection(db, "Transactions"), ...constraints);
  const snap = await getDocs(q);
  
  let txs = snap.docs
    .map(doc => doc.data() as Transaction)
    .filter(tx => tx.is_deleted !== true)
    .sort((a, b) => {
      const aTime = a.created_at?.seconds || 0;
      const bTime = b.created_at?.seconds || 0;
      return bTime - aTime;
    });
  
  // 1. Status Filter
  if (statusFilter === 'ACTIVE') {
    txs = txs.filter(tx => tx.status !== 'VOIDED');
  } else if (statusFilter === 'VOIDED') {
    txs = txs.filter(tx => tx.status === 'VOIDED');
  }

  // 2. Text Search Filter
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    txs = txs.filter(tx => 
      (tx.customer_name || '').toLowerCase().includes(term) ||
      (tx.custom_doc_no || '').toLowerCase().includes(term) ||
      (tx.search_terms || []).some(t => t.includes(term))
    );
  }
  
  // 3. Document Type Filter
  if (docType && docType !== 'ALL') {
    txs = txs.filter(tx => tx.document_type === docType);
  }
  
  // 4. Payment Status Filter (Quotes do not have a real payment status)
  if (payStatus && payStatus !== 'ALL') {
    txs = txs.filter(tx => tx.payment_status === payStatus && tx.document_type !== DocumentType.QUOTE);
  }

  // 5. Date Range Filters
  if (startDate) {
    txs = txs.filter(tx => {
      const ts = tx.created_at?.seconds ? tx.created_at.seconds * 1000 : (tx as any).created_at;
      return new Date(ts) >= startDate;
    });
  }
  
  if (endDate) {
    txs = txs.filter(tx => {
      const ts = tx.created_at?.seconds ? tx.created_at.seconds * 1000 : (tx as any).created_at;
      return new Date(ts) <= endDate;
    });
  }

  return txs;
};

/**
 * Retrieves the last 100 active transactions for a specific customer.
 */
export const getTransactionsByCustomer = async (storeId: string, customerId: string): Promise<Transaction[]> => {
  const q = query(
    collection(db, "Transactions"),
    where("store_id", "==", storeId),
    where("customer_id", "==", customerId),
    orderBy("timestamp", "desc"),
    limit(100)
  );
  
  const snap = await getDocs(q);
  const allTxs = snap.docs.map(doc => doc.data() as Transaction);
  return allTxs.filter(tx => tx.status !== 'VOIDED');
};

/**
 * Atomically generates the next sequential document number based on a prefix.
 * Example: INV-000001
 */
export const getLatestDocumentNo = async (storeId: string, prefix: string): Promise<string> => {
  const counterRef = doc(db, "Counters", `${storeId}_${prefix}`);
  let assignedDocNo = "";

  await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    let nextNum = 1;
    
    if (counterSnap.exists()) {
      nextNum = counterSnap.data().current_value + 1;
    }
    
    assignedDocNo = `${prefix}${nextNum.toString().padStart(6, '0')}`;
  });

  return assignedDocNo;
};

// ============================================================================
// WRITE OPERATIONS (TRANSACTIONS)
// ============================================================================

/**
 * Finalizes a new transaction (Sale, Quote, Challan).
 * Handles inventory deduction and customer Udhaar balance adjustments atomically.
 */
export const finalizeTransaction = async (
  storeId: string,
  transactionData: Omit<Transaction, "search_terms" | "store_id" | "status">,
  customerName: string,
  customerPhone: string,
  customerAddress?: string,
  customerGstin?: string,
  customDocNo?: string
): Promise<string> => {
  const now = Timestamp.now();
  
  // Format search terms and structured data for Firestore
  const preparedData = prepareTransactionForFirestore({
    ...transactionData,
    custom_doc_no: customDocNo || transactionData.transaction_id,
    store_id: storeId,
    status: 'COMPLETED',
    created_at: now,
    updated_at: now,
    is_deleted: false,
    version: 1,
  }, customerName, customerPhone, customerAddress, customerGstin);
  
  const txRef = doc(db, "Transactions", preparedData.transaction_id);

  await runTransaction(db, async (transaction) => {
    // 1. Fetch Inventory Records for Deduction (Skip custom items)
    let itemRefs: any[] = [];
    let itemSnaps: any[] = [];
    let regularItems: any[] = [];
    
    if (preparedData.document_type === DocumentType.FINAL_SALE) {
      regularItems = preparedData.items.filter(i => !i.is_custom);
      if (regularItems.length > 0) {
        itemRefs = regularItems.map(item => doc(db, "Inventory", item.item_id));
        itemSnaps = await Promise.all(itemRefs.map(ref => transaction.get(ref)));
      }
    }

    // 2. Fetch Customer Record for Credit Balances
    let custRef: any = null;
    let custSnap: any = null;
    if (preparedData.payment_status === PaymentStatus.CREDIT && preparedData.customer_id) {
      custRef = doc(db, "Customers", preparedData.customer_id);
      custSnap = await transaction.get(custRef);
    }

    // === ALL READS DONE, NOW PERFORM WRITES ===

    // 3. Save the Transaction
    transaction.set(txRef, preparedData);

    // 4. Update the Sequence Counter
    const prefixMatch = preparedData.custom_doc_no?.match(/^([A-Z]+-)/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const numMatch = preparedData.custom_doc_no?.match(/\d+$/);
      if (numMatch) {
        const num = parseInt(numMatch[0], 10);
        const counterRef = doc(db, "Counters", `${storeId}_${prefix}`);
        transaction.set(counterRef, { store_id: storeId, prefix: prefix, current_value: num }, { merge: true });
      }
    }

    // 5. Deduct Inventory Quantities
    if (itemSnaps.length > 0) {
      itemSnaps.forEach((snap, idx) => {
        if (snap.exists() && snap.data().store_id === storeId) {
          const currentStock = snap.data().current_stock;
          transaction.update(itemRefs[idx], { current_stock: currentStock - regularItems[idx].qty });
        }
      });
    }

    // 6. Update Customer Udhaar (Credit) Balance
    if (custSnap && custSnap.exists() && custSnap.data().store_id === storeId) {
      const currentBalance = custSnap.data().udhaar_balance || 0;
      transaction.update(custRef, { udhaar_balance: currentBalance + preparedData.total_amount });
    }
  });

  return preparedData.transaction_id;
};

// ============================================================================
// VOID OPERATIONS
// ============================================================================

/**
 * Voids a completed transaction and strictly reverses its side effects.
 * - Restocks inventory
 * - Refunds customer Udhaar balances
 * - Creates an audit log of the voiding action
 */
export const voidTransaction = async (
  storeId: string, 
  transactionId: string, 
  employeeId: string, 
  reason: string
): Promise<void> => {
  const txRef = doc(db, "Transactions", transactionId);

  await runTransaction(db, async (transaction) => {
    const txSnap = await transaction.get(txRef);
    
    if (!txSnap.exists() || txSnap.data().store_id !== storeId) {
      throw new Error("Transaction not found or unauthorized");
    }

    const txData = txSnap.data() as Transaction;
    if (txData.status === 'VOIDED') {
      throw new Error("Transaction is already voided");
    }

    // 1. Fetch Inventory Records for Restocking
    let itemRefs: any[] = [];
    let itemSnaps: any[] = [];
    let regularItems: any[] = [];
    if (txData.document_type === DocumentType.FINAL_SALE) {
      regularItems = txData.items.filter(i => !i.is_custom);
      if (regularItems.length > 0) {
        itemRefs = regularItems.map(item => doc(db, "Inventory", item.item_id));
        itemSnaps = await Promise.all(itemRefs.map(ref => transaction.get(ref)));
      }
    }

    // 2. Fetch Customer Record for Refund
    let custRef: any = null;
    let custSnap: any = null;
    if (txData.payment_status === PaymentStatus.CREDIT && txData.customer_id) {
      custRef = doc(db, "Customers", txData.customer_id);
      custSnap = await transaction.get(custRef);
    }

    // === ALL READS DONE, NOW PERFORM WRITES ===

    // 3. Mark the Transaction as VOIDED
    transaction.update(txRef, { 
      status: 'VOIDED',
      updated_at: Timestamp.now(),
      version: (txData.version || 1) + 1
    });

    // 4. Restock Inventory
    if (itemSnaps.length > 0) {
      itemSnaps.forEach((snap, idx) => {
        if (snap.exists() && snap.data().store_id === storeId) {
          const currentStock = snap.data().current_stock;
          transaction.update(itemRefs[idx], { 
            current_stock: currentStock + regularItems[idx].qty,
            updated_at: Timestamp.now()
          });
        }
      });
    }

    // 5. Refund Customer Udhaar Balance
    if (custSnap && custSnap.exists() && custSnap.data().store_id === storeId) {
      const currentBalance = custSnap.data().udhaar_balance || 0;
      transaction.update(custRef, { 
        udhaar_balance: currentBalance - txData.total_amount,
        updated_at: Timestamp.now()
      });
    }

    // 6. Create Audit Log (VoidLog)
    const logId = `VOID_${Date.now()}`;
    const logRef = doc(db, "VoidLogs", logId);
    const voidLog: VoidLog = {
      log_id: logId,
      store_id: storeId,
      transaction_id: transactionId,
      voided_by: employeeId,
      reason,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      is_deleted: false,
      version: 1,
      impact: {
        inventory_adjusted: itemSnaps.length > 0,
        credit_reversed: !!custSnap
      }
    };
    
    transaction.set(logRef, voidLog);
  });
};
