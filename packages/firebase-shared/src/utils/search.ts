import { Transaction } from "../types";

/**
 * Generates an array of lowercase prefixes for a given string.
 * For example, "John" -> ["j", "jo", "joh", "john"]
 */
const generatePrefixes = (text: string): string[] => {
  const prefixes: string[] = [];
  let current = "";
  for (const char of text.toLowerCase()) {
    current += char;
    prefixes.push(current);
  }
  return prefixes;
};

/**
 * Tokenizes a string by words and generates prefixes for each word.
 * Also includes the full string prefixes.
 */
const tokenizeAndPrefix = (text: string): string[] => {
  if (!text) return [];
  const cleanText = text.trim().toLowerCase();
  const words = cleanText.split(/\s+/);
  
  const segments = new Set<string>();
  
  // Prefixes for the entire string
  generatePrefixes(cleanText).forEach((p) => segments.add(p));
  
  // Prefixes for individual words
  words.forEach((word) => {
    generatePrefixes(word).forEach((p) => segments.add(p));
  });

  return Array.from(segments);
};

/**
 * Takes a transaction (along with customer details and item names)
 * and generates the search_terms array.
 */
export const generateSearchTerms = (
  customerName: string = "",
  customerPhone: string = "",
  itemNames: string[] = []
): string[] => {
  const terms = new Set<string>();

  // Add customer name segments
  if (customerName) {
    tokenizeAndPrefix(customerName).forEach((term) => terms.add(term));
  }

  // Add customer phone segments
  if (customerPhone) {
    tokenizeAndPrefix(customerPhone).forEach((term) => terms.add(term));
  }

  // Add item names segments
  itemNames.forEach((name) => {
    if (name) {
      tokenizeAndPrefix(name).forEach((term) => terms.add(term));
    }
  });

  return Array.from(terms);
};

/**
 * Helper to prepare a Transaction object for Firestore insertion.
 */
export const prepareTransactionForFirestore = (
  transaction: Omit<Transaction, "search_terms">,
  customerName: string,
  customerPhone: string,
  customerAddress?: string,
  customerGstin?: string
): Transaction => {
  const itemNames = transaction.items.map((item) => item.name || "");
  const search_terms = generateSearchTerms(customerName, customerPhone, itemNames);

  // Clean items array to remove undefined values
  const cleanItems = transaction.items.map(item => {
    const cleanItem: any = {};
    for (const [k, v] of Object.entries(item)) {
      if (v !== undefined) cleanItem[k] = v;
    }
    return cleanItem;
  });

  const rawTx = {
    ...transaction,
    items: cleanItems,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    customer_gstin: customerGstin,
    search_terms,
  };

  const cleanTx: any = {};
  for (const [k, v] of Object.entries(rawTx)) {
    if (v !== undefined) cleanTx[k] = v;
  }

  return cleanTx as Transaction;
};
