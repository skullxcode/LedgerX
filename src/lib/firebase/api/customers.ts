import { doc, runTransaction, setDoc, getDoc, collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "../config";
import { Customer } from "../types";
import { generateSearchTerms } from "../utils/search";
import { logger } from "../utils/logger";
import { validateString, validatePhone } from "../utils/validation";
import { NotFoundError, ValidationError } from "../utils/errors";

export const getCustomer = async (storeId: string, customerId: string): Promise<Customer | null> => {
  const docRef = doc(db, "Customers", customerId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().store_id === storeId && !docSnap.data().is_deleted) {
    return docSnap.data() as Customer;
  }
  return null;
};

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
    // Validate inputs
    validateString(storeId, "storeId", { required: true, minLength: 1 });
    validateString(customerId, "customerId", { required: true, minLength: 1 });
    validateString(name, "name", { required: true, minLength: 2, maxLength: 100 });
    validatePhone(phone, "phone");

    const now = Timestamp.now();
    const rawCustomer: any = {
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
  } catch (e) {
    console.error("Transaction failed: ", e);
    throw e;
  }
};

export const searchCustomers = async (storeId: string, searchTerm: string): Promise<Customer[]> => {
  try {
    const q = query(
      collection(db, "Customers"),
      where("store_id", "==", storeId)
    );
    
    const querySnapshot = await getDocs(q);
    const customers = querySnapshot.docs.map((doc) => doc.data() as Customer)
      .filter(c => c.is_deleted !== true);
    
    if (!searchTerm) {
      return customers;
    }
    
    const lowerTerm = searchTerm.toLowerCase();
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(lowerTerm) || 
      (c.phone || '').includes(lowerTerm) ||
      (c.search_terms || []).some(term => term.includes(lowerTerm))
    );
  } catch (error) {
    logger.error("Failed to search customers", error as Error);
    throw error;
  }
};

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
  
  if (updates.name || updates.phone) {
    updateData.search_terms = generateSearchTerms(
      updates.name || currentData.name,
      updates.phone || currentData.phone,
      []
    );
  }
  
  await setDoc(customerRef, updateData, { merge: true });
};

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
  // Soft delete - preserves data for audit trail
  const currentData = snap.data() as Customer;
  const deletePayload: any = {
    is_deleted: true,
    deleted_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    version: (currentData.version || 1) + 1,
    ...(deletedBy ? { deleted_by: deletedBy } : {}),
  };
  await setDoc(customerRef, deletePayload, { merge: true });
};
