/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useMemo } from "react";
import { 
  DocumentType, 
  FormatMode, 
  PaymentStatus, 
  type TransactionItem, 
  type Customer 
} from '@/lib/firebase';

interface POSState {
  cart: TransactionItem[];
  customer: Customer | null;
  documentType: DocumentType;
  formatMode: FormatMode;
  paymentStatus: PaymentStatus;
  
  // Actions
  addToCart: (item: TransactionItem) => void;
  updateCartItemQty: (itemId: string, qty: number) => void;
  removeFromCart: (itemId: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setDocumentType: (type: DocumentType) => void;
  setFormatMode: (mode: FormatMode) => void;
  setPaymentStatus: (status: PaymentStatus) => void;
  clearCart: () => void;
  loadTransaction: (tx: any) => void;
  
  // Derived state
  cartTotal: number;
  cartTotalWithTax: number;
}

const POSContext = createContext<POSState | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<TransactionItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.QUOTE);
  const [formatMode, setFormatMode] = useState<FormatMode>(FormatMode.INFORMAL);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID_NOW);

  const addToCart = (item: TransactionItem) => {
    setCart((prev) => {
      const existing = prev.find(i => i.item_id === item.item_id);
      if (existing && !item.is_custom) {
        const newQty = existing.qty + item.qty;
        if (item.max_stock !== undefined && newQty > item.max_stock) {
          alert(`Cannot add more than available stock (${item.max_stock})`);
          return prev;
        }
        return prev.map(i => 
          i.item_id === item.item_id ? { ...i, qty: newQty } : i
        );
      }
      if (item.max_stock !== undefined && item.qty > item.max_stock) {
        alert(`Cannot add more than available stock (${item.max_stock})`);
        return prev;
      }
      return [...prev, item];
    });
  };

  const updateCartItemQty = (itemId: string, qty: number) => {
    setCart((prev) => prev.map(i => {
      if (i.item_id === itemId) {
        if (i.max_stock !== undefined && qty > i.max_stock) {
          alert(`Cannot increase quantity beyond available stock (${i.max_stock})`);
          return { ...i, qty: i.max_stock };
        }
        return { ...i, qty };
      }
      return i;
    }));
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter(i => i.item_id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomer(null);
  };

  const loadTransaction = (tx: any) => {
    setCart(tx.items || []);
    // We construct a mock customer object so it displays properly in the cart
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

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }, [cart]);

  const cartTotalWithTax = useMemo(() => {
    return cart.reduce((sum, item) => {
      const base = item.price * item.qty;
      const taxRate = formatMode === FormatMode.FORMAL_TAXED && item.gst_rate ? item.gst_rate : 0;
      const taxAmount = base * (taxRate / 100);
      return sum + base + taxAmount;
    }, 0);
  }, [cart, formatMode]);

  const value = {
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

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (context === undefined) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
