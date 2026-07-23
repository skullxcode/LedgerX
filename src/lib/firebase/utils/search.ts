import type { Transaction } from "../types";

// ============================================================================
// TOKENIZATION & PREFIXING
// ============================================================================

/**
 * Generates an array of lowercase prefixes for a given string.
 * For example, "John" -> ["j", "jo", "joh", "john"]
 * 
 * @param text - The string to generate prefixes for.
 * @returns Array of prefix strings.
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
 * 
 * @param text - The string to tokenize.
 * @returns Array of unique prefix strings.
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

// ============================================================================
// EXPORTED SEARCH UTILITIES
// ============================================================================

/**
 * Takes customer details and item names to generate a comprehensive `search_terms` 
 * array for Firestore queries. This enables "starts-with" and partial word searches 
 * without requiring external full-text search engines like Algolia.
 * 
 * @param customerName - Name of the customer (optional).
 * @param customerPhone - Phone number of the customer (optional).
 * @param itemNames - Array of item names associated with the record (optional).
 * @returns Array of search term prefixes.
 */
export const generateSearchTerms = (
  customerName: string = "",
  customerPhone: string = "",
  itemNames: string[] = []
): string[] => {
  const terms = new Set<string>();

  if (customerName) {
    tokenizeAndPrefix(customerName).forEach((term) => terms.add(term));
  }

  if (customerPhone) {
    tokenizeAndPrefix(customerPhone).forEach((term) => terms.add(term));
  }

  itemNames.forEach((name) => {
    if (name) {
      tokenizeAndPrefix(name).forEach((term) => terms.add(term));
    }
  });

  return Array.from(terms);
};

/**
 * Helper to prepare a Transaction object for Firestore insertion.
 * It automatically generates `search_terms` and safely strips any `undefined` values 
 * that would cause Firestore serialization errors.
 * 
 * @param transaction - The base transaction payload.
 * @param customerName - The customer's name.
 * @param customerPhone - The customer's phone.
 * @param customerAddress - (Optional) The customer's address.
 * @param customerGstin - (Optional) The customer's GSTIN.
 * @returns A cleansed Transaction object ready for Firestore.
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
    const cleanItem: Record<string, any> = {};
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

  const cleanTx: Record<string, any> = {};
  for (const [k, v] of Object.entries(rawTx)) {
    if (v !== undefined) cleanTx[k] = v;
  }

  return cleanTx as Transaction;
};
