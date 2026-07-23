import { 
  doc, 
  runTransaction, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from "firebase/firestore";
import { db } from "../config";
import type { Customer } from "../types";
import { generateSearchTerms } from "../utils/search";
import { logger } from "../utils/logger";
import { validateString, validatePhone } from "../utils/validation";

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Retrieves a customer's profile by ID.
 * Returns null if the customer is marked as deleted or does not belong to the store.
 * 
 * @param storeId - The store/tenant ID to authorize the read.
 * @param customerId - The unique ID of the customer.
 */
export const getCustomer = async (storeId: string, customerId: string): Promise<Customer | null> => {
  const docRef = doc(db, "Customers", customerId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists() && docSnap.data().store_id === storeId && !docSnap.data().is_deleted) {
    return docSnap.data() as Customer;
  }
  
  return null;
};

/**
 * Searches for active customers by matching a search term against name, phone, or tags.
 * If no search term is provided, returns all active customers for the store.
 * 
 * @param storeId - The store/tenant ID.
 * @param searchTerm - The string to search for.
 */
export const searchCustomers = async (
  storeId: string, 
  searchTerm: string,
  pageSize: number = 50,
  startAfterDoc?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{ data: Customer[], lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  try {
    let constraints: any[] = [
      where("store_id", "==", storeId)
    ];

    if (searchTerm) {
      constraints.push(where("search_terms", "array-contains", searchTerm.toLowerCase()));
    }

    let q = query(collection(db, "Customers"), ...constraints);
    
    // We cannot combine array-contains with orderBy without a composite index. 
    // We will rely on default document ID ordering which is adequate for simple pagination.
    if (startAfterDoc) {
      q = query(q, startAfter(startAfterDoc));
    }
    
    q = query(q, limit(pageSize));
    
    const querySnapshot = await getDocs(q);
    
    // Filter out logically deleted customers (could also be done via a where clause if indexed, but this is fine for soft-delete)
    const activeCustomers = querySnapshot.docs
      .map((d) => d.data() as Customer)
      .filter(c => !c.is_deleted);
    
    const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    return { data: activeCustomers, lastDoc };
  } catch (error) {
    logger.error("Failed to search customers", error as Error);
    throw error;
  }
};

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Creates a new customer profile and increments the customer ID counter atomically.
 */
export const createCustomer = async (
  storeId: string,
  customerId: string,
  name: string,
  phone: string,
  address?: string,
  gstin?: string,
  email?: string,
  createdBy?: string
): Promise<void> => {
  try {
    // Strict runtime validation
    validateString(storeId, "storeId", { required: true, minLength: 1 });
    validateString(customerId, "customerId", { required: true, minLength: 1 });
    validateString(name, "name", { required: true, minLength: 2, maxLength: 100 });
    validatePhone(phone, "phone");

    const now = Timestamp.now();
    
    // Construct the payload safely, dropping undefined values
    const rawCustomer: Partial<Customer> & { [key: string]: any } = {
      customer_id: customerId,
      store_id: storeId,
      name,
      phone,
      udhaar_balance: 0,
      created_at: now,
      updated_at: now,
      is_deleted: false,
      version: 1,
      search_terms: generateSearchTerms(name, phone),
      ...(address ? { address: validateString(address, "address", { required: false, maxLength: 500 }) } : {}),
      ...(gstin ? { gstin: validateString(gstin, "gstin", { required: false, maxLength: 15 }) } : {}),
      ...(email ? { email: validateString(email, "email", { required: false, maxLength: 100 }) } : {}),
      ...(createdBy ? { created_by: createdBy } : {}),
    };

    await runTransaction(db, async (transaction) => {
      transaction.set(doc(db, "Customers", customerId), rawCustomer);

      // Increment sequence counter if the ID matches standard format (e.g., CUST-100)
      const prefixMatch = customerId.match(/^([A-Z]+-)/);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        const numMatch = customerId.match(/\d+$/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          const counterRef = doc(db, "Counters", `${storeId}_${prefix}`);
          transaction.set(counterRef, { store_id: storeId, prefix: prefix, current_value: num }, { merge: true });
        }
      }
    });

    logger.info("Customer created successfully", "createCustomer", { customerId, storeId });
  } catch (error) {
    logger.error("Failed to create customer", error as Error, "createCustomer", { customerId, storeId });
    throw error;
  }
};

/**
 * Updates specific fields on an existing customer profile.
 * Automatically recalculates search terms if the name or phone is changed.
 */
export const updateCustomer = async (
  storeId: string,
  customerId: string,
  updates: Partial<Customer>
): Promise<void> => {
  const customerRef = doc(db, "Customers", customerId);
  const snap = await getDoc(customerRef);
  
  if (!snap.exists() || snap.data().store_id !== storeId) {
    throw new Error("Customer does not exist or unauthorized!");
  }
  
  const currentData = snap.data() as Customer;
  const updateData: Partial<Customer> = {
    ...updates,
    updated_at: Timestamp.now(),
    version: (currentData.version || 1) + 1
  };
  
  // Re-generate search terms if core identity fields change
  if (updates.name || updates.phone) {
    updateData.search_terms = generateSearchTerms(
      updates.name || currentData.name,
      updates.phone || currentData.phone,
      []
    );
  }
  
  await setDoc(customerRef, updateData, { merge: true });
};

/**
 * Atomically updates a customer's Udhaar (credit) balance.
 * Prevents race conditions when multiple transactions occur simultaneously.
 * 
 * @param amountToAdd - The positive (credit added) or negative (payment received) amount.
 */
export const updateCustomerUdhaarBalance = async (
  storeId: string,
  customerId: string,
  amountToAdd: number
): Promise<void> => {
  const customerRef = doc(db, "Customers", customerId);

  try {
    await runTransaction(db, async (transaction) => {
      const customerDoc = await transaction.get(customerRef);
      if (!customerDoc.exists() || customerDoc.data().store_id !== storeId) {
        throw new Error("Customer does not exist or unauthorized!");
      }

      const currentBalance = customerDoc.data().udhaar_balance || 0;
      const newBalance = currentBalance + amountToAdd;

      transaction.update(customerRef, { 
        udhaar_balance: newBalance,
        updated_at: Timestamp.now(),
        version: (customerDoc.data().version || 1) + 1
      });
    });
  } catch (error) {
    logger.error("Failed to update Udhaar balance", error as Error, "updateCustomerUdhaarBalance", { customerId, amountToAdd });
    throw error;
  }
};

// ============================================================================
// DELETION OPERATIONS
// ============================================================================

/**
 * Performs a soft delete on a customer profile.
 * The data is preserved in the database for auditing and historical transactions, 
 * but `is_deleted` is set to true so they no longer appear in searches.
 */
export const deleteCustomer = async (
  storeId: string,
  customerId: string,
  deletedBy?: string
): Promise<void> => {
  const customerRef = doc(db, "Customers", customerId);
  const snap = await getDoc(customerRef);
  
  if (!snap.exists() || snap.data().store_id !== storeId) {
    throw new Error("Customer does not exist or unauthorized!");
  }
  
  const currentData = snap.data() as Customer;
  const deletePayload: Partial<Customer> & { [key: string]: any } = {
    is_deleted: true,
    deleted_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    version: (currentData.version || 1) + 1,
    ...(deletedBy ? { deleted_by: deletedBy } : {}),
  };
  
  await setDoc(customerRef, deletePayload, { merge: true });
};
