import { useState } from "react";
import { type InventoryItem, ItemType, addInventoryItem, updateInventoryItem } from '@ledgerx/firebase-shared';
import { useAuth } from '../../context/AuthContext';

interface InventoryFormProps {
  initialData?: InventoryItem;
  onClose: () => void;
  categories?: string[];
}

export const InventoryForm: React.FC<InventoryFormProps> = ({ initialData, onClose, categories = [] }) => {
  const { profile } = useAuth();
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [imageUrl, setImageUrl] = useState(initialData?.image_url || '');
  const [hsnCode, setHsnCode] = useState(initialData?.hsn_code || '');
  const [itemType, setItemType] = useState<ItemType>(initialData?.item_type || ItemType.PRODUCT);
  const [purchasePrice, setPurchasePrice] = useState(initialData?.purchase_price.toString() || '');
  const [sellingPrice, setSellingPrice] = useState(initialData?.selling_price.toString() || '');
  const [gstRate, setGstRate] = useState(initialData?.gst_rate.toString() || '18');
  const [initialStock, setInitialStock] = useState(initialData?.current_stock.toString() || '0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (!profile?.store_id) return;
      
      const data = {
        name,
        category,
        image_url: imageUrl,
        hsn_code: hsnCode,
        item_type: itemType,
        purchase_price: parseFloat(purchasePrice) || 0,
        selling_price: parseFloat(sellingPrice) || 0,
        gst_rate: parseFloat(gstRate) || 0,
        current_stock: parseFloat(initialStock) || 0,
        is_active: true,
      };

      if (initialData) {
        await updateInventoryItem(initialData.item_id, data);
      } else {
        await addInventoryItem(profile.store_id, data);
      }
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to save item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-surface-container-lowest w-full max-w-[600px] mx-4 p-4 md:p-10 rounded border border-outline-variant shadow-[0_4px_20px_rgba(15,23,42,0.04)] max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline-md text-headline-md text-primary">
            {initialData ? 'Edit Inventory Item' : 'Add New Inventory Item'}
          </h3>
          <button className="text-secondary hover:text-primary transition-colors" onClick={onClose}>
            <span className="material-symbols-outlined" data-icon="close">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-secondary">Product Name</label>
              <input 
                className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
                placeholder="e.g. Laser Printer X5" 
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-secondary">Category</label>
              <input 
                className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
                placeholder="e.g. Electronics, Clothing" 
                value={category}
                onChange={e => setCategory(e.target.value)}
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                {categories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-secondary">Type</label>
              <select 
                className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none"
                value={itemType}
                onChange={e => setItemType(e.target.value as ItemType)}
              >
                <option value={ItemType.PRODUCT}>Product (Physical)</option>
                <option value={ItemType.SERVICE}>Service</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-secondary">Image URL (Optional)</label>
              <input 
                className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
                placeholder="e.g. https://example.com/image.png" 
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-secondary">HSN Code (Optional)</label>
              <input 
                className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
                placeholder="e.g. 9403" 
                value={hsnCode}
                onChange={e => setHsnCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-secondary">Initial Stock</label>
              <input 
                className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 disabled:bg-surface-container" 
                type="number"
                value={initialStock}
                onChange={e => setInitialStock(e.target.value)}
                disabled={!!initialData}
                required
              />
              {initialData && <p className="text-[10px] text-secondary">Use Adjust Stock to change quantity.</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-secondary">Purchase Price (₹)</label>
              <input 
                className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
                type="number"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-secondary">Selling Price (₹)</label>
              <input 
                className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none" 
                type="number"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-secondary">GST Rate (%)</label>
              <select 
                className="w-full border border-outline-variant rounded p-3 text-body-md focus:ring-1 focus:ring-primary outline-none"
                value={gstRate}
                onChange={e => setGstRate(e.target.value)}
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
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
              {isSubmitting ? 'Saving...' : (initialData ? 'Update Record' : 'Create Record')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
