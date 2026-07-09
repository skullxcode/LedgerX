import { useState, useEffect } from "react";
import { type InventoryItem, searchInventory } from '@ledgerx/firebase-shared';
import { useAuth } from '../../context/AuthContext';
import { usePOS } from '../../context/POSContext';

export const SearchDropdown: React.FC = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  
  const { addToCart } = usePOS();

  useEffect(() => {
    const fetchResults = async () => {
      if (profile?.store_id) {
        try {
          // Empty query to fetch all or recent items (searchInventory returns all if query is empty)
          const items = await searchInventory(profile.store_id, '');
          setProducts(items);
        } catch (error) {
          console.error("Fetch failed", error);
        }
      }
    };
    fetchResults();
  }, [profile?.store_id]);

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

  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const categories = ['All', ...uniqueCategories];
  
  const displayedProducts = activeCategory === 'All' 
    ? products 
    : products.filter(p => p.category === activeCategory);

  return (
    <section className="flex-1 overflow-y-auto p-gutter scrollbar-hide">
      {/* Categories Bar */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
              activeCategory === cat 
                ? 'bg-primary text-on-primary' 
                : 'bg-white border border-outline-variant text-secondary hover:bg-surface-container'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Bento Grid of Products */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayedProducts.map(item => (
          <div key={item.item_id} onClick={() => handleSelectItem(item)} className="bg-white border border-outline-variant rounded-xl p-4 group cursor-pointer hover:border-primary transition-all flex flex-col">
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
              <button className="h-8 w-8 bg-surface-container rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
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

      {/* Quick Add FAB */}
      <div className="fixed bottom-8 right-[444px] z-50">
        <button className="w-14 h-14 bg-primary text-on-primary rounded-full flex items-center justify-center hover:scale-105 transition-transform active:scale-95 group border border-primary-fixed-dim/20">
          <span className="material-symbols-outlined" data-icon="barcode_scanner">barcode_scanner</span>
          <span className="absolute right-full mr-4 bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">SCAN ITEM</span>
        </button>
      </div>
    </section>
  );
};
