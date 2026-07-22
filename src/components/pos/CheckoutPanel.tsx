import { useState, useEffect } from "react";
import { usePOS } from '../../context/POSContext';
import { useAuth } from '../../context/AuthContext';
import { DocumentType, FormatMode, PaymentStatus, finalizeTransaction, createCustomer, getLatestDocumentNo, type Customer, searchCustomers } from '@/lib/firebase';

export const CheckoutPanel: React.FC<{ onShowChallan: (txId: string) => void }> = ({ onShowChallan }) => {
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
    setCustomer // Need to import this from usePOS
  } = usePOS();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [buyersOrderNo, setBuyersOrderNo] = useState('');
  const [buyersOrderDate, setBuyersOrderDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gstRegion, setGstRegion] = useState<'INTRA' | 'INTER'>('INTRA');

  // Search customers as they type
  useEffect(() => {
    const fetchCustomer = async () => {
      const searchTerm = customerPhone.trim() || customerName.trim();
      if (searchTerm.length >= 3 && !customer && profile?.store_id) {
        try {
          const results = await searchCustomers(profile.store_id, searchTerm);
          setCustomerSuggestions(results);
          setShowSuggestions(true);
        } catch (e) {
          console.error("Auto-fill error", e);
        }
      } else {
        setCustomerSuggestions([]);
        setShowSuggestions(false);
      }
    };
    
    const timeout = setTimeout(fetchCustomer, 300);
    return () => clearTimeout(timeout);
  }, [customerPhone, customerName, customer, profile?.store_id]);

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
      } catch (e) {
        console.error("Failed to fetch next doc no", e);
        setDocumentNo(`${prefix}000001`);
      }
    };
    fetchNextDocNo();
  }, [documentType, formatMode, profile?.store_id]);

  const handleFinalize = async () => {
    if (cart.length === 0 || !profile?.store_id) return;
    
    if (!customer && (!customerName.trim() || !customerPhone.trim())) {
      alert("Customer Name and Mobile No are required.");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      let custId = customer?.customer_id;
      
      if (!custId) {
        custId = await getLatestDocumentNo(profile.store_id, 'CUST-');
        await createCustomer(profile.store_id, custId, customerName, customerPhone, customerAddress, customerGstin);
      }

      const txId = `TXN_${Date.now()}`;
      
      // Clean items to strip any undefined values that could crash Firestore
      const cleanItems = cart.map(item => {
        const clean: any = {};
        for (const [k, v] of Object.entries(item)) {
          if (v !== undefined) clean[k] = v;
        }
        return clean;
      });

      const transactionData = {
        transaction_id: txId,
        customer_id: custId || 'WALK_IN',
        document_type: documentType,
        format_mode: formatMode,
        payment_status: paymentStatus,
        items: cleanItems,
        total_amount: formatMode === FormatMode.FORMAL_TAXED ? cartTotalWithTax : cartTotal,
        timestamp: new Date(documentDate),
        buyers_order_no: buyersOrderNo,
        buyers_order_date: buyersOrderDate ? new Date(buyersOrderDate) : undefined,
      };

      if (formatMode === FormatMode.FORMAL_TAXED) {
        const totalTax = cartTotalWithTax - cartTotal;
        const maxRate = cart.reduce((max, item) => Math.max(max, item.gst_rate || 0), 0);
        
        if (gstRegion === 'INTRA') {
          (transactionData as any).gst_breakdown = {
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
          (transactionData as any).gst_breakdown = {
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

      const finalTxId = await finalizeTransaction(
        profile.store_id, 
        transactionData, 
        customer?.name || customerName, 
        customer?.phone || customerPhone,
        customer?.address || customerAddress,
        customer?.gstin || customerGstin,
        documentNo
      );
      
      if (documentType === DocumentType.FINAL_SALE) {
        onShowChallan(finalTxId);
        
        // Remove Job Card if this transaction originated from one
        const jobIds = cleanItems
          .filter(item => item.item_id.startsWith('SVC_'))
          .map(item => item.item_id.replace('SVC_', ''));
        
        if (jobIds.length > 0) {
          try {
            const { deleteJobCard } = await import('@/lib/firebase');
            for (const jobId of jobIds) {
              await deleteJobCard(jobId);
            }
          } catch (e) {
            console.error("Failed to remove billed job card", e);
          }
        }
      } else {
        alert("Quotation saved successfully!");
      }
      
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerGstin('');
      
      // Refresh the next document number automatically
      let prefix = 'INV-';
      if (documentType === DocumentType.QUOTE) {
        prefix = 'QT-';
      } else if (formatMode === FormatMode.INFORMAL) {
        prefix = 'CH-';
      }
      const nextNo = await getLatestDocumentNo(profile.store_id, prefix);
      setDocumentNo(nextNo);
    } catch (e: any) {
      console.error("Failed to finalize transaction", e);
      const msg = e?.message || e?.code || String(e);
      alert(`Failed to finalize transaction: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="w-full bg-white border-l border-outline-variant flex flex-col shadow-[-4px_0_20px_rgba(15,23,42,0.04)] h-full">
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
               </div>
               <button 
                 onClick={() => {
                   setCustomer(null);
                   setCustomerName('');
                   setCustomerPhone('');
                 }} 
                 className="text-error hover:bg-error-container p-1 rounded transition-colors"
               >
                 <span className="material-symbols-outlined text-[16px]">close</span>
               </button>
             </div>
          ) : (
            <div className="space-y-2 relative">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Name *"
                  className="flex-1 bg-white border border-outline-variant rounded p-2 text-body-md outline-none focus:border-primary transition-colors"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onFocus={() => { if (customerSuggestions.length > 0) setShowSuggestions(true); }}
                />
                <input 
                  type="tel"
                  placeholder="Phone *"
                  className="flex-1 bg-white border border-outline-variant rounded p-2 text-body-md outline-none focus:border-primary transition-colors"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onFocus={() => { if (customerSuggestions.length > 0) setShowSuggestions(true); }}
                />
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Address (Optional)"
                  className="flex-1 bg-white border border-outline-variant rounded p-2 text-[11px] outline-none focus:border-primary transition-colors"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
                <input 
                  type="text"
                  placeholder="GSTIN (Optional)"
                  className="flex-1 bg-white border border-outline-variant rounded p-2 text-[11px] outline-none focus:border-primary transition-colors uppercase"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value)}
                />
              </div>
              
              {showSuggestions && customerSuggestions.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)} />
                  <div className="absolute top-11 left-0 right-0 bg-white border border-outline-variant rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {customerSuggestions.map(c => (
                      <div 
                        key={c.customer_id}
                        className="p-3 hover:bg-surface-container cursor-pointer border-b border-outline-variant last:border-0"
                        onClick={() => {
                          setCustomer(c);
                          setShowSuggestions(false);
                          setCustomerName('');
                          setCustomerPhone('');
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
                className="flex-1 bg-white border border-outline-variant rounded p-2 text-[11px] outline-none focus:border-primary transition-colors"
                value={buyersOrderNo}
                onChange={(e) => setBuyersOrderNo(e.target.value)}
              />
              <input 
                type="date"
                className="flex-1 bg-white border border-outline-variant rounded p-2 text-[11px] outline-none focus:border-primary transition-colors"
                value={buyersOrderDate}
                onChange={(e) => setBuyersOrderDate(e.target.value)}
              />
            </div>
          </details>
        </div>

        {/* Cart Items */}
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
                    <p className="font-code text-code text-secondary">₹{item.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
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

        {/* Document Settings */}
        <div className="p-6 bg-surface-container-low border-t border-outline-variant mt-auto shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block font-label-md text-label-md text-secondary mb-1.5 uppercase tracking-wider">Doc Type</label>
            <select 
              className="w-full bg-white border border-outline-variant rounded py-1.5 px-3 text-label-md font-medium outline-none"
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
              className="w-full bg-white border border-outline-variant rounded py-1.5 px-3 text-label-md font-medium outline-none"
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
                className={`flex-1 rounded font-bold uppercase tracking-tight transition-all text-[10px] ${gstRegion === 'INTRA' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
              >Intra-State (CGST+SGST)</button>
              <button 
                onClick={() => setGstRegion('INTER')}
                className={`flex-1 rounded font-bold uppercase tracking-tight transition-all text-[10px] ${gstRegion === 'INTER' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
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
                className={`flex-1 rounded font-bold uppercase tracking-tight transition-all text-[10px] ${paymentStatus === PaymentStatus.PAID_NOW ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
              >PAID</button>
              <button 
                onClick={() => setPaymentStatus(PaymentStatus.CREDIT)}
                className={`flex-1 rounded font-bold uppercase tracking-tight transition-all text-[10px] ${paymentStatus === PaymentStatus.CREDIT ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
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
              className="w-full bg-white border border-outline-variant rounded py-1.5 px-3 text-label-md font-code outline-none"
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-secondary mb-1.5 uppercase tracking-wider">Date</label>
            <input 
              type="date"
              value={documentDate}
              onChange={e => setDocumentDate(e.target.value)}
              className="w-full bg-white border border-outline-variant rounded py-1.5 px-3 text-label-md outline-none text-secondary"
            />
          </div>
          </div>
        </div>
      </div>
    </div>

    {/* Fixed Totals & CTA Footer */}
    <div className="p-6 bg-surface-container-low border-t border-outline-variant shrink-0">
        {/* Totals */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between">
            <span className="text-body-md text-secondary">Subtotal</span>
            <span className="font-code text-body-md text-primary">₹{cartTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          {formatMode === FormatMode.FORMAL_TAXED && (
            <>
              {gstRegion === 'INTRA' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-body-md text-secondary">CGST</span>
                    <span className="font-code text-body-md text-secondary">₹{((cartTotalWithTax - cartTotal) / 2).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body-md text-secondary">SGST</span>
                    <span className="font-code text-body-md text-secondary">₹{((cartTotalWithTax - cartTotal) / 2).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-body-md text-secondary">IGST</span>
                  <span className="font-code text-body-md text-secondary">₹{(cartTotalWithTax - cartTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-body-md text-secondary font-bold">Total Tax</span>
                <span className="font-code text-body-md text-primary font-bold">₹{(cartTotalWithTax - cartTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </>
          )}
          <div className="pt-2 border-t border-outline-variant flex justify-between">
            <span className="font-headline-md text-headline-md font-bold text-primary">Total</span>
            <span className="font-headline-md text-headline-md font-bold text-primary">₹{cartTotalWithTax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>

        {/* CTA Actions */}
        <div className="flex gap-3">

          <button 
            disabled={cart.length === 0 || isProcessing}
            onClick={handleFinalize}
            className="flex-1 py-4 bg-primary text-white font-bold text-label-md rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {isProcessing ? "PROCESSING..." : (documentType === DocumentType.QUOTE ? "SAVE QUOTE" : "PROCEED TO CHECKOUT")}
          </button>
        </div>
      </div>
    </section>
  );
};
