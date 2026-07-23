import { useState, useEffect } from "react";
import { type InventoryItem, ItemType } from '@/lib/firebase/types';
import { storage } from '@/lib/firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useInventoryMutations } from '../../hooks/queries/useInventory';
import { Input } from '../ui/Input';
import toast from 'react-hot-toast';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export interface InventoryFormProps {
  /** If provided, the form populates with this data and runs an update instead of a create */
  initialData?: InventoryItem;
  /** Callback fired to close the modal */
  onClose: () => void;
  /** Callback fired when a new item is successfully created */
  onSuccess?: (itemId: string, data: any) => void;
  /** Existing categories for auto-complete */
  categories?: string[];
}

const DEFAULT_FORM_DATA = {
  name: '',
  category: '',
  imageUrl: '',
  hsnCode: '',
  itemType: ItemType.PRODUCT,
  initialStock: '0',
  minStock: '',
  reorderQuantity: '',
  purchasePrice: '',
  sellingPrice: '',
  gstRate: '18',
  isTaxInclusive: false
};

const DRAFT_KEY = 'ledgerx_inventory_draft';

/**
 * A comprehensive form component for adding and editing inventory items.
 * Supports image uploads to Firebase Storage, tax-inclusive price calculation, 
 * and draft restoration.
 */
