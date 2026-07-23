import { useState } from "react";
import Papa from "papaparse";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { ItemType, bulkAddInventoryItems } from "@/lib/firebase";

interface BulkImportModalProps {
  onClose: () => void;
}

interface ParsedItem {
  Name: string;
  Category: string;
  Type: string;
  Stock: string;
  PurchasePrice: string;
  SellingPrice: string;
  GSTRate: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose }) => {
  const { profile } = useAuth();
  const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const handleDownloadTemplate = () => {
    const headers = "Name,Category,Type,Stock,PurchasePrice,SellingPrice,GSTRate\n";
    const example = "Premium Coffee Beans,Beverages,PRODUCT,50,400,600,5\n";
    const blob = new Blob([headers + example], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "LedgerX_Inventory_Template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedData(results.data as ParsedItem[]);
        setIsParsing(false);
      },
      error: (error) => {
        console.error(error);
        toast.error("Failed to parse CSV file");
        setIsParsing(false);
      },
    });
  };

  const handleConfirmUpload = async () => {
    if (!profile?.store_id) return;
    if (parsedData.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${parsedData.length} items...`);

    try {
      const formattedItems = parsedData.map((row) => {
        const pPrice = parseFloat(row.PurchasePrice) || 0;
        const sPrice = parseFloat(row.SellingPrice) || 0;
        const stock = parseFloat(row.Stock) || 0;
        const gst = parseFloat(row.GSTRate) || 0;
        
        return {
          name: row.Name || "Unnamed Item",
          category: row.Category || "Uncategorized",
          item_type: row.Type?.toUpperCase() === 'SERVICE' ? ItemType.SERVICE : ItemType.PRODUCT,
          purchase_price: pPrice,
          selling_price: sPrice,
          gst_rate: gst,
          current_stock: stock,
          is_active: true,
        };
      });

      const count = await bulkAddInventoryItems(profile.store_id, formattedItems);
      toast.success(`Successfully imported ${count} items!`, { id: toastId });
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Bulk import failed", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-[800px] mx-4 p-4 md:p-10 rounded border border-outline-variant shadow-[0_4px_20px_rgba(15,23,42,0.04)] max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline-md text-headline-md text-primary">
            Bulk Import Inventory (CSV)
          </h3>
          <button className="text-secondary hover:text-primary transition-colors" onClick={onClose}>
            <span className="material-symbols-outlined" data-icon="close">
              close
            </span>
          </button>
        </div>

        <div className="mb-6 flex gap-4">
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-surface-container text-primary font-label-md rounded flex items-center gap-2 hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download Template
          </button>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="px-4 py-2 bg-primary text-on-primary font-label-md rounded flex items-center gap-2 hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Select CSV File
            </button>
          </div>
        </div>

        {isParsing && <p className="text-secondary">Parsing CSV...</p>}

        {parsedData.length > 0 && (
          <div className="flex-1 overflow-auto border border-outline-variant rounded mb-6">
            <table className="w-full text-left text-body-sm">
              <thead className="bg-surface-container sticky top-0">
                <tr>
                  <th className="px-4 py-2 font-medium text-secondary">Name</th>
                  <th className="px-4 py-2 font-medium text-secondary">Category</th>
                  <th className="px-4 py-2 font-medium text-secondary">Stock</th>
                  <th className="px-4 py-2 font-medium text-secondary">Price</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="border-t border-outline-variant/50 hover:bg-surface-container-lowest">
                    <td className="px-4 py-2">{row.Name}</td>
                    <td className="px-4 py-2">{row.Category}</td>
                    <td className="px-4 py-2">{row.Stock}</td>
                    <td className="px-4 py-2">₹{row.SellingPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedData.length > 50 && (
              <p className="p-2 text-center text-secondary text-xs bg-surface-container">
                Showing first 50 of {parsedData.length} items.
              </p>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-outline-variant flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 border border-outline-variant rounded font-label-md text-label-md text-primary hover:bg-surface-container transition-colors"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmUpload}
            className="px-6 py-2 bg-primary rounded font-label-md text-label-md text-on-primary shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center min-w-[140px]"
            disabled={isUploading || parsedData.length === 0}
          >
            {isUploading ? "Uploading..." : `Import ${parsedData.length} Items`}
          </button>
        </div>
      </div>
    </div>
  );
};
