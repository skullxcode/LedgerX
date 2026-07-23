/**
 * Formats a numeric amount as Indian Rupee currency.
 * 
 * @param amount - The numeric value to format.
 * @param decimals - Number of decimal places (default: 2).
 * @returns A formatted string like "₹1,00,000.00"
 */
export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

/**
 * Formats a date (Firestore Timestamp or Date) to a human-readable string.
 * 
 * @param date - Firestore Timestamp or JS Date object.
 * @returns A formatted date string like "23 Jul 2026"
 */
export const formatDate = (date: any): string => {
  if (!date) return '—';
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
