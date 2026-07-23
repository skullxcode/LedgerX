import { useState, useEffect, Suspense, lazy } from "react";
import { POSProvider } from './context/POSContext';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { NotificationDropdown } from './components/layout/NotificationDropdown';
import { HelpModal } from './components/layout/HelpModal';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useNotifications } from './hooks/queries/useNotifications';
import toast, { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AnimatePresence, motion } from 'framer-motion';

import { SearchDropdown } from './components/pos/SearchDropdown';
import { CheckoutPanel } from './components/pos/CheckoutPanel';
import { DeliveryChallan } from './components/pos/DeliveryChallan';
import { useInventory } from './hooks/queries/useInventory';
import { useDismissedNotifications } from './hooks/useDismissedNotifications';

// ============================================================================
// LAZY LOADED MODULES
// ============================================================================
const InventoryDashboard = lazy(() => import('./components/inventory/InventoryDashboard').then(m => ({ default: m.InventoryDashboard })));
const KanbanBoard = lazy(() => import('./components/kanban/KanbanBoard').then(m => ({ default: m.KanbanBoard })));
const TransactionsDashboard = lazy(() => import('./components/transactions/TransactionsDashboard').then(m => ({ default: m.TransactionsDashboard })));
const CRMDashboard = lazy(() => import('./components/crm/CRMDashboard').then(m => ({ default: m.CRMDashboard })));
const ExpensesDashboard = lazy(() => import('./components/expenses/ExpensesDashboard').then(m => ({ default: m.ExpensesDashboard })));
const SettingsDashboard = lazy(() => import('./components/settings/SettingsDashboard').then(m => ({ default: m.SettingsDashboard })));
const AnalyticsDashboard = lazy(() => import('./components/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));

import './index.css';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================
type TabType = 'ANALYTICS' | 'POS' | 'INVENTORY' | 'REPAIRS' | 'TRANSACTIONS' | 'CRM' | 'EXPENSES' | 'SETTINGS';

const NAV_ITEMS: { id: TabType; label: string; icon: string }[] = [
  { id: 'ANALYTICS', label: 'Dashboard', icon: 'dashboard' },
  { id: 'POS', label: 'Billing & Invoicing', icon: 'point_of_sale' },
  { id: 'INVENTORY', label: 'Inventory', icon: 'inventory_2' },
  { id: 'REPAIRS', label: 'Repairs', icon: 'build_circle' },
  { id: 'TRANSACTIONS', label: 'Transactions', icon: 'receipt_long' },
  { id: 'CRM', label: 'Customers', icon: 'group' },
  { id: 'EXPENSES', label: 'Expenses', icon: 'account_balance' },
  { id: 'SETTINGS', label: 'Settings', icon: 'settings' },
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Displays the business or owner name in the header, truncating if necessary.
 */
const HeaderProfileName = ({ defaultName }: { defaultName: string }) => {
  const { profile: businessProfile } = useBusiness();
  const displayName = businessProfile?.owner_name || businessProfile?.business_name || defaultName;

  return (
    <p className="font-label-md text-primary font-bold group-hover:text-secondary transition-colors truncate max-w-[120px] md:max-w-[200px]">
      {displayName}
    </p>
  );
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================

/**
 * Core application layout and routing component.
 * Handles authentication checks, profile verification, and main navigation.
 */
function MainApp() {
  // --- Navigation & Layout State ---
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const hash = window.location.hash.replace('#', '');
    if (['ANALYTICS', 'POS', 'INVENTORY', 'REPAIRS', 'TRANSACTIONS', 'CRM', 'EXPENSES', 'SETTINGS'].includes(hash)) {
      return hash as TabType;
    }
    return (localStorage.getItem('ledgerx_active_tab') as TabType) || 'ANALYTICS';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const { user, profile, loading } = useAuth();
  const { data: rawNotifications = [] } = useNotifications(profile?.store_id);
  // Global key listener for '?'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setIsHelpOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Feature State (Deep Links & Modals) ---
  const [challanTxId, setChallanTxId] = useState<string | null>(null);
  const [deepLinkCustomerId, setDeepLinkCustomerId] = useState<string | null>(null);
  const [deepLinkJobId, setDeepLinkJobId] = useState<string | null>(null);

  // --- Authentication State ---
  // (Moved to top of component)

  // --- Theme State ---
  const { theme, setTheme, isDark } = useTheme();

  // --- Low Stock Alert Badge ---
  const dismissedIds = useDismissedNotifications();
  // Filter dismissed notifications — same logic as NotificationDropdown for a consistent count
  const notifications = rawNotifications.filter(n => !dismissedIds.includes(n.id));
  const { data: inventoryItems = [] } = useInventory(profile?.store_id);
  const lowStockCount = inventoryItems.filter(item => {
    const threshold = item.min_stock ?? 5;
    const isLow = (item.current_stock ?? 0) <= threshold && item.is_active;
    const notifId = `stock-${item.item_id}`;
    return isLow && !dismissedIds.includes(notifId);
  }).length;

  /**
   * Persist active tab selection to local storage and update URL hash.
   */
  useEffect(() => {
    localStorage.setItem('ledgerx_active_tab', activeTab);
    window.location.hash = activeTab;
  }, [activeTab]);

  /**
   * Listen for browser back/forward navigation.
   */
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['ANALYTICS', 'POS', 'INVENTORY', 'REPAIRS', 'TRANSACTIONS', 'CRM', 'EXPENSES', 'SETTINGS'].includes(hash)) {
        setActiveTab(hash as TabType);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // ============================================================================
  // CONDITIONAL RENDERS (AUTH & ONBOARDING)
  // ============================================================================

  // 1. Show loading indicator while resolving auth state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="text-secondary font-medium animate-pulse">Loading Workspace...</span>
      </div>
    );
  }

  // 2. Redirect to Login if not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  // 3. Prompt for business profile creation if missing (Auth exists, but no Firestore profile)
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="bg-surface p-8 rounded-2xl shadow-lg border border-outline-variant max-w-md w-full">
          <h2 className="text-2xl font-bold text-primary mb-2">Complete Your Profile</h2>
          <p className="text-on-surface-variant mb-6 text-sm">
            Your account exists, but your business profile is missing. Let's create it now.
          </p>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const businessName = fd.get('businessName') as string;
            if (!businessName) return;

            try {
              const idToken = await user.getIdToken();
              const res = await fetch('/api/auth/create-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  idToken,
                  businessName,
                  phone: user.phoneNumber || '',
                  ownerName: user.displayName || ''
                })
              });

              if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create profile');
              }
              window.location.reload();
            } catch (error: any) {
              toast.error("Failed to create profile: " + error.message);
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

            <button type="submit" className="w-full py-3 bg-primary text-on-primary rounded-lg font-bold">
              Create Business Profile
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-outline-variant/30 text-center">
            <button
              onClick={async () => {
                const { signOut } = await import('@/lib/firebase/api/auth');
                signOut();
              }}
              className="text-error font-medium hover:underline"
            >
              Log Out Instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN APP RENDER
  // ============================================================================

  return (
    <BusinessProvider>
      <POSProvider>
        <div className="bg-background font-body-md text-on-surface overflow-x-hidden min-h-screen flex">

          {/* Mobile Overlay Background */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar Navigation */}
          <aside className={`h-[100dvh] w-64 fixed left-0 top-0 bg-surface-container-lowest dark:bg-surface-container-low border-r border-outline-variant dark:border-outline flex flex-col py-10 px-4 z-50 transform transition-transform duration-300 md:translate-x-0 print:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            {/* Logo & Branding */}
            <div className="mb-10 px-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary text-[18px]">account_balance_wallet</span>
              </div>
              <div>
                <h1 className="font-headline-md text-[18px] font-bold text-primary dark:text-on-primary-fixed">LedgerX</h1>
                <p className="font-label-md text-[10px] text-secondary tracking-wide">Enterprise Management</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors duration-200 border-l-4 ${isActive
                        ? 'text-primary dark:text-on-primary-fixed font-bold border-primary bg-surface-container'
                        : 'text-secondary dark:text-on-secondary-container hover:bg-surface-container-low border-transparent'
                      }`}
                  >
                    <span className="material-symbols-outlined" data-icon={item.icon}>{item.icon}</span>
                    <span className="font-label-md text-label-md">{item.label}</span>
                    {item.id === 'INVENTORY' && lowStockCount > 0 && (
                      <span className="ml-auto bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {lowStockCount > 99 ? '99+' : lowStockCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Action Button */}
            <div className="mt-auto px-4 pb-4 pt-4">
              <button
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-on-primary rounded font-label-md text-label-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
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

          {/* Main Content Area */}
          <main className={`md:ml-64 flex-1 h-[100dvh] flex flex-col relative overflow-hidden w-full print:m-0 print:h-auto print:overflow-visible ${challanTxId ? 'print:hidden' : ''}`}>

            {/* Header (TopAppBar) */}
            <header className="flex justify-between items-center w-full px-4 md:px-margin-desktop h-16 bg-surface-container-lowest dark:bg-surface-container-low border-b border-outline-variant dark:border-outline z-30 shrink-0 print:hidden">
              <div className="flex items-center flex-1 max-w-xl gap-2 md:gap-4">
                <button
                  className="md:hidden text-secondary hover:bg-surface-container p-2 rounded-full active:scale-95 transition-transform shrink-0"
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
                <div className="hidden md:flex items-center gap-2">
                  <h2 className="font-headline-md text-primary font-bold">{NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Dashboard'}</h2>
                </div>
              </div>

              {/* Header Actions & Profile */}
              <div className="flex items-center gap-2 md:gap-6 ml-2 md:ml-10">
                <div className="flex items-center gap-2 md:gap-4">
                  {/* Theme Toggle */}
                  <button
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className="text-secondary hover:bg-surface-container p-2 rounded-full active:scale-95 transition-transform relative"
                    title="Toggle Dark Mode"
                  >
                    <span className="material-symbols-outlined">
                      {isDark ? 'light_mode' : 'dark_mode'}
                    </span>
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                      className="hidden md:block text-secondary hover:bg-surface-container p-2 rounded-full active:scale-95 transition-transform relative"
                    >
                      <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
                      {notifications.length > 0 && (
                        <span className="absolute top-1 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-surface"></span>
                      )}
                    </button>
                    <NotificationDropdown
                      isOpen={isNotificationsOpen}
                      onClose={() => setIsNotificationsOpen(false)}
                      onNavigate={(tab, id) => {
                        setActiveTab(tab as TabType);
                        if (tab === 'CRM' && id) setDeepLinkCustomerId(id);
                        else if (tab === 'REPAIRS' && id) setDeepLinkJobId(id);
                      }}
                    />
                  </div>
                  <button
                    onClick={() => setIsHelpOpen(true)}
                    className="hidden md:block text-secondary hover:bg-surface-container p-2 rounded-full active:scale-95 transition-transform"
                    title="Keyboard Shortcuts & Help (?)"
                  >
                    <span className="material-symbols-outlined" data-icon="help_outline">help_outline</span>
                  </button>
                </div>
                <div className="hidden md:block h-8 w-[1px] bg-outline-variant"></div>

                {/* Profile Click Target */}
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('SETTINGS')}>
                  <div className="text-right hidden sm:block">
                    <HeaderProfileName defaultName={(profile as any)?.name || 'Admin'} />
                    <p className="font-label-md text-[10px] text-secondary uppercase">Administrator</p>
                  </div>
                  <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center overflow-hidden">
                    <span className="material-symbols-outlined text-secondary text-[20px] md:text-[24px]">person</span>
                  </div>
                </div>
              </div>
            </header>

            {/* Active Tab Content */}
            <div className="flex-1 overflow-y-auto w-full h-full relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full"
                >
                  <Suspense fallback={<div className="flex h-full items-center justify-center text-secondary font-body-md animate-pulse">Loading Module...</div>}>
                    {activeTab === 'ANALYTICS' && (
                      <div className="p-margin-desktop h-full">
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
                      <div className="p-margin-desktop max-w-container-max mx-auto h-full">
                        <KanbanBoard onSwitchToPOS={() => setActiveTab('POS')} initialJobId={deepLinkJobId} onClearDeepLink={() => setDeepLinkJobId(null)} />
                      </div>
                    )}

                    {activeTab === 'TRANSACTIONS' && (
                      <div className="p-margin-desktop h-full">
                        <TransactionsDashboard onViewTransaction={setChallanTxId} />
                      </div>
                    )}

                    {activeTab === 'CRM' && (
                      <div className="p-margin-desktop h-full">
                        <CRMDashboard onViewTransaction={setChallanTxId} initialCustomerId={deepLinkCustomerId} />
                      </div>
                    )}

                    {activeTab === 'EXPENSES' && (
                      <div className="p-margin-desktop h-full">
                        <ExpensesDashboard />
                      </div>
                    )}

                    {activeTab === 'SETTINGS' && (
                      <div className="p-margin-desktop h-full">
                        <SettingsDashboard />
                      </div>
                    )}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* Overlays / Modals */}
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
          <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        </div>
      </POSProvider>
    </BusinessProvider>
  );
}

// ============================================================================
// ROOT PROVIDER WRAPPER
// ============================================================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false, // We're using Firebase, so we don't want to over-fetch on focus
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <Toaster position="top-right" />
            <MainApp />
          </AuthProvider>
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
