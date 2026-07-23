import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  writeBatch, 
  runTransaction, 
  onSnapshot 
} from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "../config";
import type { InventoryItem, StockAdjustment, AdjustmentReason } from "../types";
import { generateSearchTerms } from "../utils/search";

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Searches for active inventory items based on a search term.
 * If no search term is provided, returns all active items for the store.
 * 
 * @param storeId - The store/tenant ID.
 * @param searchTerm - The string to search against name, category, or tags.
 */
export const searchInventory = async (storeId: string, searchTerm: string): Promise<InventoryItem[]> => {
  const q = query(
    collection(db, "Inventory"),
    where("store_id", "==", storeId)
  );
  
  const querySnapshot = await getDocs(q);
  
  // Filter out logically deleted or inactive items
  const items = querySnapshot.docs
    .map((d) => d.data() as InventoryItem)
    .filter(item => !item.is_deleted && item.is_active !== false);
  
  if (!searchTerm) {
    return items;
  }
  
  const lowerTerm = searchTerm.toLowerCase();
  return items.filter(item => 
    (item.name || '').toLowerCase().includes(lowerTerm) || 
    (item.category || '').toLowerCase().includes(lowerTerm) ||
    (item.search_terms || []).some(term => term.includes(lowerTerm))
  );
};

/**
 * Sets up a real-time listener for active inventory items.
 * 
 * @param storeId - The store/tenant ID.
 * @param callback - Function to execute when data updates.
 * @returns Unsubscribe function to stop listening.
 */
export const subscribeToInventory = (storeId: string, callback: (items: InventoryItem[]) => void) => {
  const q = query(
    collection(db, "Inventory"),
    where("store_id", "==", storeId),
    where("is_active", "==", true),
    where("is_deleted", "==", false)
  );
  
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => d.data() as InventoryItem);
    callback(items);
  });
};

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Adds a single new item to the inventory.
 * Automatically generates a smart ID based on the category (if provided) and timestamp.
 * 
 * @param storeId - The store/tenant ID.
 * @param item - The inventory item payload (without auto-generated fields).
 * @returns The newly created item's unique ID.
 */
export const addInventoryItem = async (
  storeId: string, 
  item: Omit<InventoryItem, "item_id" | "store_id" | "search_terms" | "created_at" | "updated_at" | "is_deleted" | "version">
): Promise<string> => {
  let customId = "";
  if (item.category) {
    const safeCat = item.category.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4);
    customId = `${safeCat}_${Date.now()}`;
  } else {
    customId = `ITM_${Date.now()}`;
  }
  
  const docRef = doc(db, "Inventory", customId);
  const now = Timestamp.now();
  
  const itemWithSearchTerms: InventoryItem = {
    ...item,
    item_id: customId,
    store_id: storeId,
    search_terms: generateSearchTerms("", "", [item.name]),
    is_active: true,
    created_at: now,
    updated_at: now,
    is_deleted: false,
    version: 1,
  };
  
  await setDoc(docRef, itemWithSearchTerms);
  return customId;
};

/**
 * Processes bulk additions to the inventory, safely bypassing the 500-document batch limit in Firestore.
 */
export const bulkAddInventoryItems = async (
  storeId: string,
  items: Omit<InventoryItem, "item_id" | "store_id" | "search_terms" | "created_at" | "updated_at" | "is_deleted" | "version">[]
): Promise<number> => {
  if (!items.length) return 0;
  
  const batches = [];
  let currentBatch = writeBatch(db);
  let operationCount = 0;
  
  for (const item of items) {
    if (operationCount === 499) {
      batches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      operationCount = 0;
    }
    
    let customId = "";
    if (item.category) {
      const safeCat = item.category.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4);
      customId = `${safeCat}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    } else {
      customId = `ITM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    
    const docRef = doc(db, "Inventory", customId);
    const now = Timestamp.now();
    
    const itemWithSearchTerms: InventoryItem = {
      ...item,
      item_id: customId,
      store_id: storeId,
      search_terms: generateSearchTerms("", "", [item.name]),
      is_active: true,
      created_at: now,
      updated_at: now,
      is_deleted: false,
      version: 1,
    };
    
    currentBatch.set(docRef, itemWithSearchTerms);
    operationCount++;
  }
  
  if (operationCount > 0) {
    batches.push(currentBatch.commit());
  }
  
  await Promise.all(batches);
  return items.length;
};

