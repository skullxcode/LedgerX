import { useState, useEffect } from "react";
import { type InventoryItem, searchInventory, addInventoryItem, ItemType } from '@/lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { usePOS } from '../../context/POSContext';
import toast from 'react-hot-toast';
import { InventoryForm } from '../inventory/InventoryForm';

export const SearchDropdown: React.FC = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCustomProduct, setShowCustomProduct] = useState(false);

  // Custom Product State
  const [cpName, setCpName] = useState('');
  const [cpPrice, setCpPrice] = useState('');
  const [cpQty, setCpQty] = useState('1');
  const [cpGst, setCpGst] = useState('18');

  const { addToCart } = usePOS();

  useEffect(() => {
    const fetchResults = async () => {
      if (profile?.store_id) {
        try {
          const items = await searchInventory(profile.store_id, '');
          setProducts(items);
        } catch (error) {
          console.error("Fetch failed", error);
        }
      }
    };
    fetchResults();
  }, [profile?.store_id, showQuickAdd]);

  const handleSelectItem = (item: InventoryItem) => {
    addToCart({
      item_id: item.item_id,
      name: item.name,
      qty: 1,
      price: item.selling_price,
      gst_rate: item.gst_rate,
      is_custom: false,
      max_stock: item.current_stock,
      image_url: item.image_url,
      category: item.category,
    });
  };

  const handleQuickAddSuccess = (itemId: string, data: any) => {
    addToCart({
      item_id: itemId,
      name: data.name,
      qty: 1,
      price: data.selling_price,
      gst_rate: data.gst_rate,
      is_custom: false,
      max_stock: data.current_stock,
      category: data.category || 'Uncategorized'
    });
    setShowQuickAdd(false);
  };

  const handleCustomProduct = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const price = parseFloat(cpPrice);
      const qty = parseFloat(cpQty);
      const gst = parseFloat(cpGst);
      if (isNaN(price) || isNaN(qty) || isNaN(gst)) throw new Error("Invalid number formats");

      addToCart({
        item_id: `CUSTOM_${Date.now()}`,
        name: cpName,
        qty,
        price,
        gst_rate: gst,
        is_custom: true,
        category: 'Custom'
      });
      
      toast.success("Custom product added to cart");
      setShowCustomProduct(false);
      setCpName(''); setCpPrice(''); setCpQty('1'); setCpGst('18');
    } catch (error: any) {
      toast.error(error.message || "Failed to add custom product");
    }
  };

  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const categories = ['All', ...uniqueCategories];
  
  const displayedProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.item_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="flex-1 overflow-y-auto p-gutter scrollbar-hide relative">
      {/* Mobile-Visible Action Buttons */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button 
          className="flex-1 min-w-[140px] px-4 py-3 bg-surface-container-high border border-outline-variant text-primary font-label-md rounded flex items-center justify-center gap-2 hover:bg-surface-container transition-colors"
          onClick={() => setShowQuickAdd(true)}
        >
          <span className="material-symbols-outlined text-[18px]">add_box</span>
          Quick Add Product
        </button>
        <button 
          className="flex-1 min-w-[140px] px-4 py-3 bg-surface-container-high border border-outline-variant text-primary font-label-md rounded flex items-center justify-center gap-2 hover:bg-surface-container transition-colors"
          onClick={() => setShowCustomProduct(true)}
        >
          <span className="material-symbols-outlined text-[18px]">post_add</span>
          Custom Product
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary">search</span>
          <input 
            id="pos-search-input"
            type="text" 
            placeholder="Search inventory by name or SKU..." 
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-full py-3 pl-10 pr-4 text-body-md outline-none focus:border-primary transition-colors shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
              activeCategory === cat 
                ? 'bg-primary text-on-primary' 
                : 'bg-surface-container-lowest border border-outline-variant text-secondary hover:bg-surface-container'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Bento Grid of Products */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayedProducts.map(item => (
          <div key={item.item_id} onClick={() => handleSelectItem(item)} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 group cursor-pointer hover:border-primary transition-all flex flex-col">
            <div className="aspect-square bg-surface-container rounded-lg mb-4 overflow-hidden flex items-center justify-center relative">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
              ) : item.category ? (
                <span className="font-headline-md text-primary font-bold text-4xl opacity-50">{item.category.charAt(0).toUpperCase()}</span>
              ) : (
                <span className="material-symbols-outlined text-outline-variant text-4xl opacity-50">inventory_2</span>
              )}
            </div>
            <h3 className="font-body-md text-body-md font-bold text-primary mb-1 truncate">{item.name}</h3>
            <p className="text-[10px] text-secondary font-medium mb-3 uppercase tracking-tighter truncate">
              SKU: {item.item_id.substring(0, 8)} | Stock: {item.current_stock}
            </p>
            <div className="mt-auto flex justify-between items-center">
              <span className="font-headline-md text-headline-md text-primary">₹{item.selling_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              <button className="h-8 w-8 bg-surface-container rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-all">
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
          </div>
        ))}
        {displayedProducts.length === 0 && (
          <div className="col-span-full py-10 text-center text-secondary">
            No products in inventory. Go to Settings or Inventory to add items.
          </div>
        )}
      </div>

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <InventoryForm 
          onClose={() => setShowQuickAdd(false)} 
          onSuccess={handleQuickAddSuccess}
          categories={categories.filter(c => c !== 'All')}
        />
      )}

      {/* Custom Product Modal */}
      {showCustomProduct && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleCustomProduct} className="bg-surface-container-lowest rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-primary mb-4">Add Custom Product</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-secondary mb-1">Product/Service Name *</label>
                <input required type="text" value={cpName} onChange={e => setCpName(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-primary" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-secondary mb-1">Unit Price *</label>
                  <input required type="number" step="0.01" min="0" value={cpPrice} onChange={e => setCpPrice(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-primary" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-secondary mb-1">Quantity *</label>
                  <input required type="number" step="0.01" min="0" value={cpQty} onChange={e => setCpQty(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-secondary mb-1">GST Rate (%) *</label>
                <select required value={cpGst} onChange={e => setCpGst(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-primary bg-surface-container-lowest">
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowCustomProduct(false)} className="px-4 py-2 border rounded text-secondary hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded hover:bg-primary/90">Add to Cart</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
