import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  orderBy, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config';
import type { Expense, ExpenseCategory } from '../types';

/**
 * Creates a new expense/payable record.
 */
export const addExpense = async (
  storeId: string, 
  data: Omit<Expense, 'expense_id' | 'created_at' | 'updated_at' | 'store_id' | 'search_terms'>
): Promise<string> => {
  const expenseId = `EXP_${Date.now()}`;
  const docRef = doc(db, 'Expenses', expenseId);
  
  const searchTerms = [
    data.category.toLowerCase(),
    data.vendor_name?.toLowerCase() || '',
    data.status.toLowerCase(),
    data.payment_method?.toLowerCase() || ''
  ].filter(Boolean);

  const expense: Expense = {
    ...data,
    expense_id: expenseId,
    store_id: storeId,
    search_terms: searchTerms,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, expense);
  return expenseId;
};

/**
 * Fetches all expenses for a store, optionally filtering by month/status.
 */
export const searchExpenses = async (
  storeId: string,
  startDate?: Date,
  endDate?: Date,
  status?: 'PAID' | 'UNPAID' | 'ALL'
): Promise<Expense[]> => {
  let q = query(
    collection(db, 'Expenses'),
    where('store_id', '==', storeId)
  );
  
  if (status && status !== 'ALL') {
    q = query(q, where('status', '==', status));
  }

  const querySnapshot = await getDocs(q);
  let expenses = querySnapshot.docs.map(d => d.data() as Expense);

  // Client-side date filtering since we can't easily compound range queries without composite indexes
  if (startDate || endDate) {
    expenses = expenses.filter(exp => {
      const expDate = exp.date?.toDate ? exp.date.toDate() : new Date(exp.date);
      if (startDate && expDate < startDate) return false;
      if (endDate && expDate > endDate) return false;
      return true;
    });
  }

  // Sort newest first
  expenses.sort((a, b) => {
    const d1 = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
    const d2 = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
    return d2 - d1;
  });

  return expenses;
};

/**
 * Updates an existing expense.
 */
export const updateExpense = async (expenseId: string, updates: Partial<Expense>): Promise<void> => {
  const docRef = doc(db, 'Expenses', expenseId);
  
  const dataToUpdate: any = {
    ...updates,
    updated_at: serverTimestamp(),
  };
  
  // Recompute search terms if relevant fields changed
  if (updates.category || updates.vendor_name || updates.status || updates.payment_method) {
    const searchTerms = [
      (updates.category || '').toLowerCase(),
      (updates.vendor_name || '').toLowerCase(),
      (updates.status || '').toLowerCase(),
      (updates.payment_method || '').toLowerCase()
    ].filter(Boolean);
    if (searchTerms.length > 0) {
      dataToUpdate.search_terms = searchTerms; // Normally we'd merge with existing, but this is a simple implementation
    }
  }
  
  await updateDoc(docRef, dataToUpdate);
};

/**
 * Deletes an expense.
 */
export const deleteExpense = async (expenseId: string): Promise<void> => {
  const docRef = doc(db, 'Expenses', expenseId);
  await deleteDoc(docRef);
};
