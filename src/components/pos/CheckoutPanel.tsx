import { useState, useEffect } from "react";
import { usePOS } from '../../context/POSContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomers } from '@/hooks/queries/useCustomers';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import { formatCurrency } from '../../lib/utils/formatters';
import { DocumentType, FormatMode, PaymentStatus, type Customer } from '@/lib/firebase/types';
import { finalizeTransaction, getLatestDocumentNo } from '@/lib/firebase/api/transactions';
import { createCustomer } from '@/lib/firebase/api/customers';
import toast from 'react-hot-toast';

export interface CheckoutPanelProps {
  /** Callback triggered when a transaction successfully finalizes. Returns the transaction ID. */
  onShowChallan: (txId: string) => void;
}

/**
 * The CheckoutPanel component handles the cart state, customer selection, 
 * taxation rules, and finalizes transactions by dispatching them to Firestore.
 */
export const CheckoutPanel: React.FC<CheckoutPanelProps> = ({ onShowChallan }) => {
  const { profile } = useAuth();
  const {
    cart,
    customer,
    documentType,
    formatMode,
    paymentStatus,
    setDocumentType,
    setFormatMode,
    setPaymentStatus,
    cartTotal,
    cartTotalWithTax,
    clearCart,
    updateCartItemQty,
    removeFromCart,
    setCustomer
  } = usePOS();

  // Local State: Customer Details
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerGstin, setCustomerGstin] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  
  // Local State: Document Meta
  const [documentNo, setDocumentNo] = useState<string>('');
  const [documentDate, setDocumentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [buyersOrderNo, setBuyersOrderNo] = useState<string>('');
  const [buyersOrderDate, setBuyersOrderDate] = useState<string>('');
  
  // Local State: Processing & UI
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [gstRegion, setGstRegion] = useState<'INTRA' | 'INTER'>('INTRA');
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  /**
   * Keyboard shortcuts for faster POS operations.
   * Ctrl+Enter: finalize/submit checkout.
   * Escape: clear cart (if not empty and not currently typing in an input).
   * Ctrl+K: Focus item search.
   * Ctrl+B: Toggle Payment Status.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById('checkout-submit-btn')?.click();
      }

      if (e.key === 'Escape' && !isTyping && cart.length > 0) {
        setIsConfirmClearOpen(true);
      }

      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById('pos-search-input')?.focus();
      }

      if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPaymentStatus(paymentStatus === PaymentStatus.PAID_NOW ? PaymentStatus.CREDIT : PaymentStatus.PAID_NOW);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, paymentStatus, setPaymentStatus]);

  /**
   * Automatically search for existing customers as the user types a phone number or name.
   */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(customerSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [customerSearchQuery]);

  const { data: searchResponse } = useCustomers(
    profile?.store_id, 
    debouncedSearchQuery.length >= 3 ? debouncedSearchQuery : ''
  );
  const searchResults = searchResponse?.data || [];

  const customerSuggestions = debouncedSearchQuery.length >= 3 ? searchResults : [];

  useEffect(() => {
    if (debouncedSearchQuery.length >= 3 && !customer && !isCreatingNewCustomer) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [debouncedSearchQuery, customer, isCreatingNewCustomer]);

  /**
   * Fetch the next sequential document number when the document type changes.
   */
  useEffect(() => {
    const fetchNextDocNo = async () => {
      if (!profile?.store_id) return;
      let prefix = 'INV-';
      if (documentType === DocumentType.QUOTE) {
        prefix = 'QT-';
      } else if (formatMode === FormatMode.INFORMAL) {
        prefix = 'CH-';
      }
      
      try {
        const nextNo = await getLatestDocumentNo(profile.store_id, prefix);
        setDocumentNo(nextNo);
      } catch (error) {
        console.error("Failed to fetch next document number", error);
        setDocumentNo(`${prefix}000001`);
      }
    };
    fetchNextDocNo();
  }, [documentType, formatMode, profile?.store_id]);

  /**
   * Handles the submission of the cart, applying taxes, creating customers if necessary, 
   * and storing the transaction in Firestore.
   */
  const handleFinalize = async () => {
    if (cart.length === 0 || !profile?.store_id) return;
    
    if (!customer) {
      if (isCreatingNewCustomer) {
        if (!customerName.trim() || !customerPhone.trim()) {
          toast.error("Customer Name and Mobile No are required for new customers.");
          return;
        }
      } else {
        // Just a walk-in, or no customer selected
        // We can allow blank customers as WALK_IN, or require name.
        // If they searched but didn't pick, let's treat it as WALK_IN with no name unless they typed one.
        if (customerSearchQuery.trim()) {
          // Attempting to checkout without selecting a customer from search
          toast.error("Please select a customer from the search results, or click '+ Add New Customer' to create one.");
          return;
        }
      }
    }
    
    setIsProcessing(true);
    
    try {
      let custId = customer?.customer_id;
      
      // Auto-create customer profile if it's a new walk-in with a name/phone
      if (!custId) {
        custId = await getLatestDocumentNo(profile.store_id, 'CUST-');
        await createCustomer(
          profile.store_id, 
          custId, 
          customerName, 
          customerPhone, 
          customerAddress, 
          customerGstin, 
          customerEmail
        );
      }

      const txId = `TXN_${Date.now()}`;
      
      // Clean items to strip any undefined values that could crash Firestore
      const cleanItems = cart.map(item => {
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(item)) {
          if (v !== undefined) clean[k] = v;
        }
        return clean;
      });

      const transactionData: Record<string, any> = {
        transaction_id: txId,
        customer_id: custId || 'WALK_IN',
        customer_email: customer?.email || customerEmail || undefined,
        document_type: documentType,
        format_mode: formatMode,
        payment_status: paymentStatus,
        items: cleanItems,
        total_amount: formatMode === FormatMode.FORMAL_TAXED ? cartTotalWithTax : cartTotal,
        timestamp: new Date(documentDate),
        buyers_order_no: buyersOrderNo,
        buyers_order_date: buyersOrderDate ? new Date(buyersOrderDate) : undefined,
      };

      // Calculate GST Breakdowns if Formal Tax Mode is selected
      if (formatMode === FormatMode.FORMAL_TAXED) {
        const totalTax = cartTotalWithTax - cartTotal;
        const maxRate = cart.reduce((max, item) => Math.max(max, item.gst_rate || 0), 0);
        
        if (gstRegion === 'INTRA') {
          transactionData.gst_breakdown = {
            tax_slab: maxRate,
            cgst_rate: maxRate / 2,
            cgst: totalTax / 2,
            sgst_rate: maxRate / 2,
            sgst: totalTax / 2,
            igst_rate: 0,
            igst: 0,
            total_tax: totalTax
          };
        } else {
          transactionData.gst_breakdown = {
            tax_slab: maxRate,
            cgst_rate: 0,
            cgst: 0,
            sgst_rate: 0,
            sgst: 0,
            igst_rate: maxRate,
            igst: totalTax,
            total_tax: totalTax
          };
        }
      }

      // 1. Commit to Firestore
      const finalTxId = await finalizeTransaction(
        profile.store_id, 
        transactionData as any, 
        customer?.name || customerName, 
        customer?.phone || customerPhone,
        customer?.address || customerAddress,
        customer?.gstin || customerGstin,
        documentNo
      );
      
      // 2. Handle Post-Transaction Actions (Challan display, JobCard cleanup)
      if (documentType === DocumentType.FINAL_SALE) {
        onShowChallan(finalTxId);
        
        const jobIds = cleanItems
          .filter(item => item.item_id.startsWith('SVC_'))
          .map(item => item.item_id.replace('SVC_', ''));
        
        if (jobIds.length > 0) {
          try {
            const { deleteJobCard } = await import('@/lib/firebase/api/jobCards');
            for (const jobId of jobIds) {
              await deleteJobCard(jobId);
            }
          } catch (error) {
            console.error("Failed to remove billed job card", error);
          }
        }
      } else {
        toast.success("Quotation saved successfully!");
      }
      
      // 3. Reset State
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerGstin('');
      setCustomerEmail('');
      setCustomerSearchQuery('');
      setIsCreatingNewCustomer(false);
      
      // Refresh the next document number automatically
      let prefix = 'INV-';
      if (documentType === DocumentType.QUOTE) {
        prefix = 'QT-';
      } else if (formatMode === FormatMode.INFORMAL) {
        prefix = 'CH-';
      }
      const nextNo = await getLatestDocumentNo(profile.store_id, prefix);
      setDocumentNo(nextNo);

    } catch (error: any) {
      console.error("Failed to finalize transaction", error);
      const msg = error?.message || error?.code || String(error);
      alert(`Failed to finalize transaction: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="w-full bg-surface-container-lowest border-l border-outline-variant flex flex-col shadow-[-4px_0_20px_rgba(15,23,42,0.04)] h-full">
      {/* Scrollable Main Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
        
        {/* Cart Header */}
        <div className="p-6 border-b border-outline-variant shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline-md text-headline-md font-bold text-primary">Current Cart</h2>
            <span className="px-2 py-1 bg-surface-container-high rounded text-[10px] font-bold text-primary">{cart.length} ITEMS</span>
          </div>
          
          {/* Customer Input */}
          <div className="mb-2">
            <label className="block font-label-md text-label-md text-secondary mb-1.5 uppercase tracking-wider">Customer Details</label>
            {customer ? (
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant flex justify-between items-center">
                <div>
                  <p className="font-bold text-body-md text-primary">{customer.name}</p>
                  <p className="text-[11px] text-secondary">{customer.phone}</p>
                  {customer.email && <p className="text-[11px] text-secondary">{customer.email}</p>}
                </div>
                <button 
                  onClick={() => {
                    setCustomer(null);
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerEmail('');
                    setCustomerSearchQuery('');
                  }} 
                  className="text-error hover:bg-error-container p-1 rounded transition-colors"
                  aria-label="Remove Customer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ) : isCreatingNewCustomer ? (
              <div className="space-y-3 relative bg-surface-container-low p-4 rounded border border-outline-variant">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-primary text-body-md">New Customer Details</span>
                  <button 
                    className="text-secondary hover:text-error text-[12px] font-bold underline"
                    onClick={() => {
                      setIsCreatingNewCustomer(false);
                      setCustomerName('');
                      setCustomerPhone('');
                    }}
                  >Cancel</button>
                </div>
                <div className="flex gap-2 w-full">
                  <input 
                    type="text"
                    placeholder="Name *"
                    className="flex-1 w-1/2 bg-surface-container-lowest border border-outline-variant rounded p-2 text-body-md outline-none focus:border-primary transition-colors min-w-0"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <input 
                    type="tel"
                    placeholder="Phone *"
                    className="flex-1 w-1/2 bg-surface-container-lowest border border-outline-variant rounded p-2 text-body-md outline-none focus:border-primary transition-colors min-w-0"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 w-full">
                  <input 
                    type="text"
                    placeholder="Address (Optional)"
                    className="flex-1 w-[55%] bg-surface-container-lowest border border-outline-variant rounded p-2 text-body-md outline-none focus:border-primary transition-colors min-w-0"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                  <input 
                    type="email"
                    placeholder="Email (Optional)"
                    className="flex-1 w-[45%] bg-surface-container-lowest border border-outline-variant rounded p-2 text-body-md outline-none focus:border-primary transition-colors min-w-0"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 w-full">
                  <input 
                    type="text"
                    placeholder="GSTIN (Optional)"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-[11px] outline-none focus:border-primary transition-colors uppercase min-w-0"
                    value={customerGstin}
                    onChange={(e) => setCustomerGstin(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 relative">
                <div className="flex gap-2 relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">search</span>
                  <input 
                    type="text"
                    placeholder="Search customer by name or phone..."
                    className="flex-1 bg-surface-container-lowest border border-outline-variant rounded py-2 pl-9 pr-2 text-body-md outline-none focus:border-primary transition-colors"
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    onFocus={() => { if (customerSuggestions.length > 0) setShowSuggestions(true); }}
                  />
                </div>
                <button 
                  className="w-full py-2 bg-surface-container-high hover:bg-surface-container border border-outline-variant text-primary font-bold text-label-md rounded transition-colors flex items-center justify-center gap-2"
                    onClick={() => {
                      setIsCreatingNewCustomer(true);
                      setShowSuggestions(false);
                      // Pre-fill name or phone if they started typing it
                    if (/^\d+$/.test(customerSearchQuery)) {
                      setCustomerPhone(customerSearchQuery);
                    } else {
                      setCustomerName(customerSearchQuery);
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  Add New Customer
                </button>
                
                {/* Auto-fill Suggestions Dropdown */}
                {showSuggestions && customerSuggestions.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)} />
                    <div className="absolute top-11 left-0 right-0 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                      {customerSuggestions.map(c => (
                        <div 
                          key={c.customer_id}
                          className="p-3 hover:bg-surface-container cursor-pointer border-b border-outline-variant last:border-0"
                          onClick={() => {
                            setCustomer(c);
                            setShowSuggestions(false);
                            setCustomerSearchQuery('');
                          }}
                        >
                          <div className="font-bold text-body-md text-primary">{c.name}</div>
                          <div className="text-[11px] text-secondary">{c.phone}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Optional Document Metadata */}
          <div className="mt-4 pt-4 border-t border-outline-variant">
            <details className="group">
              <summary className="text-label-md font-bold text-primary cursor-pointer list-none flex items-center gap-1 hover:text-secondary transition-colors">
                <span className="material-symbols-outlined text-[16px] group-open:rotate-90 transition-transform">chevron_right</span>
                Additional Document Details (Optional)
              </summary>
              <div className="mt-3 flex gap-2 pl-5">
                <input 
                  type="text"
                  placeholder="Buyer's Order No."
                  className="flex-1 bg-surface-container-lowest border border-outline-variant rounded p-2 text-[11px] outline-none focus:border-primary transition-colors"
                  value={buyersOrderNo}
                  onChange={(e) => setBuyersOrderNo(e.target.value)}
                />
                <input 
                  type="date"
                  className="flex-1 bg-surface-container-lowest border border-outline-variant rounded p-2 text-[11px] outline-none focus:border-primary transition-colors"
                  value={buyersOrderDate}
                  onChange={(e) => setBuyersOrderDate(e.target.value)}
                />
              </div>
            </details>
          </div>
        </div>

        {/* Cart Items Loop */}
        <div className="p-6 space-y-6 shrink-0 min-h-[250px]">
          {cart.length === 0 ? (
            <div className="text-center text-secondary py-10 font-label-md">Cart is empty. Click items to add.</div>
          ) : (
            cart.map(item => (
              <div key={item.item_id} className="flex gap-4">
                <div className="h-16 w-16 bg-surface-container rounded border border-outline-variant overflow-hidden shrink-0 flex items-center justify-center">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                  ) : item.category ? (
                    <span className="font-headline-md text-primary font-bold text-xl">{item.category.charAt(0).toUpperCase()}</span>
                  ) : (
                    <span className="material-symbols-outlined text-outline-variant">inventory_2</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-body-md text-body-md font-bold text-primary leading-tight">{item.name}</h4>
                    <button onClick={() => removeFromCart(item.item_id)} className="text-secondary hover:text-error transition-colors">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="font-code text-code text-secondary">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center border border-outline-variant rounded">
                      <button onClick={() => updateCartItemQty(item.item_id, Math.max(1, item.qty - 1))} className="px-2 py-0.5 hover:bg-surface-container transition-colors"><span className="material-symbols-outlined text-xs">remove</span></button>
                      <span className="px-3 py-0.5 font-label-md text-label-md border-x border-outline-variant">{item.qty}</span>
                      <button onClick={() => updateCartItemQty(item.item_id, item.qty + 1)} className="px-2 py-0.5 hover:bg-surface-container transition-colors"><span className="material-symbols-outlined text-xs">add</span></button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Taxation & Transaction Format Selectors */}
        <div className="p-6 bg-surface-container-low border-t border-outline-variant mt-auto shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-label-md text-label-md text-secondary mb-1.5 uppercase tracking-wider">Doc Type</label>
              <select 
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-1.5 px-3 text-label-md font-medium outline-none"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              >
                <option value={DocumentType.FINAL_SALE}>Tax Invoice</option>
                <option value={DocumentType.QUOTE}>Quotation</option>
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-secondary mb-1.5 uppercase tracking-wider">Tax Mode</label>
              <select 
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-1.5 px-3 text-label-md font-medium outline-none"
                value={formatMode}
                onChange={(e) => setFormatMode(e.target.value as FormatMode)}
              >
                <option value={FormatMode.FORMAL_TAXED}>Formal (Taxed)</option>
                <option value={FormatMode.INFORMAL}>Informal (Untaxed)</option>
              </select>
            </div>
          </div>
          
          {formatMode === FormatMode.FORMAL_TAXED && (
            <div className="mb-4">
              <label className="block font-label-md text-label-md text-secondary mb-1.5 uppercase tracking-wider">GST Region</label>
              <div className="flex h-9 bg-surface-container border border-outline-variant rounded p-1">
                <button 
                  onClick={() => setGstRegion('INTRA')}
                  className={`flex-1 rounded font-bold uppercase tracking-tight transition-all text-[10px] ${gstRegion === 'INTRA' ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
                >Intra-State (CGST+SGST)</button>
                <button 
                  onClick={() => setGstRegion('INTER')}
                  className={`flex-1 rounded font-bold uppercase tracking-tight transition-all text-[10px] ${gstRegion === 'INTER' ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
                >Inter-State (IGST)</button>
              </div>
            </div>
          )}
          
          {documentType === DocumentType.FINAL_SALE && (
            <div className="mb-4">
              <label className="block font-label-md text-label-md text-secondary mb-1.5 uppercase tracking-wider">Status</label>
              <div className="flex h-9 bg-surface-container border border-outline-variant rounded p-1">
                <button 
                  onClick={() => setPaymentStatus(PaymentStatus.PAID_NOW)}
                  className={`flex-1 rounded font-bold uppercase tracking-tight transition-all text-[10px] ${paymentStatus === PaymentStatus.PAID_NOW ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
                >PAID</button>
                <button 
                  onClick={() => setPaymentStatus(PaymentStatus.CREDIT)}
                  className={`flex-1 rounded font-bold uppercase tracking-tight transition-all text-[10px] ${paymentStatus === PaymentStatus.CREDIT ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
                >CREDIT</button>
              </div>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-label-md text-label-md text-secondary mb-1.5 uppercase tracking-wider">Document No.</label>
              <input 
                value={documentNo}
                onChange={e => setDocumentNo(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-1.5 px-3 text-label-md font-code outline-none"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-secondary mb-1.5 uppercase tracking-wider">Date</label>
              <input 
                type="date"
                value={documentDate}
                onChange={e => setDocumentDate(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-1.5 px-3 text-label-md outline-none text-secondary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Totals & CTA Footer */}
      <div className="p-6 bg-surface-container-low border-t border-outline-variant shrink-0">
        <div className="space-y-2 mb-6">
          <div className="flex justify-between">
            <span className="text-body-md text-secondary">Subtotal</span>
            <span className="font-code text-body-md text-primary">{formatCurrency(cartTotal)}</span>
          </div>
          {formatMode === FormatMode.FORMAL_TAXED && (
            <>
              {gstRegion === 'INTRA' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-body-md text-secondary">CGST</span>
                    <span className="font-code text-body-md text-secondary">{formatCurrency((cartTotalWithTax - cartTotal) / 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-md text-secondary">SGST</span>
                    <span className="font-code text-body-md text-secondary">{formatCurrency((cartTotalWithTax - cartTotal) / 2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-body-md text-secondary">IGST</span>
                  <span className="font-code text-body-md text-secondary">{formatCurrency(cartTotalWithTax - cartTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-body-md text-secondary font-bold">Total Tax</span>
                <span className="font-code text-body-md text-primary font-bold">{formatCurrency(cartTotalWithTax - cartTotal)}</span>
              </div>
            </>
          )}
          <div className="pt-2 border-t border-outline-variant flex justify-between">
            <span className="font-headline-md text-headline-md font-bold text-primary">Total</span>
            <span className="font-headline-md text-headline-md font-bold text-primary">{formatCurrency(cartTotalWithTax)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            id="checkout-submit-btn"
            disabled={cart.length === 0 || isProcessing}
            onClick={handleFinalize}
            title="Ctrl+Enter"
            className="flex-1 py-4 bg-primary text-on-primary font-bold text-label-md rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {isProcessing ? "PROCESSING..." : (documentType === DocumentType.QUOTE ? "SAVE QUOTE" : "PROCEED TO CHECKOUT")}
            {!isProcessing && <span className="opacity-50 text-[10px] font-normal hidden md:inline ml-1">(Ctrl+↵)</span>}
          </button>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isConfirmClearOpen}
        title="Clear Cart"
        message="Are you sure you want to clear the current cart? All items will be removed."
        confirmLabel="Clear Cart"
        onConfirm={() => {
          clearCart();
          setIsConfirmClearOpen(false);
        }}
        onCancel={() => setIsConfirmClearOpen(false)}
        isDestructive={true}
      />
    </section>
  );
};
