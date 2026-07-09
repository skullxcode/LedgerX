import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { type Transaction, voidTransaction, DocumentType, PaymentStatus, numberToWords } from '@ledgerx/firebase-shared';
import { app } from '@ledgerx/firebase-shared';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { usePOS } from '../../context/POSContext';

interface DeliveryChallanProps {
  transactionId: string;
  onClose: () => void;
  onConvertToInvoice?: () => void;
}

export const DeliveryChallan: React.FC<DeliveryChallanProps> = ({ transactionId, onClose, onConvertToInvoice }) => {
  const { profile: authProfile } = useAuth();
  const { profile } = useBusiness();
  const { loadTransaction } = usePOS();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState<DocumentType | 'MEMO'>(DocumentType.FINAL_SALE);

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
      } catch (e) {
        console.error("Failed to load transaction for document", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTx();
  }, [transactionId]);

  const handleVoid = async () => {
    if (window.confirm("Are you sure you want to void this transaction? This cannot be undone.")) {
      try {
        if (!authProfile?.store_id) return;
        await voidTransaction(authProfile.store_id, transactionId, authProfile.uid, "Voided from viewer");
        alert("Transaction voided successfully.");
        onClose();
      } catch (e) {
        console.error("Failed to void", e);
        alert("Failed to void transaction");
      }
    }
  };

  const handleConvertToInvoice = () => {
    if (transaction && onConvertToInvoice) {
      loadTransaction(transaction);
      onConvertToInvoice();
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center print:hidden">
      <div className="bg-white p-8 rounded font-body-md">Loading...</div>
    </div>
  );
  if (!transaction) return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center print:hidden">
      <div className="bg-white p-8 rounded font-body-md">Document not found</div>
    </div>
  );

  const docDate = transaction.timestamp?.seconds ? new Date(transaction.timestamp.seconds * 1000) : new Date(transaction.timestamp);
  const buyersOrderDate = transaction.buyers_order_date?.seconds ? new Date(transaction.buyers_order_date.seconds * 1000) : (transaction.buyers_order_date ? new Date(transaction.buyers_order_date) : null);
  
  const subtotal = transaction.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  // Try to use gst_breakdown if available, otherwise fallback
  const totalTax = transaction.gst_breakdown?.total_tax || (transaction.total_amount - subtotal);
  
  const rawTotal = transaction.total_amount;
  const grandTotal = Math.round(rawTotal);
  const roundOff = grandTotal - rawTotal;

  const isUntaxed = transaction.format_mode === 'INFORMAL';
  const showFinancials = printMode !== 'MEMO';

  const getDocTitle = () => {
    switch (printMode) {
      case DocumentType.QUOTE: return 'QUOTATION';
      case 'MEMO': return 'DELIVERY MEMO';
      case DocumentType.FINAL_SALE: 
      default: return isUntaxed ? 'INVOICE' : 'TAX INVOICE';
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-container-low/80 backdrop-blur-sm z-50 overflow-y-auto flex justify-center items-start py-12 px-margin-mobile md:px-0 print:static print:bg-white print:p-0 print:block">
      
      {/* Controls Container (Hidden on Print) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10 print:hidden">
        <button className="bg-white p-2 rounded-full shadow hover:bg-surface-container transition-colors self-end" onClick={onClose} aria-label="Close document">
          <span className="material-symbols-outlined text-primary">close</span>
        </button>
        
        <div className="bg-white border border-outline-variant p-4 rounded-lg shadow-xl mt-4 flex flex-col gap-4 w-64">
          <div className="flex flex-col gap-2">
            <h4 className="font-label-md text-label-md text-secondary uppercase tracking-wider">Print Mode</h4>
            <div className="flex flex-col gap-1 border-b border-outline-variant pb-4">
              {transaction.document_type === DocumentType.FINAL_SALE && (
                <>
                  <button 
                    className={`py-2 px-3 text-left rounded text-label-md transition-colors ${printMode === DocumentType.FINAL_SALE ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
                    onClick={() => setPrintMode(DocumentType.FINAL_SALE)}
                  >
                    Tax Invoice
                  </button>
                  <button 
                    className={`py-2 px-3 text-left rounded text-label-md transition-colors ${printMode === 'MEMO' ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
                    onClick={() => setPrintMode('MEMO')}
                  >
                    Delivery Memo
                  </button>
                </>
              )}
              {transaction.document_type === DocumentType.QUOTE && (
                <button 
                  className={`py-2 px-3 text-left rounded text-label-md transition-colors ${printMode === DocumentType.QUOTE ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'}`}
                  onClick={() => setPrintMode(DocumentType.QUOTE)}
                >
                  Quotation
                </button>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded font-label-md text-label-md transition-all active:opacity-80 justify-center" 
              onClick={() => window.print()}
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print Document
            </button>
            
            {transaction.document_type === DocumentType.QUOTE && (
              <button 
                className="flex items-center gap-2 px-4 py-2 border border-outline-variant bg-white text-primary rounded font-label-md text-label-md transition-all hover:bg-surface-container justify-center"
                onClick={handleConvertToInvoice}
              >
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                Convert to Invoice
              </button>
            )}
            
            {transaction.status !== 'VOIDED' && (
              <button 
                className="flex items-center gap-2 px-4 py-2 mt-2 bg-rose-50 text-rose-700 rounded font-label-md text-label-md transition-all hover:bg-rose-100 justify-center"
                onClick={handleVoid}
              >
                <span className="material-symbols-outlined text-[18px]">block</span>
                Void Transaction
              </button>
            )}
          </div>
        </div>
      </div>

      {/* A4 Canvas */}
      <div id="print-invoice" className="bg-white w-full max-w-[850px] min-h-[1100px] text-black shadow-xl border border-outline-variant p-6 sm:p-8 md:p-10 flex flex-col relative print:shadow-none print:border-none print:m-0 print:p-0 print:w-full">
        
        {transaction.status === 'VOIDED' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-error font-bold text-headline-lg border-8 border-error py-4 px-12 -rotate-45 opacity-30 z-0 pointer-events-none whitespace-nowrap">
            VOIDED TRANSACTION
          </div>
        )}

        {/* --- Header Section --- */}
        <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2 relative z-10">
          <div className="text-[12px] font-bold">
            {profile?.gstin && `GSTIN/UIN No.: ${profile.gstin}`}
          </div>
          <div className="text-[12px] italic uppercase text-right absolute right-0 top-0">
            {printMode === DocumentType.FINAL_SALE && !isUntaxed && "(ORIGINAL FOR RECIPIENT)"}
          </div>
        </div>
        
        <div className="text-center mb-2 relative z-10">
          <h1 className="text-4xl font-bold font-serif uppercase tracking-wider text-black">{profile?.business_name || 'Business Name'}</h1>
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

        <div className="text-center mb-2 border-y-2 border-black py-1 font-bold uppercase text-lg relative z-10">
          {getDocTitle()}
        </div>

        {/* --- Meta Info Table --- */}
        <div className="border-2 border-black flex flex-row relative z-10">
          {/* Left Side: Buyer Info */}
          <div className="w-1/2 border-r-2 border-black p-2 flex flex-col">
            <span className="font-bold text-[12px] mb-1">Buyer</span>
            <div className="font-bold text-[14px] uppercase">{transaction.customer_name || 'Walk-in Customer'}</div>
            {transaction.customer_address && <div className="text-[13px]">{transaction.customer_address}</div>}
            {transaction.customer_phone && <div className="text-[12px] mt-1">Phone: {transaction.customer_phone}</div>}
            {transaction.customer_gstin && <div className="text-[12px] font-bold mt-1">GSTIN: {transaction.customer_gstin}</div>}
          </div>

          {/* Right Side: Invoice & Order Info */}
          <div className="w-1/2 flex flex-col">
            <div className="flex border-b-2 border-black h-1/2">
              <div className="w-1/2 border-r-2 border-black p-2 flex flex-col justify-center">
                <span className="text-[11px]">Invoice No.</span>
                <span className="font-bold text-[14px]">{transaction.custom_doc_no || transaction.transaction_id.substring(0, 8)}</span>
              </div>
              <div className="w-1/2 p-2 flex flex-col justify-center">
                <span className="text-[11px]">Dated</span>
                <span className="font-bold text-[14px]">{docDate.toLocaleDateString('en-GB')}</span>
              </div>
            </div>
            <div className="flex h-1/2">
              <div className="w-1/2 border-r-2 border-black p-2 flex flex-col justify-center">
                <span className="text-[11px]">Buyer's Order No.</span>
                <span className="font-bold text-[14px]">{transaction.buyers_order_no || '-'}</span>
              </div>
              <div className="w-1/2 p-2 flex flex-col justify-center">
                <span className="text-[11px]">Dated</span>
                <span className="font-bold text-[14px]">{buyersOrderDate ? buyersOrderDate.toLocaleDateString('en-GB') : '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* --- Items Table --- */}
        <div className="border-x-2 border-b-2 border-black flex-grow flex flex-col relative z-10 min-h-[300px]">
          <table className="w-full h-full border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-[12px]">
                <th className="font-bold py-1 px-1 text-center w-10 border-r-2 border-black">No.</th>
                <th className="font-bold py-1 px-2 text-left border-r-2 border-black">Description of Goods</th>
                <th className="font-bold py-1 px-1 text-center w-20 border-r-2 border-black">HSN</th>
                <th className="font-bold py-1 px-1 text-center w-16 border-r-2 border-black">Quantity</th>
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
                  </td>
                  <td className="py-2 px-1 text-center border-r-2 border-black text-[13px]">{item.hsn_code || ''}</td>
                  <td className="py-2 px-1 text-center border-r-2 border-black text-[13px] font-bold">{item.qty}</td>
                  {showFinancials && <td className="py-2 px-1 text-right border-r-2 border-black text-[13px]">
                    {item.price.toFixed(2)}
                  </td>}
                  {showFinancials && <td className="py-2 px-2 text-right text-[13px] font-bold">
                    {(item.price * item.qty).toFixed(2)}
                  </td>}
                </tr>
              ))}
              {/* Padding row to stretch table */}
              <tr className="flex-grow">
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                {showFinancials && <td className="border-r-2 border-black"></td>}
                {showFinancials && <td></td>}
              </tr>
            </tbody>
            
            {/* Totals Section directly inside table bottom */}
            {showFinancials && (
              <tfoot className="border-t-2 border-black font-bold text-[13px]">
                {!isUntaxed ? (
                  <>
                    <tr>
                      <td colSpan={4} className="border-r-2 border-black border-b border-black"></td>
                      <td className="py-1 px-1 text-right border-r-2 border-black border-b border-black">Total</td>
                      <td className="py-1 px-2 text-right border-b border-black">{subtotal.toFixed(2)}</td>
                    </tr>
                    {transaction.gst_breakdown?.cgst > 0 && (
                      <tr>
                        <td colSpan={4} className="border-r-2 border-black border-b border-black"></td>
                        <td className="py-1 px-1 text-right border-r-2 border-black border-b border-black">CGST @ {transaction.gst_breakdown.cgst_rate}%</td>
                        <td className="py-1 px-2 text-right border-b border-black">{transaction.gst_breakdown.cgst.toFixed(2)}</td>
                      </tr>
                    )}
                    {transaction.gst_breakdown?.sgst > 0 && (
                      <tr>
                        <td colSpan={4} className="border-r-2 border-black border-b border-black"></td>
                        <td className="py-1 px-1 text-right border-r-2 border-black border-b border-black">SGST @ {transaction.gst_breakdown.sgst_rate}%</td>
                        <td className="py-1 px-2 text-right border-b border-black">{transaction.gst_breakdown.sgst.toFixed(2)}</td>
                      </tr>
                    )}
                    {transaction.gst_breakdown?.igst > 0 && (
                      <tr>
                        <td colSpan={4} className="border-r-2 border-black border-b border-black"></td>
                        <td className="py-1 px-1 text-right border-r-2 border-black border-b border-black">IGST @ {transaction.gst_breakdown.igst_rate}%</td>
                        <td className="py-1 px-2 text-right border-b border-black">{transaction.gst_breakdown.igst.toFixed(2)}</td>
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
                ) : null}
                <tr>
                  <td colSpan={4} className="border-r-2 border-black"></td>
                  <td className="py-2 px-1 text-right border-r-2 border-black font-extrabold">G. Total</td>
                  <td className="py-2 px-2 text-right font-extrabold text-[15px]">{rawTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* --- Round Off and Words --- */}
        {showFinancials && (
          <>
            <div className="border-x-2 border-b-2 border-black flex">
              <div className="w-2/3 p-1 font-bold text-[13px] border-r-2 border-black">
                Total Amount with {isUntaxed ? 'Tax' : 'GST'} (Rounded Off)
              </div>
              <div className="w-1/3 p-1 font-extrabold text-[15px] text-right px-2">
                ₹ {grandTotal.toFixed(2)}
              </div>
            </div>
            <div className="border-x-2 border-b-2 border-black p-1 flex">
              <span className="font-bold text-[12px] mr-2">Total Amount (in words) :</span>
              <span className="text-[13px] font-bold italic">{numberToWords(grandTotal)}</span>
            </div>
          </>
        )}

        {/* --- Footer Terms & Signature --- */}
        <div className="border-x-2 border-b-2 border-black flex min-h-[140px] relative z-10">
          {/* Left Side: Declaration & Terms */}
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

          {/* Right Side: Bank & Signature */}
          <div className="w-[45%] flex flex-col">
            <div className="p-2 border-b-2 border-black flex-grow">
              <span className="font-bold text-[11px] block mb-1">Company's bank Detail</span>
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
            <div className="p-2 h-24 flex flex-col justify-between items-end">
              <span className="font-bold text-[12px]">For : {profile?.signature_name || profile?.business_name || 'Business Name'}</span>
              <span className="text-[11px] font-bold mt-12 text-right block w-full border-t border-black pt-1">
                Authorised Signatory
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
