import { collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, writeBatch, runTransaction, onSnapshot, orderBy } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "../config";
import { InventoryItem, StockAdjustment, AdjustmentReason } from "../types";
import { generateSearchTerms } from "../utils/search";

export const searchInventory = async (storeId: string, searchTerm: string): Promise<InventoryItem[]> => {
  const q = query(
    collection(db, "Inventory"),
    where("store_id", "==", storeId)
  );
  
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map((doc) => doc.data() as InventoryItem)
    .filter(item => item.is_deleted !== true && item.is_active !== false);
  
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

export const subscribeToInventory = (storeId: string, callback: (items: InventoryItem[]) => void) => {
  const q = query(
    collection(db, "Inventory"),
    where("store_id", "==", storeId),
    where("is_active", "==", true),
    where("is_deleted", "==", false)
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((doc) => doc.data() as InventoryItem);
    callback(items);
  });
};

export const addInventoryItem = async (storeId: string, item: Omit<InventoryItem, "item_id" | "store_id" | "search_terms" | "created_at" | "updated_at" | "is_deleted" | "version">): Promise<string> => {
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

export const updateInventoryItem = async (itemId: string, updates: Partial<InventoryItem>): Promise<void> => {
  const docRef = doc(db, "Inventory", itemId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("Item does not exist!");
  }
  
  // Strip undefined values to prevent Firestore errors
  const sanitizedUpdates: any = {};
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

export const softDeleteInventoryItem = async (itemId: string, deletedBy?: string): Promise<void> => {
  const docRef = doc(db, "Inventory", itemId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("Item does not exist!");
  }
  
  const deletePayload: any = {
    is_deleted: true,
    deleted_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    version: (snap.data().version || 1) + 1,
    ...(deletedBy ? { deleted_by: deletedBy } : {}),
  };
  await updateDoc(docRef, deletePayload);
};

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
  
  const itemRef = doc(db, "Inventory", itemId);
  batch.update(itemRef, { 
    current_stock: adjustedStock,
    updated_at: now
  });

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

      // 3. Write updates
      for (const update of updates) {
        transaction.update(update.ref, { current_stock: update.newStock });
      }
    });
  } catch (e) {
    console.error("Stock deduction transaction failed: ", e);
    throw e;
  }
};
