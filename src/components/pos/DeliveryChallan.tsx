import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { type Transaction, voidTransaction, DocumentType, numberToWords } from '@/lib/firebase';
import { app } from '@/lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { usePOS } from '../../context/POSContext';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import toast from 'react-hot-toast';

export interface DeliveryChallanProps {
  /** The unique ID of the transaction to display */
  transactionId: string;
  /** Callback fired when the user closes the modal */
  onClose: () => void;
  /** Optional callback to load a quotation back into the POS cart */
  onConvertToInvoice?: () => void;
}

/**
 * A modal component that generates a printable invoice, quotation, or delivery memo.
 * Uses a strict A4/receipt sizing format for accurate printing.
 */
export const DeliveryChallan: React.FC<DeliveryChallanProps> = ({ transactionId, onClose, onConvertToInvoice }) => {
  const { profile: authProfile } = useAuth();
  const { profile } = useBusiness();
  const { loadTransaction } = usePOS();
  
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState<DocumentType | 'MEMO'>(DocumentType.FINAL_SALE);
  const [isConfirmVoidOpen, setIsConfirmVoidOpen] = useState(false);

  /**
   * Fetches the transaction details on mount.
   */
  useEffect(() => {
    const fetchTx = async () => {
      try {
        const db = getFirestore(app);
        const docRef = doc(db, 'Transactions', transactionId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const tx = docSnap.data() as Transaction;
          setTransaction(tx);
          setPrintMode(tx.document_type || DocumentType.FINAL_SALE);
        }
      } catch (error) {
        console.error("Failed to load transaction for document preview", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTx();
  }, [transactionId]);

  /**
   * Voids the current transaction and closes the modal.
   * Requires confirmation due to irreversible financial impact.
   */
  const handleVoid = async () => {
    try {
      if (!authProfile?.store_id) return;
      await voidTransaction(authProfile.store_id, transactionId, authProfile.uid, "Voided from viewer");
      toast.success("Transaction voided successfully.");
      setIsConfirmVoidOpen(false);
      onClose();
    } catch (error) {
      console.error("Failed to void", error);
      toast.error("Failed to void transaction");
    }
  };

  /**
   * Loads a saved quotation back into the POS cart for modification and final sale.
   */
  const handleConvertToInvoice = () => {
    if (transaction && onConvertToInvoice) {
      loadTransaction(transaction);
      onConvertToInvoice();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center print:hidden">
        <div className="bg-surface-container-lowest p-8 rounded font-body-md shadow-md">Loading Document...</div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center print:hidden">
        <div className="bg-surface-container-lowest p-8 rounded font-body-md shadow-md text-error">Document not found</div>
      </div>
    );
  }

  // Safely parse Firestore Timestamps
  const docDate = transaction.timestamp?.seconds 
    ? new Date(transaction.timestamp.seconds * 1000) 
    : new Date(transaction.timestamp);
    
  const buyersOrderDate = transaction.buyers_order_date?.seconds 
    ? new Date(transaction.buyers_order_date.seconds * 1000) 
    : (transaction.buyers_order_date ? new Date(transaction.buyers_order_date) : null);
  
  // Calculate Totals
  const subtotal = transaction.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalTax = transaction.gst_breakdown?.total_tax || (transaction.total_amount - subtotal);
  const rawTotal = transaction.total_amount;
  const grandTotal = Math.round(rawTotal);

  const isUntaxed = transaction.format_mode === 'INFORMAL';
  const showFinancials = printMode !== 'MEMO';

  /**
   * Determines the title printed at the top of the document.
   */
  const getDocTitle = () => {
    switch (printMode) {
      case DocumentType.QUOTE: return 'QUOTATION';
      case 'MEMO': return 'DELIVERY MEMO';
      case DocumentType.FINAL_SALE: 
      default: return isUntaxed ? 'INVOICE' : 'TAX INVOICE';
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-container-low/80 backdrop-blur-sm z-[100] flex flex-col print:static print:bg-surface-container-lowest print:block">
      
      {/* Controls Header (Hidden on Print) */}
      <div className="flex-none bg-surface-container-lowest border-b border-outline-variant p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm z-20 print:hidden">
        <div className="flex items-center gap-4">
          <button 
            className="bg-surface-container-high p-2 rounded-full hover:bg-surface-container-highest transition-colors" 
            onClick={onClose} 
            aria-label="Close document"
          >
            <span className="material-symbols-outlined text-primary">close</span>
          </button>
          <h2 className="font-headline-sm font-bold text-primary">Document Preview</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-surface-container rounded p-1">
            {transaction.document_type === DocumentType.FINAL_SALE && (
              <>
                <button 
                  className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase transition-colors ${printMode === DocumentType.FINAL_SALE ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
                  onClick={() => setPrintMode(DocumentType.FINAL_SALE)}
                >
                  Tax Invoice
                </button>
                <button 
                  className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase transition-colors ${printMode === 'MEMO' ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container-high'}`}
                  onClick={() => setPrintMode('MEMO')}
                >
                  Delivery Memo
                </button>
              </>
            )}
            {transaction.document_type === DocumentType.QUOTE && (
              <button className="px-3 py-1.5 rounded text-[11px] font-bold uppercase transition-colors bg-primary text-on-primary shadow-sm">
                Quotation
              </button>
            )}
          </div>

          <button 
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded font-bold text-[11px] uppercase transition-all active:opacity-80" 
            onClick={() => window.print()}
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print / Save as PDF
          </button>
          
          {transaction.document_type === DocumentType.QUOTE && (
            <button 
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-lowest border border-outline-variant text-primary rounded font-bold text-[11px] uppercase transition-all hover:bg-surface-container"
              onClick={handleConvertToInvoice}
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              Convert
            </button>
          )}
          
          {transaction.status !== 'VOIDED' && (
            <button 
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded font-bold text-[11px] uppercase transition-all hover:bg-rose-100"
              onClick={() => setIsConfirmVoidOpen(true)}
            >
              <span className="material-symbols-outlined text-[16px]">block</span>
              Void
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Canvas Area (Actual Printable Invoice) */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-start md:justify-center items-start print:p-0">
        <div 
          id="print-invoice" 
          className="bg-white shrink-0 w-[800px] min-h-[1100px] text-black shadow-xl border border-gray-300 p-6 sm:p-8 md:p-10 flex flex-col relative print:shadow-none print:border-none print:m-0 print:p-0 print:w-full print:bg-white print:text-black"
        >
          
          {transaction.status === 'VOIDED' && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-error font-bold text-headline-lg border-8 border-error py-4 px-12 -rotate-45 opacity-30 z-0 pointer-events-none whitespace-nowrap">
              VOIDED TRANSACTION
            </div>
          )}

          {/* Header Section */}
          <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2 relative z-10">
            <div className="text-[12px] font-bold">
              {!isUntaxed && profile?.gstin && `GSTIN: ${profile.gstin}`}
            </div>
            <div className="text-[12px] italic uppercase text-right absolute right-0 top-0">
              {printMode === DocumentType.FINAL_SALE && !isUntaxed && "(ORIGINAL FOR RECIPIENT)"}
            </div>
          </div>
          
          {!isUntaxed && (
            <div className="text-center mb-2 relative z-10">
              <h1 className="text-4xl font-bold font-serif uppercase tracking-wider text-black">
                {profile?.business_name || 'Business Name'}
              </h1>
              <p className="text-[11px] mt-1">
                {profile?.address || ''} 
                Mobile : {profile?.phone || 'N/A'}{profile?.alt_phone ? `, ${profile.alt_phone}` : ''}
              </p>
              {(profile?.email || profile?.website) && (
                <p className="text-[11px]">
                  {profile?.email && `e-mail : ${profile.email}`} {profile?.website && `| web : ${profile.website}`}
                </p>
              )}
            </div>
          )}

          <div className="text-center mb-2 border-y-2 border-black py-1 font-bold uppercase text-lg relative z-10">
            {getDocTitle()}
          </div>

          {/* Meta Info Table */}
          <div className="border-2 border-black flex flex-row relative z-10">
            {/* Left Side: Buyer Info */}
            <div className="w-1/2 border-r-2 border-black p-2 flex flex-col">
              <span className="font-bold text-[12px] mb-1">
                {printMode === DocumentType.QUOTE ? 'Quotation For' : 'Buyer'}
              </span>
              <div className="font-bold text-[14px] uppercase">{transaction.customer_name || 'Walk-in Customer'}</div>
              {transaction.customer_address && <div className="text-[13px]">{transaction.customer_address}</div>}
              {transaction.customer_phone && <div className="text-[12px] mt-1">Phone: {transaction.customer_phone}</div>}
              {transaction.customer_gstin && <div className="text-[12px] font-bold mt-1">GSTIN: {transaction.customer_gstin}</div>}
            </div>

            {/* Right Side: Invoice & Order Info */}
            <div className="w-1/2 flex flex-col">
              <div className={`flex ${isUntaxed || printMode === 'MEMO' || printMode === DocumentType.QUOTE ? 'h-full' : 'border-b-2 border-black h-1/2'}`}>
                {!isUntaxed && (
                  <div className="w-1/2 border-r-2 border-black p-2 flex flex-col justify-center">
                    <span className="text-[11px]">
                      {printMode === 'MEMO' ? 'Delivery Memo No.' : printMode === DocumentType.QUOTE ? 'Quotation No.' : 'Invoice No.'}
                    </span>
                    <span className="font-bold text-[14px]">
                      {printMode === 'MEMO' && transaction.custom_doc_no 
                        ? transaction.custom_doc_no.replace(/^INV/, 'DM') 
                        : (transaction.custom_doc_no || transaction.transaction_id.substring(0, 8))}
                    </span>
                  </div>
                )}
                <div className={`${isUntaxed ? 'w-full' : 'w-1/2'} p-2 flex flex-col justify-center`}>
                  <span className="text-[11px]">Dated</span>
                  <span className="font-bold text-[14px]">{docDate.toLocaleDateString('en-GB')}</span>
                </div>
              </div>
              
              {!isUntaxed && printMode !== 'MEMO' && printMode !== DocumentType.QUOTE && (
                <div className="flex h-1/2">
                  <div className="w-1/2 border-r-2 border-black p-2 flex flex-col justify-center">
                    <span className="text-[11px]">Buyer's Order No.</span>
                    <span className="font-bold text-[14px]">{transaction.buyers_order_no || '-'}</span>
                  </div>
                  <div className="w-1/2 p-2 flex flex-col justify-center">
                    <span className="text-[11px]">Dated</span>
                    <span className="font-bold text-[14px]">
                      {buyersOrderDate ? buyersOrderDate.toLocaleDateString('en-GB') : '-'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border-x-2 border-b-2 border-black flex-grow flex flex-col relative z-10 min-h-[300px]">
            <table className="w-full h-full border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-[12px]">
                  <th className="font-bold py-1 px-1 text-center w-10 border-r-2 border-black">No.</th>
                  <th className="font-bold py-1 px-2 text-left border-r-2 border-black">Description of Goods</th>
                  {!isUntaxed && <th className="font-bold py-1 px-1 text-center w-20 border-r-2 border-black">HSN</th>}
                  <th className="font-bold py-1 px-1 text-center w-16 border-r-2 border-black">Qty</th>
                  {showFinancials && <th className="font-bold py-1 px-1 text-right w-24 border-r-2 border-black">Rate</th>}
                  {showFinancials && <th className="font-bold py-1 px-2 text-right w-28">Amount</th>}
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item, index) => (
                  <tr key={index} className="align-top">
                    <td className="py-2 px-1 text-center border-r-2 border-black text-[13px]">{index + 1}</td>
                    <td className="py-2 px-2 border-r-2 border-black text-[14px] font-semibold">
                      {item.name} {item.is_custom ? '(Custom)' : ''}
                      {!isUntaxed && item.gst_rate !== undefined && (
                        <div className="text-[10px] text-gray-600 font-normal mt-0.5">GST: {item.gst_rate}%</div>
                      )}
                    </td>
                    {!isUntaxed && <td className="py-2 px-1 text-center border-r-2 border-black text-[13px]">{item.hsn_code || ''}</td>}
                    <td className="py-2 px-1 text-center border-r-2 border-black text-[13px] font-bold">{item.qty}</td>
                    {showFinancials && (
                      <td className="py-2 px-1 text-right border-r-2 border-black text-[13px]">
                        {item.price.toFixed(2)}
                      </td>
                    )}
                    {showFinancials && (
                      <td className="py-2 px-2 text-right text-[13px] font-bold">
                        {(item.price * item.qty).toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))}
                {/* Empty padding row to stretch the table */}
                <tr className="flex-grow">
                  <td className="border-r-2 border-black"></td>
                  <td className="border-r-2 border-black"></td>
                  {!isUntaxed && <td className="border-r-2 border-black"></td>}
                  <td className="border-r-2 border-black"></td>
                  {showFinancials && <td className="border-r-2 border-black"></td>}
                  {showFinancials && <td></td>}
                </tr>
              </tbody>
              
              {/* Table Totals Footers */}
              {showFinancials && (
                <tfoot className="border-t-2 border-black font-bold text-[13px]">
                  {!isUntaxed && (
                    <>
                      <tr>
                        <td colSpan={4} className="border-r-2 border-black border-b border-black"></td>
                        <td className="py-1 px-1 text-right border-r-2 border-black border-b border-black">Total</td>
                        <td className="py-1 px-2 text-right border-b border-black">{subtotal.toFixed(2)}</td>
                      </tr>
                      {transaction.gst_breakdown?.cgst > 0 && (
                        <tr>
                          <td colSpan={4} className="border-r-2 border-black border-b border-black"></td>
                          <td className="py-1 px-1 text-right border-r-2 border-black border-b border-black">
                            CGST @ {transaction.gst_breakdown.cgst_rate}%
                          </td>
                          <td className="py-1 px-2 text-right border-b border-black">
                            {transaction.gst_breakdown.cgst.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {transaction.gst_breakdown?.sgst > 0 && (
                        <tr>
                          <td colSpan={4} className="border-r-2 border-black border-b border-black"></td>
                          <td className="py-1 px-1 text-right border-r-2 border-black border-b border-black">
                            SGST @ {transaction.gst_breakdown.sgst_rate}%
                          </td>
                          <td className="py-1 px-2 text-right border-b border-black">
                            {transaction.gst_breakdown.sgst.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {transaction.gst_breakdown?.igst > 0 && (
                        <tr>
                          <td colSpan={4} className="border-r-2 border-black border-b border-black"></td>
                          <td className="py-1 px-1 text-right border-r-2 border-black border-b border-black">
                            IGST @ {transaction.gst_breakdown.igst_rate}%
                          </td>
                          <td className="py-1 px-2 text-right border-b border-black">
                            {transaction.gst_breakdown.igst.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {(!transaction.gst_breakdown || (transaction.gst_breakdown.cgst === 0 && transaction.gst_breakdown.igst === 0 && totalTax > 0)) && (
                        <tr>
                          <td colSpan={4} className="border-r-2 border-black border-b border-black"></td>
                          <td className="py-1 px-1 text-right border-r-2 border-black border-b border-black">Tax</td>
                          <td className="py-1 px-2 text-right border-b border-black">{totalTax.toFixed(2)}</td>
                        </tr>
                      )}
                    </>
                  )}
                  <tr>
                    <td colSpan={isUntaxed ? 3 : 4} className="border-r-2 border-black"></td>
                    <td className="py-2 px-1 text-right border-r-2 border-black font-extrabold">G. Total</td>
                    <td className="py-2 px-2 text-right font-extrabold text-[15px]">{rawTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Round Off and Amount In Words */}
          {showFinancials && (
            <>
              <div className="border-x-2 border-b-2 border-black flex">
                <div className="w-2/3 p-1 font-bold text-[13px] border-r-2 border-black">
                  {isUntaxed ? 'Total Amount (Rounded Off)' : 'Total Amount with GST (Rounded Off)'}
                </div>
                <div className="w-1/3 p-1 font-extrabold text-[15px] text-right px-2">
                  ₹ {grandTotal.toFixed(2)}
                </div>
              </div>
              <div className="border-x-2 border-b-2 border-black p-1 flex items-center">
                <span className="font-bold text-[12px] mr-2">Total Amount (in words) :</span>
                <span className="text-[13px] font-bold italic">{numberToWords(grandTotal)} Rupees Only</span>
              </div>
            </>
          )}

          {/* Footer Terms & Signature */}
          {!isUntaxed && (
            <div className="border-x-2 border-b-2 border-black flex min-h-[140px] relative z-10">
              
              {/* Declaration & Terms */}
              <div className="w-[55%] border-r-2 border-black p-2 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-[12px] block mb-1">
                    {printMode === DocumentType.QUOTE ? 'Terms & Conditions' : 'Declaration'}
                  </span>
                  <p className="text-[10px] whitespace-pre-wrap leading-tight">
                    {printMode === DocumentType.QUOTE 
                      ? (profile?.quotation_terms || '1. Quotation is valid for 30 days.\n2. Taxes inclusive.')
                      : (profile?.invoice_terms || '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.')}
                  </p>
                </div>
              </div>

              {/* Bank Details & Signature Block */}
              <div className="w-[45%] flex flex-col">
                {printMode !== 'MEMO' && printMode !== DocumentType.QUOTE && (
                  <div className="p-2 border-b-2 border-black flex-grow">
                    <span className="font-bold text-[11px] block mb-1">Company's Bank Details</span>
                    <div className="flex text-[11px]">
                      <span className="w-24">Bank Name</span>
                      <span>: {profile?.bank_name || 'N/A'}</span>
                    </div>
                    <div className="flex text-[11px]">
                      <span className="w-24">A/c No.</span>
                      <span>: {profile?.bank_account || 'N/A'}</span>
                    </div>
                    <div className="flex text-[11px]">
                      <span className="w-24">Branch & IFS Code</span>
                      <span>: {profile?.bank_ifsc || 'N/A'}</span>
                    </div>
                  </div>
                )}
                
                <div className={`p-2 h-24 flex flex-col justify-between items-end ${printMode === 'MEMO' || printMode === DocumentType.QUOTE ? 'flex-grow' : ''}`}>
                  <span className="font-bold text-[12px]">
                    For : {profile?.signature_name || profile?.business_name || 'Business Name'}
                  </span>
                  <span className="text-[11px] font-bold mt-12 text-right block w-full border-t border-black pt-1">
                    Authorised Signatory
                  </span>
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isConfirmVoidOpen}
        title="Void Transaction"
        message="Are you sure you want to void this transaction? This cannot be undone."
        confirmLabel="Void Transaction"
        onConfirm={handleVoid}
        onCancel={() => setIsConfirmVoidOpen(false)}
        isDestructive={true}
      />
    </div>
  );
};
