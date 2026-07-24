import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  arrayUnion, 
  Timestamp 
} from "firebase/firestore";
import { db } from "../config";
import type { JobCard, JobCardStatus, JobCardPart } from "../types";

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Retrieves a list of all active (non-deleted) job cards for a specific store.
 * Results are ordered by creation date (newest first).
 * 
 * @param storeId - The store/tenant ID.
 * @returns Array of JobCard objects.
 */
export const getJobCards = async (storeId: string): Promise<JobCard[]> => {
  const q = query(
    collection(db, "JobCards"),
    where("store_id", "==", storeId),
    where("is_deleted", "==", false),
    orderBy("created_at", "desc")
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => doc.data() as JobCard);
};

/**
 * Retrieves a specific job card by its unique ID.
 * Validates that the job card belongs to the requested store and is not deleted.
 * 
 * @param storeId - The store/tenant ID for authorization.
 * @param jobId - The unique ID of the job card.
 * @returns The JobCard object, or null if not found or unauthorized.
 */
export const getJobCard = async (storeId: string, jobId: string): Promise<JobCard | null> => {
  const docRef = doc(db, "JobCards", jobId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists() && docSnap.data().store_id === storeId && !docSnap.data().is_deleted) {
    return docSnap.data() as JobCard;
  }
  return null;
};

/**
 * Retrieves all active job cards associated with a specific customer.
 * 
 * @param storeId - The store/tenant ID.
 * @param customerId - The unique ID of the customer.
 */
export const getJobCardsByCustomer = async (storeId: string, customerId: string): Promise<JobCard[]> => {
  const q = query(
    collection(db, "JobCards"),
    where("store_id", "==", storeId),
    where("customer_id", "==", customerId),
    where("is_deleted", "==", false),
    orderBy("created_at", "desc")
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => doc.data() as JobCard);
};

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Creates a new Job Card (Repair Ticket).
 * Strips any undefined fields before writing to prevent Firestore serialization errors.
 * 
 * @param storeId - The store/tenant ID.
 * @param jobData - The core payload of the job card.
 * @param createdBy - (Optional) User ID of the creator.
 * @returns The auto-generated Job ID.
 */
export const createJobCard = async (
  storeId: string, 
  jobData: Omit<JobCard, "job_id" | "store_id" | "created_at" | "updated_at" | "is_deleted" | "version">, 
  createdBy?: string
): Promise<string> => {
  const docRef = doc(collection(db, "JobCards"));
  const now = Timestamp.now();
  
  const job: JobCard = {
    ...jobData,
    job_id: docRef.id,
    store_id: storeId,
    created_at: now,
    updated_at: now,
    ...(createdBy ? { created_by: createdBy } : {}),
    is_deleted: false,
    version: 1,
  };

  // Safely strip undefined values
  const cleanJob: Record<string, any> = {};
  for (const [k, v] of Object.entries(job)) {
    if (v !== undefined) cleanJob[k] = v;
  }

  await setDoc(docRef, cleanJob);
  return docRef.id;
};

/**
 * Updates an existing Job Card's core details (customer, device, issue, cost).
 * 
 * @param jobId - The Job Card ID.
 * @param updates - The fields to update.
 */
export const updateJobCardDetails = async (
  jobId: string, 
  updates: Partial<Pick<JobCard, "customer_id" | "customer_name" | "customer_phone" | "customer_address" | "customer_gstin" | "device_make_model" | "reported_issue" | "estimated_cost" | "advance_paid">>
): Promise<void> => {
  const docRef = doc(db, "JobCards", jobId);
  
  const payload = Object.entries(updates).reduce((acc, [k, v]) => {
    if (v !== undefined) acc[k] = v;
    return acc;
  }, {} as Record<string, any>);
  
  if (Object.keys(payload).length > 0) {
    payload.updated_at = Timestamp.now();
    await updateDoc(docRef, payload);
  }
};

/**
 * Soft deletes a Job Card by setting is_deleted to true.
 * 
 * @param jobId - The Job Card ID.
 */
export const deleteJobCard = async (jobId: string): Promise<void> => {
  const docRef = doc(db, "JobCards", jobId);
  await updateDoc(docRef, {
    is_deleted: true,
    updated_at: Timestamp.now()
  });
};

/**
 * Updates the status of an existing Job Card.
 * If the status is moved to 'READY', the completion date is automatically recorded.
 * 
 * @param jobId - The unique ID of the job card.
 * @param status - The new status (e.g., PENDING, IN_PROGRESS, READY, DELIVERED).
 */
export const updateJobCardStatus = async (jobId: string, status: JobCardStatus): Promise<void> => {
  const docRef = doc(db, "JobCards", jobId);
  const snap = await getDoc(docRef);
  
  if (!snap.exists()) {
    throw new Error("JobCard does not exist!");
  }
  
  const updatePayload: Record<string, any> = { 
    status,
    updated_at: Timestamp.now(),
    version: (snap.data().version || 1) + 1,
  };
  
  if (status === 'READY') {
    updatePayload.completion_date = Timestamp.now();
  }
  
  await updateDoc(docRef, updatePayload);
};

/**
 * Appends a new part/component to the parts_used array of a Job Card.
 * Uses Firestore arrayUnion to prevent race conditions.
 * 
 * @param jobId - The unique ID of the job card.
 * @param currentParts - The current list of parts (unused in arrayUnion, but kept for signature).
 * @param newPart - The part object to add.
 */
export const addPartToJobCard = async (jobId: string, currentParts: JobCardPart[], newPart: JobCardPart): Promise<void> => {
  const docRef = doc(db, "JobCards", jobId);
  await updateDoc(docRef, { 
    parts_used: arrayUnion(newPart),
    updated_at: Timestamp.now()
  });
};

// ============================================================================
// DELETION OPERATIONS
// ============================================================================

/**
 * Performs a soft delete on a Job Card to preserve history.
 * 
 * @param jobId - The unique ID of the job card to delete.
 */
export const deleteJobCard = async (jobId: string): Promise<void> => {
  const docRef = doc(db, "JobCards", jobId);
  await updateDoc(docRef, {
    is_deleted: true,
    updated_at: Timestamp.now()
  });
};
