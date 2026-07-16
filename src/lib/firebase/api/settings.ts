import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config";
import { BusinessProfile } from "../types";

export const getBusinessProfile = async (storeId: string): Promise<BusinessProfile | null> => {
  const docRef = doc(db, "Settings", storeId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().store_id === storeId) {
    return docSnap.data() as BusinessProfile;
  }
  return null;
};

export const updateBusinessProfile = async (storeId: string, profile: BusinessProfile): Promise<void> => {
  const docRef = doc(db, "Settings", storeId);
  await setDoc(docRef, { ...profile, store_id: storeId }, { merge: true });
};

export const wipeStoreData = async (storeId: string): Promise<void> => {
  if (!storeId) throw new Error("Store ID is required to wipe data");
  
  const collectionsToWipe = ["Transactions", "Customers", "Inventory", "JobCards"];
  
  for (const collName of collectionsToWipe) {
    const q = query(collection(db, collName), where("store_id", "==", storeId));
    const snap = await getDocs(q);
    
    // We process deletions in chunks of 500 to satisfy Firestore batch limits
    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    
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
    
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }

  // Also wipe the business profile (Settings doc)
  const settingsRef = doc(db, "Settings", storeId);
  const batch = writeBatch(db);
  batch.delete(settingsRef);
  await batch.commit();
};
