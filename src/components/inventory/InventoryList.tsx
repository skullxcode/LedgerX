import { useState } from "react";
import { type InventoryItem, ItemType, softDeleteInventoryItem } from '@/lib/firebase';
import { InventoryForm } from './InventoryForm';
import { StockAdjustmentForm } from './StockAdjustmentForm';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import { formatCurrency } from '../../lib/utils/formatters';

export interface InventoryListProps {
  /** The list of inventory items to display */
  items: InventoryItem[];
}

/**
 * A dual-view (desktop table/mobile card) list component for displaying and managing inventory.
 * Provides inline actions for editing, adjusting stock, and deleting items.
 */
export const InventoryList: React.FC<InventoryListProps> = ({ items }) => {
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const executeDelete = async () => {
    if (itemToDelete) {
      await softDeleteInventoryItem(itemToDelete);
      setOpenDropdown(null);
      setItemToDelete(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-surface-container-lowest">
      
      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4 p-4">
        {items.map(item => (
          <div key={item.item_id} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-surface-container-high overflow-hidden border border-outline-variant/30 shrink-0 flex items-center justify-center">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                  ) : item.category ? (
                    <span className="font-headline-md text-primary font-bold text-lg">{item.category.charAt(0).toUpperCase()}</span>
                  ) : (
                    <span className="material-symbols-outlined text-outline-variant">inventory_2</span>
                  )}
                </div>
                <div>
                  <p className="font-headline-md text-[14px] font-bold text-primary">{item.name}</p>
                  <p className="font-code text-[10px] text-secondary tracking-widest uppercase">SKU: {item.item_id.substring(0, 8)}</p>
                </div>
              </div>
              <div className="relative">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === item.item_id ? null : item.item_id)}
                  className="p-2 hover:bg-surface-container rounded-full transition-colors active:scale-95"
                >
                  <span className="material-symbols-outlined text-secondary" data-icon="more_vert">more_vert</span>
                </button>
                {openDropdown === item.item_id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
                    <div className="absolute right-0 top-10 w-32 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg z-50 overflow-hidden py-1">
                      <button 
                        className="w-full text-left px-4 py-2 text-body-md hover:bg-surface-container transition-colors"
                        onClick={() => { setEditingItem(item); setOpenDropdown(null); }}
                      >
                        Edit Item
                      </button>
                      {item.item_type === ItemType.PRODUCT && (
                        <button 
                          className="w-full text-left px-4 py-2 text-body-md hover:bg-surface-container transition-colors"
                          onClick={() => { setAdjustingItem(item); setOpenDropdown(null); }}
                        >
                          Adjust Stock
                        </button>
                      )}
                      <div className="h-px w-full bg-outline-variant my-1"></div>
                      <button 
                        className="w-full text-left px-4 py-2 text-body-md text-error hover:bg-rose-50 transition-colors"
                        onClick={() => { setItemToDelete(item.item_id); setOpenDropdown(null); }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 bg-surface-container-low/50 rounded-lg p-3">
              <div>
                <p className="text-[10px] text-secondary uppercase tracking-wider mb-1">Category</p>
                <span className="px-2 py-0.5 rounded-full bg-primary-fixed/30 text-primary-fixed-dim text-[10px] font-bold uppercase tracking-wider">
                  {item.category || 'UNCATEGORIZED'}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-secondary uppercase tracking-wider mb-1">Price</p>
                <p className="font-body-md font-bold text-primary">{formatCurrency(item.selling_price)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] text-secondary uppercase tracking-wider mb-1">Stock Level</p>
                {item.item_type === ItemType.PRODUCT ? (
                  (() => {
                    const threshold = item.min_stock ?? 5;
                    const isLow = item.current_stock <= threshold;
                    return (
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                           <div 
                             className={`h-full rounded-full ${isLow ? 'bg-error' : (item.current_stock < threshold + 15 ? 'bg-amber-400' : 'bg-primary')}`} 
                             style={{ width: `${Math.min(100, Math.max(0, (item.current_stock / 500) * 100))}%` }}
                           ></div>
                        </div>
                        <span className="text-[10px] font-label-md font-bold text-primary w-24 text-right">
                          <span className={isLow ? 'text-error' : ''}>{item.current_stock}</span> / 500
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight ${isLow ? 'bg-error-container text-error' : 'bg-emerald-50 text-emerald-700'}`}>
                           {isLow ? 'LOW STOCK' : 'OPTIMAL'}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-secondary text-label-md">-</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-12 text-secondary font-body-md">
            No items found. Click "Add Product" to get started.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-surface-container-low z-10">
            <tr>
              <th className="px-6 py-4 border-b border-outline-variant text-[10px] font-label-md text-secondary uppercase tracking-wider w-12 text-center">
                <input type="checkbox" className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary" />
              </th>
              <th className="px-6 py-4 border-b border-outline-variant text-[10px] font-label-md text-secondary uppercase tracking-wider">Product & SKU</th>
              <th className="px-6 py-4 border-b border-outline-variant text-[10px] font-label-md text-secondary uppercase tracking-wider text-center">Category</th>
              <th className="px-6 py-4 border-b border-outline-variant text-[10px] font-label-md text-secondary uppercase tracking-wider text-right">Unit Price</th>
              <th className="px-6 py-4 border-b border-outline-variant text-[10px] font-label-md text-secondary uppercase tracking-wider text-center">Stock Level</th>
              <th className="px-6 py-4 border-b border-outline-variant text-[10px] font-label-md text-secondary uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 border-b border-outline-variant text-[10px] font-label-md text-secondary uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {items.map(item => (
              <tr key={item.item_id} className="hover:bg-surface-container-low transition-colors group">
                <td className="px-6 py-4 text-center">
                  <input type="checkbox" className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary" />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded bg-surface-container-high overflow-hidden border border-outline-variant/30 shrink-0 flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                      ) : item.category ? (
                        <span className="font-headline-md text-primary font-bold text-lg">{item.category.charAt(0).toUpperCase()}</span>
                      ) : (
                        <span className="material-symbols-outlined text-outline-variant">inventory_2</span>
                      )}
                    </div>
                    <div>
                      <p className="font-headline-md text-[14px] font-bold text-primary">{item.name}</p>
                      <p className="font-code text-[10px] text-secondary tracking-widest uppercase">SKU: {item.item_id.substring(0, 8)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-3 py-1 rounded-full bg-primary-fixed/30 text-primary-fixed-dim text-[10px] font-bold uppercase tracking-wider">
                    {item.category || 'UNCATEGORIZED'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-body-md text-body-md text-primary">
                  {formatCurrency(item.selling_price)}
                </td>
                <td className="px-6 py-4">
                  {item.item_type === ItemType.PRODUCT ? (
                    (() => {
                      const threshold = item.min_stock ?? 5;
                      const isLow = item.current_stock <= threshold;
                      return (
                        <div className="flex flex-col gap-1 w-32 mx-auto">
                          <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                             <div 
                               className={`h-full rounded-full ${isLow ? 'bg-error' : (item.current_stock < threshold + 15 ? 'bg-amber-400' : 'bg-primary')}`} 
                               style={{ width: `${Math.min(100, Math.max(0, (item.current_stock / 500) * 100))}%` }}
                             ></div>
                          </div>
                          <span className="text-[10px] font-label-md font-bold text-primary text-center">
                            <span className={isLow ? 'text-error' : ''}>{item.current_stock}</span> of 500 units
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center text-secondary text-label-md">-</div>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {item.item_type === ItemType.PRODUCT ? (
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight ${item.current_stock <= (item.min_stock ?? 5) ? 'bg-error-container text-error' : 'bg-emerald-50 text-emerald-700'}`}>
                       {item.current_stock <= (item.min_stock ?? 5) ? 'LOW STOCK' : 'OPTIMAL'}
                    </span>
                  ) : (
                    <span className="text-secondary text-label-md">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button 
                      title="Edit Item"
                      onClick={() => setEditingItem(item)}
                      className="p-1.5 hover:bg-surface-container text-secondary hover:text-primary rounded transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    {item.item_type === ItemType.PRODUCT && (
                      <button 
                        title="Adjust Stock"
                        onClick={() => setAdjustingItem(item)}
                        className="p-1.5 hover:bg-surface-container text-secondary hover:text-amber-600 rounded transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">tune</span>
                      </button>
                    )}
                    <button 
                      title="Delete Item"
                      onClick={() => setItemToDelete(item.item_id)}
                      className="p-1.5 hover:bg-rose-50 text-secondary hover:text-error rounded transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-secondary font-body-md">
                  No items found. Click "Add Product" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingItem && (
        <InventoryForm initialData={editingItem} onClose={() => setEditingItem(null)} categories={Array.from(new Set(items.map(item => item.category).filter(Boolean))) as string[]} />
      )}

      {adjustingItem && (
        <StockAdjustmentForm 
          item={adjustingItem} 
          onClose={() => setAdjustingItem(null)} 
          onSuccess={() => setAdjustingItem(null)}
        />
      )}

      <ConfirmationDialog
        isOpen={!!itemToDelete}
        title="Delete Item"
        message="Are you sure you want to delete this item? This will hide it from the catalog."
        confirmLabel="Delete"
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
        isDestructive={true}
      />
    </div>
  );
};
