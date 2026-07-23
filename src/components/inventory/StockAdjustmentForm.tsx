import { useState } from "react";
import { type InventoryItem, type AdjustmentReason } from '@/lib/firebase/types';
import { useAuth } from '../../context/AuthContext';
import { useInventoryMutations } from '../../hooks/queries/useInventory';
import toast from 'react-hot-toast';

export interface StockAdjustmentFormProps {
  /** The inventory item to adjust */
  item: InventoryItem;
  /** Callback fired to close the modal */
  onClose: () => void;
  /** Callback fired when stock is successfully adjusted */
  onSuccess: () => void;
}

/**
 * A modal form specifically for correcting stock quantities.
 * Logs the reason for adjustment to maintain a clean audit trail.
 */
export const StockAdjustmentForm: React.FC<StockAdjustmentFormProps> = ({ item, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const { adjustMutation } = useInventoryMutations(profile?.store_id);
  const [newStock, setNewStock] = useState(item.current_stock.toString());
  const [reason, setReason] = useState<AdjustmentReason>('CORRECTION');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.store_id) return;
    
    try {
      await adjustMutation.mutateAsync({
        itemId: item.item_id,
        previousStock: item.current_stock,
        adjustedStock: parseFloat(newStock),
        reason,
        adjustedBy: profile?.user_id
      });
      toast.success("Stock adjusted successfully");
      onSuccess();
    } catch (error: any) {
      console.error("Stock adjustment error:", error);
      const msg = error?.message || error?.code || String(error);
      toast.error(`Failed to adjust stock: ${msg}`);
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
              disabled={adjustMutation.isPending}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-8 py-3 bg-primary rounded font-label-md text-label-md text-on-primary shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:opacity-90 transition-opacity disabled:opacity-50" 
              disabled={adjustMutation.isPending}
            >
              {adjustMutation.isPending ? 'Adjusting...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
