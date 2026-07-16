import { collection, doc, setDoc, getDocs, getDoc, updateDoc, query, where, orderBy, onSnapshot, arrayUnion } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "../config";
import { JobCard, JobCardStatus, JobCardPart } from "../types";

export const createJobCard = async (storeId: string, jobData: Omit<JobCard, "job_id" | "store_id" | "created_at" | "updated_at" | "is_deleted" | "version">, createdBy?: string): Promise<string> => {
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

  // Strip any undefined values before writing to Firestore
  const cleanJob: any = {};
  for (const [k, v] of Object.entries(job)) {
    if (v !== undefined) cleanJob[k] = v;
  }

  await setDoc(docRef, cleanJob);
  return docRef.id;
};

export const updateJobCardStatus = async (jobId: string, status: JobCardStatus): Promise<void> => {
  const docRef = doc(db, "JobCards", jobId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error("JobCard does not exist!");
  }
  
  const updatePayload: any = { 
    status,
    updated_at: Timestamp.now(),
    version: (snap.data().version || 1) + 1,
  };
  if (status === 'READY') {
    updatePayload.completion_date = Timestamp.now();
  }
  await updateDoc(docRef, updatePayload);
};

export const deleteJobCard = async (jobId: string): Promise<void> => {
  const docRef = doc(db, "JobCards", jobId);
  await updateDoc(docRef, {
    is_deleted: true,
    updated_at: Timestamp.now()
  });
};

export const addPartToJobCard = async (jobId: string, currentParts: JobCardPart[], newPart: JobCardPart): Promise<void> => {
  const docRef = doc(db, "JobCards", jobId);
  await updateDoc(docRef, { parts_used: arrayUnion(newPart) });
};

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

export const getJobCard = async (storeId: string, jobId: string): Promise<JobCard | null> => {
  const docRef = doc(db, "JobCards", jobId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().store_id === storeId && !docSnap.data().is_deleted) {
    return docSnap.data() as JobCard;
  }
  return null;
};

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
