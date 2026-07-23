import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  updateDoc,
  deleteDoc,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config';
import type { Vendor } from '../types';

/**
 * Helper to generate consistent search terms for a vendor.
 */
const generateVendorSearchTerms = (data: { name?: string; phone?: string; address?: string }): string[] => {
  return [
    (data.name || '').toLowerCase(),
    (data.phone || '').toLowerCase(),
    (data.address || '').toLowerCase()
  ].filter(Boolean);
};

/**
 * Creates a new vendor.
 */
export const addVendor = async (
  storeId: string, 
  data: Omit<Vendor, 'vendor_id' | 'created_at' | 'updated_at' | 'store_id' | 'search_terms' | 'payable_balance'>
): Promise<string> => {
  const vendorId = `VEND_${Date.now()}`;
  const docRef = doc(db, 'Vendors', vendorId);
  
  const searchTerms = generateVendorSearchTerms(data);

  const vendor: Vendor = {
    ...data,
    vendor_id: vendorId,
    store_id: storeId,
    payable_balance: 0,
    search_terms: searchTerms,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, vendor);
  return vendorId;
};

/**
 * Fetches all vendors for a store.
 */
export const searchVendors = async (storeId: string, searchTerm?: string): Promise<Vendor[]> => {
  let q = query(collection(db, 'Vendors'), where('store_id', '==', storeId));
  
  const querySnapshot = await getDocs(q);
  let vendors = querySnapshot.docs.map(d => d.data() as Vendor).filter(v => !v.is_deleted);

  if (searchTerm) {
    const lowerTerm = searchTerm.toLowerCase();
    vendors = vendors.filter(v => v.search_terms.some(term => term.includes(lowerTerm)));
  }

  // Sort alphabetically
  vendors.sort((a, b) => a.name.localeCompare(b.name));
  return vendors;
};

/**
 * Updates an existing vendor's details.
 */
export const updateVendor = async (vendorId: string, updates: Partial<Vendor>): Promise<void> => {
  const docRef = doc(db, 'Vendors', vendorId);
  
  const dataToUpdate: any = {
    ...updates,
    updated_at: serverTimestamp(),
  };
  
  if (updates.name !== undefined || updates.phone !== undefined || updates.address !== undefined) {
    const searchTerms = generateVendorSearchTerms(updates);
    if (searchTerms.length > 0) {
      dataToUpdate.search_terms = searchTerms; 
    }
  }
  
  await updateDoc(docRef, dataToUpdate);
};

/**
 * Internal helper to safely update vendor payable balance.
 * Uses runTransaction to prevent the balance from becoming negative.
 */
export const updateVendorBalance = async (vendorId: string, amountChange: number): Promise<void> => {
  const docRef = doc(db, 'Vendors', vendorId);
  
  await runTransaction(db, async (transaction) => {
    const vendorDoc = await transaction.get(docRef);
    if (!vendorDoc.exists()) {
      throw new Error("Vendor does not exist!");
    }
    
    const currentBalance = vendorDoc.data().payable_balance || 0;
    const newBalance = currentBalance + amountChange;
    
    if (newBalance < 0) {
      throw new Error("Payment amount exceeds outstanding balance. Cannot have a negative payable balance.");
    }
    
    transaction.update(docRef, {
      payable_balance: newBalance,
      updated_at: serverTimestamp()
    });
  });
};

/**
 * Permanently deletes a vendor document.
 * Note: This should only be done if there are no outstanding payables.
 */
export const deleteVendor = async (vendorId: string): Promise<void> => {
  const docRef = doc(db, 'Vendors', vendorId);
  await updateDoc(docRef, {
    is_deleted: true,
    updated_at: serverTimestamp(),
  });
};
