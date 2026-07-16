import { useState, Suspense, lazy } from "react";
import { POSProvider } from './context/POSContext';
import { BusinessProvider } from './context/BusinessContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { Toaster } from 'react-hot-toast';

import { SearchDropdown } from './components/pos/SearchDropdown';
import { CheckoutPanel } from './components/pos/CheckoutPanel';
import { DeliveryChallan } from './components/pos/DeliveryChallan';

const InventoryDashboard = lazy(() => import('./components/inventory/InventoryDashboard').then(m => ({ default: m.InventoryDashboard })));
const KanbanBoard = lazy(() => import('./components/kanban/KanbanBoard').then(m => ({ default: m.KanbanBoard })));
const TransactionsDashboard = lazy(() => import('./components/transactions/TransactionsDashboard').then(m => ({ default: m.TransactionsDashboard })));
const CRMDashboard = lazy(() => import('./components/crm/CRMDashboard').then(m => ({ default: m.CRMDashboard })));
const SettingsDashboard = lazy(() => import('./components/settings/SettingsDashboard').then(m => ({ default: m.SettingsDashboard })));
const AnalyticsDashboard = lazy(() => import('./components/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));

import './index.css';

type TabType = 'ANALYTICS' | 'POS' | 'INVENTORY' | 'REPAIRS' | 'TRANSACTIONS' | 'CRM' | 'SETTINGS';

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabType>('ANALYTICS');
  const [challanTxId, setChallanTxId] = useState<string | null>(null);
  const [deepLinkCustomerId, setDeepLinkCustomerId] = useState<string | null>(null);
  const [deepLinkJobId, setDeepLinkJobId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }
  
  if (!profile) {
    // If loading is false but profile is still null, it means the user's Firestore profile is missing.
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="bg-surface p-8 rounded-2xl shadow-lg border border-outline-variant max-w-md w-full">
          <h2 className="text-2xl font-bold text-primary mb-2">Complete Your Profile</h2>
          <p className="text-on-surface-variant mb-6 text-sm">Your account exists, but your business profile is missing. Let's create it now.</p>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const businessName = fd.get('businessName') as string;
            if (!businessName) return;
            
            try {
              const { db } = await import('@/lib/firebase');
              const { doc, setDoc } = await import('firebase/firestore');
              
              const newStoreId = "STORE_" + Date.now();
              
              await setDoc(doc(db, "Users", user.uid), {
                uid: user.uid,
                store_id: newStoreId,
                role: 'ADMIN',
                phone: user.phoneNumber || ''
              });
              
              await setDoc(doc(db, "Settings", newStoreId), {
                business_id: newStoreId,
                store_id: newStoreId,
                business_name: businessName,
                owner_name: user.displayName || '',
                phone: user.phoneNumber || '',
                address: '', gstin: '', upi_id: '', bank_account: '', bank_ifsc: ''
              });
              
              window.location.reload();
            } catch (err: any) {
              alert("Failed to create profile: " + err.message);
            }
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Business Name</label>
              <input 
                name="businessName"
                required
                className="w-full border border-outline-variant rounded-lg p-3 bg-surface-container"
                placeholder="e.g. Acme Corp"
              />
            </div>
            
            <button 
              type="submit"
              className="w-full py-3 bg-primary text-on-primary rounded-lg font-bold"
            >
              Create Business Profile
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-outline-variant/30 text-center">
            <button 
              onClick={async () => {
                const { auth } = await import('@/lib/firebase');
                auth.signOut();
              }} 
              className="text-error font-medium"
            >
              Log Out Instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: { id: TabType; label: string; icon: string }[] = [
    { id: 'ANALYTICS', label: 'Dashboard', icon: 'dashboard' },
    { id: 'POS', label: 'Billing & Invoicing', icon: 'point_of_sale' },
    { id: 'INVENTORY', label: 'Inventory', icon: 'inventory_2' },
    { id: 'REPAIRS', label: 'Repairs', icon: 'build_circle' },
    { id: 'TRANSACTIONS', label: 'Transactions', icon: 'receipt_long' },
    { id: 'CRM', label: 'Customers', icon: 'group' },
    { id: 'SETTINGS', label: 'Settings', icon: 'settings' },
  ];

  const getSearchPlaceholder = () => {
    switch(activeTab) {
      case 'POS': return "Search products, SKUs, or barcodes...";
      case 'INVENTORY': return "Search inventory by name, SKU or category...";
      case 'SETTINGS': return "Search settings...";
      case 'REPAIRS': return "Search service tickets...";
      default: return "Search analytics, ledgers, or inventory...";
    }
  };

  return (
    <BusinessProvider>
      <POSProvider>
        <div className="bg-background font-body-md text-on-surface overflow-x-hidden min-h-screen flex">
          
          {/* Mobile Overlay */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* SideNavBar */}
          <aside className={`h-[100dvh] w-64 fixed left-0 top-0 bg-surface-container-lowest dark:bg-surface-container-low border-r border-outline-variant dark:border-outline flex flex-col py-10 px-4 z-50 transform transition-transform duration-300 md:translate-x-0 print:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="mb-10 px-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[18px]">account_balance_wallet</span>
              </div>
              <div>
                <h1 className="font-headline-md text-[18px] font-bold text-primary dark:text-on-primary-fixed">LedgerX</h1>
                <p className="font-label-md text-[10px] text-secondary tracking-wide">Enterprise Management</p>
              </div>
            </div>
            
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors duration-200 border-l-4 ${
                      isActive 
                        ? 'text-primary dark:text-on-primary-fixed font-bold border-primary bg-surface-container'
                        : 'text-secondary dark:text-on-secondary-container hover:bg-surface-container-low border-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined" data-icon={item.icon}>{item.icon}</span>
                    <span className="font-label-md text-label-md">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            
            <div className="mt-auto px-4 pb-4 pt-4">
              <button 
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white rounded font-label-md text-label-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
                onClick={() => {
                  setActiveTab('POS');
                  setIsMobileMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Transaction
              </button>
            </div>
          </aside>

          {/* Main Content Wrapper */}
          <main className={`md:ml-64 flex-1 h-[100dvh] flex flex-col relative overflow-hidden w-full print:m-0 print:h-auto print:overflow-visible ${challanTxId ? 'print:hidden' : ''}`}>
            {/* TopAppBar */}
            <header className="flex justify-between items-center w-full px-4 md:px-margin-desktop h-16 bg-surface-container-lowest dark:bg-surface-container-low border-b border-outline-variant dark:border-outline z-30 shrink-0 print:hidden">
              <div className="flex items-center flex-1 max-w-xl gap-2 md:gap-4">
                <button 
                  className="md:hidden text-secondary hover:bg-surface-container p-2 rounded-full active:scale-95 transition-transform shrink-0"
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
                <div className="hidden md:flex items-center gap-2">
                  <h2 className="font-headline-md text-primary font-bold">{navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-6 ml-2 md:ml-10">
                {/* Notifications and FAQ hidden per user request */}
                <div className="hidden items-center gap-4">
                  <button className="text-secondary hover:bg-surface-container p-2 rounded-full active:scale-95 transition-transform relative">
                    <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
                  </button>
                  <button className="text-secondary hover:bg-surface-container p-2 rounded-full active:scale-95 transition-transform">
                    <span className="material-symbols-outlined" data-icon="help_outline">help_outline</span>
                  </button>
                </div>
                <div className="hidden md:block h-8 w-[1px] bg-outline-variant"></div>
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('SETTINGS')}>
                  <div className="text-right hidden sm:block">
                    <p className="font-label-md text-primary font-bold group-hover:text-secondary transition-colors truncate max-w-[120px] md:max-w-[200px]">{(profile as any)?.owner_name || (profile as any)?.name || 'Admin'}</p>
                    <p className="font-label-md text-[10px] text-secondary uppercase">Administrator</p>
                  </div>
                  <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center overflow-hidden">
                    <span className="material-symbols-outlined text-secondary text-[20px] md:text-[24px]">person</span>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content Area - Full height to allow scrolling or fixed flex layouts internally */}
            <div className="flex-1 overflow-y-auto w-full h-full">
              <Suspense fallback={<div className="flex h-full items-center justify-center text-secondary font-body-md animate-pulse">Loading Module...</div>}>
              {activeTab === 'ANALYTICS' && (
                <div className="p-margin-desktop">
                  <AnalyticsDashboard onNavigate={(tab, id) => {
                    setActiveTab(tab as TabType);
                    if (tab === 'CRM' && id) setDeepLinkCustomerId(id);
                    if (tab === 'REPAIRS' && id) setDeepLinkJobId(id);
                  }} />
                </div>
              )}

              {activeTab === 'POS' && (
                <div className="flex flex-col lg:flex-row h-full w-full">
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <SearchDropdown />
                  </div>
                  <div className="w-full lg:w-[420px] shrink-0 h-[50vh] lg:h-full border-t lg:border-t-0 lg:border-l border-outline-variant z-10 bg-surface-container-lowest shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:shadow-none">
                    <CheckoutPanel onShowChallan={setChallanTxId} />
                  </div>
                </div>
              )}

              {activeTab === 'INVENTORY' && <InventoryDashboard />}

              {activeTab === 'REPAIRS' && (
                <div className="p-margin-desktop max-w-container-max mx-auto">
                  <KanbanBoard onSwitchToPOS={() => setActiveTab('POS')} initialJobId={deepLinkJobId} onClearDeepLink={() => setDeepLinkJobId(null)} />
                </div>
              )}

              {activeTab === 'TRANSACTIONS' && (
                <div className="p-margin-desktop h-[calc(100vh-4rem)]">
                  <TransactionsDashboard onViewTransaction={setChallanTxId} />
                </div>
              )}

              {activeTab === 'CRM' && (
                <div className="p-margin-desktop">
                  <CRMDashboard onViewTransaction={setChallanTxId} initialCustomerId={deepLinkCustomerId} />
                </div>
              )}

              {activeTab === 'SETTINGS' && (
                <div className="p-margin-desktop">
                  <SettingsDashboard />
                </div>
              )}
              </Suspense>
            </div>
          </main>

          {challanTxId && (
            <DeliveryChallan 
              transactionId={challanTxId} 
              onClose={() => setChallanTxId(null)} 
              onConvertToInvoice={() => {
                setChallanTxId(null);
                setActiveTab('POS');
              }}
            />
          )}
        </div>
      </POSProvider>
    </BusinessProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <MainApp />
    </AuthProvider>
  );
}

export default App;
