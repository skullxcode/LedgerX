import { Timestamp } from 'firebase/firestore';

// ============================================================================
// ENUMS
// ============================================================================

export enum ItemType {
  PRODUCT = "PRODUCT",
  SERVICE = "SERVICE",
}

export enum DocumentType {
  QUOTE = "QUOTE",
  FINAL_SALE = "FINAL_SALE",
}

export enum FormatMode {
  FORMAL_TAXED = "FORMAL_TAXED",
  INFORMAL = "INFORMAL",
}

export enum PaymentStatus {
  PAID_NOW = "PAID_NOW",
  CREDIT = "CREDIT",
}

export enum JobCardStatus {
  RECEIVED = "RECEIVED",
  IN_PROGRESS = "IN_PROGRESS",
  READY = "READY",
}

export type AdjustmentReason = "RESTOCK" | "DAMAGED" | "CORRECTION";

// ============================================================================
// BASE INTERFACE FOR AUDIT FIELDS
// ============================================================================

export interface AuditBase {
  created_at?: Timestamp | any;
  updated_at?: Timestamp | any;
  created_by?: string;
  is_deleted?: boolean;
  deleted_at?: Timestamp;
  deleted_by?: string;
  version?: number; // For optimistic locking
}

// ============================================================================
// INVENTORY & STOCK MANAGEMENT
// ============================================================================

export interface InventoryItem extends AuditBase {
  item_id: string;
  store_id: string;
  name: string;
  item_type: ItemType;
  category?: string;
  description?: string;
  hsn_code?: string;
  purchase_price: number;
  selling_price: number;
  gst_rate: number; // Percentage slab (0, 5, 12, 18, 28)
  current_stock: number;
  min_stock?: number; // For low-stock alerts
  reorder_quantity?: number;
  supplier?: string;
  search_terms: string[]; // For full-text search
  is_active: boolean;
  image_url?: string;
}

export interface StockAdjustment extends AuditBase {
  adjustment_id: string;
  store_id: string;
  item_id: string;
  previous_stock: number;
  adjusted_stock: number;
  difference: number;
  reason: AdjustmentReason;
  notes?: string;
}

// ============================================================================
// CUSTOMERS & CREDIT MANAGEMENT
// ============================================================================

export interface Customer extends AuditBase {
  customer_id: string;
  store_id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  email?: string;
  udhaar_balance: number; // Credit balance
  total_credit_limit?: number; // Max credit allowed
  search_terms: string[];
  last_transaction_at?: Timestamp;
  tags?: string[]; // For categorization (VIP, bulk buyer, etc.)
}

// ============================================================================
// TRANSACTIONS (SALES/QUOTES)
// ============================================================================

export interface GSTBreakdown {
  taxable_amount?: number;
  tax_amount?: number;
  tax_slab: number; // The GST% that was applied
  cgst_rate?: number;
  cgst?: number;
  sgst_rate?: number;
  sgst?: number;
  igst_rate?: number;
  igst?: number;
  total_tax?: number;
}

export interface TransactionItem {
  item_id: string;
  qty: number;
  price: number; // Base price per unit
  gst_rate?: number; // GST percentage
  is_custom: boolean; // Custom item not from inventory
  name?: string;
  max_stock?: number;
  image_url?: string;
  category?: string;
  hsn_code?: string; // For tax compliance
}

export interface Transaction extends AuditBase {
  transaction_id: string;
  custom_doc_no?: string; // User-facing number (e.g., INV-001)
  store_id: string;
  customer_id: string;
  // Denormalized customer data for quick access (fetch full data via join if needed)
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_gstin?: string;
  customer_email?: string;
  buyers_order_no?: string;
  buyers_order_date?: Timestamp | any;
  document_type: DocumentType;
  format_mode: FormatMode;
  payment_status: PaymentStatus;
  items: TransactionItem[]; // TODO: Consider sub-collection for scalability
  total_amount: number;
  gst_breakdown?: GSTBreakdown; // Pre-calculated for audit trail
  discount_amount?: number;
  discount_reason?: string;
  notes?: string;
  search_terms: string[];
  status: 'COMPLETED' | 'VOIDED';
  timestamp?: Timestamp | any; // Backwards compatibility for old records
}

// ============================================================================
// JOB CARDS (SERVICE MANAGEMENT)
// ============================================================================

export interface JobCardPart {
  item_id: string;
  name: string;
  qty: number;
  price: number;
  gst_rate?: number;
  supplier?: string;
}

export interface JobCard extends AuditBase {
  job_id: string;
  store_id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_gstin?: string;
  device: string;
  device_model: string;
  device_serial?: string; // For tracking
  reported_issue: string;
  diagnosis?: string; // What was found during inspection
  status: JobCardStatus;
  estimated_cost: number;
  final_cost?: number; // After completion
  labor_cost?: number; // Service charges
  parts_used: JobCardPart[]; // TODO: Consider sub-collection for scalability
  warranty?: string; // e.g., "3 months"
  completion_date?: Timestamp;
  notes?: string;
  search_terms?: string[];
}

// ============================================================================
// BUSINESS CONFIGURATION
// ============================================================================

export interface BusinessProfile extends AuditBase {
  business_id: string;
  store_id: string;
  business_name: string;
  owner_name?: string;
  phone: string;
  alt_phone?: string;
  address: string;
  gstin: string;
  upi_id: string;
  bank_account: string;
  bank_ifsc: string;
  bank_name?: string;
  website?: string;
  email?: string;
  logo_url?: string;
  invoice_terms?: string;
  quotation_terms?: string;
  delivery_memo_terms?: string;
  signature_name?: string;
  invoice_prefix?: string;
  quote_prefix?: string;
  memo_prefix?: string;
}

export interface UserProfile extends AuditBase {
  uid: string;
  store_id: string;
  name: string;
  email?: string;
  phone: string;
  role: 'ADMIN' | 'EMPLOYEE';
  permissions?: string[]; // For fine-grained access control
  is_active: boolean;
  last_login?: Timestamp;
}

// ============================================================================
// AUDIT & COMPLIANCE
// ============================================================================

export interface VoidLog extends AuditBase {
  log_id: string;
  store_id: string;
  transaction_id: string;
  voided_by: string;
  reason: string;
  impact?: {
    inventory_adjusted: boolean;
    credit_reversed: boolean;
  };
}

export interface AuditLog extends AuditBase {
  log_id: string;
  store_id: string;
  user_id: string;
  action: string; // e.g., 'CUSTOMER_CREATED', 'INVOICE_GENERATED'
  entity_type: string; // 'Customer', 'Transaction', 'Inventory'
  entity_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
}

// ============================================================================
// EXPENSES & PAYABLES
// ============================================================================

export enum ExpenseCategory {
  PROCUREMENT = "PROCUREMENT",
  SALARY = "SALARY",
  UTILITIES = "UTILITIES",
  RENT = "RENT",
  MAINTENANCE = "MAINTENANCE",
  VENDOR_PAYMENT = "VENDOR_PAYMENT",
  OTHER = "OTHER"
}

export interface Vendor extends AuditBase {
  vendor_id: string;
  store_id: string;
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
  payable_balance: number;
  search_terms: string[];
}

export interface Expense extends AuditBase {
  expense_id: string;
  store_id: string;
  amount: number;
  category: ExpenseCategory | string;
  vendor_id?: string;
  vendor_name?: string;
  date: Timestamp | any;
  notes?: string;
  payment_method?: string;
  status: 'PAID' | 'UNPAID';
  receipt_url?: string;
  search_terms: string[];
}