/**
 * Updates specific fields of an inventory item.
 * Skips undefined fields to prevent Firestore serialization errors.
 */
export const updateInventoryItem = async (itemId: string, updates: Partial<InventoryItem>): Promise<void> => {
  const docRef = doc(db, "Inventory", itemId);
  const snap = await getDoc(docRef);
  
  if (!snap.exists()) {
    throw new Error("Item does not exist!");
  }
  
  // Safely strip undefined values
  const sanitizedUpdates: Record<string, any> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) sanitizedUpdates[k] = v;
  }

  const updateData: Partial<InventoryItem> = {
    ...sanitizedUpdates,
    updated_at: Timestamp.now(),
    version: (snap.data().version || 1) + 1
  };
  
  if (updates.name) {
    updateData.search_terms = generateSearchTerms("", "", [updates.name]);
  }
  
  await updateDoc(docRef, updateData as any);
};

// ============================================================================
// STOCK MANAGEMENT
// ============================================================================

/**
 * Adjusts the current stock of an item manually and creates an audit log entry (Stock Adjustment).
 */
export const adjustStock = async (
  storeId: string,
  itemId: string,
  previousStock: number,
  adjustedStock: number,
  reason: AdjustmentReason,
  adjustedBy?: string
): Promise<void> => {
  const batch = writeBatch(db);
  const now = Timestamp.now();
  
  // 1. Update Inventory Item
  const itemRef = doc(db, "Inventory", itemId);
  batch.update(itemRef, { 
    current_stock: adjustedStock,
    updated_at: now
  });

  // 2. Create Audit Record
  const adjustmentId = `ADJ_${Date.now()}`;
  const adjRef = doc(db, "StockAdjustments", adjustmentId);
  
  const adjustmentData: StockAdjustment = {
    adjustment_id: adjustmentId,
    store_id: storeId,
    item_id: itemId,
    previous_stock: previousStock,
    adjusted_stock: adjustedStock,
    difference: adjustedStock - previousStock,
    reason,
    created_at: now,
    updated_at: now,
    ...(adjustedBy ? { created_by: adjustedBy } : {}),
    is_deleted: false,
    version: 1
  };
  
  batch.set(adjRef, adjustmentData);
  await batch.commit();
};

/**
 * Atomically deducts stock quantities for multiple items during a transaction (e.g., POS sale).
 * Fails the entire transaction if any item has insufficient data or lacks authorization.
 */
export const deductInventoryStock = async (
  storeId: string,
  items: { item_id: string; qty: number; is_custom?: boolean }[]
): Promise<void> => {
  const regularItems = items.filter(i => !i.is_custom);
  if (regularItems.length === 0) return;

  try {
    await runTransaction(db, async (transaction) => {
      const docRefs = regularItems.map(item => doc(db, "Inventory", item.item_id));
      const docSnaps = await Promise.all(docRefs.map(ref => transaction.get(ref)));

      const updates = [];
      
      // Phase 1: Read all documents
      for (let i = 0; i < docSnaps.length; i++) {
        const snap = docSnaps[i];
        const reqItem = regularItems[i];
        
        if (!snap.exists() || snap.data().store_id !== storeId) {
          throw new Error(`Item ${reqItem.item_id} does not exist or unauthorized!`);
        }
        
        const data = snap.data() as InventoryItem;
        const newStock = data.current_stock - reqItem.qty;
        updates.push({ ref: docRefs[i], newStock });
      }

      // Phase 2: Write all updates
      for (const update of updates) {
        transaction.update(update.ref, { current_stock: update.newStock });
      }
    });
  } catch (error) {
    console.error("Stock deduction transaction failed: ", error);
    throw error;
  }
};

// ============================================================================
// DELETION OPERATIONS
// ============================================================================

/**
 * Performs a soft delete on an inventory item to preserve transaction history.
 */
export const softDeleteInventoryItem = async (itemId: string, deletedBy?: string): Promise<void> => {
  const docRef = doc(db, "Inventory", itemId);
  const snap = await getDoc(docRef);
  
  if (!snap.exists()) {
    throw new Error("Item does not exist!");
  }
  
  const deletePayload: Record<string, any> = {
    is_deleted: true,
    deleted_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    version: (snap.data().version || 1) + 1,
    ...(deletedBy ? { deleted_by: deletedBy } : {}),
  };
  
  await updateDoc(docRef, deletePayload);
};
