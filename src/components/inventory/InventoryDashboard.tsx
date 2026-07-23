import { useState, useEffect, useMemo } from "react";
import { type InventoryItem, app, type Transaction } from '@/lib/firebase';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../hooks/queries/useInventory';
import { InventoryList } from './InventoryList';
import { InventoryForm } from './InventoryForm';
import { BulkImportModal } from './BulkImportModal';

/**
 * The main dashboard for managing the store's inventory.
 * Displays aggregate metrics, allows searching, and renders the `InventoryList`.
 */
export const InventoryDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { data: items = [], isLoading } = useInventory(profile?.store_id);
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [turnoverRate, setTurnoverRate] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const term = searchQuery.toLowerCase();
    return items.filter(item => 
      (item.name || '').toLowerCase().includes(term) ||
      (item.category || '').toLowerCase().includes(term) ||
      (item.item_id || '').toLowerCase().includes(term)
    );
  }, [items, searchQuery]);

  const totalValue = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.selling_price * (item.current_stock || 0)), 0);
  }, [items]);

  const lowStockCount = useMemo(() => {
    return items.filter(item => (item.current_stock ?? 0) < 5).length;
  }, [items]);

  const activeCategories = useMemo(() => {
    const categories = new Set(items.map(item => item.category).filter(Boolean));
    return categories.size;
  }, [items]);

  const totalUnits = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.current_stock || 0), 0);
  }, [items]);

  /**
   * Fetch total sales turnover periodically to calculate turnover rate against stock value.
   */
  useEffect(() => {
    const fetchTurnover = async () => {
      if (!profile?.store_id || totalValue === 0) return;
      try {
        const db = getFirestore(app);
        const txQ = query(collection(db, 'Transactions'), where('store_id', '==', profile.store_id));
        const txSnap = await getDocs(txQ);
        let totalSales = 0;
        txSnap.docs.forEach(doc => {
          const tx = doc.data() as Transaction;
          if (tx.status !== 'VOIDED') {
            totalSales += tx.total_amount;
          }
        });
        setTurnoverRate(totalSales / totalValue);
      } catch (e) {
        console.error("Failed to calculate turnover", e);
      }
    };
    fetchTurnover();
  }, [profile?.store_id, totalValue]);

  /**
   * Generates a CSV file from the current inventory items and prompts download.
   */
  const handleExportCSV = () => {
    if (items.length === 0) {
      alert("No inventory data to export");
      return;
    }
    const headers = "SKU,Name,Category,Type,Stock,Purchase Price,Selling Price,GST%\n";
    const rows = items.map(i => {
      return `${i.item_id},${i.name},${i.category || ''},${i.item_type},${i.current_stock},${i.purchase_price},${i.selling_price},${i.gst_rate}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventory_${new Date().toLocaleDateString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 lg:p-10 w-full flex flex-col h-[calc(100dvh-4rem)] overflow-y-auto">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">Inventory</h2>
          <p className="font-body-md text-body-md text-secondary mt-1">Managing {items.length} items across {activeCategories} {activeCategories === 1 ? 'category' : 'categories'}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto mt-4 md:mt-0">
          <div className="relative w-64 hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
            <input 
              className="w-full border border-outline-variant rounded py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md transition-colors"
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsImporting(true)}
            className="px-4 py-2 border border-outline-variant bg-surface-container-lowest text-secondary font-label-md rounded flex items-center gap-2 hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Import CSV
          </button>
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 border border-outline-variant bg-surface-container-lowest text-secondary font-label-md rounded flex items-center gap-2 hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <button 
            className="flex items-center gap-2 px-6 py-2 bg-primary text-on-primary font-label-md text-label-md rounded hover:opacity-90 transition-all"
            onClick={() => setIsAdding(true)}
          >
            <span className="material-symbols-outlined" data-icon="add_box">add_box</span>
            Add Product
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden relative w-full mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
        <input 
          className="w-full border border-outline-variant rounded py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md text-body-md bg-surface-container-lowest transition-colors"
          placeholder="Search inventory..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Dashboard Summary Bento (Mini) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-lg flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-label-md text-secondary uppercase tracking-widest mb-3">Total Value</p>
            <h3 className="text-headline-md font-headline-md font-bold text-primary">₹{totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-secondary">
            <span className="material-symbols-outlined text-[14px] text-on-tertiary-container">inventory_2</span>
            <span className="text-on-tertiary-container font-label-md">Based on current stock</span>
          </div>
        </div>
        
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-lg flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-label-md text-secondary uppercase tracking-widest mb-3">Total Units</p>
            <h3 className="text-headline-md font-headline-md font-bold text-primary">{totalUnits.toLocaleString()} Units</h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-secondary">
            <span className="material-symbols-outlined text-[14px] text-outline">widgets</span>
            <span className="font-label-md">Across {items.length} SKUs</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-lg flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-label-md text-secondary uppercase tracking-widest mb-3">Low Stock Alerts</p>
            <h3 className={`text-headline-md font-headline-md font-bold ${lowStockCount > 0 ? 'text-error' : 'text-primary'}`}>{lowStockCount} Items</h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-secondary">
            {lowStockCount > 0 ? (
              <><span className="material-symbols-outlined text-[14px] text-error">warning</span>
              <span className="text-error font-label-md">Immediate restock required</span></>
            ) : (
              <><span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
              <span className="text-emerald-600 font-label-md">All items sufficiently stocked</span></>
            )}
          </div>
        </div>
        
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-lg flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-label-md text-secondary uppercase tracking-widest mb-3">Active Categories</p>
            <h3 className="text-headline-md font-headline-md font-bold text-primary">{activeCategories} Groups</h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-secondary">
            <span className="material-symbols-outlined text-[14px] text-outline">category</span>
            <span>Manage via product edit</span>
          </div>
        </div>
        
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-lg flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-label-md text-secondary uppercase tracking-widest mb-3">Turnover Rate</p>
            <h3 className="text-headline-md font-headline-md font-bold text-primary">{turnoverRate.toFixed(2)}x</h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-secondary">
            <span className="material-symbols-outlined text-[14px] text-on-tertiary-container">bolt</span>
            <span className="text-on-tertiary-container font-label-md">Based on live sales</span>
          </div>
        </div>
      </div>

      {/* High Density Data Grid */}
      <div className="flex-1 bg-surface-container-lowest border border-outline-variant flex flex-col">
        <InventoryList items={filteredItems} />
      </div>

      {isAdding && (
        <InventoryForm onClose={() => setIsAdding(false)} categories={Array.from(new Set(items.map(item => item.category).filter(Boolean))) as string[]} />
      )}
      {isImporting && (
        <BulkImportModal onClose={() => setIsImporting(false)} />
      )}
    </div>
  );
};
