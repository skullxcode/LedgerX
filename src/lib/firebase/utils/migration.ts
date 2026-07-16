import { Timestamp } from 'firebase/firestore';
import type { 
  Transaction, 
  Customer, 
  InventoryItem, 
  JobCard, 
  StockAdjustment,
  AuditBase 
} from '../types';

/**
 * Migration utilities to help convert old data format to new format
 * Used when upgrading existing documents in Firestore
 */

/**
 * Convert old Date/number timestamp to Firebase Timestamp
 */
export function normalizeTimestamp(value: any): Timestamp {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === 'number') return Timestamp.fromMillis(value);
  return Timestamp.now();
}

/**
 * Add audit fields to any document for first time
 */
export function addAuditFields<T extends Partial<AuditBase>>(
  doc: T,
  createdBy?: string
): T & AuditBase {
  return {
    ...doc,
    created_at: normalizeTimestamp(doc.created_at || Timestamp.now()),
    updated_at: normalizeTimestamp(doc.updated_at || Timestamp.now()),
    created_by: createdBy || doc.created_by,
    is_deleted: doc.is_deleted || false,
    version: doc.version || 1,
  } as T & AuditBase;
}

/**
 * Migrate old Transaction format to new format
 */
export function migrateTransaction(oldTx: any): Partial<Transaction> {
  return {
    transaction_id: oldTx.transaction_id,
    custom_doc_no: oldTx.custom_doc_no,
    store_id: oldTx.store_id,
    customer_id: oldTx.customer_id,
    customer_name: oldTx.customer_name,
    customer_phone: oldTx.customer_phone,
    customer_address: oldTx.customer_address,
    customer_gstin: oldTx.customer_gstin,
    document_type: oldTx.document_type,
    format_mode: oldTx.format_mode,
    payment_status: oldTx.payment_status,
    items: oldTx.items,
    total_amount: oldTx.total_amount,
    search_terms: oldTx.search_terms || [],
    status: oldTx.status || 'COMPLETED',
    created_at: normalizeTimestamp(oldTx.timestamp || oldTx.created_at),
    updated_at: normalizeTimestamp(oldTx.updated_at || Timestamp.now()),
    is_deleted: oldTx.is_deleted || false,
    version: oldTx.version || 1,
  };
}

/**
 * Migrate old Customer format to new format
 */
export function migrateCustomer(oldCustomer: any): Partial<Customer> {
  return {
    customer_id: oldCustomer.customer_id,
    store_id: oldCustomer.store_id,
    name: oldCustomer.name,
    phone: oldCustomer.phone,
    address: oldCustomer.address,
    gstin: oldCustomer.gstin,
    udhaar_balance: oldCustomer.udhaar_balance || 0,
    search_terms: oldCustomer.search_terms || [],
    created_at: normalizeTimestamp(oldCustomer.created_at),
    updated_at: normalizeTimestamp(oldCustomer.updated_at || Timestamp.now()),
    is_deleted: oldCustomer.is_deleted || false,
    version: oldCustomer.version || 1,
  };
}

/**
 * Migrate old InventoryItem format to new format
 */
export function migrateInventoryItem(oldItem: any): Partial<InventoryItem> {
  return {
    item_id: oldItem.item_id,
    store_id: oldItem.store_id,
    name: oldItem.name,
    item_type: oldItem.item_type,
    category: oldItem.category,
    purchase_price: oldItem.purchase_price,
    selling_price: oldItem.selling_price,
    gst_rate: oldItem.gst_rate,
    current_stock: oldItem.current_stock,
    search_terms: oldItem.search_terms || [],
    is_active: oldItem.is_active !== false,
    image_url: oldItem.image_url,
    created_at: normalizeTimestamp(oldItem.created_at || Timestamp.now()),
    updated_at: normalizeTimestamp(oldItem.updated_at || Timestamp.now()),
    is_deleted: oldItem.is_deleted || false,
    version: oldItem.version || 1,
  };
}

/**
 * Migrate old JobCard format to new format
 */
export function migrateJobCard(oldJobCard: any): Partial<JobCard> {
  return {
    job_id: oldJobCard.job_id,
    store_id: oldJobCard.store_id,
    customer_id: oldJobCard.customer_id,
    customer_name: oldJobCard.customer_name,
    customer_phone: oldJobCard.customer_phone,
    customer_address: oldJobCard.customer_address,
    customer_gstin: oldJobCard.customer_gstin,
    device: oldJobCard.device,
    device_model: oldJobCard.device_model,
    reported_issue: oldJobCard.reported_issue,
    status: oldJobCard.status,
    estimated_cost: oldJobCard.estimated_cost,
    parts_used: oldJobCard.parts_used || [],
    created_at: normalizeTimestamp(oldJobCard.created_at),
    updated_at: normalizeTimestamp(oldJobCard.updated_at || Timestamp.now()),
    is_deleted: oldJobCard.is_deleted || false,
    version: oldJobCard.version || 1,
  };
}

/**
 * Migrate old StockAdjustment format to new format
 */
export function migrateStockAdjustment(oldAdj: any): Partial<StockAdjustment> {
  return {
    adjustment_id: oldAdj.adjustment_id,
    store_id: oldAdj.store_id,
    item_id: oldAdj.item_id,
    previous_stock: oldAdj.previous_stock,
    adjusted_stock: oldAdj.adjusted_stock,
    difference: oldAdj.difference,
    reason: oldAdj.reason,
    created_at: normalizeTimestamp(oldAdj.timestamp || oldAdj.created_at),
    updated_at: normalizeTimestamp(oldAdj.updated_at || Timestamp.now()),
    is_deleted: oldAdj.is_deleted || false,
    version: oldAdj.version || 1,
  };
}

/**
 * Batch migration function - migrates multiple documents
 */
export function batchMigrate(
  documents: any[],
  migrateFunction: (doc: any) => any
): any[] {
  return documents.map(doc => migrateFunction(doc));
}
