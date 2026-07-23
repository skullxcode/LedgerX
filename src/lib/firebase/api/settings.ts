import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs, type DocumentReference } from "firebase/firestore";
import { db } from "../config";
import type { BusinessProfile } from "../types";

// ============================================================================
// BUSINESS PROFILE SETTINGS
// ============================================================================

/**
 * Retrieves the business profile (tenant settings) for a given store ID.
 * 
 * @param storeId - The unique identifier of the tenant/store.
 * @returns The BusinessProfile object, or null if not found.
 */
export const getBusinessProfile = async (storeId: string): Promise<BusinessProfile | null> => {
  const docRef = doc(db, "Settings", storeId);
  const docSnap = await getDoc(docRef);
  
  // Verify existence and strictly match the store_id to prevent data leakage
  if (docSnap.exists() && docSnap.data().store_id === storeId) {
    return docSnap.data() as BusinessProfile;
  }
  
  return null;
};

/**
 * Updates an existing business profile, merging the new fields with the existing data.
 * 
 * @param storeId - The unique identifier of the tenant/store.
 * @param profile - The updated profile fields.
 */
export const updateBusinessProfile = async (storeId: string, profile: BusinessProfile): Promise<void> => {
  const docRef = doc(db, "Settings", storeId);
  
  // Enforce store_id consistency during update
  await setDoc(docRef, { ...profile, store_id: storeId }, { merge: true });
};

// ============================================================================
// DANGER ZONE (TENANT DATA WIPING)
// ============================================================================

/**
 * Irreversibly deletes all collections and documents associated with a store ID.
 * This effectively wipes a tenant's data entirely.
 * 
 * @param storeId - The unique identifier of the tenant/store to wipe.
 * @throws Error if the store ID is missing.
 */
export const wipeStoreData = async (storeId: string): Promise<void> => {
  if (!storeId) {
    throw new Error("Store ID is required to wipe data safely.");
  }
  
  // The core tenant collections to clean up
  const collectionsToWipe = ["Transactions", "Customers", "Inventory", "JobCards"];
  
  for (const collName of collectionsToWipe) {
    const q = query(collection(db, collName), where("store_id", "==", storeId));
    const snap = await getDocs(q);
    
    // Firestore restricts batched writes to 500 operations maximum
    const chunks: DocumentReference[][] = [];
    let currentChunk: DocumentReference[] = [];
    
    snap.docs.forEach((docSnap) => {
      currentChunk.push(docSnap.ref);
      if (currentChunk.length === 500) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    });
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    // Execute batched deletions
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }

  // Finally, wipe the core business profile itself
  const settingsRef = doc(db, "Settings", storeId);
  const finalBatch = writeBatch(db);
  finalBatch.delete(settingsRef);
  await finalBatch.commit();
};
