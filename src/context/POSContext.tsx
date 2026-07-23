/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useMemo } from "react";
import { 
  DocumentType, 
  FormatMode, 
  PaymentStatus, 
  type TransactionItem, 
  type Customer 
} from '@/lib/firebase';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Defines the shape of the global Point of Sale (POS) context.
 */
interface POSState {
  // --- Core State ---
  cart: TransactionItem[];
  customer: Customer | null;
  documentType: DocumentType;
  formatMode: FormatMode;
  paymentStatus: PaymentStatus;
  
  // --- Actions ---
  addToCart: (item: TransactionItem) => void;
  updateCartItemQty: (itemId: string, qty: number) => void;
  removeFromCart: (itemId: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setDocumentType: (type: DocumentType) => void;
  setFormatMode: (mode: FormatMode) => void;
  setPaymentStatus: (status: PaymentStatus) => void;
  clearCart: () => void;
  loadTransaction: (tx: any) => void;
  
  // --- Derived State (Calculated Properties) ---
  cartTotal: number;
  cartTotalWithTax: number;
}

// ============================================================================
// CONTEXT SETUP
// ============================================================================

const POSContext = createContext<POSState | undefined>(undefined);

/**
 * Provides global Point of Sale state management for the application.
 * Handles shopping cart, customer assignment, taxation, and billing logic.
 */
export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- State ---
  const [cart, setCart] = useState<TransactionItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.QUOTE);
  const [formatMode, setFormatMode] = useState<FormatMode>(FormatMode.INFORMAL);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID_NOW);

  // --- Cart Actions ---
  
  /**
   * Adds an item to the cart. If the item already exists (and isn't custom), 
   * its quantity is incremented instead. Validates against available stock.
   */
  const addToCart = (item: TransactionItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(i => i.item_id === item.item_id);
      
      // Handle existing standard inventory item
      if (existingItem && !item.is_custom) {
        const newQty = existingItem.qty + item.qty;
        if (item.max_stock !== undefined && newQty > item.max_stock) {
          toast.error(`Cannot add more than available stock (${item.max_stock})`);
          return prevCart;
        }
        return prevCart.map(i => 
          i.item_id === item.item_id ? { ...i, qty: newQty } : i
        );
      }
      
      // Handle new item
      if (item.max_stock !== undefined && item.qty > item.max_stock) {
        toast.error(`Cannot add more than available stock (${item.max_stock})`);
        return prevCart;
      }
      
      return [...prevCart, item];
    });
  };

  /**
   * Updates the exact quantity of an existing item in the cart.
   * Validates against available stock.
   */
  const updateCartItemQty = (itemId: string, qty: number) => {
    setCart((prevCart) => prevCart.map(i => {
      if (i.item_id === itemId) {
        if (i.max_stock !== undefined && qty > i.max_stock) {
          toast.error(`Cannot increase quantity beyond available stock (${i.max_stock})`);
          return { ...i, qty: i.max_stock };
        }
        return { ...i, qty };
      }
      return i;
    }));
  };

  /**
   * Removes an item entirely from the cart based on its unique ID.
   */
  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter(i => i.item_id !== itemId));
  };

  /**
   * Clears the entire cart and removes the currently selected customer.
   */
  const clearCart = () => {
    setCart([]);
    setCustomer(null);
  };

  // --- Transaction Loading ---

  /**
   * Loads a previous transaction into the POS state (useful for edits, reprints, or converting quotes).
   */
  const loadTransaction = (tx: any) => {
    setCart(tx.items || []);
    
    // Construct a mock customer object so it displays properly in the cart view
    if (tx.customer_id) {
      setCustomer({
        customer_id: tx.customer_id,
        store_id: tx.store_id,
        name: tx.customer_name || 'Walk-in',
        phone: tx.customer_phone || '',
        address: tx.customer_address || '',
        gstin: tx.customer_gstin || '',
        udhaar_balance: 0,
        created_at: new Date(),
        search_terms: []
      });
    } else {
      setCustomer(null);
    }
    
    setDocumentType(DocumentType.FINAL_SALE);
    setFormatMode(tx.format_mode || FormatMode.INFORMAL);
  };

  // --- Derived State (Calculations) ---

  /**
   * Calculates the base total of the cart (pre-tax).
   */
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }, [cart]);

  /**
   * Calculates the grand total of the cart, applying GST conditionally based on the Format Mode.
   */
  const cartTotalWithTax = useMemo(() => {
    return cart.reduce((sum, item) => {
      const basePrice = item.price * item.qty;
      const isFormalTaxed = formatMode === FormatMode.FORMAL_TAXED;
      const taxRate = isFormalTaxed && item.gst_rate ? item.gst_rate : 0;
      const taxAmount = basePrice * (taxRate / 100);
      
      return sum + basePrice + taxAmount;
    }, 0);
  }, [cart, formatMode]);

  const contextValue: POSState = {
    cart,
    customer,
    documentType,
    formatMode,
    paymentStatus,
    addToCart,
    updateCartItemQty,
    removeFromCart,
    setCustomer,
    setDocumentType,
    setFormatMode,
    setPaymentStatus,
    clearCart,
    loadTransaction,
    cartTotal,
    cartTotalWithTax
  };

  return <POSContext.Provider value={contextValue}>{children}</POSContext.Provider>;
};

// ============================================================================
// CUSTOM HOOK
// ============================================================================

/**
 * Custom hook to consume the POSContext safely.
 * Throws an error if used outside of a POSProvider.
 */
export const usePOS = () => {
  const context = useContext(POSContext);
  if (context === undefined) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
