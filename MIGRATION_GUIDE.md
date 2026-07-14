# Data Structure Improvements - Migration Guide

## Overview
Your Firestore schema has been significantly improved with:
- ✅ Consistent Timestamp usage across all collections
- ✅ Audit trail support (created_at, updated_at, deleted_by, version)
- ✅ Soft deletes for data preservation
- ✅ Additional business fields (warranty, labor_cost, credit limits, etc.)
- ✅ Optimized composite indexes for fast queries
- ✅ Audit log collection for compliance

---

## Key Changes

### 1. **Timestamp Standardization**

**Before:**
```typescript
timestamp: number | Date | any;
created_at: string | Date | any;
```

**After:**
```typescript
import { Timestamp } from 'firebase/firestore';
created_at: Timestamp;
updated_at?: Timestamp;
```

**Why:** Firebase Timestamps are server-synchronized and handle timezones correctly.

### 2. **Audit Fields (All Collections)**

**New fields added:**
```typescript
created_at: Timestamp;          // When document was created
updated_at?: Timestamp;         // Last modification time
created_by?: string;            // User who created it
is_deleted?: boolean;           // Soft delete flag
deleted_at?: Timestamp;         // When deleted
deleted_by?: string;            // User who deleted it
version?: number;               // For optimistic locking/versioning
```

**Benefits:**
- Complete audit trail
- Ability to recover "deleted" data
- Prevents accidental data loss

### 3. **New Collection: AuditLog**

```typescript
{
  log_id: string;
  store_id: string;
  user_id: string;
  action: string;              // e.g., 'CUSTOMER_CREATED'
  entity_type: string;         // 'Customer', 'Transaction'
  entity_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  created_at: Timestamp;
}
```

**Useful for:**
- Compliance and regulations
- Understanding data changes
- User activity tracking

### 4. **Enhanced Collections**

#### Customers
```typescript
// NEW FIELDS:
total_credit_limit?: number;    // Max credit allowed
last_transaction_at?: Timestamp;
tags?: string[];               // VIP, bulk buyer, etc.
```

#### Inventory
```typescript
// NEW FIELDS:
description?: string;
min_stock?: number;            // For low-stock alerts
reorder_quantity?: number;
supplier?: string;
updated_at?: Timestamp;
```

#### Transactions
```typescript
// NEW FIELDS:
gst_breakdown?: GSTBreakdown;   // Pre-calculated tax
discount_amount?: number;
discount_reason?: string;
notes?: string;
created_by?: string;

// GSTBreakdown structure:
{
  taxable_amount: number;
  tax_amount: number;
  tax_slab: number;            // The GST% applied
}
```

#### JobCards
```typescript
// NEW FIELDS:
device_serial?: string;
diagnosis?: string;
final_cost?: number;
labor_cost?: number;
warranty?: string;
completion_date?: Timestamp;
notes?: string;
created_by?: string;
```

---

## Migration Steps

### Step 1: Use Migration Utilities

```typescript
import { 
  migrateTransaction,
  migrateCustomer,
  migrateInventoryItem,
  migrateJobCard,
  normalizeTimestamp 
} from './utils/migration';

// Convert old document to new format
const oldTx = { /* from Firestore */ };
const newTx = migrateTransaction(oldTx);

// Update document
await setDoc(doc(db, 'Transactions', oldTx.transaction_id), newTx);
```

### Step 2: Batch Migration Script

```typescript
import { getDocs, collection, writeBatch, doc } from 'firebase/firestore';
import { migrateTransaction } from './utils/migration';

async function migrateAllTransactions() {
  const snapshot = await getDocs(collection(db, 'Transactions'));
  const batch = writeBatch(db);
  
  let count = 0;
  for (const doc of snapshot.docs) {
    const newData = migrateTransaction(doc.data());
    batch.update(doc.ref, newData);
    
    if (++count % 500 === 0) {
      await batch.commit();
      batch = writeBatch(db);
      console.log(`Migrated ${count} documents`);
    }
  }
  
  await batch.commit();
  console.log(`Migration complete. Total: ${count}`);
}
```

### Step 3: Use Optimized Queries

```typescript
import { buildTransactionQueries } from './utils/queryBuilders';
import { getDocs, collection, query } from 'firebase/firestore';

const queryBuilders = buildTransactionQueries('store_123');
const constraints = queryBuilders.getCompletedTransactions();

const snapshot = await getDocs(
  query(collection(db, 'Transactions'), ...constraints)
);
```

---

## Backward Compatibility

### Old Code Still Works?

✅ **Yes** - Existing documents remain readable
❌ **But** - New queries won't benefit from indexes
⚠️ **Recommended** - Migrate documents gradually

### Gradual Migration Strategy

```typescript
// Accept both old and new formats
export function normalizeTimestamp(value: any): Timestamp {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === 'number') return Timestamp.fromMillis(value);
  return Timestamp.now();
}

// In your queries
const doc = await getDoc(docRef);
const timestamp = normalizeTimestamp(doc.data().created_at);
```

---

## Query Performance Improvements

### New Indexes Deployed

Your firestore.indexes.json now includes:

