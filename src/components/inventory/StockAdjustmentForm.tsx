import { useState } from "react";
import { adjustStock, type InventoryItem, type AdjustmentReason } from '@/lib/firebase';
import { useAuth } from '../../context/AuthContext';

interface StockAdjustmentFormProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

export const StockAdjustmentForm: React.FC<StockAdjustmentFormProps> = ({ item, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [newStock, setNewStock] = useState(item.current_stock.toString());
  const [reason, setReason] = useState<AdjustmentReason>('CORRECTION');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (!profile?.store_id) return;
      await adjustStock(
        profile.store_id,
        item.item_id,
        item.current_stock,
        parseFloat(newStock),
        reason
      );
      onSuccess();
    } catch (error: any) {
      console.error("Stock adjustment error:", error);
      const msg = error?.message || error?.code || String(error);
      alert(`Failed to adjust stock: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const diff = parseFloat(newStock || '0') - item.current_stock;

  return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-surface-container-lowest w-full max-w-[500px] mx-4 p-4 md:p-8 rounded border border-outline-variant shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline-md text-headline-md text-primary">Adjust Stock: {item.name}</h3>
          <button className="text-secondary hover:text-primary transition-colors" onClick={onClose}>
            <span className="material-symbols-outlined" data-icon="close">close</span>
          </button>
        </div>

        <p className="text-secondary font-body-md mb-6">Current Stock: <strong className="text-primary">{item.current_stock}</strong></p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-secondary">New Actual Stock</label>
            <input 
              type="number" 
              className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none"
              value={newStock} 
              onChange={e => setNewStock(e.target.value)} 
              required 
            />
          </div>
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-secondary">
              Reason for change (<span className={diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-error' : ''}>{diff > 0 ? `+${diff}` : diff}</span>)
            </label>
            <select 
              className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none"
              value={reason} 
              onChange={e => setReason(e.target.value as AdjustmentReason)}
            >
              <option value="RESTOCK">Restock (Received new items)</option>
              <option value="DAMAGED">Damaged / Lost</option>
              <option value="CORRECTION">Correction (Inventory Audit)</option>
            </select>
          </div>
          
          <div className="pt-6 border-t border-outline-variant flex justify-end gap-4">
            <button 
              type="button" 
              className="px-6 py-3 border border-outline-variant rounded font-label-md text-label-md text-primary hover:bg-surface-container transition-colors" 
              onClick={onClose} 
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-8 py-3 bg-primary rounded font-label-md text-label-md text-on-primary shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:opacity-90 transition-opacity disabled:opacity-50" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adjusting...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