export const InventoryForm: React.FC<InventoryFormProps> = ({ initialData, onClose, onSuccess, categories = [] }) => {
  const { profile } = useAuth();
  const { addMutation, updateMutation } = useInventoryMutations(profile?.store_id);
  
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        name: initialData.name || DEFAULT_FORM_DATA.name,
        category: initialData.category || DEFAULT_FORM_DATA.category,
        imageUrl: initialData.image_url || DEFAULT_FORM_DATA.imageUrl,
        hsnCode: initialData.hsn_code || DEFAULT_FORM_DATA.hsnCode,
        itemType: initialData.item_type || DEFAULT_FORM_DATA.itemType,
        initialStock: initialData.current_stock.toString() || DEFAULT_FORM_DATA.initialStock,
        minStock: initialData.min_stock?.toString() || DEFAULT_FORM_DATA.minStock,
        reorderQuantity: initialData.reorder_quantity?.toString() || DEFAULT_FORM_DATA.reorderQuantity,
        purchasePrice: initialData.purchase_price.toString() || DEFAULT_FORM_DATA.purchasePrice,
        sellingPrice: initialData.selling_price.toString() || DEFAULT_FORM_DATA.sellingPrice,
        gstRate: initialData.gst_rate.toString() || DEFAULT_FORM_DATA.gstRate,
        isTaxInclusive: false // Edits use raw values
      };
    }
    
    // Load Draft for new items
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) return JSON.parse(draft);
    } catch (error) {
      console.warn("Could not load draft", error);
    }
    return DEFAULT_FORM_DATA;
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Auto-save Draft for new items
   */
  useEffect(() => {
    if (!initialData) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    }
  }, [formData, initialData]);

  const updateForm = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // --- Profit Margin Calculation ---
  const parsedPurchase = parseFloat(formData.purchasePrice) || 0;
  let parsedSelling = parseFloat(formData.sellingPrice) || 0;
  const parsedGst = parseFloat(formData.gstRate) || 0;
  
  if (formData.isTaxInclusive) {
    parsedSelling = parsedSelling / (1 + (parsedGst / 100));
  }

  const profit = parsedSelling - parsedPurchase;
  const margin = parsedSelling > 0 ? ((profit / parsedSelling) * 100).toFixed(1) : '0.0';

  /**
   * Close form on Escape key
   */
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  /**
   * Handle image uploads directly to Firebase Storage.
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.store_id) return;

    setIsUploading(true);
    const toastId = toast.loading("Uploading image...");
    try {
      const storageRef = ref(storage, `inventory/${profile.store_id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateForm('imageUrl', url);
      toast.success("Image uploaded", { id: toastId });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Validate, format, and save the item to Firestore.
   */
  const processSubmit = async (addAnother: boolean = false) => {
    setIsSubmitting(true);
    
    try {
      if (!profile?.store_id) return;
      
      const trimmedName = formData.name.trim();
      const trimmedCategory = formData.category.trim();

      if (!trimmedName) {
        toast.error("Product name cannot be empty");
        setIsSubmitting(false);
        return;
      }
      
      const data = {
        name: trimmedName,
        category: trimmedCategory,
        image_url: formData.imageUrl,
        hsn_code: formData.hsnCode,
        item_type: formData.itemType,
        purchase_price: parsedPurchase,
        selling_price: parsedSelling, // Saves the base price
        gst_rate: parsedGst,
        current_stock: parseFloat(formData.initialStock) || 0,
        min_stock: formData.minStock ? parseFloat(formData.minStock) : undefined,
        reorder_quantity: formData.reorderQuantity ? parseFloat(formData.reorderQuantity) : undefined,
        is_active: true,
      };

      if (initialData && !addAnother) {
        await updateMutation.mutateAsync({ itemId: initialData.item_id, updates: data });
        toast.success("Item updated successfully");
        onClose();
      } else {
        const result = await addMutation.mutateAsync(data);
        toast.success("Item added successfully");
        localStorage.removeItem(DRAFT_KEY);
        
        if (onSuccess) {
          onSuccess(result, data);
        }

        if (addAnother) {
          setFormData(DEFAULT_FORM_DATA);
        } else {
          onClose();
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processSubmit(false);
  };

  return (
    <div 
      className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-surface-container-lowest w-full max-w-[600px] mx-4 p-4 md:p-10 rounded border border-outline-variant shadow-[0_4px_20px_rgba(15,23,42,0.04)] max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline-md text-headline-md text-primary">
            {initialData ? 'Edit Inventory Item' : 'Add New Inventory Item'}
          </h3>
          <button className="text-secondary hover:text-primary transition-colors" onClick={onClose}>
            <span className="material-symbols-outlined" data-icon="close">close</span>
          </button>
        </div>

        {/* Draft Notice */}
        {!initialData && formData.name && (
           <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-100 text-blue-700 rounded text-sm flex items-center gap-2">
             <span className="material-symbols-outlined text-[16px]">save</span>
             Draft restored from last session.
             <button type="button" onClick={() => { setFormData(DEFAULT_FORM_DATA); localStorage.removeItem(DRAFT_KEY); }} className="ml-auto underline font-bold hover:text-blue-900">Clear</button>
           </div>
        )}

        <form onSubmit={handleSubmit} className={`space-y-6 ${isSubmitting || isUploading ? 'pointer-events-none opacity-70' : ''}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <Input 
              label="Product Name"
              placeholder="e.g. Laser Printer X5" 
              value={formData.name}
              onChange={e => updateForm('name', e.target.value)}
              required
            />
            <div className="space-y-1 mb-3">
              <label className="text-label-md font-medium text-on-surface">Category</label>
              <input 
                className="h-10 px-3 text-body-md border border-outline-variant focus:border-primary rounded outline-none transition-colors w-full bg-surface-container-lowest text-on-surface focus:ring-1 focus:ring-primary" 
                placeholder="e.g. Electronics, Clothing" 
                value={formData.category}
                onChange={e => updateForm('category', e.target.value)}
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                {categories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-1 mb-3">
              <label className="text-label-md font-medium text-on-surface">Type</label>
              <select 
                className="h-10 px-3 text-body-md border border-outline-variant focus:border-primary rounded outline-none transition-colors w-full bg-surface-container-lowest text-on-surface focus:ring-1 focus:ring-primary"
                value={formData.itemType}
                onChange={e => updateForm('itemType', e.target.value as ItemType)}
              >
                <option value={ItemType.PRODUCT}>Product (Physical)</option>
                <option value={ItemType.SERVICE}>Service</option>
              </select>
            </div>
            
            <div className="space-y-1 mb-3">
              <label className="text-label-md font-medium text-on-surface">Image Upload</label>
              <div className="flex items-center gap-2">
                {formData.imageUrl ? (
                  <div className="h-10 w-10 border border-outline-variant rounded overflow-hidden flex-shrink-0">
                    <img src={formData.imageUrl} alt="preview" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-10 w-10 border border-dashed border-outline-variant rounded flex items-center justify-center flex-shrink-0 bg-surface-container">
                    <span className="material-symbols-outlined text-secondary text-lg">image</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-secondary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-surface-container file:text-primary hover:file:bg-surface-container-high transition-colors"
                />
              </div>
            </div>

            <Input 
              label="HSN Code (Optional)"
              placeholder="e.g. 9403" 
              value={formData.hsnCode}
              onChange={e => updateForm('hsnCode', e.target.value)}
            />
          </div>

          <div className="p-4 bg-surface-container rounded-lg border border-outline-variant/50">
            <h4 className="text-label-lg font-medium text-primary mb-3">Stock Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1 mb-3">
                <Input 
                  label="Initial Stock"
                  type="number"
                  min="0"
                  value={formData.initialStock}
                  onChange={e => updateForm('initialStock', e.target.value)}
                  disabled={!!initialData}
                  required
                />
                {initialData && <p className="text-[10px] text-secondary mt-[-10px]">Use Adjust Stock to change quantity.</p>}
              </div>
              <Input 
                label="Min Stock Alert"
                type="number"
                min="0"
                value={formData.minStock}
                onChange={e => updateForm('minStock', e.target.value)}
                placeholder="e.g. 10"
              />
              <Input 
                label="Reorder Qty"
                type="number"
                min="0"
                value={formData.reorderQuantity}
                onChange={e => updateForm('reorderQuantity', e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
          </div>

          <div className="p-4 bg-surface-container rounded-lg border border-outline-variant/50">
            <h4 className="text-label-lg font-medium text-primary mb-3">Pricing & Margin</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input 
                label="Purchase Price (₹)"
                type="number"
                min="0"
                step="0.01"
                value={formData.purchasePrice}
                onChange={e => updateForm('purchasePrice', e.target.value)}
                required
              />
              <div className="flex flex-col gap-1 mb-3">
                <Input 
                  label="Selling Price (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={e => updateForm('sellingPrice', e.target.value)}
                  required
                />
                {!initialData && (
                  <label className="flex items-center gap-2 mt-[-6px] cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-3 h-3 text-primary rounded border-outline-variant focus:ring-primary cursor-pointer"
                      checked={formData.isTaxInclusive}
                      onChange={e => updateForm('isTaxInclusive', e.target.checked)}
                    />
                    <span className="text-[10px] text-secondary group-hover:text-primary transition-colors">Price includes GST</span>
                  </label>
                )}
              </div>
              <div className="space-y-1 mb-3">
                <label className="text-label-md font-medium text-on-surface">GST Rate (%)</label>
                <select 
                  className="h-10 px-3 text-body-md border border-outline-variant focus:border-primary rounded outline-none transition-colors w-full bg-surface-container-lowest text-on-surface focus:ring-1 focus:ring-primary"
                  value={formData.gstRate}
                  onChange={e => updateForm('gstRate', e.target.value)}
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>
            
            {/* Profit Margin Preview */}
            <div className="mt-2 text-sm">
              <span className="text-secondary">Expected Profit: </span>
              <span className={`font-medium ${profit > 0 ? 'text-green-600' : 'text-error'}`}>
                ₹{profit.toFixed(2)} ({margin}% margin)
              </span>
              {formData.isTaxInclusive && parsedGst > 0 && (
                <span className="text-secondary ml-2 text-xs">(Base Price: ₹{parsedSelling.toFixed(2)})</span>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-outline-variant flex justify-end gap-3 sm:gap-4 flex-wrap">
            <button 
              type="button"
              className="px-4 py-2 border border-outline-variant rounded font-label-md text-label-md text-primary hover:bg-surface-container transition-colors" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            {!initialData && (
              <button 
                type="button"
                className="px-4 py-2 bg-surface-container-high rounded font-label-md text-label-md text-primary hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                onClick={() => processSubmit(true)}
                disabled={isSubmitting}
              >
                Save & Add Another
              </button>
            )}
            <button 
              type="submit"
              className="px-6 py-2 bg-primary rounded font-label-md text-label-md text-on-primary shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center min-w-[140px]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-on-primary inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                initialData ? 'Update Record' : 'Create Record'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