1. **Customers**
   - `store_id + is_deleted + created_at` (for listing)
   - `store_id + search_terms + is_deleted` (for search)
   - `store_id + last_transaction_at` (for activity tracking)

2. **Inventory**
   - `store_id + is_active + is_deleted` (for listing)
   - `store_id + is_active + current_stock` (for low-stock alerts)
   - `store_id + search_terms + is_active + is_deleted` (for search)

3. **Transactions**
   - `store_id + is_deleted + created_at` (for listing)
   - `store_id + customer_id + created_at` (for customer history)
   - `store_id + status + created_at` (for status filtering)
   - `store_id + search_terms + created_at` (for search)

4. **JobCards**
   - `store_id + is_deleted + created_at` (for listing)
   - `store_id + customer_id + created_at` (for customer jobs)
   - `store_id + status + created_at` (for status tracking)

### Deployment

Deploy these indexes:
```bash
firebase deploy --only firestore:indexes
```

---

## Testing Migration

```typescript
// 1. Create test data in old format
const oldCustomer = {
  customer_id: 'CUST-001',
  store_id: 'store_123',
  name: 'Test',
  phone: '1234567890',
  created_at: new Date(),
  search_terms: ['test']
};

// 2. Migrate it
const migrated = migrateCustomer(oldCustomer);

// 3. Verify fields
console.log(migrated.created_at instanceof Timestamp); // true
console.log(migrated.is_deleted); // false
console.log(migrated.version); // 1

// 4. Test queries
const constraints = buildCustomerQueries('store_123').getActiveCustomers();
// Now indexes will be used!
```

---

## Soft Delete Pattern

### Why Use Soft Deletes?

- ✅ Data preservation and recovery
- ✅ Audit trail compliance
- ✅ Historical analysis still works
- ✅ No performance penalty

### Implementation

```typescript
// Instead of deleteDoc():
await updateDoc(doc(db, 'Customers', customerId), {
  is_deleted: true,
  deleted_at: Timestamp.now(),
  deleted_by: currentUserId,
  updated_at: Timestamp.now(),
});

// Queries automatically exclude soft-deleted docs:
const constraints = buildCustomerQueries(storeId)
  .getActiveCustomers();
// Already includes: where('is_deleted', '==', false)
```

### Permanent Delete (if needed)

```typescript
// Last resort - fully removes data
await deleteDoc(doc(db, 'Customers', customerId));
// Note: Breaks audit trail!
```

---

## Rollback Plan

If you need to revert:

```typescript
// 1. Keep old API functions working
export const legacyGetCustomer = async (storeId, customerId) => {
  const doc = await getDoc(/* ... */);
  // Don't access new fields, use fallbacks
};

// 2. Run reverse migration if needed
const oldFormat = {
  customer_id: newCustomer.customer_id,
  store_id: newCustomer.store_id,
  // ... map back to old schema
};
```

---

## Documentation for Team

### For Backend Developers
- Use `buildCustomerQueries()`, `buildTransactionQueries()` instead of manual queries
- Always include `is_deleted` checks in your queries
- Use `Timestamp.now()` for current time

### For Frontend Developers
- Update type imports: `import { Customer, Transaction } from 'firebase-shared/types'`
- Use migration utilities when reading old data
- New fields are optional (graceful degradation)

### For DevOps
- Deploy indexes: `firebase deploy --only firestore:indexes`
- Monitor Firestore stats for query performance improvement
- No data cleanup needed (soft deletes only)

---

## Common Issues & Solutions

### Issue: Queries return empty
**Solution:** Check that `is_deleted` constraint is included

```typescript
// ❌ Wrong
query(collection(db, 'Customers'), where('store_id', '==', storeId))

// ✅ Correct
query(collection(db, 'Customers'), 
  where('store_id', '==', storeId),
  where('is_deleted', '==', false)
)
```

### Issue: Timestamp comparison failing
**Solution:** Ensure both sides are `Timestamp` objects

```typescript
// ❌ Wrong
where('created_at', '>=', new Date())

// ✅ Correct
where('created_at', '>=', Timestamp.fromDate(new Date()))
```

### Issue: Index not being used
**Solution:** Ensure constraints order matches index definition

```typescript
// Index: store_id ASC, is_deleted ASC, created_at DESC
// ✅ This uses the index
[
  where('store_id', '==', storeId),
  where('is_deleted', '==', false),
  orderBy('created_at', 'desc')
]

// ❌ This won't use it (different order)
[
  where('is_deleted', '==', false),
  where('store_id', '==', storeId),
  orderBy('created_at', 'desc')
]
```

---

## Next Steps

1. ✅ Update `types.ts` - **DONE**
2. ✅ Create migration utilities - **DONE**
3. ✅ Create query builders - **DONE**
4. ⏳ **TODO:** Update API files to use new types
5. ⏳ **TODO:** Run batch migration on production data
6. ⏳ **TODO:** Deploy Firestore indexes
7. ⏳ **TODO:** Update component queries

---

## Questions?

- **Type issues?** Check `migration.ts` for conversion utilities
- **Query performance?** Use `queryBuilders.ts` for optimized queries
- **Data loss concerns?** Soft deletes preserve everything
